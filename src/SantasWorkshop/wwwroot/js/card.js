import { $, api, applyBranding, esc, practicalHtml, snow } from "./common.js";
import { renderBlueprint } from "./blueprint.js";
import { waitForPicture } from "./picture.js";

const wishId = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

init();

async function init() {
  snow($("#snow"), { count: 50 });
  const config = await applyBranding();

  let wish;
  try {
    wish = await api(`/api/wishes/${encodeURIComponent(wishId)}`);
  } catch {
    $("#loading").classList.add("hidden");
    $("#missing").classList.remove("hidden");
    return;
  }

  document.title = `${wish.blueprint.machineName} · Santa's AI Workshop`;
  $("#cEyebrow").textContent = `Wish #${wish.number}`;
  $("#cWish").innerHTML = `<span class="hand">I wish AI would</span> ${esc(wish.text)}`;
  $("#cBlueprint").innerHTML = renderBlueprint(wish, { company: config.companyName, mark: config.glyphUrl });
  $("#cPractical").innerHTML = practicalHtml(wish, { glanceFirst: true });
  $("#loading").classList.add("hidden");
  $("#card").classList.remove("hidden");

  showPicture(wish);
  if (wish.leadSubmitted) showThanks();
  $("#leadForm").addEventListener("submit", submit);
}

async function submit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const error = $("#formError");
  error.textContent = "";

  if (!data.name?.trim()) return fail("Please add your name.", form.name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email?.trim() || "")) return fail("That email address doesn't look quite right.", form.email);
  if (!data.company?.trim()) return fail("Please add your company.", form.company);
  if (!form.consent.checked) return fail("Please tick the box so we're allowed to email you.", form.consent);

  const button = $("#leadBtn");
  button.disabled = true;
  button.textContent = "Sending to the elves…";
  try {
    await api(`/api/wishes/${encodeURIComponent(wishId)}/lead`, {
      method: "POST",
      body: {
        name: data.name.trim(),
        email: data.email.trim(),
        company: data.company.trim(),
        role: (data.role || "").trim(),
        consent: true,
      },
    });
    showThanks();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = "Send me my plan";
  }

  function fail(message, field) {
    error.textContent = message;
    field?.focus();
  }
}

/** The AI-painted picture of the machine. If the elves are still painting it, wait for it here. */
async function showPicture(wish) {
  const figure = $("#cPicture");
  const img = $("#cPictureImg");
  const caption = $("#cPictureCap");
  img.alt = `An AI-painted picture of the ${wish.blueprint.machineName}`;
  let url = wish.pictureUrl;
  if (!url && wish.picturePending) {
    figure.classList.remove("hidden");
    figure.classList.add("painting");
    caption.textContent = "🎨 The elves are painting a picture of your machine. It'll appear here in a moment…";
    url = await waitForPicture(wish.id);
  }
  if (!url) { figure.classList.add("hidden"); return; }
  img.src = url;
  try { await img.decode(); } catch { figure.classList.add("hidden"); return; }
  figure.classList.remove("hidden", "painting");
  caption.textContent = "🎨 Your machine, as painted by AI";
}

function showThanks() {
  $("#optin").classList.add("hidden");
  $("#thanks").classList.remove("hidden");
}
