# BUGDETECT AI

Evidence-first bug-report management. The application currently provides account registration and login, private repository labels, and owner-authorized bug-report tracking. GitHub App access, AI investigations, patch generation, and sandbox execution are **not implemented**; creating a repository here does not connect to GitHub or run code.

This is an early local-development foundation, not a production-ready deployment. Before exposing it to a network, add and verify the planned abuse/rate controls, operational monitoring and shared session strategy, production TLS/cookie configuration, account recovery policy, and remaining security/release gates.

## Run locally

Requirements: Java 21 or later, Maven 3.9+, Node.js 22+, and npm. The API uses a local H2 file database by default; PostgreSQL is supported by setting the database environment variables.

Start the API in one terminal:

```powershell
cd backend
mvn spring-boot:run
```

If port 8080 is already in use, set `$env:PORT = "18080"` in PowerShell before starting the API. Start the web application in another terminal from the repository root:

```powershell
npm install
npm run dev
```

If you changed the API port, set `$env:API_PROXY_TARGET = "http://127.0.0.1:18080"` before starting Vite.

Open the Vite URL printed in the terminal (normally `http://127.0.0.1:5173`). Register an account, add a local repository label in `owner/repository` format, then create and update bug reports.

The local database is written under `backend/data/` and is ignored by Git. To use PostgreSQL, create the database and set `DATABASE_URL` (for example `jdbc:postgresql://localhost:5432/bugdetect`), `DATABASE_USERNAME`, and `DATABASE_PASSWORD` in the API process environment. Flyway owns schema creation; do not use Hibernate schema auto-update.

## Checks

```powershell
npm test
npm run build
cd backend
mvn test
```

## Current implementation boundary

The Java API is the system of record. Browser authentication uses server-side sessions, an `HttpOnly` session cookie, and CSRF tokens for state-changing requests. User-owned repositories and bug reports are persisted with Flyway migrations. The current repository entry is only a local label. No GitHub credentials, model provider, queue, AI worker, investigation, patch, or sandbox runner is configured. Do not execute untrusted repository code through this version.

See [the architecture](docs/architecture.md) and [the proposed software process](docs/software-process.md) for the intended system and delivery gates.
