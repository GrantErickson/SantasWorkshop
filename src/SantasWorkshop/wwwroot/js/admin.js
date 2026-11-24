import { $, $$, api, esc, fmt } from "./common.js";

let key = "";
let leads = [];
let refreshTimer = 0;

try { key = localStorage.getItem("adminKey") || ""; } catch { /* private mode */ }

$("#keyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  key = $("#keyInput").value.trim();
  await start();
});

$("#signOut").addEventListener("click", () => {
  try { localStorage.removeItem("adminKey"); } catch { /* ignore */ }
  location.reload();
});

for (const tab of $$(".a-tabs button")) {
  tab.addEventListener("click", () => {
    for (const t of $$(".a-tabs button")) t.classList.toggle("active", t === tab);
    $("#tab-wishes").classList.toggle("hidden", tab.dataset.tab !== "wishes");
    $("#tab-leads").classList.toggle("hidden", tab.dataset.tab !== "leads");
  });
}

function adminApi(path, opts = {}) {
  return api(`/api/admin${path}`, { ...opts, headers: { "X-Admin-Key": key } });
}

start();

async function start() {
  if (!key) return showKeyForm();
  try {
    await loadAll();
  } catch (err) {
    return showKeyForm(err.status === 401 ? "That key didn't work." : err.message);
  }
  try { localStorage.setItem("adminKey", key); } catch { /* ignore */ }
  $("#keyForm").classList.add("hidden");
  $("#app").classList.remove("hidden");
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadAll().catch(() => {}), 15_000);
}

function showKeyForm(message = "") {
  $("#app").classList.add("hidden");
  $("#keyForm").classList.remove("hidden");
  $("#keyError").textContent = message;
  $("#keyInput").focus();
}

async function loadAll() {
  const [summary, wishes, leadRows] = await Promise.all([
    adminApi("/summary"), adminApi("/wishes"), adminApi("/leads"),
  ]);
  leads = leadRows;
  renderSummary(summary);
  renderWishes(wishes);
  renderLeads(leadRows);
}

function renderSummary(s) {
  const elf = s.claudeEnabled
    ? `<span class="ok">Claude ✓</span><br><span class="a-muted">${esc(s.model)} · ${esc(s.effort)}${s.fastMode ? " · fast" : ""}</span>`
    : `<span class="warn">Backup elf only</span>`;
  $("#stats").innerHTML = [
    ["Elf brain", elf, true],
    ["Wishes on the wall", fmt(s.stats.wishCount)],
    ["Hours counter", fmt(s.stats.totalHours)],
    ["Leads", fmt(s.stats.leadCount)],
    ["Live TV screens", fmt(s.liveScreens)],
    ["Avg. Claude time", s.averageSeconds ? `${s.averageSeconds.toFixed(1)}s` : "–"],
  ].map(([label, value, small]) => `
    <div class="a-stat"><div class="label">${label}</div><div class="value${small ? " small" : ""}">${value}</div></div>`).join("");

  const local = $("#alertLocal");
  local.classList.toggle("hidden", !s.publicBaseUrlIsLocal);
  local.innerHTML = `<b>Phones can't open QR codes that point at ${esc(s.publicBaseUrl)}.</b>
    Run with the <code>booth</code> profile and open this page using the laptop's network address
    (for example http://192.168.1.20:5284/admin), or deploy it and set <code>Workshop:PublicBaseUrl</code>.`;

  const backup = $("#alertBackup");
  backup.classList.toggle("hidden", s.claudeEnabled && s.backupWishes === 0);
  backup.innerHTML = !s.claudeEnabled
    ? `<b>Claude isn't connected</b>, so wishes come from the offline backup elf (templates).
       Set the <code>ANTHROPIC_API_KEY</code> environment variable and restart to use Claude.`
    : `<b>${s.backupWishes} wish${s.backupWishes === 1 ? "" : "es"} fell back to the backup elf</b> because Claude
       didn't answer in time. Check the venue Wi-Fi and the server log.`;

  const link = (el, url) => { el.href = url; el.textContent = url; };
  link($("#kioskLink"), s.kioskUrl);
  link($("#wallLink"), s.wallUrl);
  link($("#counterLink"), s.counterUrl);
  const kioskPath = s.kioskUrl.slice(s.publicBaseUrl.length) || "/kiosk";
  const qrSrc = `/api/admin/qr?path=${encodeURIComponent(kioskPath)}&key=${encodeURIComponent(key)}`;
  if ($("#kioskQr").dataset.src !== qrSrc) $("#kioskQr").src = $("#kioskQr").dataset.src = qrSrc;
  $("#csvLink").href = `/api/admin/leads.csv?key=${encodeURIComponent(key)}`;
}

