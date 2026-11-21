"use strict";
// Remote feed (updated daily by the agent). Same-origin on the website, absolute URL inside the Android app.
const REMOTE = "https://tanishshahh.github.io/ahmedabad-leads/data/leads-data.json";
const LOCAL = "data/leads-data.json";
const STATUSES = ["new", "contacted", "replied", "won", "lost"];
const STATUS_LABEL = { new: "New", contacted: "Contacted", replied: "Replied", won: "Won", lost: "Lost" };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// Per-device state (status + notes), kept in localStorage; wrapped because storage can throw.
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let state = store.get("lead-state", {}); // id -> {status, note}
let leads = [];
let filter = "all";
let query = "";
let niche = store.get("niche", "");
const open = new Set();

// Home = Shivranjani. Distance is a road estimate (straight line x 1.3) from approximate coordinates.
const HOME = { lat: 23.0270, lon: 72.5290 };
let radius = Number(store.get("radius-km", 8));
function km(l) {
  if (typeof l.lat !== "number" || typeof l.lon !== "number") return null;
  const r = (x) => (x * Math.PI) / 180, dLat = r(l.lat - HOME.lat), dLon = r(l.lon - HOME.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(HOME.lat)) * Math.cos(r(l.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a)) * 1.3;
}
const inRadius = (l) => { if (!radius) return true; const d = km(l); return d === null || d <= radius; };

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1600); }
const st = (id) => (state[id] && state[id].status) || "new";
function save(id, patch) { state[id] = { ...(state[id] || {}), ...patch }; store.set("lead-state", state); }

async function load(force) {
  $("#sub").textContent = "Updating…";
  const onSite = location.protocol.startsWith("http") && location.hostname.endsWith("github.io");
  const urls = onSite ? [LOCAL] : [REMOTE, LOCAL];
  let data = null;
  for (const u of urls) {
    try {
      const r = await fetch(u + (u.startsWith("http") ? "?t=" + Date.now() : ""), { cache: "no-store" });
      if (r.ok) { data = await r.json(); store.set("lead-cache", data); break; }
    } catch {}
  }
  let offline = false;
  if (!data) { data = store.get("lead-cache", null); offline = true; }
  if (!data) { $("#sub").textContent = "No data yet"; render(); return; }
  leads = (data.leads || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);
  $("#sub").textContent = (offline ? "Offline copy · " : "Updated ") + (data.updated || "");
  if (force) toast(offline ? "Offline: showing saved leads" : "Leads refreshed");
  render();
}

