// The AI-painted picture of a wish's machine. It's painted in the background after the blueprint appears, so
// screens show the blueprint first, then turn the card over to the picture when it's ready.
import { api } from "./common.js";
import { sfx } from "./sound.js";

const FLIP_HTML = `
  <div class="flip-inner">
    <div class="blueprint-card flip-front"></div>
    <div class="picture-card flip-back" aria-hidden="true">
      <img alt="">
      <span class="picture-tag">🎨 Painted by AI</span>
    </div>
  </div>
  <button type="button" class="flip-btn hidden"></button>`;

/**
 * Turns `host` into a card with the blueprint on the front and the picture on the back.
 * Put the blueprint SVG in `.front`. With `interactive`, tapping the card or its button turns it over.
 */
export function makeFlip(host, { interactive = false } = {}) {
  host.classList.add("flip");
  host.innerHTML = FLIP_HTML;
  const inner = host.querySelector(".flip-inner");
  const front = host.querySelector(".flip-front");
  const back = host.querySelector(".flip-back");
  const img = back.querySelector("img");
  const button = host.querySelector(".flip-btn");
  let state = "none"; // none | pending | ready
  let flipped = false;
  let shown = "";
  let generation = 0; // bumps on reset, so a picture still loading for the previous wish is ignored

  const render = () => {
    host.classList.toggle("flipped", flipped);
    front.setAttribute("aria-hidden", String(flipped));
    back.setAttribute("aria-hidden", String(!flipped));
    // TVs only show the "painting" label; the picture carries its own "Painted by AI" tag.
    button.classList.toggle("hidden", state === "none" || (state === "ready" && !interactive));
    button.classList.toggle("painting", state === "pending");
    button.disabled = !interactive || state !== "ready";
    button.textContent = state === "pending"
      ? "🎨 The elves are painting it…"
      : flipped ? "📐 See the blueprint" : "🖼️ See the picture";
  };

  const turn = (on) => {
    if (state !== "ready") return;
    flipped = on;
    render();
  };

  if (interactive) {
    button.addEventListener("click", (e) => { e.stopPropagation(); sfx("tap"); turn(!flipped); });
    inner.addEventListener("click", () => { if (state === "ready") { sfx("tap"); turn(!flipped); } });
  }

  return {
    front,
    get flipped() { return flipped; },
    /** Back to a plain blueprint, ready for the next wish. */
    reset(item) {
      generation++;
      state = item?.picturePending ? "pending" : "none";
      flipped = false;
      shown = "";
      img.removeAttribute("src");
      img.alt = item?.blueprint?.machineName ? `An AI-painted picture of the ${item.blueprint.machineName}` : "";
      render();
    },
    pending() { state = "pending"; render(); },
    /** Hides the "painting" label, e.g. when the picture didn't come. */
    none() { state = "none"; flipped = false; render(); },
    /** Loads the picture, then (by default) turns the card over to it. Resolves false if it couldn't load. */
    async show(url, { turnOver = true, sound = false } = {}) {
      const mine = generation;
      if (shown !== url) {
        img.src = url;
        let loaded = true;
        try { await img.decode(); } catch { loaded = false; }
        if (mine !== generation) return false;
        if (!loaded) { state = "none"; render(); return false; }
        shown = url;
      }
      state = "ready";
      flipped = turnOver || flipped;
      render();
      if (sound) sfx("reveal");
      return true;
    },
    turn,
  };
}

/**
 * Checks on a wish until its picture is painted. Resolves with the picture's URL, or null if it failed,
 * was removed, took too long, or `signal` was aborted.
 */
export async function waitForPicture(id, { signal, every = 2500, timeout = 150_000 } = {}) {
  const giveUp = Date.now() + timeout;
  while (!signal?.aborted && Date.now() < giveUp) {
    await new Promise((r) => setTimeout(r, every));
    if (signal?.aborted) return null;
    try {
      const wish = await api(`/api/wishes/${encodeURIComponent(id)}`);
      if (!wish.picturePending) return wish.pictureUrl ?? null;
    } catch { /* server restarting; keep trying */ }
  }
  return null;
}
