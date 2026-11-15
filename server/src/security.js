// Small, dependency-free security middleware: secure headers and a rate limiter.

// ---------- secure headers ----------
const HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
};

function securityHeaders(req, res, next) {
  for (const [name, value] of Object.entries(HEADERS)) res.setHeader(name, value);
  next();
}

// ---------- rate limiter (fixed window, in memory, per client IP) ----------
// Options: windowMs, max, name (used in the error code), now() for tests.
function createRateLimiter({ windowMs = 60_000, max = 100, now = Date.now } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  const sweep = setInterval(() => {
    const t = now();
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }, windowMs);
  if (sweep.unref) sweep.unref(); // never keep the process alive just for cleanup

  function middleware(req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil((entry.resetAt - t) / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - t) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        status: "error",
        error: { code: "RATE_LIMITED", message: `Too many requests. Try again in ${retryAfter} seconds.`, request_id: req.id },
      });
    }
    next();
  }
  middleware.stop = () => clearInterval(sweep);
  return middleware;
}

module.exports = { securityHeaders, createRateLimiter, HEADERS };
