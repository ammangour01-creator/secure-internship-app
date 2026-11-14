const MODES = ["Remote", "Hybrid", "On-site"];
const ALLOWED_FIELDS = [
  "id", "title", "domain", "mode", "location",
  "skills", "openings", "duration_weeks", "applications_open",
];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Validates and cleans an internship body (used by POST and PUT).
// Returns { errors: [...], value: {...} }
function validateInternship(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { errors: [{ field: "body", message: "Request body must be a JSON object." }], value: null };
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) add(key, "Unknown field.");
  }

  const value = {};

  // id (optional on create)
  if (body.id !== undefined) {
    if (typeof body.id !== "string" || !/^INT-\d{3,6}$/.test(body.id)) {
      add("id", "id must look like INT-123.");
    } else {
      value.id = body.id;
    }
  }

  // title (required)
  if (!isNonEmptyString(body.title)) add("title", "title is required.");
  else if (body.title.trim().length < 3 || body.title.trim().length > 100)
    add("title", "title must be 3 to 100 characters.");
  else value.title = body.title.trim();

  // domain (required)
  if (!isNonEmptyString(body.domain)) add("domain", "domain is required.");
  else if (body.domain.trim().length < 2 || body.domain.trim().length > 60)
    add("domain", "domain must be 2 to 60 characters.");
  else value.domain = body.domain.trim();

  // mode (required, one of three values, case-insensitive)
  if (!isNonEmptyString(body.mode)) {
    add("mode", `mode is required (${MODES.join(", ")}).`);
  } else {
    const match = MODES.find((m) => m.toLowerCase() === body.mode.trim().toLowerCase());
    if (!match) add("mode", `mode must be one of: ${MODES.join(", ")}.`);
    else value.mode = match;
  }

  // location (optional)
  if (body.location === undefined) value.location = "";
  else if (typeof body.location !== "string" || body.location.trim().length > 60)
    add("location", "location must be text up to 60 characters.");
  else value.location = body.location.trim();

  // skills (optional array of short strings)
  if (body.skills === undefined) value.skills = [];
  else if (
    !Array.isArray(body.skills) ||
    body.skills.length > 10 ||
    body.skills.some((s) => !isNonEmptyString(s) || s.trim().length > 30)
  ) {
    add("skills", "skills must be an array of up to 10 short text values.");
  } else {
    value.skills = body.skills.map((s) => s.trim());
  }

  // openings (optional integer)
  if (body.openings === undefined) value.openings = 1;
  else if (!Number.isInteger(body.openings) || body.openings < 0 || body.openings > 1000)
    add("openings", "openings must be a whole number from 0 to 1000.");
  else value.openings = body.openings;

  // duration_weeks (optional integer)
  if (body.duration_weeks === undefined) value.duration_weeks = 4;
  else if (!Number.isInteger(body.duration_weeks) || body.duration_weeks < 1 || body.duration_weeks > 52)
    add("duration_weeks", "duration_weeks must be a whole number from 1 to 52.");
  else value.duration_weeks = body.duration_weeks;

  // applications_open (optional boolean)
  if (body.applications_open === undefined) value.applications_open = true;
  else if (typeof body.applications_open !== "boolean")
    add("applications_open", "applications_open must be true or false.");
  else value.applications_open = body.applications_open;

  return { errors, value };
}

// Reads ?page= and ?limit= from the query string.
function parsePagination(query) {
  const errors = [];
  let page = 1;
  let limit = 10;

  if (query.page !== undefined) {
    page = Number(query.page);
    if (!Number.isInteger(page) || page < 1) errors.push({ field: "page", message: "page must be a whole number 1 or higher." });
  }
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      errors.push({ field: "limit", message: "limit must be a whole number from 1 to 50." });
  }
  return { errors, page, limit };
}

module.exports = { validateInternship, parsePagination, MODES };
