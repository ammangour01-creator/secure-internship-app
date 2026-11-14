// Run with: npm run seed        (safe to run many times: existing IDs are skipped)
const fs = require("fs");
const path = require("path");

function seed(db) {
  // 1) Records from the supplied SQL sample (INT-001 .. INT-004)
  db.exec(fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8"));

  // 2) Records from the supplied JSON (INT-101 .. INT-105), IDs preserved
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, "internships.json"), "utf8"));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO internships
      (id, title, domain, mode, location, skills, openings, duration_weeks, applications_open)
    VALUES (@id, @title, @domain, @mode, @location, @skills, @openings, @duration_weeks, @applications_open)`);

  db.transaction((rows) => {
    for (const r of rows)
      insert.run({
        id: r.id,
        title: r.title,
        domain: r.domain,
        mode: r.mode,
        location: r.location || "",
        skills: JSON.stringify(r.skills || []),
        openings: Number.isInteger(r.openings) ? r.openings : 1,
        duration_weeks: Number.isInteger(r.duration_weeks) ? r.duration_weeks : 4,
        applications_open: r.applications_open === 0 ? 0 : 1,
      });
  })(json.internships);

  return db.prepare("SELECT COUNT(*) AS total FROM internships").get().total;
}

module.exports = { seed };

if (require.main === module) {
  const { openDb } = require("../src/db");
  console.log(`Seed complete. internships table now has ${seed(openDb())} records.`);
}
