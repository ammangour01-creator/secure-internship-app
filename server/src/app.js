const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { validateInternship, parsePagination, MODES } = require("./validate");
const { validateApplication } = require("./applicationValidate");
const { securityHeaders, createRateLimiter } = require("./security");
const { createLogger } = require("./logger");
const { version } = require("../../package.json");

// Builds the Express app. Everything configurable is a parameter so tests can
// inject an in-memory database, tiny rate limits and a log collector.
function createApp({
  db,
  adminKey = process.env.ADMIN_API_KEY || "",
  trustProxy = process.env.TRUST_PROXY || "",
  generalLimit = { windowMs: 60_000, max: 120 },
  applyLimit = { windowMs: 15 * 60_000, max: 10 },
  logWrite,
  clientDir = path.join(__dirname, "..", "..", "client"),
} = {}) {
  const app = express();
  const logger = createLogger(logWrite);
  const startedAt = Date.now();
  app.locals.logger = logger;

  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", Number(trustProxy) || trustProxy); // needed behind Render/Heroku-style proxies

  app.use(logger.requestLogger);
  app.use(securityHeaders);
  // API answers and health checks must never be cached by browsers or proxies.
  app.use(["/api", "/healthz", "/readyz"], (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", createRateLimiter(generalLimit));
  app.use(express.json({ limit: "10kb" }));

  // ---------- helpers: one response format for everything ----------
  const ok = (res, data, extra = {}, code = 200) => res.status(code).json({ status: "success", data, ...extra });
  const fail = (res, code, errorCode, message, details) => {
    const error = { code: errorCode, message, request_id: res.req && res.req.id }; // lets a user quote the id from the logs
    if (details) error.details = details;
    return res.status(code).json({ status: "error", error });
  };

  const toRecord = (row) => ({
    id: row.id,
    title: row.title,
    domain: row.domain,
    mode: row.mode,
    location: row.location,
    skills: JSON.parse(row.skills),
    openings: row.openings,
    duration_weeks: row.duration_weeks,
    applications_open: row.applications_open === 1,
  });

  const nextId = () => {
    const row = db.prepare("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS max FROM internships").get();
    return "INT-" + String((row.max || 0) + 1).padStart(3, "0");
  };

  const toDb = (v, id) => ({
    id, title: v.title, domain: v.domain, mode: v.mode, location: v.location,
    skills: JSON.stringify(v.skills), openings: v.openings, duration_weeks: v.duration_weeks,
    applications_open: v.applications_open ? 1 : 0,
  });

  // Changing internship records needs the admin key. Reading and applying are public.
  function requireAdmin(req, res, next) {
    const given = String(req.get("x-api-key") || "");
    const hash = (s) => crypto.createHash("sha256").update(s).digest();
    if (!adminKey || !crypto.timingSafeEqual(hash(given), hash(adminKey)))
      return fail(res, 401, "UNAUTHORIZED", "A valid x-api-key header is required for this action.");
    next();
  }

  // ---------- health checks ----------
  // /healthz: is the process alive?  /readyz: can it reach its database?  (Render polls /healthz.)
  app.get("/healthz", (req, res) =>
    res.json({ status: "ok", version, uptime_s: Math.round((Date.now() - startedAt) / 1000) })
  );
  app.get("/readyz", (req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({ status: "ready", db: "ok" });
    } catch (err) {
      logger.log({ level: "error", event: "readiness_failed", id: req.id, message: String(err.message).slice(0, 200) });
      res.status(503).json({ status: "unavailable", db: "error" });
    }
  });

  // ---------- routes ----------
  app.get("/api/health", (req, res) => ok(res, { up: true, version }));

  // Distinct values for the filter dropdowns
  app.get("/api/filters", (req, res) => {
    const domains = db.prepare("SELECT DISTINCT domain FROM internships ORDER BY domain").all().map((r) => r.domain);
    ok(res, { domains, modes: MODES });
  });

  // LIST: ?page=1&limit=6&domain=UI/UX&mode=Remote&q=sql
  app.get("/api/internships", (req, res) => {
    const { errors, page, limit } = parsePagination(req.query);
    const where = [];
    const params = {};

    if (req.query.domain !== undefined && String(req.query.domain) !== "") {
      where.push("LOWER(domain) = LOWER(@domain)");
      params.domain = String(req.query.domain);
    }
    if (req.query.mode !== undefined && String(req.query.mode) !== "") {
      if (!MODES.some((m) => m.toLowerCase() === String(req.query.mode).toLowerCase()))
        errors.push({ field: "mode", message: `mode must be one of: ${MODES.join(", ")}.` });
      else {
        where.push("LOWER(mode) = LOWER(@mode)");
        params.mode = String(req.query.mode);
      }
    }
    if (req.query.q !== undefined && String(req.query.q).trim() !== "") {
      const escaped = String(req.query.q).trim().slice(0, 60).replace(/[\\%_]/g, "\\$&");
      where.push(
        "(title LIKE @q ESCAPE '\\' OR domain LIKE @q ESCAPE '\\' OR location LIKE @q ESCAPE '\\' OR skills LIKE @q ESCAPE '\\')"
      );
      params.q = `%${escaped}%`;
    }

    if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Invalid query parameters.", errors);

    const clause = where.length ? "WHERE " + where.join(" AND ") : "";
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM internships ${clause}`).get(params);
    const rows = db
      .prepare(`SELECT * FROM internships ${clause} ORDER BY id LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset: (page - 1) * limit });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    ok(res, rows.map(toRecord), {
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  });

  app.get("/api/internships/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM internships WHERE id = ?").get(req.params.id);
    if (!row) return fail(res, 404, "NOT_FOUND", "Internship not found.");
    ok(res, toRecord(row));
  });

  // APPLY: server-side validation is the source of truth (the browser check is only a convenience)
  app.post("/api/applications", createRateLimiter(applyLimit), (req, res) => {
    const { errors, value } = validateApplication(req.body);
    if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", errors);

    const internship = db.prepare("SELECT id, applications_open FROM internships WHERE id = ?").get(value.internship_id);
    if (!internship) return fail(res, 404, "NOT_FOUND", "Internship not found.");
    if (internship.applications_open !== 1)
      return fail(res, 409, "APPLICATIONS_CLOSED", "Applications for this internship are closed.");

    try {
      const info = db
        .prepare(
          `INSERT INTO applications (internship_id, applicant_name, applicant_email, portfolio_url)
           VALUES (?, ?, ?, ?)`
        )
        .run(value.internship_id, value.name, value.email, value.portfolio_url);
      // Respond with ids only; never echo the applicant record back.
      ok(res, { application_id: Number(info.lastInsertRowid), internship_id: value.internship_id }, {}, 201);
    } catch (err) {
      if (String(err.code).startsWith("SQLITE_CONSTRAINT"))
        return fail(res, 409, "DUPLICATE_APPLICATION", "You have already applied to this internship with this email.");
      throw err;
    }
  });

  // CREATE / UPDATE / DELETE internships (admin only)
  app.post("/api/internships", requireAdmin, (req, res) => {
    const { errors, value } = validateInternship(req.body);
    if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Invalid input.", errors);
    const id = value.id || nextId();
    if (db.prepare("SELECT 1 FROM internships WHERE id = ?").get(id))
      return fail(res, 409, "CONFLICT", `Internship ${id} already exists.`);
    db.prepare(
      `INSERT INTO internships (id, title, domain, mode, location, skills, openings, duration_weeks, applications_open)
       VALUES (@id, @title, @domain, @mode, @location, @skills, @openings, @duration_weeks, @applications_open)`
    ).run(toDb(value, id));
    res.location(`/api/internships/${id}`);
    ok(res, toRecord(db.prepare("SELECT * FROM internships WHERE id = ?").get(id)), {}, 201);
  });

  app.put("/api/internships/:id", requireAdmin, (req, res) => {
    if (!db.prepare("SELECT 1 FROM internships WHERE id = ?").get(req.params.id))
      return fail(res, 404, "NOT_FOUND", "Internship not found.");
    const { errors, value } = validateInternship(req.body);
    if (value && value.id && value.id !== req.params.id)
      errors.push({ field: "id", message: "id in the body must match the id in the URL." });
    if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Invalid input.", errors);
    db.prepare(
      `UPDATE internships SET title=@title, domain=@domain, mode=@mode, location=@location,
         skills=@skills, openings=@openings, duration_weeks=@duration_weeks,
         applications_open=@applications_open WHERE id=@id`
    ).run(toDb(value, req.params.id));
    ok(res, toRecord(db.prepare("SELECT * FROM internships WHERE id = ?").get(req.params.id)));
  });

  app.delete("/api/internships/:id", requireAdmin, (req, res) => {
    try {
      const result = db.prepare("DELETE FROM internships WHERE id = ?").run(req.params.id);
      if (result.changes === 0) return fail(res, 404, "NOT_FOUND", "Internship not found.");
      ok(res, { id: req.params.id, deleted: true });
    } catch (err) {
      if (String(err.code).startsWith("SQLITE_CONSTRAINT"))
        return fail(res, 409, "CONFLICT", "This internship has applications and cannot be deleted.");
      throw err;
    }
  });

  // ---------- frontend ----------
  // maxAge 0 + ETag: browsers always revalidate, so a redeploy is picked up immediately and unchanged files cost only a 304.
  app.use(express.static(clientDir, { index: "index.html", maxAge: 0 }));

  // ---------- errors ----------
  app.use("/api", (req, res) => fail(res, 404, "NOT_FOUND", "Route not found."));
  app.use((req, res) =>
    res
      .status(404)
      .type("html")
      .send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Page not found</title><body><p>Page not found. <a href="/">Back to the internship board</a></p></body></html>')
  );

  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return fail(res, 400, "INVALID_JSON", "Request body is not valid JSON.");
    if (err.type === "entity.too.large") return fail(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    logger.log({ level: "error", event: "unhandled_error", id: req.id, message: String(err.message).slice(0, 200) }); // message only, never bodies
    fail(res, 500, "INTERNAL_ERROR", "Something went wrong on the server.");
  });

  return app;
}

module.exports = { createApp };
