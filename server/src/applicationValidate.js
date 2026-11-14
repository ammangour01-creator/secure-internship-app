// Validation for the application form. Pure functions, no database access,
// so the same rules are easy to unit test and to mirror in the browser.
const ALLOWED_FIELDS = ["internship_id", "name", "email", "portfolio_url"];

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// Only plain http(s) links without embedded credentials are accepted.
// javascript:, data:, file:, vbscript: etc. are rejected because they are unsafe to render as links.
function checkUrl(raw) {
  if (typeof raw !== "string") return "Portfolio link must be text.";
  const text = raw.trim();
  if (text.length > 300) return "Portfolio link must be 300 characters or fewer.";
  if (CONTROL_CHARS.test(text) || /\s/.test(text)) return "Portfolio link must not contain spaces or control characters.";
  let url;
  try {
    url = new URL(text);
  } catch {
    return "Enter a full link such as https://example.com/me.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return "Only http:// or https:// links are allowed.";
  if (url.username || url.password) return "Links with a username or password are not allowed.";
  if (!url.hostname.includes(".")) return "Enter a full link such as https://example.com/me.";
  return null;
}

// Returns { errors: [{field, message}], value }
function validateApplication(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  if (body === null || typeof body !== "object" || Array.isArray(body))
    return { errors: [{ field: "body", message: "Request body must be a JSON object." }], value: null };

  for (const key of Object.keys(body)) if (!ALLOWED_FIELDS.includes(key)) add(key, "Unknown field.");

  const value = {};

  if (typeof body.internship_id !== "string" || !/^INT-\d{3,6}$/.test(body.internship_id))
    add("internship_id", "internship_id must look like INT-101.");
  else value.internship_id = body.internship_id;

  // name
  if (typeof body.name !== "string" || body.name.trim() === "") add("name", "Name is required.");
  else {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) add("name", "Name must be 2 to 80 characters.");
    else if (CONTROL_CHARS.test(name) || /[<>]/.test(name)) add("name", "Name contains characters that are not allowed.");
    else value.name = name;
  }

  // email
  if (typeof body.email !== "string" || body.email.trim() === "") add("email", "Email is required.");
  else {
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) add("email", "Enter a valid email address.");
    else value.email = email;
  }

  // portfolio_url (optional)
  if (body.portfolio_url === undefined || body.portfolio_url === null || body.portfolio_url === "") {
    value.portfolio_url = "";
  } else {
    const problem = checkUrl(body.portfolio_url);
    if (problem) add("portfolio_url", problem);
    else value.portfolio_url = new URL(body.portfolio_url.trim()).href;
  }

  return { errors, value };
}

module.exports = { validateApplication, checkUrl, EMAIL_RE };
