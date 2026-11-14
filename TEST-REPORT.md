# Test report

Date: 2026-11-14 · Node 22

## 1. Unit tests (`npm run test:unit`) — 15 tests, run and passing

```
ok 1 - rate limiter allows up to max requests, then answers 429 with Retry-After
ok 2 - rate limiter counts each client separately and resets after the window
ok 3 - secure headers are set on every response
ok 4 - redact masks passwords, tokens, emails, names and urls at any depth
ok 5 - request log line has method, path and status but no query string, body or headers
ok 6 - accepts a valid application and normalises it
ok 7 - portfolio link is optional
ok 8 - rejects missing or blank name
ok 9 - rejects names with markup characters or control characters
ok 10 - rejects invalid email addresses
ok 11 - rejects unsafe URLs
ok 12 - accepts safe http and https URLs
ok 13 - rejects unknown fields and bad internship ids
ok 14 - rejects non-object bodies
ok 15 - reports every problem at once
# tests 15
# pass 15
# fail 0
```

Covers application validation (missing name, invalid email, unsafe URL, unknown fields, bad ids), the rate limiter (limit, per-client counting, window reset), secure headers and log redaction.

**Mutation check:** I deliberately broke the code five ways (allow any URL scheme, disable the rate limiter, log the query string and body, remove the email check, drop `frame-ancestors`). Each break made the matching test fail, and the original code passes again. So the tests really detect these problems.

## 2. API integration tests (`npm test`) — run these on your machine

`tests/api.test.js` starts the real Express app with an in-memory SQLite database and calls it over HTTP (12 tests): seed data INT-101..105, pagination and filters, valid application (201), missing name / invalid email / unsafe URL (400), duplicate (409), unknown internship (404), closed internship (409), SQL injection strings, rate limit (429 + Retry-After), secure headers, logs without applicant data, admin key, bad JSON (400) and oversized body (413).

Run on 2026-11-14 on Windows with Node 24: tests 27, pass 27, fail 0 (includes the 12 API integration tests).

## 3. Browser checks (real Chromium via Playwright) — 28 checks

The frontend was driven in a real browser at 360px, 768px and 1280px against a small mock server that follows the same API contract and uses the project's real validation and rate-limit modules. Screenshots are in `docs/screenshots/`.

```
PASS loading skeleton shown while waiting  -> Loading internships…
PASS 6 cards on page 1 (limit=6)  -> 6
PASS 360px: no horizontal scroll  -> 360 vs 360
PASS status announces count  -> 9 internships found.
PASS pagination visible
PASS next page shows remaining 3
PASS mode filter On-site -> 1 result
PASS domain filter UI/UX -> 2 results
PASS empty state shown
PASS error state with Retry button
PASS error is in the status region
PASS Retry recovers and shows results
PASS dialog opens with keyboard (Enter)
PASS focus moved into dialog (name field)
PASS Tab never reaches the page behind the dialog (8 presses)
PASS Esc closes dialog
PASS focus returns to the card button
PASS client rejects blank name / bad email / unsafe url
PASS first invalid field focused + aria-invalid
PASS 360px: dialog has no horizontal scroll  -> 326 vs 326
PASS server rejects unsafe URL (400)  -> 400
PASS success message shown and form hidden
PASS duplicate shows a clear message (409)  -> You have already applied to this internship with this email.
PASS closed internship: form hidden + message
PASS rate limit shows a readable message  -> Too many requests. Try again in 60 seconds.
PASS 768px: no horizontal scroll
PASS 1280px: no horizontal scroll
PASS no Content-Security-Policy violations in console
```

Result: 28/28 passed, repeated 3 times with the same result. Two real bugs found and fixed during this run: the `hidden` attribute was overridden by CSS (form stayed visible), and the Close button wrapped onto two lines at 360px.

## Acceptance criteria

| Criterion | Evidence |
|---|---|
| List has loading, empty, error and retry states | Browser checks 1, 4, 5 and screenshots 01, 03, 04 |
| Server rejects missing name, invalid email, unsafe URL, duplicate | `validation.test.js` (run), `api.test.js` (run locally) |
| Logs have no password, token or full applicant record | `security.test.js` (run), `api.test.js` (run locally) |
| Works at 360px without horizontal scroll | Browser check: scrollWidth 360 = clientWidth 360; dialog 326 = 326 |
| Keyboard users can operate search, filters, cards, dialog, form | Browser checks: Enter opens dialog, focus moves in, Esc closes, focus returns, form submits with Enter |
