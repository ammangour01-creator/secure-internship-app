# Security checklist

Where each control lives and how it is tested.

| # | Control | Where | Test |
|---|---|---|---|
| 1 | **Rate limiting**: 120 requests/min per IP on `/api`, and 10 applications per 15 min per IP. Over the limit: `429` + `Retry-After`. | `server/src/security.js`, `server/src/app.js` | `security.test.js`, `api.test.js` |
| 2 | **Secure headers**: CSP (`default-src 'self'`, no inline script/style, `frame-ancestors 'none'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS, COOP/CORP, `X-Powered-By` removed. | `server/src/security.js` | `security.test.js`, `api.test.js`, browser run (no CSP violations) |
| 3 | **Parameterized queries**: every SQL statement uses `?` or `@name` placeholders. Search text is escaped for `LIKE`. No string concatenation of user input. | `server/src/app.js` | `api.test.js` (SQL injection test) |
| 4 | **Server-side validation**: name, email, URL, internship id, unknown fields, body size (10 kb). The browser check is only a convenience. | `server/src/applicationValidate.js` | `validation.test.js`, `api.test.js` |
| 5 | **Unsafe URLs rejected**: only `http(s)`, no `javascript:`/`data:`/`file:`, no embedded username/password, max 300 chars. | `applicationValidate.js` | `validation.test.js` |
| 6 | **Duplicates rejected**: `UNIQUE (internship_id, email)` in the database; email is lower-cased first, so `A@x.com` and `a@x.com` are the same. Race-safe because the database enforces it. | `schema.sql`, `app.js` | `api.test.js` |
| 7 | **Safe logs**: only event, request id, method, path (no query string), status, duration, with a level (info/warn/error). Bodies and headers are never logged; sensitive keys are redacted. Error logs contain the message only. Errors show the same request id to the user. | `server/src/logger.js` | `security.test.js`, `logging.test.js`, `api.test.js` |
| 8 | **No XSS in the UI**: all text is inserted with `textContent`, never `innerHTML`. CSP blocks inline scripts as a second layer. | `client/app.js` | Browser run |
| 9 | **Write access protected**: creating/updating/deleting internships needs the `x-api-key` header (constant-time compare). If `ADMIN_API_KEY` is empty these routes are disabled. | `app.js` | `api.test.js` |
| 10 | **Health checks and API responses are never cached** (`Cache-Control: no-store`); health endpoints expose only status, version and uptime. | `server/src/app.js` | `api.test.js` |
| 11 | **No secrets in git**: `.env` ignored, `.env.example` has no values. Application responses return ids only, never the applicant's details. | `.gitignore`, `.env.example` | `api.test.js` |

## Known limits (honest notes)
- The rate limiter keeps counts in memory, so it resets on restart and is per server instance. Fine for one instance; use Redis or similar when scaling out.
- No login system: anyone can apply once per internship per email. Email addresses are not verified.
- Health endpoints (`/healthz`, `/readyz`) are not rate limited so the platform can probe them; they reveal no data beyond status, version and uptime.
- SQLite on a free Render instance can be wiped on redeploy. The app reseeds an empty database on start.
