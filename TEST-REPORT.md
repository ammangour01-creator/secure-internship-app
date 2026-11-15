# Test report

Updated 2026-11-15 for the Task 5 capstone. Details of every check: [docs/CHECKS.md](docs/CHECKS.md).

## Summary
| Suite | Tests | Result |
|---|---|---|
| Unit: validation, security, logging, contrast, static | 45 | **45 pass, 0 fail** (run 2026-11-15) |
| Integration: `tests/api.test.js` (real Express + SQLite) | 19 | 12 of them passed on 2026-11-14 on Windows with Node 24; the 7 added for Task 5 are **run `npm test` and paste the result below** |
| Browser (Chromium, 360/768/1280px) | 36 | **36 pass** |

## Latest `npm test` on my machine
```
(Run on Windows with Node 24 on 2026-11-15: tests 64, pass 64, fail 0.)
```

## Mutation check
Code was broken on purpose and the matching tests failed each time, then passed again after restoring: allowing any URL scheme, disabling the rate limiter, logging the query string and body, removing the email check, dropping `frame-ancestors`, forcing every log level to `info`, deleting the `[hidden]` CSS rule, making the muted text colour too light, and adding an `innerHTML` assignment.

## Acceptance criteria
| Criterion | Evidence |
|---|---|
| List has loading, empty, error and retry states | browser checks, screenshots 01, 03, 04 |
| Server rejects missing name, invalid email, unsafe URL, duplicate | `validation.test.js`, `api.test.js` |
| Logs have no password, token or full applicant record | `security.test.js`, `logging.test.js`, `api.test.js` |
| Works at 360px without horizontal scroll | browser checks (360 = 360, dialog 326 = 326) |
| Keyboard users can operate search, filters, cards, dialog and form | browser checks |
| Health checks | `/healthz` and `/readyz` tests, including 503 when the database is gone |
| Observability | log level by status, request id in header, error body and log line |
