const test = require("node:test");
const assert = require("node:assert/strict");
const { createLogger } = require("../server/src/logger");

function run(status) {
  const lines = [];
  const { requestLogger } = createLogger((l) => lines.push(l));
  const res = { headers: {}, handlers: {}, statusCode: status };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.on = (ev, fn) => { res.handlers[ev] = fn; };
  const req = { method: "GET", path: "/api/internships", url: "/api/internships?q=secret@example.com" };
  requestLogger(req, res, () => {});
  res.handlers.finish();
  return { entry: JSON.parse(lines[0]), res, req };
}

test("log level follows the status code: info, warn, error", () => {
  assert.equal(run(200).entry.level, "info");
  assert.equal(run(404).entry.level, "warn");
  assert.equal(run(429).entry.level, "warn");
  assert.equal(run(500).entry.level, "error");
});

test("every request line is one JSON object with event, id, method, path, status and ms", () => {
  const { entry } = run(200);
  for (const key of ["time", "level", "event", "id", "method", "path", "status", "ms"]) assert.ok(key in entry, key);
  assert.equal(entry.event, "request");
});

test("each request gets a unique id, also returned in the X-Request-Id header", () => {
  const a = run(200), b = run(200);
  assert.notEqual(a.entry.id, b.entry.id);
  assert.equal(a.res.headers["X-Request-Id"], a.entry.id);
  assert.match(a.entry.id, /^[0-9a-f]{12}$/);
});

test("the query string never reaches the log", () => {
  assert.ok(!JSON.stringify(run(200).entry).includes("secret@example.com"));
});

test("custom events (startup, shutdown, errors) are logged with a level and redacted", () => {
  const lines = [];
  const { log } = createLogger((l) => lines.push(l));
  log({ event: "startup", port: 3000 });
  log({ level: "error", event: "unhandled_error", message: "boom", password: "hunter2", email: "a@b.com" });
  const [start, err] = lines.map((l) => JSON.parse(l));
  assert.equal(start.level, "info");
  assert.equal(err.level, "error");
  assert.ok(!lines[1].includes("hunter2") && !lines[1].includes("a@b.com"));
});
