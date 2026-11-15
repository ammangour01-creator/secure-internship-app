// Regression guards for the frontend: these fail if someone later adds an XSS-prone pattern,
// an inline script/style (blocked by the CSP anyway) or a form field without a label.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "client", f), "utf8");
const html = read("index.html");
const js = read("app.js");
const css = read("style.css");

test("app.js never writes HTML or evaluates strings (XSS guard)", () => {
  for (const bad of [/\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new\s+Function\s*\(/])
    assert.doesNotMatch(js, bad, String(bad));
});

test("index.html has no inline scripts, inline handlers or inline styles (CSP guard)", () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "inline <script>");
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "inline event handler");
  assert.doesNotMatch(html, /\sstyle\s*=/i, "inline style attribute");
});

test("every input and select has a matching <label for>", () => {
  const ids = [...html.matchAll(/<(?:input|select)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 6);
  for (const id of ids) assert.match(html, new RegExp(`<label[^>]*\\bfor="${id}"`), `label for #${id}`);
});

test("page basics: lang, viewport, title, one h1, skip link, main landmark", () => {
  assert.match(html, /<html lang="en"/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<title>[^<]{3,}<\/title>/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /class="skip-link" href="#results"/);
  assert.match(html, /<main>/);
});

test("the dialog and live regions needed by assistive technology are present", () => {
  assert.match(html, /<dialog id="detail" aria-labelledby="detail-title"/);
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="form-status"[^>]*role="status"/);
});

test("the stylesheet respects reduced motion, hides [hidden] elements and styles focus", () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /:focus-visible/);
});

test("no external requests: every src/href/url()/fetch() is same-origin (CSP default-src 'self')", () => {
  const external = (u) => /^(https?:)?\/\//i.test(u);
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) assert.ok(!external(m[1]), `index.html loads ${m[1]}`);
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) assert.ok(!external(m[1]), `style.css loads ${m[1]}`);
  for (const m of js.matchAll(/fetch\(\s*[`'"]([^`'"]+)|api\(\s*[`'"]([^`'"]+)/g)) assert.ok(!external(m[1] || m[2]), `app.js calls ${m[1] || m[2]}`);
});
