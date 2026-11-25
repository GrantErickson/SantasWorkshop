import { $, api, applyBranding, countTo, esc, fmt, listen, snow } from "./common.js";
import { renderBlueprint } from "./blueprint.js";
import { setUpSound, sfx, showNowPlaying, startMachine, startMusic } from "./sound.js";
import { makeFlip } from "./picture.js";

const FEATURE_SECONDS = 12;     // how long each blueprint stays in the featured spot (it turns over to its picture halfway)
const CELEBRATE_SECONDS = 10;   // how long a brand-new wish takes over the screen
const PICTURE_HOLD_SECONDS = 8; // how long the takeover stays up once the elves finish painting its picture
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
let featureTurnTimer = 0;
let celebrating = null; // the wish taking over the screen, if any
let featureFlip;
let celebrateFlip;
let scrollOffset = 0;
let loopHeight = 0;

init();

async function init() {
  snow($("#snow"), { count: 110 });
  setUpSound({ page: "wall", musicButton: true });
  showNowPlaying($("#nowPlaying"));
  startMusic();
  featureFlip = makeFlip($("#featureFlip"));
  celebrateFlip = makeFlip($("#celebrateFlip"));
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
      picture: ({ id, pictureUrl }) => pictureReady(id, pictureUrl),
      refresh: () => refresh(),
    },
    () => refresh(),
  );
  setInterval(() => refresh({ restart: false }), 60_000); // belt and braces in case an event was missed
  requestAnimationFrame(scrollLoop);
}

async function refresh({ restart = true } = {}) {
  try {
    const data = await api("/api/wall?take=200");
    items = data.items;
    renderList(false);
    setStats(data.stats);
    // Staff changes (hiding a wish, removing a picture) show at once, from the same spot in the rotation.
    // The once-a-minute check leaves a running rotation alone.
    if (!celebrating && (restart || !featureTimer)) startFeatureRotation(featureIndex);
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

const featurePool = () => items.slice(0, 12);

function startFeatureRotation(from = 0, { justPainted = false } = {}) {
  stopFeatureRotation();
  featureIndex = from;
  showFeature({ justPainted });
  featureTimer = setInterval(() => {
    featureIndex++;
    showFeature();
  }, FEATURE_SECONDS * 1000);
}

function stopFeatureRotation() {
  clearInterval(featureTimer);
  clearTimeout(featureTurnTimer);
  featureTimer = 0;
}

function showFeature({ justPainted = false } = {}) {
  clearTimeout(featureTurnTimer);
  const pool = featurePool();
  const host = $("#featureFlip");
  if (pool.length === 0) {
    $("#featureLabel").textContent = "Coming soon to a workshop near you";
    featureFlip.reset();
    featureFlip.front.innerHTML = renderBlueprint(SAMPLE, { company: config.companyName, mark: config.glyphUrl });
    $("#featureMeta").innerHTML = "";
    return;
  }
  const item = pool[featureIndex % pool.length];
  $("#featureLabel").textContent = justPainted ? "Just painted by the elves"
    : featureIndex % pool.length === 0 ? "Fresh from the workshop" : "From the workshop";
  host.classList.remove("swap-in");
  void host.offsetWidth; // restart the CSS animation
  host.classList.add("swap-in");
  featureFlip.reset(item);
  featureFlip.front.innerHTML = renderBlueprint(item, { company: config.companyName, mark: config.glyphUrl });
  $("#featureMeta").innerHTML = `
    <span class="hand">…${esc(item.wallText)}</span>
    <span class="wall-feature-hours">≈ <b>${fmt(item.hours)}</b> hrs/yr back</span>`;
  if (item.pictureUrl) {
    // Blueprint first, then turn over to the picture halfway through; straight away for one that was just painted.
    featureFlip.show(item.pictureUrl, { turnOver: false });
    featureTurnTimer = setTimeout(() => featureFlip.show(item.pictureUrl, { sound: justPainted }),
      justPainted ? 1200 : FEATURE_SECONDS * 500);
  }
}

/** A wish's picture just finished painting: show it off, in the takeover if it's still up. */
function pictureReady(id, pictureUrl) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.pictureUrl = pictureUrl;
  item.picturePending = false;
  if (celebrating?.id === id) {
    celebrateFlip.show(pictureUrl, { sound: true });
    endCelebrationIn(PICTURE_HOLD_SECONDS);
  } else if (!celebrating) {
    const index = featurePool().indexOf(item);
    if (index >= 0) startFeatureRotation(index, { justPainted: true });
  }
}

// ---- New wish celebration ------------------------------------------------

function celebrate(item) {
  celebrating = item;
  stopFeatureRotation();
  $("#celebrateWish").innerHTML = `<span class="hand">I wish AI would</span> ${esc(item.wallText)}`;
  celebrateFlip.reset(item);
  celebrateFlip.front.innerHTML = renderBlueprint(item, { company: config.companyName, mark: config.glyphUrl });
  $("#celebrateMeta").innerHTML = `<span class="chip">${esc(item.category)}</span> ≈ <b>${fmt(item.hours)}</b> hours a year back`;
  const overlay = $("#celebrate");
  overlay.classList.remove("hidden", "leaving");
  sfx("fanfare");
  startMachine((item.blueprint?.modules ?? []).map((m) => m.kind), celebrateFlip.front.querySelector("svg"), { delay: 1 });
  endCelebrationIn(CELEBRATE_SECONDS);
}

function endCelebrationIn(seconds) {
  const overlay = $("#celebrate");
  clearTimeout(celebrate.timer);
  clearTimeout(celebrate.leaving);
  celebrate.timer = setTimeout(() => {
    overlay.classList.add("leaving");
    celebrate.leaving = setTimeout(() => {
      overlay.classList.add("hidden");
      celebrating = null;
      startFeatureRotation();
    }, 600);
  }, seconds * 1000);
}
