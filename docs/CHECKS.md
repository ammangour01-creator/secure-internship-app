# Quality checks (regression, accessibility, performance, security)

Everything marked **verified** was run on 2026-11-15. Items marked **you run** need a real browser on the live site, so there is a box to fill in.

## 1. Regression: automated tests
64 tests in `tests/` (`npm test`):

| File | Tests | Covers |
|---|---|---|
| `validation.test.js` | 10 | name, email, URL, unknown fields, ids, body shape |
| `security.test.js` | 5 | rate limiter, secure headers, log redaction |
| `logging.test.js` | 5 | log levels, request id, no query string, custom events |
| `static.test.js` | 7 | no `innerHTML`, no inline script/style, labels, landmarks, no external requests |
| `contrast.test.js` | 2 (18 checks) | WCAG contrast of every colour pair in `style.css` |
| `api.test.js` | 19 | real Express + SQLite: seed, list, apply, validation, duplicate, injection, rate limit, headers, logs, health, request id, 404, 500 |

Unit tests (45): **verified, 45/45 pass**. Mutation check: breaking the code on purpose (log levels, `[hidden]` rule, a light grey text colour, adding `innerHTML`) made the matching tests fail, then they passed again after restoring.
Full `npm test` result on your machine (paste it here):

```
(Run on Windows with Node 24 on 2026-11-15: tests 64, pass 64, fail 0.)
```

## 2. Accessibility
**Verified (automated, in the tests):** every input has a `<label for>`, one `<h1>`, `lang`, viewport, skip link, `<main>`, dialog with `aria-labelledby`, live regions for status and form messages, reduced-motion rule, visible focus style.

**Verified (real Chromium, 36 checks, below):** keyboard opens the dialog, focus moves in, Tab never reaches the page behind it, Esc closes and focus returns to the card button, the first invalid field gets focus with `aria-invalid`, results heading takes focus after paging.

**Colour contrast (computed from the real CSS):**

| Pair | Colours | Ratio | Needed |
|---|---|---|---|
| Body text on page | #14213d on #f6f8fc | 15.0:1 | 4.5:1 |
| Muted text on cards | #4f5a70 on #ffffff | 6.9:1 | 4.5:1 |
| White on primary button | #ffffff on #2354d6 | 6.3:1 | 4.5:1 |
| Error text on white | #b3261e on #ffffff | 6.5:1 | 4.5:1 |
| Success text on white | #1b6b3a on #ffffff | 6.5:1 | 4.5:1 |
| Tag text | #1a3a8f on #e8eefc | 8.8:1 | 4.5:1 |
| Input border on white | #7a859c on #ffffff | 3.7:1 | 3:1 |
| Focus ring on page | #14213d on #f6f8fc | 15.0:1 | 3:1 |

**You run (5 minutes):**
- [ ] Browser zoom 200% on the live site: nothing is cut off or overlaps.
- [ ] Keyboard only (no mouse): search → filter → open card → submit form → close.
- [ ] Optional: turn on Windows Narrator (`Win+Ctrl+Enter`) and listen to the form and the error messages.

## 3. Mobile and responsive
Verified in Chromium: 360px, 768px and 1280px have no horizontal scroll (document width equals viewport width; the dialog at 360px is 326px wide inside 326px). Screenshots in `docs/screenshots/`: loading, empty, error, dialog, form errors, success, duplicate, desktop.

## 4. Performance
**Verified (measured file sizes):**

| File | Raw | Gzip |
|---|---|---|
| index.html | 4.1 KB | 1.5 KB |
| style.css | 4.9 KB | 1.7 KB |
| app.js | 12.2 KB | 4.1 KB |
| **Total** | **21.3 KB** | **7.2 KB** |

No framework, no web fonts, no images, no third-party requests (also guarded by `static.test.js`). Files are served with ETag revalidation, so unchanged files cost a 304.

**You run (2 minutes):** Chrome DevTools → **Lighthouse** tab → Mobile → Analyze page load on the live URL. Write the scores here:

| Performance | Accessibility | Best practices | SEO |
|---|---|---|---|
|100|100|100|100|

## 5. Security
See [SECURITY.md](../SECURITY.md). Verified by tests: rate limit (429 + Retry-After), CSP and other headers, SQL injection strings treated as data, unsafe URLs, duplicates, logs without applicant data.

## 6. Browser run (Chromium via Playwright)
The frontend was driven at 360, 768 and 1280px against a mock server that follows the API contract and uses the project's real validators and rate limiter (screenshots in `docs/screenshots/`).

```
PASS loading skeleton shown while waiting  -> Loading internships…
PASS 6 cards on page 1 (limit=6)  -> 6
PASS 360px: no horizontal scroll  -> 360 vs 360
PASS status announces count  -> 9 internships found.
PASS pagination visible
PASS next page shows remaining 3
PASS after paging, focus moves to the results heading
PASS URL records the page (?page=2)  -> http://localhost:4010/?page=2
PASS reload keeps page 2
PASS URL is clean again on page 1  -> http://localhost:4010/
PASS reload keeps the domain filter (select and results)
PASS stale or unknown link parameters fall back safely (no crash)
PASS focus ring is dark navy 3px  -> rgb(20, 33, 61) 3px
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
PASS no favicon.ico request (inline icon is used)
PASS no Content-Security-Policy violations in console
```
Result: 36/36 passed (run twice, same result).
