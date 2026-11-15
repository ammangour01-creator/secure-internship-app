// Structured JSON logging: one line per event, always with time, level and event.
// Request lines contain only event, id, method, path (no query string), status and duration.
// Bodies, headers, emails and tokens are never logged; sensitive keys are redacted as a safety net.
const crypto = require("crypto");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE = /pass(word)?|token|secret|authorization|api[-_]?key|cookie|email|name|url|body/i;

function redact(value, depth = 0) {
  if (value === null || typeof value !== "object" || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  return out;
}

// Server errors are "error", client mistakes are "warn", everything else is "info".
const levelForStatus = (status) => (status >= 500 ? "error" : status >= 400 ? "warn" : "info");

// write(line) receives one JSON string. LOG_LEVEL (debug|info|warn|error) hides quieter lines.
function createLogger(write = (line) => console.log(line), minLevel = process.env.LOG_LEVEL || "info") {
  const min = LEVELS[minLevel] || LEVELS.info;

  function log(fields) {
    const level = LEVELS[fields.level] ? fields.level : "info";
    if (LEVELS[level] < min) return;
    write(JSON.stringify(redact({ time: new Date().toISOString(), ...fields, level })));
  }

  function requestLogger(req, res, next) {
    const started = process.hrtime.bigint();
    const id = crypto.randomBytes(6).toString("hex"); // 12 hex characters
    req.id = id;
    res.setHeader("X-Request-Id", id);
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log({ level: levelForStatus(res.statusCode), event: "request", id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) });
    });
    next();
  }

  // Convenience helpers for non-request events: logger.info("server_started", { port })
  const at = (level) => (event, extra = {}) => log({ ...extra, level, event });
  return { log, info: at("info"), warn: at("warn"), error: at("error"), requestLogger };
}

module.exports = { createLogger, redact, levelForStatus, LEVELS };
