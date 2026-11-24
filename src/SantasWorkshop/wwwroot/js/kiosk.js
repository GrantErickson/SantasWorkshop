import { $, $$, api, applyBranding, esc, practicalHtml, snow } from "./common.js";
import { gear, renderBlueprint } from "./blueprint.js";
import { setUpSound, sfx, startMachine, startMusic, stopMusic } from "./sound.js";
import { makeFlip, waitForPicture } from "./picture.js";

const RESULT_IDLE_SECONDS = 120; // reset to the start screen after this long without a touch
const ASK_IDLE_SECONDS = 75;     // clear a half-typed wish someone walked away from

const IDEAS = [
  "do our expense reports", "triage the support inbox", "write proposals", "take meeting notes",
  "reconcile invoices", "answer HR policy questions", "build the monthly report", "schedule meetings",
  "onboard new hires", "review contracts", "enter data from PDFs", "follow up with leads",
  "update the CRM", "write job descriptions", "answer the same customer questions", "track inventory",
];

// What the elves are up to while Claude works. Each wish opens with a random first line, then continues through a
// shuffled deck of the workshop lines. Slow answers get the "still going" lines.
const WORKING_OPENERS = [
  "Reading your wish… twice.",
  "Unrolling a fresh sheet of blueprint paper…",
  "Sharpening the candy-cane pencils…",
  "Waking up the night-shift elves…",
  "Rolling up tiny sleeves…",
  "Clearing a workbench for your wish…",
  "Ringing the workshop bell. Everybody up!",
  "Pinning your wish to the big corkboard…",
];

const WORKING_LINES = [
  "Consulting the North Pole engineering department…",
  "Drafting the blueprint…",
  "Measuring twice, wrapping once…",
  "Tightening the jingle bolts…",
  "Oiling the gingerbread gears…",
  "Untangling the fairy lights…",
  "Calibrating the snow-globe brain…",
  "Asking Rudolph for a second opinion…",
  "Borrowing a wrench from Mrs. Claus…",
  "Hammering in the peppermint rivets…",
  "Testing the conveyor belt with a fruitcake…",
  "Looking for the left-handed candy-cane wrench…",
  "Counting the sprockets. Then counting them again…",
  "Tuning the jingle bells to the right key…",
  "Wiring up the tinsel. Carefully…",
  "Adding a few extra gears, just in case…",
  "Teaching the robot arm to wave…",
  "Topping up the cocoa tank…",
  "Polishing the brass pipes…",
  "Checking the elves' break schedule…",
  "Asking the snowmen to keep things cool…",
  "Sweeping up the glitter…",
  "Running it past the head elf…",
  "Borrowing power from the toy train set…",
  "Asking the penguins for directions. Wrong pole…",
  "Shooing the reindeer off the blueprints…",
  "Swapping the squeaky wheel for a jingly one…",
  "Bolting on a bigger funnel…",
  "Finding the dull parts of your week to automate…",
  "Converting busywork into holiday cheer…",
  "Estimating the hours you'll get back…",
  "Doing the math on your new free time…",
  "Looking up how AI could really do this…",
  "Picking a first step you could try on Monday…",
  "Writing it all down in our neatest handwriting…",
  "Checking it twice…",
  "Adding a bow on top…",
];

const WORKING_SLOW = [
  "Still going! The best machines take a little longer…",
  "The elves have called in reinforcements…",
  "Almost there. One last tinsel adjustment…",
  "Santa wants to see this one personally…",
  "Just tightening the very last bolt…",
];

const WORKING_LINE_SECONDS = 2.6;
const WORKING_SLOW_AFTER_SECONDS = 18;

let config;
let kioskKey = "";
let idleTimer = 0;
let idleDeadline = 0;
let idleSeconds = 0;
let recognition = null;
let resultFlip;
let pictureWatch = null; // stops checking for the last guest's picture when the next guest starts

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
  resultFlip = makeFlip($("#rFlip"), { interactive: true });
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
  pictureWatch?.abort();
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

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Shared across wishes, so the next guest picks up where the last one left off and no line repeats until all have shown.
let workingQueue = [];
let slowQueue = [];

function animateWorking() {
  const start = performance.now();
  const message = $("#workingMsg");
  const say = (text) => {
    message.textContent = text;
    message.classList.remove("fresh");
    void message.offsetWidth; // restart the fade-in
    message.classList.add("fresh");
  };
  say(WORKING_OPENERS[Math.floor(Math.random() * WORKING_OPENERS.length)]);
  $("#progressBar").style.width = "4%";
  const lines = setInterval(() => {
    const waited = (performance.now() - start) / 1000;
    if (waited > WORKING_SLOW_AFTER_SECONDS) {
      if (slowQueue.length === 0) slowQueue = shuffle(WORKING_SLOW);
      say(slowQueue.shift());
    } else {
      if (workingQueue.length === 0) workingQueue = shuffle(WORKING_LINES);
      say(workingQueue.shift());
    }
  }, WORKING_LINE_SECONDS * 1000);
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
  resultFlip.reset(wish);
  resultFlip.front.innerHTML = renderBlueprint(wish, { company: config.companyName });
  $("#rPractical").innerHTML = practicalHtml(wish);
  $("#rQr").src = `/qr/${encodeURIComponent(wish.id)}.svg`;
  show("result");
  sfx("fanfare");
  startMachine((wish.blueprint?.modules ?? []).map((m) => m.kind), resultFlip.front.querySelector("svg"), { delay: 1 });
  setIdle(RESULT_IDLE_SECONDS, showAsk, true);
  if (wish.pictureUrl) resultFlip.show(wish.pictureUrl, { turnOver: false });
  else if (wish.picturePending) showPictureWhenPainted(wish.id);
}

/** The elves paint the machine in the background; turn the card over to the picture when it's ready. */
async function showPictureWhenPainted(id) {
  pictureWatch?.abort();
  const watch = (pictureWatch = new AbortController());
  const url = await waitForPicture(id, { signal: watch.signal });
  if (watch.signal.aborted) return;
  if (url && await resultFlip.show(url, { sound: true })) bumpIdle();
  else resultFlip.none();
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