function render() {
  const nsel = $("#niche"), kinds = [...new Set(leads.map((l) => l.niche))].sort();
  if (nsel.options.length !== kinds.length + 1) nsel.innerHTML = '<option value="">All niches</option>' + kinds.map((k) => `<option>${esc(k)}</option>`).join("");
  if (niche && !kinds.includes(niche)) niche = "";
  nsel.value = niche;
  const near = leads.filter((l) => inRadius(l) && (!niche || l.niche === niche));
  const counts = { all: near.length };
  STATUSES.forEach((s) => (counts[s] = near.filter((l) => st(l.id) === s).length));
  $("#stats").innerHTML = [["Leads", counts.all], ["Contacted", counts.contacted + counts.replied], ["Won", counts.won]]
    .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("");
  $("#filters").innerHTML = ["all", ...STATUSES]
    .map((s) => `<button class="f ${filter === s ? "on" : ""}" data-f="${s}">${s === "all" ? "All" : STATUS_LABEL[s]} ${counts[s]}</button>`).join("");

  const q = query.trim().toLowerCase();
  const shown = near.filter((l) => (filter === "all" || st(l.id) === filter) && (!q || [l.name, l.area, l.niche, l.offer].join(" ").toLowerCase().includes(q)));
  const hidden = leads.length - near.length;
  const hint = hidden > 0 ? `<div class="meta" style="margin:8px 2px">${hidden} lead${hidden > 1 ? "s" : ""} hidden outside ${radius} km. Raise the distance to see them.</div>` : "";
  if (!shown.length) { $("#list").innerHTML = hint + `<div class="empty">No leads within ${radius || "any"} km yet.</div>`; return; }

  let html = hint, day = "";
  for (const l of shown) {
    if (l.date !== day) { day = l.date; html += `<div class="day">${esc(day)}</div>`; }
    const s = st(l.id), note = (state[l.id] && state[l.id].note) || "";
    html += `<section class="card ${open.has(l.id) ? "open" : ""}" data-id="${esc(l.id)}">
      <div class="head" data-toggle><div><h2 class="name">${esc(l.name)}</h2><div class="meta">${esc(l.niche)} · ${esc(l.area)}</div>${km(l) !== null ? `<div class="dist">~${km(l).toFixed(1)} km from Shivranjani</div>` : ""}<span class="st">${STATUS_LABEL[s]}</span></div><div class="score">${esc(l.score)}/10</div></div>
      <div class="body">
        <div class="chips">${(l.chips || []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
        <h3>What I found</h3><ul>${(l.findings || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <h3>What to offer</h3><div class="offer"><div>${esc(l.offer)}</div><div class="price">${esc(l.price)} <span class="meta">(budget est. ${esc(l.budget)})</span></div><div class="meta">Upsell: ${esc(l.upsell)}</div></div>
        <h3>Pitch idea</h3><div>${esc(l.pitch)}</div>
        <h3>Message</h3><div class="msg">${esc(l.msg)}</div>
        ${l.verify ? `<div class="note">Verify on Google Maps first: no official website was found in search.</div>` : ""}
        <div class="row">
          <button class="b p" data-copy>Copy message</button>
          <button class="b" data-wa>WhatsApp</button>
          ${l.site ? `<a class="b" href="${esc(l.site)}" target="_blank" rel="noopener">Open site</a>` : ""}
          ${l.phone ? `<a class="b" href="tel:${esc(String(l.phone).replace(/\s/g, ""))}">Call</a>` : ""}
          <a class="b" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(l.name + " Ahmedabad")}">Maps</a>
        </div>
        <h3>Status</h3>
        <select data-status>${STATUSES.map((x) => `<option value="${x}" ${x === s ? "selected" : ""}>${STATUS_LABEL[x]}</option>`).join("")}</select>
        <textarea data-note placeholder="Notes (saved on this device)">${esc(note)}</textarea>
      </div></section>`;
  }
  $("#list").innerHTML = html;
}

document.addEventListener("click", async (e) => {
  const f = e.target.closest("[data-f]");
  if (f) { filter = f.dataset.f; return render(); }
  if (e.target.closest("#refresh")) return load(true);
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id, l = leads.find((x) => x.id === id);
  if (e.target.closest("[data-copy]")) {
    try { await navigator.clipboard.writeText(l.msg); toast("Message copied"); } catch { toast("Long-press the text to copy"); }
  } else if (e.target.closest("[data-wa]")) {
    const digits = String(l.phone || "").replace(/\D/g, "");
    const mobile = digits.length >= 10 && /^[6-9]/.test(digits.slice(-10)) ? "91" + digits.slice(-10) : "";
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(l.msg)}`, "_blank");
  } else if (e.target.closest("[data-toggle]")) {
    open.has(id) ? open.delete(id) : open.add(id);
    card.classList.toggle("open");
  }
});
document.addEventListener("change", (e) => {
  const id = e.target.closest(".card")?.dataset.id;
  if (id && e.target.matches("[data-status]")) { save(id, { status: e.target.value }); render(); }
  if (id && e.target.matches("[data-note]")) { save(id, { note: e.target.value }); toast("Note saved"); }
});
$("#q").addEventListener("input", (e) => { query = e.target.value; render(); });
$("#niche").addEventListener("change", (e) => { niche = e.target.value; store.set("niche", niche); render(); });
$("#radius").value = String(radius);
$("#radius").addEventListener("change", (e) => { radius = Number(e.target.value); store.set("radius-km", radius); render(); });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
load();
