// Integration tests: the real Express app + SQLite (in memory), called over HTTP.
// Needs `npm install` first (express, better-sqlite3).
const test = require("node:test");
const assert = require("node:assert/strict");
const { openDb } = require("../server/src/db");
const { seed } = require("../server/seed/seed");
const { createApp } = require("../server/src/app");

async function start(options = {}) {
  const db = openDb(":memory:");
  seed(db);
  const logs = [];
  const app = createApp({ db, adminKey: "test-admin-key", logWrite: (l) => logs.push(l), applyLimit: { windowMs: 60_000, max: 50 }, ...options });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, init = {}) => {
    const res = await fetch(base + path, init);
    let body = null;
    try { body = await res.json(); } catch { /* not json */ }
    return { res, body };
  };
  const post = (path, data, headers = {}) =>
    call(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data) });
  return { db, logs, call, post, close: () => server.close() };
}

const good = (over = {}) => ({ internship_id: "INT-101", name: "Asha Verma", email: "asha@example.com", portfolio_url: "https://example.com/asha", ...over });

test("seed data: INT-101..INT-105 from the supplied JSON are served with the standard envelope", async () => {
  const t = await start();
  const { res, body } = await t.call("/api/internships?limit=50");
  assert.equal(res.status, 200);
  assert.equal(body.status, "success");
  const ids = body.data.map((r) => r.id);
  for (const id of ["INT-101", "INT-102", "INT-103", "INT-104", "INT-105"]) assert.ok(ids.includes(id), id);
  assert.equal(body.pagination.total, 9);
  t.close();
});

test("list supports pagination, domain, mode and search", async () => {
  const t = await start();
  let r = await t.call("/api/internships?page=1&limit=3");
  assert.equal(r.body.data.length, 3);
  assert.equal(r.body.pagination.totalPages, 3);
  r = await t.call("/api/internships?domain=Full%20Stack%20Development&mode=Remote");
  assert.deepEqual(r.body.data.map((x) => x.id), ["INT-101"]);
  r = await t.call("/api/internships?q=sql");
  assert.deepEqual(r.body.data.map((x) => x.id), ["INT-102", "INT-104"]);
  r = await t.call("/api/internships?q=zzzz-nothing");
  assert.equal(r.body.data.length, 0);
  r = await t.call("/api/internships?limit=999&page=0");
  assert.equal(r.res.status, 400);
  t.close();
});

test("valid application is accepted (201) and does not echo the applicant record", async () => {
  const t = await start();
  const { res, body } = await t.post("/api/applications", good());
  assert.equal(res.status, 201);
  assert.equal(body.data.internship_id, "INT-101");
  assert.ok(!JSON.stringify(body).includes("asha@example.com"));
  assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM applications").get().n, 1);
  t.close();
});

test("server rejects missing name, invalid email and unsafe URL with 400 and field details", async () => {
  const t = await start();
  let r = await t.post("/api/applications", good({ name: "" }));
  assert.equal(r.res.status, 400);
  assert.equal(r.body.error.details[0].field, "name");
  r = await t.post("/api/applications", good({ email: "not-an-email" }));
  assert.equal(r.res.status, 400);
  assert.equal(r.body.error.details[0].field, "email");
  for (const u of ["javascript:alert(1)", "data:text/html,x", "https://user:pw@example.com"]) {
    r = await t.post("/api/applications", good({ portfolio_url: u }));
    assert.equal(r.res.status, 400, u);
    assert.equal(r.body.error.details[0].field, "portfolio_url");
  }
  assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM applications").get().n, 0);
  t.close();
});

test("duplicate application is rejected with 409, even if the email differs only by case", async () => {
  const t = await start();
  assert.equal((await t.post("/api/applications", good())).res.status, 201);
  const dup = await t.post("/api/applications", good({ email: "ASHA@example.com" }));
  assert.equal(dup.res.status, 409);
  assert.equal(dup.body.error.code, "DUPLICATE_APPLICATION");
  // the same person may still apply to a different internship
  assert.equal((await t.post("/api/applications", good({ internship_id: "INT-102" }))).res.status, 201);
  t.close();
});

test("unknown internship gives 404 and a closed internship gives 409", async () => {
  const t = await start();
  assert.equal((await t.post("/api/applications", good({ internship_id: "INT-999" }))).res.status, 404);
  const closed = await t.post("/api/applications", good({ internship_id: "INT-004" })); // seeded with applications_open = 0
  assert.equal(closed.res.status, 409);
  assert.equal(closed.body.error.code, "APPLICATIONS_CLOSED");
  t.close();
});

test("SQL injection strings are treated as plain data", async () => {
  const t = await start();
  const evil = "x' OR '1'='1'; DROP TABLE applications; --";
  let r = await t.call(`/api/internships?q=${encodeURIComponent(evil)}`);
  assert.equal(r.res.status, 200);
  assert.equal(r.body.data.length, 0);
  r = await t.call(`/api/internships/${encodeURIComponent("INT-101' OR '1'='1")}`);
  assert.equal(r.res.status, 404);
  r = await t.post("/api/applications", good({ name: evil, email: "evil@example.com" }));
  assert.equal(r.res.status, 201); // stored as text
  assert.equal(t.db.prepare("SELECT applicant_name FROM applications").get().applicant_name, evil);
  assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM internships").get().n, 9); // tables intact
  t.close();
});

test("rate limit answers 429 with Retry-After once the limit is passed", async () => {
  const t = await start({ applyLimit: { windowMs: 60_000, max: 3 } });
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await t.post("/api/applications", good({ email: `p${i}@example.com`, internship_id: "INT-10" + (1 + (i % 5)) }));
    codes.push(r.res.status);
    if (r.res.status === 429) assert.ok(Number(r.res.headers.get("retry-after")) >= 1);
  }
  assert.deepEqual(codes, [201, 201, 201, 429, 429]);
  t.close();
});

test("security headers are present and X-Powered-By is removed", async () => {
  const t = await start();
  const { res } = await t.call("/api/internships");
  assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-powered-by"), null);
  t.close();
});

test("logs never contain the applicant's email, name, URL or an API key", async () => {
  const t = await start();
  await t.post("/api/applications", good({ name: "Unique Person Zed", email: "zed.secret@example.com", portfolio_url: "https://zed.example.com/private" }), { "x-api-key": "super-secret-token" });
  await t.post("/api/applications", good({ email: "broken" }));
  await t.call("/api/internships?q=zed.secret@example.com");
  const all = t.logs.join("\n");
  assert.ok(t.logs.length >= 3);
  for (const secret of ["zed.secret", "Unique Person", "zed.example.com", "super-secret-token", "broken"]) assert.ok(!all.includes(secret), secret);
  t.close();
});

test("changing internships needs the admin key; reading does not", async () => {
  const t = await start();
  const body = { title: "QA Intern", domain: "Quality Assurance", mode: "Remote" };
  assert.equal((await t.post("/api/internships", body)).res.status, 401);
  assert.equal((await t.post("/api/internships", body, { "x-api-key": "wrong" })).res.status, 401);
  assert.equal((await t.post("/api/internships", body, { "x-api-key": "test-admin-key" })).res.status, 201);
  assert.equal((await t.call("/api/internships/INT-101")).res.status, 200);
  t.close();
});

test("bad JSON gives 400 and oversized bodies give 413", async () => {
  const t = await start();
  let r = await t.call("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken" });
  assert.equal(r.res.status, 400);
  assert.equal(r.body.error.code, "INVALID_JSON");
  r = await t.post("/api/applications", good({ name: "x".repeat(20_000) }));
  assert.equal(r.res.status, 413);
  t.close();
});
