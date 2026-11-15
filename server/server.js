const { openDb } = require("./src/db");
const { seed } = require("./seed/seed");
const { createApp } = require("./src/app");
const { createLogger } = require("./src/logger");
const { version } = require("../package.json");

const logger = createLogger();
const db = openDb();
// Seeding is idempotent, so a fresh deployment (e.g. on Render) always has data.
if (db.prepare("SELECT COUNT(*) AS n FROM internships").get().n === 0) {
  seed(db);
  logger.info("database_seeded");
}

const PORT = Number(process.env.PORT) || 3000;
const server = createApp({ db, logWrite: (line) => console.log(line) }).listen(PORT, () => {
  logger.info("server_started", {
    port: PORT,
    version,
    node: process.version,
    adminRoutesEnabled: Boolean(process.env.ADMIN_API_KEY), // true/false only, never the key
    trustProxy: process.env.TRUST_PROXY || "off",
  });
  console.log(`Internship app running at http://localhost:${PORT}`);
});

// Graceful shutdown: Render sends SIGTERM on every deploy. Stop accepting new requests,
// let running ones finish, close the database, then exit.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("shutdown_started", { signal });
  const force = setTimeout(() => { logger.error("shutdown_forced"); process.exit(1); }, 10_000);
  force.unref();
  server.close(() => {
    try { db.close(); } catch { /* already closed */ }
    logger.info("shutdown_complete");
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error("unhandled_rejection", { message: String(reason && reason.message ? reason.message : reason).slice(0, 200) }));
process.on("uncaughtException", (err) => { logger.error("uncaught_exception", { message: String(err.message).slice(0, 200) }); shutdown("uncaughtException"); });
