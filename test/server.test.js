const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("../server");

let server;
let origin;
let fetchCalls;
let env;
let aiUnavailable;
let jobsUnavailable;

before(async () => {
  fetchCalls = [];
  env = {};
  aiUnavailable = false;
  jobsUnavailable = false;
  server = createServer({
    env,
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      if (url === "https://www.arbeitnow.com/api/job-board-api") {
        if (jobsUnavailable) return new Response("unavailable", { status: 503 });
        return Response.json({
          data: [
            {
              title: "Frontend Engineer",
              company_name: "Acme",
              location: "Bengaluru, India",
              description: "<p>Build <strong>web</strong> products.</p>",
              url: "https://jobs.example.test/frontend",
              remote: false,
              created_at: "2026-01-01"
            },
            {
              title: "Backend Engineer",
              company_name: "Other",
              location: "Berlin",
              description: "Server role",
              url: "https://jobs.example.test/backend",
              remote: true
            },
            {
              title: "Invalid link",
              company_name: "Unsafe",
              location: "Bengaluru",
              url: "javascript:alert(1)"
            }
          ]
        });
      }
      if (aiUnavailable) return new Response("unavailable", { status: 503 });
      return Response.json({ choices: [{ message: { content: "Hello from Gopal." } }] });
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("serves the assistant web app", async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /Gopal — your voice-first assistant/);
});

test("requires server-side AI configuration before calling a model", async () => {
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "assistant", messages: [{ role: "user", content: "Hi" }] })
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /AI_API_KEY/);
  assert.equal(fetchCalls.length, 0);
});

test("forwards valid chat to the configured AI provider with the selected mode", async () => {
  env.AI_API_KEY = "test-key-not-a-real-secret";
  env.AI_BASE_URL = "https://ai.example.test/v1/";
  env.AI_MODEL = "test-model";

  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "interview",
      languagePreference: "tanglish",
      messages: [
        { role: "assistant", content: "Let's begin with arrays." },
        { role: "user", content: "Start a coding interview." }
      ]
    })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: "Hello from Gopal." });
  const call = fetchCalls.at(-1);
  assert.equal(call.url, "https://ai.example.test/v1/chat/completions");
  assert.equal(call.options.headers.Authorization, "Bearer test-key-not-a-real-secret");
  const payload = JSON.parse(call.options.body);
  assert.equal(payload.model, "test-model");
  assert.match(payload.messages[0].content, /mock coding interviewer/i);
  assert.match(payload.messages[0].content, /calm, composed, precise/i);
  assert.match(payload.messages[0].content, /do not impersonate/i);
  assert.match(payload.messages[0].content, /understand and speak English, Tamil, and Tanglish/i);
  assert.match(payload.messages[0].content, /conversational Tanglish using Latin letters/i);
  assert.deepEqual(payload.messages.slice(1), [
    { role: "assistant", content: "Let's begin with arrays." },
    { role: "user", content: "Start a coding interview." }
  ]);
});

test("validates chat input", async () => {
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "email", messages: [{ role: "user", content: " " }] })
  });
  assert.equal(response.status, 400);
});

test("rejects unsupported response language preferences", async () => {
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "assistant",
      languagePreference: "klingon",
      messages: [{ role: "user", content: "Hi" }]
    })
  });
  assert.equal(response.status, 400);
});

test("surfaces AI provider failures without returning a successful response", async () => {
  aiUnavailable = true;
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "email", messages: [{ role: "user", content: "Draft an email." }] })
  });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /AI service could not complete/i);
  aiUnavailable = false;
});

test("filters public job listings and excludes unsafe listing URLs", async () => {
  fetchCalls.length = 0;
  const response = await fetch(`${origin}/api/jobs?q=frontend&location=bengaluru`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].title, "Frontend Engineer");
  assert.equal(result.jobs[0].description, "Build web products.");
  assert.match(result.notice, /not verified campus or off-campus drives/i);

  const remoteResponse = await fetch(`${origin}/api/jobs?q=backend&location=remote`);
  assert.equal(remoteResponse.status, 200);
  assert.equal((await remoteResponse.json()).jobs[0].title, "Backend Engineer");
});

test("surfaces public job source failures", async () => {
  jobsUnavailable = true;
  const response = await fetch(`${origin}/api/jobs?q=engineer`);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /public job-listing source/i);
  jobsUnavailable = false;
});

test("returns a clear error for unknown routes", async () => {
  const response = await fetch(`${origin}/does-not-exist`);
  assert.equal(response.status, 404);
});
