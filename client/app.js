// Internship Board: loads data from the API, shows loading / empty / error / retry states,
// and submits applications. All text is inserted with textContent (never innerHTML).
const PAGE_SIZE = 6;

const $ = (id) => document.getElementById(id);
const els = {
  form: $("filter-form"), search: $("search"), domain: $("domain"), mode: $("mode"), reset: $("reset"),
  status: $("status"), heading: $("results-heading"), state: $("state"), results: $("results"),
  pager: $("pager"), prev: $("prev"), next: $("next"), pageInfo: $("page-info"),
  dialog: $("detail"), title: $("detail-title"), meta: $("detail-meta"), skills: $("detail-skills"),
  close: $("detail-close"), apply: $("apply-form"), submit: $("submit"), formStatus: $("form-status"),
  name: $("f-name"), email: $("f-email"), url: $("f-url"),
};

let page = 1;
let current = null;          // internship shown in the dialog
let opener = null;           // element that opened the dialog (focus goes back here)
let controller = null;       // aborts an older request if a newer one starts
let searchTimer = null;
let focusResultsAfterLoad = false; // set when the user pages, so keyboard focus is not left on a stale button

// ---------- filters live in the URL (?q=&domain=&mode=&page=) so refresh, back and shared links keep the view ----------
function syncUrl() {
  const p = new URLSearchParams();
  if (els.search.value.trim()) p.set("q", els.search.value.trim());
  if (els.domain.value) p.set("domain", els.domain.value);
  if (els.mode.value) p.set("mode", els.mode.value);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// ---------- small helpers ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStatus(message) { els.status.textContent = message; }

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    const e = new Error("Cannot reach the server. Check your connection and try again.");
    e.network = true;
    throw e;
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok || !body || body.status !== "success") {
    const e = new Error((body && body.error && body.error.message) || `Server error (${res.status}).`);
    e.httpStatus = res.status;
    e.details = body && body.error && body.error.details;
    e.code = body && body.error && body.error.code;
    throw e;
  }
  return body;
}

// ---------- list rendering ----------
function showSkeletons() {
  els.state.hidden = true;
  els.results.replaceChildren(...Array.from({ length: 3 }, () => el("li", "card skeleton")));
  els.results.setAttribute("aria-busy", "true");
  els.pager.hidden = true;
}

function showState(kind, title, message, withRetry) {
  els.results.replaceChildren();
  els.results.setAttribute("aria-busy", "false");
  els.pager.hidden = true;
  els.state.className = "state" + (kind === "error" ? " error" : "");
  els.state.replaceChildren(el("h3", "", title), el("p", "", message));
  if (withRetry) {
    const retry = el("button", "btn", "Try again");
    retry.type = "button";
    retry.id = "retry";
    retry.addEventListener("click", () => {
      if (els.domain.options.length === 1) loadFilters(); // the dropdowns may have failed to load too
      loadList();
    });
    els.state.append(retry);
  }
  els.state.hidden = false;
}

function createCard(item) {
  const li = el("li", "card");
  li.append(el("h3", "", item.title));
  li.append(el("p", "meta", `${item.domain} · ${item.mode} · ${item.location || "Location not set"}`));
  const tags = el("ul", "tags");
  tags.setAttribute("aria-label", "Details");
  tags.append(el("li", "tag", `${item.duration_weeks} weeks`), el("li", "tag", `${item.openings} opening${item.openings === 1 ? "" : "s"}`));
  if (!item.applications_open) tags.append(el("li", "tag badge-closed", "Applications closed"));
  li.append(tags);
  const btn = el("button", "btn btn-secondary", item.applications_open ? "View details & apply" : "View details");
  btn.type = "button";
  btn.setAttribute("aria-label", `${btn.textContent}: ${item.title}`);
  btn.addEventListener("click", () => openDetail(item, btn));
  li.append(btn);
  return li;
}

function filtersActive() {
  return els.search.value.trim() !== "" || els.domain.value !== "" || els.mode.value !== "";
}

async function loadList() {
  if (controller) controller.abort();
  controller = new AbortController();
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (els.search.value.trim()) params.set("q", els.search.value.trim());
  if (els.domain.value) params.set("domain", els.domain.value);
  if (els.mode.value) params.set("mode", els.mode.value);

  syncUrl();
  setStatus("Loading internships…");
  showSkeletons();
  try {
    const body = await api(`/api/internships?${params}`, { signal: controller.signal });
    const { data, pagination } = body;
    if (data.length === 0 && page > 1) { // e.g. an old link with page=9: fall back to the first page
      page = 1;
      return loadList();
    }
    if (data.length === 0) {
      setStatus("No internships found.");
      showState(
        "empty",
        "No internships found",
        filtersActive() ? "Try a different search or clear the filters." : "There are no internships to show yet."
      );
      return;
    }
    els.state.hidden = true;
    els.results.replaceChildren(...data.map(createCard));
    els.results.setAttribute("aria-busy", "false");
    setStatus(`${pagination.total} internship${pagination.total === 1 ? "" : "s"} found.`);
    els.pager.hidden = pagination.totalPages <= 1;
    els.pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    els.prev.disabled = !pagination.hasPrev;
    els.next.disabled = !pagination.hasNext;
    if (focusResultsAfterLoad) { focusResultsAfterLoad = false; els.heading.focus(); }
  } catch (err) {
    if (err.name === "AbortError") return;
    setStatus("Could not load internships.");
    showState("error", "Could not load internships", err.message, true);
  }
}