function renderWishes(wishes) {
  const table = $("#wishTable");
  if (wishes.length === 0) {
    table.innerHTML = `<tr><td class="a-muted">No wishes yet.</td></tr>`;
    return;
  }
  table.innerHTML = `
    <thead><tr><th>#</th><th>Time</th><th>What they typed</th><th>On the wall as</th><th>Category</th><th class="num">Hrs/yr</th><th>Elf</th><th>Status</th><th></th></tr></thead>
    <tbody>${wishes.map((w) => `
      <tr class="${w.appropriate && !w.hidden ? "" : "is-hidden"}">
        <td>${w.number}</td>
        <td>${new Date(w.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
        <td class="wrap">${esc(w.text)}</td>
        <td class="wrap">…${esc(w.wallText)}<br><span class="a-muted">${esc(w.blueprint.machineName)}</span></td>
        <td>${esc(w.category)}</td>
        <td class="num">${fmt(w.practical.hoursSavedPerYear)}</td>
        <td>${w.source === "claude" ? `Claude <span class="a-muted">${w.elapsedSeconds}s</span>` : `<span class="pill wait">backup</span>`}</td>
        <td>${!w.appropriate ? `<span class="pill bad">flagged</span>` : w.hidden ? `<span class="pill">hidden</span>` : `<span class="pill good">on wall</span>`}</td>
        <td class="actions">
          ${w.appropriate ? `<button class="btn btn-sm btn-ghost-dark" data-hide="${esc(w.id)}" data-hidden="${!w.hidden}" type="button">${w.hidden ? "Show" : "Hide"}</button>` : ""}
          <a class="btn btn-sm btn-ghost-dark" href="/c/${encodeURIComponent(w.id)}" target="_blank" rel="noopener">Card</a>
        </td>
      </tr>`).join("")}
    </tbody>`;
  for (const btn of $$("[data-hide]", table)) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await adminApi(`/wishes/${btn.dataset.hide}/hidden`, { method: "POST", body: { hidden: btn.dataset.hidden === "true" } });
      await loadAll();
    });
  }
}

function renderLeads(rows) {
  const table = $("#leadTable");
  if (rows.length === 0) {
    table.innerHTML = `<tr><td class="a-muted">No leads yet. They appear when guests scan their card and opt in.</td></tr>`;
    return;
  }
  table.innerHTML = `
    <thead><tr><th>Time</th><th>Who</th><th>Wish</th><th>Plan</th><th>Sent</th><th></th></tr></thead>
    <tbody>${rows.map(({ lead, wish }, i) => `
      <tr>
        <td>${new Date(lead.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
        <td class="wrap"><b>${esc(lead.name)}</b><br>${esc(lead.email)}<br><span class="a-muted">${esc([lead.role, lead.company].filter(Boolean).join(", "))}</span></td>
        <td class="wrap">${wish ? `#${wish.number} …${esc(wish.wallText)}` : ""}</td>
        <td>${lead.planStatus === "ready" ? `<span class="pill good">ready${lead.plan?.source === "backup" ? " (template)" : ""}</span>`
            : lead.planStatus === "failed" ? `<span class="pill bad">failed</span>` : `<span class="pill wait">writing…</span>`}</td>
        <td><input type="checkbox" data-sent="${esc(lead.id)}" ${lead.sent ? "checked" : ""} aria-label="Email sent"></td>
        <td class="actions">
          ${lead.planStatus === "ready" ? `<button class="btn btn-sm btn-primary" data-preview="${i}" type="button">Email</button>` : ""}
          <button class="btn btn-sm btn-ghost-dark" data-regen="${esc(lead.id)}" type="button">Rewrite plan</button>
        </td>
      </tr>`).join("")}
    </tbody>`;

  for (const box of $$("[data-sent]", table)) {
    box.addEventListener("change", () => adminApi(`/leads/${box.dataset.sent}/sent`, { method: "POST", body: { sent: box.checked } }));
  }
  for (const btn of $$("[data-regen]", table)) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await adminApi(`/leads/${btn.dataset.regen}/regenerate`, { method: "POST" });
      await loadAll();
    });
  }
  for (const btn of $$("[data-preview]", table)) {
    btn.addEventListener("click", () => openEmail(leads[Number(btn.dataset.preview)]));
  }
}

function openEmail(row) {
  const email = row.email;
  $("#emailTo").textContent = `To: ${row.lead.name} <${email.to}>`;
  $("#emailSubject").textContent = email.subject;
  $("#emailFrame").srcdoc = email.html;
  $("#mailto").href = `mailto:${encodeURIComponent(email.to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.text)}`;
  $("#copyStatus").textContent = "";
  $("#copyHtml").onclick = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([email.html], { type: "text/html" }),
        "text/plain": new Blob([email.text], { type: "text/plain" }),
      })]);
      $("#copyStatus").textContent = "Copied! Paste it into a new email.";
    } catch {
      $("#copyStatus").textContent = "Couldn't copy formatted text here; try plain text.";
    }
  };
  $("#copyText").onclick = async () => {
    await navigator.clipboard.writeText(email.text);
    $("#copyStatus").textContent = "Copied plain text.";
  };
  $("#emailDialog").showModal();
}
