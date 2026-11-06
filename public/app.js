const conversation = document.querySelector("#conversation");
const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const micButton = document.querySelector("#mic-button");
const speakToggle = document.querySelector("#speak-toggle");
const languageSelect = document.querySelector("#language-select");
const voiceNote = document.querySelector("#voice-note");
const voiceStatus = document.querySelector("#voice-status");
const voiceStatusLabel = document.querySelector("#voice-status-label");
const modeDescription = document.querySelector("#mode-description");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const jobsForm = document.querySelector("#jobs-form");
const searchButton = document.querySelector("#search-button");
const jobResults = document.querySelector("#job-results");

const modeDetails = {
  assistant: "A thoughtful assistant for whatever’s on your mind.",
  interview: "Practice one question at a time, then get useful feedback.",
  email: "Shape your thoughts into a clear, editable email draft."
};

let activeMode = "assistant";
const histories = { assistant: [], interview: [], email: [] };
let history = histories[activeMode];
let recognition;
let currentUtterance;
let isListening = false;

function preferredSpeechLanguage(text) {
  const preference = languageSelect.value;
  if (preference === "tamil" || /[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (preference === "tanglish") return "en-IN";
  if (preference === "english") return "en-IN";
  if (/\b(naan|neenga|neengal|unga|ungal|enna|epdi|eppadi|irukku|irukken|venum|pannunga|sari|illa|romba|nandri|vanakkam|aama|aamaam|seri|inga|anga|poga|varuven|solunga|sollunga|mudiyuma|konjam)\b/i.test(text)) {
    return "en-IN";
  }
  return "en-GB";
}

function recognitionLanguage(preference) {
  if (preference === "tamil") return "ta-IN";
  if (preference === "english" || preference === "tanglish") return "en-IN";
  return "en-IN";
}

languageSelect.addEventListener("change", () => {
  if (recognition && !isListening) recognition.lang = recognitionLanguage(languageSelect.value);
});

function setVoiceState(state) {
  const labels = {
    idle: "Ready",
    thinking: "Thinking",
    listening: "Listening",
    speaking: "Gopal speaking"
  };
  voiceStatus.dataset.state = state;
  voiceStatusLabel.textContent = labels[state] || labels.idle;
}

function showModeConversation(mode) {
  const greetings = {
    assistant: "Good day. I’m Gopal, your personal assistant. What may I help you with?",
    interview: "I’m ready when you are. Tell me your experience level, and we’ll begin with one coding question at a time.",
    email: "Tell me who you’re writing to and what you’d like to say. I’ll prepare a polished draft for your review."
  };
  conversation.replaceChildren();
  history = histories[mode];
  if (history.length === 0) {
    addMessage("assistant", greetings[mode]);
    return;
  }
  history.forEach((message) => addMessage(message.role, message.content));
}

function addMessage(role, text, { temporary = false } = {}) {
  const article = document.createElement("article");
  article.className = `message ${role === "assistant" ? "assistant-message" : "user-message"}`;
  if (temporary) article.classList.add("thinking-message");

  if (role === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "g";
    article.append(avatar);
  }

  const content = document.createElement("div");
  content.className = "message-content";
  const speaker = document.createElement("span");
  speaker.className = "speaker";
  speaker.append(document.createTextNode(role === "assistant" ? "Gopal " : "You "));
  const timestamp = document.createElement("span");
  timestamp.textContent = `· ${temporary ? "thinking…" : "just now"}`;
  speaker.append(timestamp);
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  content.append(speaker, paragraph);
  article.append(content);
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return article;
}

function speak(text) {
  if (!speakToggle.checked || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") {
    setVoiceState("idle");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;
  utterance.lang = preferredSpeechLanguage(text);
  utterance.rate = 0.94;
  utterance.pitch = 0.92;
  const voicePrefix = utterance.lang.toLowerCase();
  const matchingVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(voicePrefix));
  if (matchingVoice) utterance.voice = matchingVoice;
  utterance.onstart = () => {
    if (currentUtterance === utterance) setVoiceState("speaking");
  };
  utterance.onend = () => {
    if (currentUtterance === utterance) {
      currentUtterance = null;
      setVoiceState("idle");
    }
  };
  utterance.onerror = () => {
    if (currentUtterance === utterance) {
      currentUtterance = null;
      setVoiceState("idle");
    }
  };
  setVoiceState("speaking");
  window.speechSynthesis.speak(utterance);
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeMode = button.dataset.mode;
    showModeConversation(activeMode);
    modeButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    modeDescription.textContent = modeDetails[activeMode];
    if (activeMode === "interview") {
      messageInput.placeholder = "Choose your level or say “start” to begin…";
    } else if (activeMode === "email") {
      messageInput.placeholder = "Tell me who you’re writing to and what you want to say…";
    } else {
      messageInput.placeholder = "Tell me what you’re thinking…";
    }
    messageInput.focus();
  });
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled) return;

  const mode = activeMode;
  const conversationHistory = histories[mode];
  conversationHistory.push({ role: "user", content: text });
  addMessage("user", text);
  setVoiceState("thinking");
  messageInput.value = "";
  messageInput.style.height = "auto";
  sendButton.disabled = true;
  const pending = addMessage("assistant", "One moment…", { temporary: true });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, languagePreference: languageSelect.value, messages: conversationHistory })
    });
    const result = await response.json();
    pending.remove();
    if (!response.ok) throw new Error(result.error || "Something went wrong.");
    conversationHistory.push({ role: "assistant", content: result.reply });
    if (activeMode === mode) addMessage("assistant", result.reply);
    speak(result.reply);
  } catch (error) {
    pending.remove();
    conversationHistory.pop();
    setVoiceState("idle");
    if (activeMode === mode) addMessage("assistant", error.message || "I couldn't connect just now. Please try again.");
  } finally {
    sendButton.disabled = false;
    messageInput.focus();
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = recognitionLanguage(languageSelect.value);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener("start", () => {
    isListening = true;
    setVoiceState("listening");
    micButton.classList.add("listening");
  });
  recognition.addEventListener("result", (event) => {
    messageInput.value = event.results[0][0].transcript;
    messageInput.dispatchEvent(new Event("input"));
    messageInput.focus();
    voiceNote.textContent = "Voice captured. Review it, then send when you’re ready.";
  });
  recognition.addEventListener("error", (event) => {
    voiceNote.textContent = event.error === "not-allowed"
      ? "Microphone permission was denied. You can still type your message."
      : "Voice input didn’t work this time. You can still type your message.";
    isListening = false;
    micButton.classList.remove("listening");
    setVoiceState("idle");
  });
  recognition.addEventListener("end", () => {
    isListening = false;
    micButton.classList.remove("listening");
    if (voiceStatus.dataset.state === "listening") setVoiceState("idle");
  });
  micButton.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
      voiceNote.textContent = "Voice input stopped.";
      return;
    }
    try {
      if (currentUtterance && "speechSynthesis" in window) {
        currentUtterance = null;
        window.speechSynthesis.cancel();
      }
      isListening = true;
      recognition.start();
      voiceNote.textContent = "Listening now. Tap the microphone only when you want to speak.";
    } catch {
      isListening = false;
      micButton.classList.remove("listening");
      setVoiceState("idle");
      voiceNote.textContent = "Voice input is already active. Finish speaking or try again in a moment.";
    }
  });
} else {
  micButton.disabled = true;
  micButton.title = "Voice input is not supported in this browser";
  micButton.setAttribute("aria-label", "Voice input is not supported in this browser");
  voiceNote.textContent = "Voice input isn’t available in this browser. You can still type in English, Tamil, or Tanglish.";
}