async function loadFilters() {
  try {
    const { data } = await api("/api/filters");
    for (const d of data.domains) els.domain.append(new Option(d, d));
    for (const m of data.modes) els.mode.append(new Option(m, m));
  } catch {
    /* filters are optional; the list can still load without the dropdown options */
  }
}

// ---------- details dialog and application form ----------
const FIELDS = [
  { input: els.name, key: "name", err: $("f-name-err") },
  { input: els.email, key: "email", err: $("f-email-err") },
  { input: els.url, key: "portfolio_url", err: $("f-url-err") },
];

function clientValidate() {
  const problems = {};
  const name = els.name.value.trim().replace(/\s+/g, " ");
  if (!name) problems.name = "Name is required.";
  else if (name.length < 2 || name.length > 80) problems.name = "Name must be 2 to 80 characters.";
  else if (/[<>]/.test(name)) problems.name = "Name contains characters that are not allowed.";

  const email = els.email.value.trim();
  if (!email) problems.email = "Email is required.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.email = "Enter a valid email address.";

  const url = els.url.value.trim();
  if (url) {
    let parsed = null;
    try { parsed = new URL(url); } catch { /* handled below */ }
    if (!parsed) problems.portfolio_url = "Enter a full link such as https://example.com/me.";
    else if (!["http:", "https:"].includes(parsed.protocol)) problems.portfolio_url = "Only http:// or https:// links are allowed.";
    else if (parsed.username || parsed.password) problems.portfolio_url = "Links with a username or password are not allowed.";
  }
  return problems;
}

function showFieldErrors(problems) {
  let first = null;
  for (const f of FIELDS) {
    const message = problems[f.key] || "";
    f.err.textContent = message;
    if (message) { f.input.setAttribute("aria-invalid", "true"); first = first || f.input; }
    else f.input.removeAttribute("aria-invalid");
  }
  return first;
}

function setFormStatus(message, kind) {
  els.formStatus.textContent = message;
  els.formStatus.className = "form-status" + (kind ? " " + kind : "");
}

function openDetail(item, button) {
  current = item;
  opener = button;
  els.title.textContent = item.title;
  els.meta.textContent = `${item.domain} · ${item.mode} · ${item.location || "Location not set"} · ${item.duration_weeks} weeks · ${item.openings} opening${item.openings === 1 ? "" : "s"}`;
  els.skills.replaceChildren(...item.skills.map((s) => el("li", "tag", s)));
  els.apply.reset();
  showFieldErrors({});
  setFormStatus("", "");
  els.apply.hidden = !item.applications_open;
  if (!item.applications_open) setFormStatus("Applications for this internship are closed.", "error");
  els.dialog.showModal();
  (item.applications_open ? els.name : els.close).focus();
}

function closeDetail() { els.dialog.close(); }

els.dialog.addEventListener("close", () => {
  if (opener && document.contains(opener)) opener.focus();
});
els.close.addEventListener("click", closeDetail);
// Clicking the dimmed backdrop closes the dialog too.
els.dialog.addEventListener("click", (e) => { if (e.target === els.dialog) closeDetail(); });

els.apply.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormStatus("", "");
  const problems = clientValidate();
  const firstBad = showFieldErrors(problems);
  if (firstBad) { firstBad.focus(); return; }

  els.submit.disabled = true;
  els.submit.textContent = "Submitting…";
  try {
    await api("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internship_id: current.id,
        name: els.name.value,
        email: els.email.value,
        portfolio_url: els.url.value,
      }),
    });
    els.apply.hidden = true;
    setFormStatus("Application submitted. Thank you!", "success");
    els.formStatus.focus();
  } catch (err) {
    if (err.details && err.details.length) {
      const map = {};
      for (const d of err.details) map[d.field] = d.message;
      const first = showFieldErrors(map);
      if (first) first.focus();
      setFormStatus("Please fix the highlighted fields.", "error");
    } else if (err.httpStatus === 429) {
      setFormStatus(err.message, "error");
    } else {
      setFormStatus(err.message, "error");
    }
  } finally {
    els.submit.disabled = false;
    els.submit.textContent = "Submit application";
  }
});

// ---------- events ----------
els.form.addEventListener("submit", (e) => e.preventDefault());
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page = 1; loadList(); }, 300);
});
for (const select of [els.domain, els.mode]) select.addEventListener("change", () => { page = 1; loadList(); });
els.reset.addEventListener("click", () => {
  els.search.value = ""; els.domain.value = ""; els.mode.value = "";
  page = 1; loadList(); els.search.focus();
});
els.prev.addEventListener("click", () => { page = Math.max(1, page - 1); focusResultsAfterLoad = true; loadList(); });
els.next.addEventListener("click", () => { page += 1; focusResultsAfterLoad = true; loadList(); });

// Start: read the URL, load the dropdown options, then restore the selected values and load the list.
async function init() {
  const params = new URLSearchParams(location.search);
  els.search.value = (params.get("q") || "").slice(0, 60);
  const wanted = { domain: params.get("domain") || "", mode: params.get("mode") || "" };
  const n = Number(params.get("page"));
  page = Number.isInteger(n) && n >= 1 ? n : 1;
  await loadFilters();
  els.domain.value = wanted.domain; // an unknown value simply selects "All"
  els.mode.value = wanted.mode;
  loadList();
}
init();
