const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter, securityHeaders, HEADERS } = require("../server/src/security");
const { createLogger, redact } = require("../server/src/logger");

// Minimal fake req/res so the middleware can be tested without a server.
function fakeRes() {
  const res = { headers: {}, statusCode: 200, body: null, handlers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.on = (ev, fn) => { res.handlers[ev] = fn; };
  return res;
}

test("rate limiter allows up to max requests, then answers 429 with Retry-After", () => {
  let t = 1_000_000;
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t });
  const hit = (ip = "1.2.3.4") => { const res = fakeRes(); let passed = false; limiter({ ip }, res, () => { passed = true; }); return { res, passed }; };

  for (let i = 0; i < 3; i++) assert.equal(hit().passed, true);
  const blocked = hit();
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.body.error.code, "RATE_LIMITED");
  assert.ok(Number(blocked.res.headers["Retry-After"]) >= 1);
  assert.equal(blocked.res.headers["RateLimit-Remaining"], "0");
  limiter.stop();
});

test("rate limiter counts each client separately and resets after the window", () => {
  let t = 5_000;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
  const hit = (ip) => { let passed = false; limiter({ ip }, fakeRes(), () => { passed = true; }); return passed; };

  assert.equal(hit("a"), true);
  assert.equal(hit("a"), false);
  assert.equal(hit("b"), true);   // another client is not affected
  t += 1001;
  assert.equal(hit("a"), true);   // new window
  limiter.stop();
});

test("secure headers are set on every response", () => {
  const res = fakeRes();
  let called = false;
  securityHeaders({}, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
  assert.match(res.headers["Content-Security-Policy"], /default-src 'self'/);
  assert.match(res.headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.doesNotMatch(res.headers["Content-Security-Policy"], /unsafe-inline|unsafe-eval/);
  assert.equal(Object.keys(res.headers).length, Object.keys(HEADERS).length);
});

test("redact masks passwords, tokens, emails, names and urls at any depth", () => {
  const out = redact({ path: "/x", password: "p", nested: { token: "t", Authorization: "Bearer abc", applicant: { email: "a@b.com", name: "Asha" } }, list: [{ api_key: "k" }] });
  const text = JSON.stringify(out);
  for (const secret of ["\"p\"", "\"t\"", "Bearer abc", "a@b.com", "Asha", "\"k\""]) assert.ok(!text.includes(secret), secret);
  assert.equal(out.path, "/x");
});

test("request log line has method, path and status but no query string, body or headers", () => {
  const lines = [];
  const { requestLogger } = createLogger((l) => lines.push(l));
  const req = { method: "POST", path: "/api/applications", url: "/api/applications?token=SECRET123", headers: { authorization: "Bearer SECRET123" }, body: { email: "asha@example.com", name: "Asha Verma" } };
  const res = fakeRes();
  requestLogger(req, res, () => {});
  res.statusCode = 201;
  res.handlers.finish();

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.method, "POST");
  assert.equal(entry.path, "/api/applications");
  assert.equal(entry.status, 201);
  for (const secret of ["SECRET123", "asha@example.com", "Asha Verma", "Bearer"]) assert.ok(!lines[0].includes(secret), secret);
});
