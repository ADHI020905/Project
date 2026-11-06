const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const MODES = new Set(["assistant", "interview", "email"]);
const LANGUAGE_PREFERENCES = new Set(["auto", "english", "tamil", "tanglish"]);
const PERSONA_PROMPT =
  "You are Gopal, a polished personal AI assistant with a calm, composed, precise, quietly confident manner. Understand and speak English, Tamil, and Tanglish (Tamil spoken or written using Latin letters, often mixed with English). Match the user's language and writing script: use natural English for English, natural Tamil in Tamil script when the user writes Tamil script, and conversational Tanglish in Latin letters when the user writes Tanglish. For mixed-language messages, mirror the user's dominant language and script. Keep responses clear and concise; be tactful and lightly witty only when natural. Address the user as 'sir' sparingly and only when it fits. Do not impersonate an existing fictional character or repeat signature catchphrases.";
const MODE_PROMPTS = {
  assistant:
    "Act as a thoughtful personal assistant. Help the user plan, think, and communicate. Do not claim to have performed actions outside this chat.",
  interview:
    "Act as a patient mock coding interviewer. Ask one coding interview question at a time, wait for the candidate's answer, and give constructive feedback on correctness, complexity, and communication. Adapt to the candidate's level. Do not reveal a full solution before they have tried.",
  email:
    "Act as an email-writing assistant. Help the user produce clear, polished, editable email drafts. Ask for missing context when needed. Never send email or claim a draft was sent."
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function makeSearchText(job) {
  return [
    job.title,
    job.company_name,
    job.location,
    job.description,
    ...(Array.isArray(job.tags) ? job.tags : []),
    ...(Array.isArray(job.job_types) ? job.job_types : [])
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function matchesTerms(text, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => text.includes(term));
}

function createServer({
  env = process.env,
  fetchImpl = globalThis.fetch,
  publicDir = path.join(__dirname, "public")
} = {}) {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");

      if (request.method === "POST" && requestUrl.pathname === "/api/chat") {
        const body = await readJson(request);
        const mode = normalizedText(body.mode);
        const languagePreference = normalizedText(body.languagePreference || "auto");
        const messages = body.messages;

        if (!MODES.has(mode) || !LANGUAGE_PREFERENCES.has(languagePreference) || !Array.isArray(messages) || messages.length === 0) {
          sendJson(response, 400, { error: "Choose a valid assistant mode and language, and send at least one message." });
          return;
        }

        const safeMessages = messages.slice(-12).map((message) => {
          if (
            !message ||
            !["user", "assistant"].includes(message.role) ||
            typeof message.content !== "string" ||
            message.content.trim().length === 0 ||
            message.content.length > 8000
          ) {
            return null;
          }
          return { role: message.role, content: message.content.trim() };
        });

        if (safeMessages.some((message) => message === null) || safeMessages.at(-1)?.role !== "user") {
          sendJson(response, 400, { error: "Messages must contain valid user and assistant text, ending with a user message." });
          return;
        }

        if (!env.AI_API_KEY) {
          sendJson(response, 503, { error: "Gopal's AI is not configured yet. Add AI_API_KEY to the server environment." });
          return;
        }

        const baseUrl = (env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
        let upstream;
        try {
          upstream = await fetchImpl(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.AI_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: env.AI_MODEL || "gpt-4o-mini",
              messages: [{
                role: "system",
                content: `${PERSONA_PROMPT} ${languagePreference === "auto"
                  ? "Automatically detect the user's language from their messages and reply in that same language and script."
                  : `The user selected ${languagePreference}. Reply in ${languagePreference === "tamil" ? "Tamil using Tamil script" : languagePreference === "tanglish" ? "conversational Tanglish using Latin letters" : "English"}, even if prior context used a different language.`} ${MODE_PROMPTS[mode]}`
              }, ...safeMessages],
              temperature: mode === "interview" ? 0.6 : 0.7
            }),
            signal: AbortSignal.timeout(20000)
          });
        } catch (error) {
          console.error("AI provider request failed:", error.message);
          sendJson(response, 502, { error: "Gopal couldn't reach the AI service. Check the server configuration and try again." });
          return;
        }

        if (!upstream.ok) {
          console.error(`AI provider returned HTTP ${upstream.status}.`);
          sendJson(response, 502, { error: "The AI service could not complete this request. Try again in a moment." });
          return;
        }

        let result;
        try {
          result = await upstream.json();
        } catch {
          sendJson(response, 502, { error: "The AI service returned an unreadable response." });
          return;
        }

        const reply = result?.choices?.[0]?.message?.content;
        if (typeof reply !== "string" || reply.trim().length === 0) {
          sendJson(response, 502, { error: "The AI service did not return a response." });
          return;
        }
        sendJson(response, 200, { reply: reply.trim() });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/jobs") {
        const query = normalizedText(requestUrl.searchParams.get("q")).slice(0, 120);
        const location = normalizedText(requestUrl.searchParams.get("location")).slice(0, 120);
        let upstream;
        try {
          upstream = await fetchImpl("https://www.arbeitnow.com/api/job-board-api", {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000)
          });
        } catch (error) {
          console.error("Job search request failed:", error.message);
          sendJson(response, 502, { error: "The public job-listing service is unavailable. Try again later." });
          return;
        }

        if (!upstream.ok) {
          console.error(`Job search source returned HTTP ${upstream.status}.`);
          sendJson(response, 502, { error: "The public job-listing source could not complete this search." });
          return;
        }

        let result;
        try {
          result = await upstream.json();
        } catch {
          sendJson(response, 502, { error: "The public job-listing source returned unreadable data." });
          return;
        }

        if (!Array.isArray(result?.data)) {
          sendJson(response, 502, { error: "The public job-listing source returned an unexpected response." });
          return;
        }

        const jobs = result.data
          .filter((job) => {
            const text = makeSearchText(job);
            const jobLocation = `${String(job.location || "")}${job.remote ? " remote" : ""}`.toLowerCase();
            return matchesTerms(text, query) && matchesTerms(jobLocation, location);
          })
          .slice(0, 30)
          .map((job) => ({
            title: typeof job.title === "string" ? job.title : "Untitled role",
            company: typeof job.company_name === "string" ? job.company_name : "Company not listed",
            location: typeof job.location === "string" ? job.location : "Location not listed",
            description: typeof job.description === "string" ? job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280) : "",
            url: typeof job.url === "string" ? job.url : "",
            remote: Boolean(job.remote),
            postedAt: typeof job.created_at === "string" ? job.created_at : ""
          }))
          .filter((job) => job.url.startsWith("https://"));

        sendJson(response, 200, {
          jobs,
          source: "Arbeitnow public job board",
          sourceUrl: "https://www.arbeitnow.com/",
          notice: "These are public job listings, not verified campus or off-campus drives. Confirm details with the employer."
        });
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Method not allowed." });
        return;
      }

      let pathname;
      try {
        pathname = decodeURIComponent(requestUrl.pathname);
      } catch {
        sendJson(response, 400, { error: "Invalid URL path." });
        return;
      }

      const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const filePath = path.resolve(publicDir, relativePath);
      const relativeFilePath = path.relative(publicDir, filePath);
      if (relativeFilePath.startsWith("..") || path.isAbsolute(relativeFilePath)) {
        sendJson(response, 404, { error: "Not found." });
        return;
      }

      let content;
      try {
        content = await fs.readFile(filePath);
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "EISDIR") {
          sendJson(response, 404, { error: "Not found." });
          return;
        }
        throw error;
      }
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      console.error("Request handling failed:", error.message);
      if (!response.headersSent) {
        sendJson(response, error.statusCode || 500, {
          error: error.statusCode ? error.message : "The server could not complete this request."
        });
      } else {
        response.destroy();
      }
    }
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const server = createServer();
  const host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`Gopal is ready at http://${host}:${port}`);
  });
}

module.exports = { createServer };
