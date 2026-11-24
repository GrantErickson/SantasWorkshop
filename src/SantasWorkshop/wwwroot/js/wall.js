import { $, api, applyBranding, countTo, esc, fmt, listen, snow } from "./common.js";
import { renderBlueprint } from "./blueprint.js";
import { setUpSound, sfx, startMachine, startMusic } from "./sound.js";

const FEATURE_SECONDS = 12;     // how long each blueprint stays in the featured spot
const CELEBRATE_SECONDS = 10;   // how long a brand-new wish takes over the screen
const SCROLL_PX_PER_SECOND = 32;

// Shown before anyone has made a wish.
const SAMPLE = {
  number: 0,
  blueprint: {
    machineName: "Your Machine Here 3000",
    tagline: "Tell the elf your least favorite task and watch it appear.",
    modules: [
      { kind: "hopper", label: "Your Busywork Goes In" },
      { kind: "brain", label: "Elf-Grade AI" },
      { kind: "gears", label: "Grinds Through It" },
      { kind: "gift-wrapper", label: "Done & Wrapped" },
    ],
    fineprint: "Side effects may include free time and holiday cheer.",
  },
};

let config;
let items = [];
let featureIndex = 0;
let featureTimer = 0;
let celebrating = false;
let scrollOffset = 0;
let loopHeight = 0;

init();

async function init() {
  snow($("#snow"), { count: 110 });
  setUpSound({ page: "wall", musicButton: true });
  startMusic();
  config = await applyBranding();
  await refresh();
  listen(
    {
      wish: ({ item, stats }) => {
        items = [item, ...items.filter((i) => i.id !== item.id)];
        renderList(true);
        setStats(stats);
        celebrate(item);
      },
      refresh: () => refresh(),
    },
    () => refresh(),
  );
  setInterval(refresh, 60_000); // belt and braces in case an event was missed
  requestAnimationFrame(scrollLoop);
}

async function refresh() {
  try {
    const data = await api("/api/wall?take=200");
    items = data.items;
    renderList(false);
    setStats(data.stats);
    if (!celebrating) startFeatureRotation();
  } catch { /* server restarting; try again next tick */ }
}

function setStats(stats) {
  countTo($("#hours"), stats.totalHours);
}

// ---- Scrolling wish list -------------------------------------------------

function itemHtml(item, fresh) {
  return `
    <div class="wall-item${fresh ? " fresh" : ""}">
      <span class="wall-item-text">${esc(item.wallText)}</span>
      <span class="wall-item-meta"><span class="chip">${esc(item.category)}</span><b>${fmt(item.hours)}</b> hrs/yr</span>
    </div>`;
}

function renderList(highlightFirst) {
  const list = $("#list");
  if (items.length === 0) {
    list.innerHTML = `<div class="wall-empty">…be the first to make a wish at the tablet!</div>`;
    loopHeight = 0;
    scrollOffset = 0;
    list.style.transform = "";
    return;
  }
  const copy = items.map((it, i) => itemHtml(it, highlightFirst && i === 0)).join("");
  list.innerHTML = `<div class="wall-copy">${copy}</div>`;
  const viewport = $("#viewport");
  if (list.scrollHeight > viewport.clientHeight) {
    // Two copies end to end let the list loop forever without a jump.
    list.innerHTML = `<div class="wall-copy">${copy}<div class="wall-sep">❄ ❄ ❄</div></div><div class="wall-copy" aria-hidden="true">${items.map((it) => itemHtml(it, false)).join("")}<div class="wall-sep">❄ ❄ ❄</div></div>`;
    loopHeight = list.firstElementChild.offsetHeight;
  } else {
    loopHeight = 0;
  }
  scrollOffset = 0;
  list.style.transform = "translateY(0)";
}

let lastFrame = performance.now();
function scrollLoop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (loopHeight > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scrollOffset = (scrollOffset + dt * SCROLL_PX_PER_SECOND) % loopHeight;
    $("#list").style.transform = `translateY(${-scrollOffset}px)`;
  }
  requestAnimationFrame(scrollLoop);
}

// ---- Featured blueprint --------------------------------------------------

function startFeatureRotation() {
  clearInterval(featureTimer);
  featureIndex = 0;
  showFeature();
  featureTimer = setInterval(() => {
    featureIndex++;
    showFeature();
  }, FEATURE_SECONDS * 1000);
}

function showFeature() {
  const pool = items.slice(0, 12);
  const card = $("#featureCard");
  if (pool.length === 0) {
    $("#featureLabel").textContent = "Coming soon to a workshop near you";
    card.innerHTML = renderBlueprint(SAMPLE, { company: config.companyName });
    $("#featureMeta").innerHTML = "";
    return;
  }
  const item = pool[featureIndex % pool.length];
  $("#featureLabel").textContent = featureIndex % pool.length === 0 ? "Fresh from the workshop" : "From the workshop";
  card.classList.remove("swap-in");
  void card.offsetWidth; // restart the CSS animation
  card.classList.add("swap-in");
  card.innerHTML = renderBlueprint(item, { company: config.companyName });
  $("#featureMeta").innerHTML = `
    <span class="hand">…${esc(item.wallText)}</span>
    <span class="wall-feature-hours">≈ <b>${fmt(item.hours)}</b> hrs/yr back</span>`;
}

// ---- New wish celebration ------------------------------------------------

function celebrate(item) {
  celebrating = true;
  clearInterval(featureTimer);
  $("#celebrateWish").innerHTML = `<span class="hand">I wish AI would</span> ${esc(item.wallText)}`;
  $("#celebrateCard").innerHTML = renderBlueprint(item, { company: config.companyName });
  $("#celebrateMeta").innerHTML = `<span class="chip">${esc(item.category)}</span> ≈ <b>${fmt(item.hours)}</b> hours a year back`;
  const overlay = $("#celebrate");
  overlay.classList.remove("hidden", "leaving");
  sfx("fanfare");
  startMachine((item.blueprint?.modules ?? []).map((m) => m.kind), $("#celebrateCard svg"), { delay: 1 });
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => {
    overlay.classList.add("leaving");
    setTimeout(() => {
      overlay.classList.add("hidden");
      celebrating = false;
      startFeatureRotation();
    }, 600);
  }, CELEBRATE_SECONDS * 1000);
}
