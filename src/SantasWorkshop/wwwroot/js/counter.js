import { $, api, applyBranding, countTo, esc, fmt, listen, snow } from "./common.js";
import { setUpSound, sfx } from "./sound.js";

const MAX_BARS = 5; // plus an "Everything else" row, so it always fits a 16:9 screen

let latest = [];
let shownHours = 0;

init();

async function init() {
  snow($("#snow"), { count: 110 });
  setUpSound({ page: "counter" });
  await applyBranding();
  await refresh();
  listen(
    {
      wish: ({ item, stats }) => {
        latest = [item, ...latest].slice(0, 8);
        if (stats.totalHours > shownHours) sfx("odometer");
        render(stats);
      },
      refresh: () => refresh(),
    },
    () => refresh(),
  );
  setInterval(refresh, 60_000);
}

async function refresh() {
  try {
    const data = await api("/api/wall?take=8");
    latest = data.items;
    render(data.stats);
  } catch { /* server restarting */ }
}

function render(stats) {
  shownHours = stats.totalHours;
  setOdometer(stats.totalHours);
  countTo($("#wishCount"), stats.wishCount, { duration: 800 });
  $("#eqPeople").textContent = (stats.totalHours / 2080).toFixed(1);
  countTo($("#eqWeeks"), Math.round(stats.totalHours / 40));
  countTo($("#eqCookies"), stats.totalHours * 2);
  renderBars(stats.categories);
  renderTicker();
}

// ---- Rolling odometer ----------------------------------------------------

function setOdometer(value) {
  const el = $("#odometer");
  const text = fmt(value);
  el.setAttribute("aria-label", `${text} hours`);
  const chars = [...text];
  // Rebuild only when the number of characters changes; otherwise roll the existing wheels.
  if (el.children.length !== chars.length) {
    el.innerHTML = chars.map((c) => /\d/.test(c)
      ? `<span class="digit"><span class="wheel">${"0123456789".split("").map((d) => `<span>${d}</span>`).join("")}</span></span>`
      : `<span class="comma">${c}</span>`).join("");
  }
  chars.forEach((c, i) => {
    const wheel = el.children[i].querySelector(".wheel");
    if (wheel) wheel.style.transform = `translateY(${-Number(c) * 10}%)`;
  });
}

// ---- Category bars (single series: one color, ranked, values labeled) -----

function renderBars(categories) {
  const rows = categories.slice(0, MAX_BARS);
  if (categories.length > MAX_BARS) {
    const rest = categories.slice(MAX_BARS);
    rows.push({ name: "Everything else", hours: rest.reduce((s, c) => s + c.hours, 0), count: rest.reduce((s, c) => s + c.count, 0) });
  }
  const max = Math.max(1, ...rows.map((r) => r.hours));
  $("#bars").innerHTML = rows.length === 0
    ? `<div class="bars-empty">Waiting for the first wish…</div>`
    : rows.map((r) => `
      <div class="bar-row" title="${esc(r.name)}: ${fmt(r.hours)} hours from ${r.count} wish${r.count === 1 ? "" : "es"}">
        <span class="bar-name">${esc(r.name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.max(1.5, (r.hours / max) * 100)}%"></span></span>
        <span class="bar-value">${fmt(r.hours)}</span>
      </div>`).join("");
}

function renderTicker() {
  $("#ticker").innerHTML = latest.length
    ? `<b>Latest:</b> ${latest.slice(0, 3).map((i) => `“…${esc(i.wallText)}”`).join(" · ")}`
    : "Make your wish at the tablet ✨";
}
