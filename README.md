# Secure Internship Board (Task 04)

One repository: the responsive internship board (Task 02) connected to the Express + SQLite API (Task 03), plus a secure application form.
All data is fictional (EdVyro training material).

| | |
|---|---|
| **Live app** | _add your Render URL here_ |
| **Repository** | _add your GitHub URL here_ |
| **2-minute walkthrough** | _add your video link here_ (script in [WALKTHROUGH.md](WALKTHROUGH.md)) |

## What it does
- Loads internships from the API with **loading, empty, error and Retry** states, search, domain and work-mode filters, and pagination.
- Details dialog (keyboard accessible) with an **application form** validated in the browser and again on the server.
- API protected with **rate limits, secure headers, parameterized queries**, safe logging and a write key. See [SECURITY.md](SECURITY.md).
- Automated tests and a [test report](TEST-REPORT.md).

## Setup
Requires Node.js 18 or newer.
```bash
npm install
npm run db:schema        # creates server/data/internships.db with the tables from server/schema.sql
npm run seed             # loads INT-001..004 (SQL sample) and INT-101..105 (JSON sample); safe to repeat
npm start                # http://localhost:3000  (frontend + API on one port)
npm test                 # all tests
```
The server also seeds an empty database on start, so a fresh deployment is never blank.
The app does not read `.env` by itself. Set variables in your shell or hosting dashboard, for example `PORT=4000 npm start` (PowerShell: `$env:PORT=4000; npm start`).

## Environment variables (`.env.example`, no secrets)
| Name | Purpose | Default |
|---|---|---|
| `PORT` | Port to listen on | 3000 |
| `DB_FILE` | SQLite file path | `server/data/internships.db` |
| `ADMIN_API_KEY` | Enables create/update/delete of internships via `x-api-key` header | empty (disabled) |
| `TRUST_PROXY` | Set to `1` behind a proxy (Render) so rate limits use the real client IP | empty |

## API
Envelope: `{ "status": "success", "data": ..., "pagination": ... }` or `{ "status": "error", "error": { "code", "message", "details" } }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/internships?page&limit&domain&mode&q` | list (limit 1 to 50) |
| GET | `/api/internships/:id` | detail |
| GET | `/api/filters` | domains and modes for the dropdowns |
| POST | `/api/applications` | `{ internship_id, name, email, portfolio_url? }` → 201, 400 validation, 404, 409 duplicate/closed, 429 |
| POST/PUT/DELETE | `/api/internships[/:id]` | needs `x-api-key` |

```bash
curl -X POST http://localhost:3000/api/applications -H "Content-Type: application/json" \
  -d '{"internship_id":"INT-101","name":"Asha Verma","email":"asha@example.com","portfolio_url":"https://example.com/asha"}'
```

## Accessibility evidence
- Every input has a visible `<label>`; errors are linked with `aria-describedby` and `aria-invalid`, and the first invalid field gets focus.
- Native `<dialog>`: focus moves in, Tab cannot reach the page behind, Esc closes, focus returns to the card button.
- Result count and load/error messages are announced through `role="status"` / `aria-live`; skip link; visible focus ring; 44px touch targets; `prefers-reduced-motion` respected.
- 360px, 768px and 1280px checked with no horizontal scroll. Screenshots: `docs/screenshots/`.

## Project structure
```
client/           index.html, style.css, app.js (no framework, no inline scripts)
server/server.js  starts the app
server/src/       app.js (routes), applicationValidate.js, validate.js, security.js, logger.js, db.js
server/schema.sql tables (applications has UNIQUE(internship_id, applicant_email))
server/seed/      seed.js, seed.sql, internships.json
tests/            validation, security (unit) and api (integration) tests
docs/screenshots/ evidence at 360px and desktop
```

## Deploy on Render (free)
1. Push this repo to GitHub.
2. Render → New → Blueprint (uses `render.yaml`) or New → Web Service: build `npm install`, start `npm start`, env `TRUST_PROXY=1`.
3. Open the URL, then paste it at the top of this README.
