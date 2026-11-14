const { openDb } = require("./src/db");
const { seed } = require("./seed/seed");
const { createApp } = require("./src/app");

const db = openDb();
// Seeding is idempotent, so a fresh deployment (e.g. on Render) always has data.
if (db.prepare("SELECT COUNT(*) AS n FROM internships").get().n === 0) seed(db);

const PORT = process.env.PORT || 3000;
createApp({ db }).listen(PORT, () => console.log(`Internship app running at http://localhost:${PORT}`));
