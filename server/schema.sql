-- Internship API schema (SQLite)
-- Based on the supplied EdVyro starter database, extended with
-- location, skills (JSON text) and openings so the supplied JSON seed fits.

CREATE TABLE IF NOT EXISTS internships (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    mode TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '[]',
    openings INTEGER NOT NULL DEFAULT 1,
    duration_weeks INTEGER NOT NULL DEFAULT 4,
    applications_open INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id TEXT NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    portfolio_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (internship_id, applicant_email),
    FOREIGN KEY (internship_id) REFERENCES internships(id)
);
