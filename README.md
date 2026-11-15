# Internship Portal: production-ready capstone

A full-stack internship portal built in four milestones: a responsive board (plain HTML/CSS/JS), a REST API (Express + SQLite), a secure application form, and this capstone pass for deployment, observability and quality checks. All data is fictional (EdVyro training material).

| | |
|---|---|
| **Live app** | https://secure-internship-app.onrender.com |
| **Health check** | https://secure-internship-app.onrender.com/healthz |
| **Repository** | https://github.com/ammangour01-creator/secure-internship-app |
| **2-minute walkthrough** | https://youtu.be/OyQgrkO-9gY (script: [WALKTHROUGH.md](WALKTHROUGH.md)) |
| **Engineering decisions** | [docs/DECISIONS.md](docs/DECISIONS.md) |
| **Quality evidence** | [docs/CHECKS.md](docs/CHECKS.md), [TEST-REPORT.md](TEST-REPORT.md), [SECURITY.md](SECURITY.md) |

The free Render plan sleeps when idle, so the first visit can take 30 to 60 seconds.

## User journey
Browse → search and filter (domain, work mode) → open details → apply → clear success or error message.
- List states: **loading** (skeletons), **empty**, **error with Try again**, pagination that moves keyboard focus to the results.
- Filters and page live in the URL (`?q=&domain=&mode=&page=`), so refresh, back and shared links keep the view.
- Application form validated in the browser and again on the server (missing name, invalid email, unsafe URL, duplicate, closed internship).
- Works from 360px to desktop with no horizontal scroll; fully keyboard operable.

## Architecture
```
Browser ── client/ (index.html, style.css, app.js)         one origin, no CORS needed
   │
   └── Express app (server/src/app.js) ── security headers ─ rate limits ─ validation ─ routes
                                              │
                                              └── SQLite via better-sqlite3 (parameterized queries only)
```
One Node process serves the frontend and the API. Details and trade-offs: [docs/DECISIONS.md](docs/DECISIONS.md).

## Quick start
Requires Node.js 18 or newer.
```bash
npm install
npm run db:schema   # creates server/data/internships.db from server/schema.sql
npm run seed        # INT-001..004 (SQL sample) and INT-101..105 (JSON sample); safe to repeat
npm start           # http://localhost:3000
npm test            # all tests
```
The server also seeds an empty database on start, so a fresh deployment is never blank.

## Configuration (`.env.example`, no secrets)
The app reads real environment variables (it has no `.env` loader). Set them in your shell or hosting dashboard, for example `PORT=4000 npm start`.

| Name | Purpose | Default |
|---|---|---|
| `PORT` | Port to listen on | 3000 |
| `DB_FILE` | SQLite file path | `server/data/internships.db` |
| `ADMIN_API_KEY` | Enables create/update/delete of internships via the `x-api-key` header | empty (routes disabled) |
| `TRUST_PROXY` | Set to `1` behind a proxy (Render) so rate limits use the real client IP | empty |
| `LOG_LEVEL` | `debug`, `info`, `warn` or `error` | `info` |

## API
Envelope: `{ "status": "success", "data": …, "pagination": … }` or `{ "status": "error", "error": { "code", "message", "request_id", "details" } }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/internships?page&limit&domain&mode&q` | list, `limit` 1 to 50 |
| GET | `/api/internships/:id` | detail |
| GET | `/api/filters` | domains and modes for the dropdowns |
| POST | `/api/applications` | `{ internship_id, name, email, portfolio_url? }` → 201, 400, 404, 409 (duplicate or closed), 429 |
| POST / PUT / DELETE | `/api/internships[/:id]` | needs `x-api-key` |
| GET | `/healthz` | liveness: process is up (used by Render) |
| GET | `/readyz` | readiness: the database answers, otherwise 503 |

```bash
curl https://secure-internship-app.onrender.com/readyz
curl -X POST https://secure-internship-app.onrender.com/api/applications -H "Content-Type: application/json" \
  -d '{"internship_id":"INT-101","name":"Asha Verma","email":"asha@example.com","portfolio_url":"https://example.com/asha"}'
```

## Logging and health checks
- One JSON line per event with `time`, `level` and `event`. Request lines hold only `id`, `method`, `path` (no query string), `status` and `ms`. Level follows the status: 2xx/3xx `info`, 4xx `warn`, 5xx `error`.
- Every response has an `X-Request-Id` header, and API errors repeat it as `error.request_id`, so a user can quote it and you can find the exact log line.
- Bodies, headers, emails, names, URLs, passwords and tokens never reach the logs (a redaction filter is a second safety net).
- Startup, shutdown and unexpected errors are logged as events (`server_started`, `shutdown_started`, `unhandled_error`, …).
- On `SIGTERM` (every Render deploy) the server stops accepting requests, finishes running ones, closes the database and exits.

## Quality checks
| Area | What is checked | Where |
|---|---|---|
| Regression | 64 automated tests: validation, API (real Express + SQLite), security, logging, static guards, contrast | `npm test`, [TEST-REPORT.md](TEST-REPORT.md) |
| Accessibility | labels, landmarks, dialog focus handling, live regions, WCAG contrast computed from the real CSS, keyboard-only flow, 360px | [docs/CHECKS.md](docs/CHECKS.md) |
| Performance | whole frontend is about 21 KB (7 KB gzip), no framework, no external requests, ETag revalidation | [docs/CHECKS.md](docs/CHECKS.md) |
| Security | rate limits, secure headers and CSP, parameterized queries, server-side validation, safe logs | [SECURITY.md](SECURITY.md) |

## Known limitations
- The free Render disk is not persistent: applications can be lost on a redeploy. For real use, move to PostgreSQL or a persistent disk.
- The rate limiter keeps counts in memory (per instance, reset on restart).
- No login and no email verification.

## Project structure
```
client/            index.html, style.css, app.js (no framework, no inline scripts)
server/server.js   starts the app, graceful shutdown
server/src/        app.js (routes, health), applicationValidate.js, validate.js, security.js, logger.js, db.js
server/schema.sql  tables (applications has UNIQUE(internship_id, applicant_email))
server/seed/       seed.js, seed.sql, internships.json
tests/             validation, security, logging, contrast, static (unit) and api (integration)
docs/              DECISIONS.md, CHECKS.md, screenshots/
render.yaml        Render blueprint (health check path /healthz)
```

## Deploy on Render
1. Push to GitHub. 2. Render → New → Web Service (or Blueprint using `render.yaml`): build `npm install`, start `npm start`, health check path `/healthz`, env `TRUST_PROXY=1`. 3. Open the URL and `/readyz`.
