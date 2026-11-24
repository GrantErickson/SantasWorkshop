import { $, $$, api, applyBranding, esc, practicalHtml, snow } from "./common.js";
import { gear, renderBlueprint } from "./blueprint.js";
import { setUpSound, sfx, startMachine, startMusic, stopMusic } from "./sound.js";

const RESULT_IDLE_SECONDS = 120; // reset to the start screen after this long without a touch
const ASK_IDLE_SECONDS = 75;     // clear a half-typed wish someone walked away from

const IDEAS = [
  "do our expense reports", "triage the support inbox", "write proposals", "take meeting notes",
  "reconcile invoices", "answer HR policy questions", "build the monthly report", "schedule meetings",
  "onboard new hires", "review contracts", "enter data from PDFs", "follow up with leads",
  "update the CRM", "write job descriptions", "answer the same customer questions", "track inventory",
];

const WORKING_LINES = [
  "Reading your wish… twice.",
  "Sharpening candy-cane pencils…",
  "Consulting the North Pole engineering department…",
  "Drafting the blueprint…",
  "Estimating the hours you'll get back…",
  "Asking Rudolph for a second opinion…",
  "Checking it twice…",
];

let config;
let kioskKey = "";
let idleTimer = 0;
let idleDeadline = 0;
let idleSeconds = 0;
let recognition = null;

init();

async function init() {
  snow($("#snow"));
  $("#gearBig").innerHTML = gear(40, 12, 10);
  $("#gearSmall").innerHTML = gear(22, 9, 7);
  $("#gearTiny").innerHTML = gear(14, 7, 6);

  // ?key=... arrives once when staff open the kiosk; remember it and tidy the address bar.
  const params = new URLSearchParams(location.search);
  if (params.has("key")) {
    kioskKey = params.get("key");
    try { localStorage.setItem("kioskKey", kioskKey); } catch { /* private mode */ }
    history.replaceState(null, "", location.pathname);
  } else {
    try { kioskKey = localStorage.getItem("kioskKey") || ""; } catch { /* private mode */ }
  }

  setUpSound({ page: "kiosk", mount: $("#soundSlot") });
  config = await applyBranding();
  setUpVoice();
  showAsk();

  $("#wishForm").addEventListener("submit", (e) => { e.preventDefault(); makeWish(); });
  $("#wishText").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); makeWish(); }
  });
  for (const id of ["#againBtn", "#naughtyBtn", "#oopsBtn"]) {
    $(id).addEventListener("click", () => { sfx("tap"); showAsk(); });
  }
  addEventListener("pointerdown", bumpIdle, { passive: true });
  addEventListener("keydown", bumpIdle, { passive: true });
}

function show(id) {
  for (const s of $$(".screen")) s.classList.toggle("hidden", s.id !== id);
}

function showAsk() {
  stopListening();
  show("ask");
  $("#wishText").value = "";
  $("#sendBtn").disabled = false;
  const picks = [...IDEAS].sort(() => Math.random() - 0.5).slice(0, 6);
  $("#chips").innerHTML = picks.map((i) => `<button type="button" class="chip">${esc(i)}</button>`).join("");
  for (const chip of $$("#chips .chip")) {
    chip.addEventListener("click", () => { sfx("tap"); $("#wishText").value = chip.textContent; $("#wishText").focus(); });
  }
  setIdle(ASK_IDLE_SECONDS, showAsk);
}

