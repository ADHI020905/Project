# Gopal

Gopal is a voice-first web assistant for personal requests, mock coding interviews, email drafting, and searching public job listings. Voice input is user-initiated; the app does not continuously listen for a wake phrase. Email mode creates editable drafts only and does not send them.

## Requirements

- Node.js 20 or newer
- An API key for an OpenAI-compatible chat-completions service to generate assistant responses

## Run locally

Set the AI configuration in the server environment, then start the app:

```powershell
$env:AI_API_KEY = "your-provider-key"
$env:AI_BASE_URL = "https://api.openai.com/v1"
$env:AI_MODEL = "gpt-4o-mini"
npm start
```

Open <http://localhost:3000>. `AI_BASE_URL` defaults to `https://api.openai.com/v1`; set it to the API's base URL (not the `/chat/completions` path) for another compatible provider. The API key is used only by the server and is never sent to the browser. Do not commit credentials.

The app also runs without an AI key so the interface and public job search can be explored; chat requests return an explicit configuration message until a key is set. The server binds to `127.0.0.1` by default; set `HOST` only when intentionally exposing it on another interface.

## Voice

Microphone input uses the browser's Web Speech recognition implementation when available. It starts only after the user taps the microphone and the browser grants permission. Browsers without recognition can still use typed chat. Spoken responses use the browser's speech synthesis when supported and can be turned off in the conversation controls.

Choose **Auto-detect**, **English**, **தமிழ்**, or **Tanglish** in the language selector. Auto-detect asks Gopal to match the language and script of your message; selecting a language asks for replies in that language, including Tamil script or Latin-letter Tanglish. The selected language also guides speech recognition and speech output. Actual Tamil and Indian-English speech voices depend on the voices installed in the browser or operating system; Tanglish is spoken using the closest available Indian-English voice.

## Public job search

Search requests use the public Arbeitnow job-board API and are made only when the user submits a search. Results link back to the listing source. This source is not a verified campus-drive feed; confirm eligibility, dates, and application details with the employer.

## Tests

Run the server and API tests with:

```powershell
npm test
```
