# Engineering decisions

Each decision lists what was chosen, why, and what it costs.

| # | Decision | Why | Trade-off |
|---|---|---|---|
| 1 | **One Node process serves the frontend and the API** | One deploy, one URL, no CORS rules to get wrong, and the CSP can say `default-src 'self'`. | Frontend and API scale together. Fine for this size; split later behind a CDN if needed. |
| 2 | **SQLite (better-sqlite3)** | Zero setup, fast, transactions, UNIQUE constraints enforce "one application per email per internship" even under races. | One writer, and the free Render disk is not persistent. Documented; PostgreSQL is the next step. |
| 3 | **Validation twice, server is the source of truth** | The browser check gives instant feedback; the server check protects against anyone calling the API directly. | Rules exist in two places, so tests (`validation.test.js`, browser run) keep them aligned. |
| 4 | **Own rate limiter and security headers instead of `express-rate-limit` / `helmet`** | The needs are small (fixed window, a dozen headers), the code is about 60 lines, fully unit tested, and it adds no dependencies. | Less battle-tested than the libraries and in-memory only. Swap to the libraries (plus Redis) when running several instances. |
| 5 | **Strict CSP: no inline script or style, no external origins** | Blocks most XSS even if a bug slips in. `static.test.js` fails if someone adds an inline script, `innerHTML` or an external URL. | Everything must live in files; no CDN fonts or analytics without changing the policy. |
| 6 | **`textContent` only, never `innerHTML`** | User and API text can never become markup. | Slightly more code to build elements. |
| 7 | **Native `<dialog>` for details and the form** | Built-in focus trap, Esc to close and an inert background, with focus returned to the opener by a few lines of code. | Needs a modern browser (all current ones). |
| 8 | **Filters and page live in the URL** | Refresh, back and shared links keep the view; stale or invalid values fall back safely. | A little state-sync code. |
| 9 | **Request id on every response, in logs and in error bodies** | A user can quote the id and you can find the exact log line without logging personal data. | One more field in every error. |
| 10 | **Logs carry no applicant data, by design and by filter** | Privacy and compliance: a log leak should never expose applicants. | Debugging relies on ids, status and timing, not payloads. |
| 11 | **`/healthz` (liveness) and `/readyz` (database) are separate and not rate limited** | The platform can restart a dead process without being fooled by a database blip, and probes never get a 429. | Two endpoints to remember. |
| 12 | **Graceful shutdown on SIGTERM** | Deploys do not cut running requests or leave the database open. | Ten second cap, then a forced exit. |
| 13 | **Write routes for internships need `ADMIN_API_KEY`, and are off when it is empty** | Safe by default: a public deployment cannot be edited by strangers. | A shared key is not real authentication; use accounts and roles for production. |
| 14 | **`no-store` on API and health responses; ETag revalidation for the frontend** | Users never see stale lists or old code after a deploy; unchanged files cost only a 304. | No long-lived caching of static files. |
| 15 | **WCAG contrast is tested from the real CSS values** | A colour change that breaks the 4.5:1 rule fails the tests instead of reaching users. | Hard-coded colours outside the tokens are listed in the test and kept honest by a second test. |

## What I would do next
1. PostgreSQL on a managed instance, with migrations.
2. Redis-backed rate limiting and a real admin login.
3. Email verification for applications.
4. CI (GitHub Actions) running `npm test` on every push, plus Lighthouse CI.
5. Metrics (request rate, error rate, p95 latency) next to the logs.