async function makeWish() {
  const text = $("#wishText").value.trim();
  if (text.length < 3) {
    $("#wishText").focus();
    $("#wishText").placeholder = "Type a work task here first!";
    sfx("oops");
    return;
  }
  stopListening();
  clearIdle();
  $("#sendBtn").disabled = true;
  $("#wishEcho").textContent = `“I wish AI would ${text}”`;
  show("working");
  sfx("send");
  startMusic({ playlist: ["jingle"], tempo: 1.1 });
  const stopWorking = animateWorking();

  try {
    const res = await api("/api/wishes", {
      method: "POST",
      body: { text },
      headers: kioskKey ? { "X-Kiosk-Key": kioskKey } : {},
    });
    stopWorking();
    stopMusic(0.4);
    if (!res.wish.appropriate) {
      show("naughty");
      sfx("naughty");
      setIdle(30, showAsk);
      return;
    }
    showResult(res.wish);
  } catch (err) {
    stopWorking();
    stopMusic(0.4);
    $("#oopsMsg").textContent = err.status === 401
      ? "This kiosk isn't unlocked yet. Ask a staff member to open it with the kiosk link."
      : err.status === 429
        ? "The elves need a quick cocoa break. Try again in a minute!"
        : "The elves hit a snag. Please try again.";
    show("oops");
    sfx("oops");
    setIdle(30, showAsk);
  }
}

function animateWorking() {
  let i = 0;
  const start = performance.now();
  $("#workingMsg").textContent = WORKING_LINES[0];
  $("#progressBar").style.width = "4%";
  const lines = setInterval(() => {
    i = (i + 1) % WORKING_LINES.length;
    $("#workingMsg").textContent = WORKING_LINES[i];
  }, 2300);
  // Fills quickly at first and slows down; never quite reaches the end on its own.
  const bar = setInterval(() => {
    const t = (performance.now() - start) / 1000;
    $("#progressBar").style.width = `${Math.min(96, 100 * (1 - Math.exp(-t / 9)))}%`;
  }, 250);
  return () => {
    clearInterval(lines);
    clearInterval(bar);
    $("#progressBar").style.width = "100%";
  };
}

function showResult(wish) {
  $("#rEyebrow").textContent = `Wish #${wish.number} granted!`;
  $("#rWish").innerHTML = `<span class="hand">I wish AI would</span> ${esc(wish.text)}`;
  $("#rBlueprint").innerHTML = renderBlueprint(wish, { company: config.companyName });
  $("#rPractical").innerHTML = practicalHtml(wish);
  $("#rQr").src = `/qr/${encodeURIComponent(wish.id)}.svg`;
  show("result");
  sfx("fanfare");
  startMachine((wish.blueprint?.modules ?? []).map((m) => m.kind), $("#rBlueprint svg"), { delay: 1 });
  setIdle(RESULT_IDLE_SECONDS, showAsk, true);
}

// ---- Idle handling -------------------------------------------------------

function setIdle(seconds, onIdle, showCountdown = false) {
  clearIdle();
  idleSeconds = seconds;
  idleDeadline = Date.now() + seconds * 1000;
  idleTimer = setInterval(() => {
    const left = Math.ceil((idleDeadline - Date.now()) / 1000);
    if (showCountdown) $("#resetMsg").textContent = left <= 20 ? `Starting over in ${left}s… tap to stay` : "";
    if (left <= 0) { clearIdle(); onIdle(); }
  }, 500);
}

function clearIdle() {
  clearInterval(idleTimer);
  idleTimer = 0;
  $("#resetMsg").textContent = "";
}

function bumpIdle() {
  if (idleTimer) idleDeadline = Date.now() + idleSeconds * 1000;
}

// ---- Voice input (Chrome/Edge/Safari, needs HTTPS or localhost) ----------

function setUpVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition || !window.isSecureContext) return;
  const mic = $("#micBtn");
  mic.classList.remove("hidden");
  mic.addEventListener("click", () => (recognition ? stopListening() : startListening(Recognition)));
}

function startListening(Recognition) {
  const box = $("#wishText");
  const before = box.value ? box.value.trim() + " " : "";
  recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onresult = (e) => {
    const said = [...e.results].map((r) => r[0].transcript).join(" ");
    box.value = (before + said.replace(/^\s*i wish (ai|it) would\s*/i, "")).trim();
  };
  recognition.onend = stopListening;
  recognition.onerror = stopListening;
  recognition.start();
  sfx("micOn");
  $("#micBtn").classList.add("listening");
}

function stopListening() {
  if (recognition) {
    const r = recognition;
    recognition = null;
    try { r.stop(); } catch { /* already stopped */ }
    sfx("micOff");
  }
  $("#micBtn").classList.remove("listening");
}
