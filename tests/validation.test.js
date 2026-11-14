const test = require("node:test");
const assert = require("node:assert/strict");
const { validateApplication, checkUrl } = require("../server/src/applicationValidate");

const good = { internship_id: "INT-101", name: "Asha Verma", email: "Asha@Example.com", portfolio_url: "https://example.com/asha" };
const fieldsOf = (r) => r.errors.map((e) => e.field).sort();

test("accepts a valid application and normalises it", () => {
  const r = validateApplication(good);
  assert.deepEqual(r.errors, []);
  assert.equal(r.value.email, "asha@example.com");
  assert.equal(r.value.name, "Asha Verma");
});

test("portfolio link is optional", () => {
  const { portfolio_url, ...rest } = good;
  assert.deepEqual(validateApplication(rest).errors, []);
  assert.deepEqual(validateApplication({ ...good, portfolio_url: "" }).errors, []);
});

test("rejects missing or blank name", () => {
  for (const name of [undefined, "", "   ", 42, "A"]) {
    const r = validateApplication({ ...good, name });
    assert.deepEqual(fieldsOf(r), ["name"], `name=${JSON.stringify(name)}`);
  }
});

test("rejects names with markup characters or control characters", () => {
  assert.deepEqual(fieldsOf(validateApplication({ ...good, name: "<script>alert(1)</script>" })), ["name"]);
  assert.deepEqual(fieldsOf(validateApplication({ ...good, name: "Asha\u0000Verma" })), ["name"]);
});

test("rejects invalid email addresses", () => {
  for (const email of [undefined, "", "plain", "a@b", "a@@b.com", "a b@c.com", "a@b..com", "@c.com", "a@-b.com", 5]) {
    assert.deepEqual(fieldsOf(validateApplication({ ...good, email })), ["email"], `email=${JSON.stringify(email)}`);
  }
});

test("rejects unsafe URLs", () => {
  const unsafe = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd",
    "vbscript:msgbox(1)", "ftp://example.com/x", "//evil.example.com", "https://user:pw@example.com/",
    "not a url", "https://localhost", "https://exa mple.com", "http://example.com/" + "a".repeat(400),
  ];
  for (const portfolio_url of unsafe)
    assert.deepEqual(fieldsOf(validateApplication({ ...good, portfolio_url })), ["portfolio_url"], portfolio_url);
});

test("accepts safe http and https URLs", () => {
  for (const u of ["https://example.com", "http://example.com/a?b=1#c", "https://sub.example.co.in/me"])
    assert.equal(checkUrl(u), null, u);
});

test("rejects unknown fields and bad internship ids", () => {
  assert.deepEqual(fieldsOf(validateApplication({ ...good, role: "admin" })), ["role"]);
  assert.deepEqual(fieldsOf(validateApplication({ ...good, internship_id: "1; DROP TABLE internships" })), ["internship_id"]);
  assert.deepEqual(fieldsOf(validateApplication({ ...good, internship_id: undefined })), ["internship_id"]);
});

test("rejects non-object bodies", () => {
  for (const body of [undefined, null, "text", 5, []]) assert.deepEqual(fieldsOf(validateApplication(body)), ["body"]);
});

test("reports every problem at once", () => {
  const r = validateApplication({ internship_id: "INT-101", name: "", email: "x", portfolio_url: "javascript:1" });
  assert.deepEqual(fieldsOf(r), ["email", "name", "portfolio_url"]);
});