speakToggle.addEventListener("change", () => {
  if (!speakToggle.checked && currentUtterance) {
    currentUtterance = null;
    window.speechSynthesis.cancel();
    setVoiceState("idle");
  }
});

jobsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = document.querySelector("#job-query").value.trim();
  const location = document.querySelector("#job-location").value.trim();
  searchButton.disabled = true;
  jobResults.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "job-status";
  loading.textContent = "Looking through public listings…";
  jobResults.append(loading);

  try {
    const params = new URLSearchParams({ q: query, location });
    const response = await fetch(`/api/jobs?${params}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Search could not be completed.");
    renderJobs(result.jobs);
  } catch (error) {
    const message = document.createElement("p");
    message.className = "job-status error";
    message.textContent = error.message || "Search could not be completed.";
    jobResults.replaceChildren(message);
  } finally {
    searchButton.disabled = false;
  }
});

function renderJobs(jobs) {
  jobResults.replaceChildren();
  if (!jobs.length) {
    const empty = document.createElement("p");
    empty.className = "job-status";
    empty.textContent = "No matching public listings found. Try a broader role or location.";
    jobResults.append(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "job-list";
  jobs.forEach((job) => {
    const card = document.createElement("article");
    card.className = "job-card";
    const title = document.createElement("h3");
    title.textContent = job.title;
    const company = document.createElement("p");
    company.className = "job-company";
    company.textContent = `${job.company} · ${job.location}${job.remote ? " · Remote" : ""}`;
    card.append(title, company);
    if (job.description) {
      const description = document.createElement("p");
      description.className = "job-description";
      description.textContent = job.description;
      card.append(description);
    }
    if (job.url) {
      const link = document.createElement("a");
      link.href = job.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View listing ↗";
      card.append(link);
    }
    list.append(card);
  });
  jobResults.append(list);
}
