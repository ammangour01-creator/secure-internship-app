// Safe logging: request logs contain only method, path (no query string), status,
// duration and a request id. Bodies, headers, emails and tokens are never logged.
const crypto = require("crypto");

const SENSITIVE = /pass(word)?|token|secret|authorization|api[-_]?key|cookie|email|name|url|body/i;

// Defensive helper for any object that might be logged: masks sensitive keys.
function redact(value, depth = 0) {
  if (value === null || typeof value !== "object" || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  return out;
}

function createLogger(write = (line) => console.log(line)) {
  const log = (fields) => write(JSON.stringify(redact({ time: new Date().toISOString(), ...fields })));

  function requestLogger(req, res, next) {
    const started = process.hrtime.bigint();
    const id = crypto.randomBytes(6).toString("hex");
    req.id = id;
    res.setHeader("X-Request-Id", id);
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log({ id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) });
    });
    next();
  }

  return { log, requestLogger };
}

module.exports = { createLogger, redact };
