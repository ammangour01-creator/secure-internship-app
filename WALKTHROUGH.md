# 2-minute walkthrough script

Record your screen (Loom, OBS or the phone screen recorder) and upload as an unlisted YouTube video or Drive link.

| Time | Show | Say |
|---|---|---|
| 0:00 | Live URL, list of cards | "This is my internship board connected to my own API." |
| 0:15 | Slow network (browser dev tools → Network → Slow 3G) then reload | "While data loads you see placeholders." |
| 0:30 | Stop the server or block `/api` in dev tools, reload, click **Try again** after restoring | "If the API fails there is a clear error and a retry button." |
| 0:50 | Search "zzzz", then filters | "Empty state, plus search, domain and work-mode filters." |
| 1:05 | Open a card with the keyboard (Tab, Enter), submit empty form, then bad email and `javascript:alert(1)` | "The browser checks first, and the server checks again." |
| 1:30 | Submit a valid application, then the same one again | "Success once, then duplicate is rejected with 409." |
| 1:45 | Open `SECURITY.md` and `TEST-REPORT.md` | "Rate limit, secure headers, parameterized queries, logs without personal data, and tests." |
| 1:55 | 360px width in dev tools | "No horizontal scroll on a phone." |

## Extra for the capstone (add 20 seconds, or replace the 0:15 row)
| Show | Say |
|---|---|
| `/healthz` and `/readyz` in a new tab | "Health checks: liveness and database readiness." |
| Render dashboard → Logs | "Structured logs with a request id, and no applicant data." |
| `docs/CHECKS.md` and `docs/DECISIONS.md` on GitHub | "Regression, accessibility and performance checks, and my engineering decisions." |
