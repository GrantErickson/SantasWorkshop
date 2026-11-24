// Shared helpers for every booth screen.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const fmt = (n) => Math.round(n ?? 0).toLocaleString("en-US");

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let configPromise;
export const getConfig = () => (configPromise ??= api("/api/config"));

/** Fill in elements marked data-brand / data-days with the configured company name etc. */
export async function applyBranding() {
  const cfg = await getConfig();
  for (const el of $$("[data-brand]")) {
    el.innerHTML = cfg.logoUrl
      ? `<img src="${esc(cfg.logoUrl)}" alt="${esc(cfg.companyName)}">`
      : esc(cfg.companyName);
  }
  for (const el of $$("[data-company]")) el.textContent = cfg.companyName;
  for (const el of $$("[data-company-url]")) {
    el.textContent = cfg.companyUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (el.tagName === "A") el.href = cfg.companyUrl;
  }
  for (const el of $$("[data-days]")) el.textContent = cfg.builtInDays === 1 ? "1 day" : `${cfg.builtInDays} days`;
  for (const el of $$("[data-region]")) el.textContent = cfg.regionName;
  return cfg;
}

/**
 * Live updates over server-sent events. EventSource reconnects by itself; onReconnect lets a
 * screen re-sync anything it missed while the connection was down.
 */
export function listen(handlers, onReconnect) {
  let connectedBefore = false;
  const source = new EventSource("/api/events");
  source.addEventListener("hello", () => {
    if (connectedBefore) onReconnect?.();
    connectedBefore = true;
  });
  for (const [type, fn] of Object.entries(handlers)) {
    source.addEventListener(type, (e) => fn(JSON.parse(e.data)));
  }
  return source;
}

/** Gentle snowfall behind the content. */
export function snow(canvas, { count = 90 } = {}) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, flakes;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const make = () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.8 + Math.random() * 2.6,
    s: 0.25 + Math.random() * 0.9,
    d: Math.random() * Math.PI * 2,
  });
  resize();
  flakes = Array.from({ length: count }, make);
  addEventListener("resize", resize);
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (const f of flakes) {
      f.y += f.s;
      f.d += 0.01;
      f.x += Math.sin(f.d) * 0.35;
      if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
      ctx.globalAlpha = 0.35 + f.r / 5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(tick);
  };
  tick();
}

/** HTML for the "how AI could really do this" panel. */
export function practicalHtml(wish, { showFirstStep = true } = {}) {
  const p = wish.practical;
  return `
    <div class="eyebrow">How AI could really do this</div>
    <h3>${esc(p.headline)}</h3>
    <ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="tags">${p.techniques.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    ${showFirstStep && p.firstStep ? `<div class="first-step"><b>Try this first:</b> ${esc(p.firstStep)}</div>` : ""}
    <div class="hours">
      <span class="num">≈ ${fmt(p.hoursSavedPerYear)}</span>
      <span class="unit">hours a year back</span>
      <span class="why">${esc(p.hoursAssumption)}</span>
    </div>`;
}

/** Animate a number from its current value to a new one. */
export function countTo(el, to, { duration = 1600 } = {}) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
