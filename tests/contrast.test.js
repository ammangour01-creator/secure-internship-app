// WCAG 2.2 contrast checks computed from the real colours used in client/style.css.
// Text needs 4.5:1; borders, focus rings and other UI parts need 3:1.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "..", "client", "style.css"), "utf8").toLowerCase();

function luminance(hex) {
  const [r, g, b] = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{3}|[0-9a-f]{6})\\b`));
  assert.ok(m, `--${name} must be defined in :root`);
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]; // #fff -> #ffffff
  return "#" + h;
};

const t = { bg: token("bg"), card: token("card"), text: token("text"), muted: token("muted"), primary: token("primary"),
  primaryDark: token("primary-dark"), border: token("border"), danger: token("danger"), ok: token("ok") };
const TAG = ["#1a3a8f", "#e8eefc"], BADGE_BG = "#fde8e6", HOVER_BG = "#eef2fd", SKELETON = "#eef1f8", INPUT_BORDER = "#7a859c";

// [description, foreground, background, minimum ratio]
const pairs = [
  ["body text on page", t.text, t.bg, 4.5],
  ["body text on cards", t.text, t.card, 4.5],
  ["muted text on page", t.muted, t.bg, 4.5],
  ["muted text on cards", t.muted, t.card, 4.5],
  ["muted text on loading skeleton", t.muted, SKELETON, 4.5],
  ["white text on primary buttons", "#ffffff", t.primary, 4.5],
  ["white text on hovered primary buttons", "#ffffff", t.primaryDark, 4.5],
  ["primary text on secondary buttons", t.primary, "#ffffff", 4.5],
  ["primary text on hovered secondary buttons", t.primaryDark, HOVER_BG, 4.5],
  ["error text on white", t.danger, "#ffffff", 4.5],
  ["error text on page", t.danger, t.bg, 4.5],
  ["success text on white", t.ok, "#ffffff", 4.5],
  ["tag text", TAG[0], TAG[1], 4.5],
  ["'Applications closed' badge", t.danger, BADGE_BG, 4.5],
  ["input border on white (UI component)", INPUT_BORDER, "#ffffff", 3],
  ["focus ring on page", t.text, t.bg, 3],
  ["focus ring on dialog", t.text, t.card, 3],
];

for (const [name, fg, bg, min] of pairs)
  test(`contrast: ${name} is at least ${min}:1`, () => {
    const r = ratio(fg, bg);
    assert.ok(r >= min, `${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
  });

test("the hard-coded colours used above really exist in style.css (keeps this test honest)", () => {
  for (const hex of [...TAG, BADGE_BG, HOVER_BG, SKELETON, INPUT_BORDER]) assert.ok(css.includes(hex), `${hex} not found in style.css`);
  assert.match(css, /:focus-visible\s*\{\s*outline:\s*3px solid var\(--text\)/);
});
