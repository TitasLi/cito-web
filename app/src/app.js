import { MultiPressDetector } from "./presses.js";
import { replay, nextPalletNr, palletCount, boardsOnCurrentPallet, lastUndone } from "./model.js";
import { newSessionName, latestSessionName } from "./sessions.js";
import { buildWorkbook, workbookToBlob, XLSX_MIME } from "./excel.js";
import { listSessions, createSession, appendEvent, loadEvents } from "./db.js";
import { beep, unlockAudio } from "./audio.js";
import { CitoLink } from "./ble.js";

const RUSYS = { 1: "I rūšis", 2: "II rūšis", 3: "III rūšis" };
const COLORS = { 1: "#2e7d32", 2: "#1565c0", 3: "#c62828" };
const BUTTON_TO_RUSIS = { 1: 3, 2: 2, 3: 1 };
const $ = id => document.getElementById(id);

let session = null, events = [], state = replay([]);
const presses = new MultiPressDetector(0.5);
const link = new CitoLink({ onReading, onStatus });
let wakeLock = null;

// ---------- būsena / ekranas
function setStatus(text, cls = "") { $("status").textContent = text; $("status").className = cls; }
function fileLabel() { return `Failas: ${session}.xlsx`; }
function showConnected() { setStatus(`● Prijungta: ${link.name}    ${fileLabel()}`, "ok"); }
function onStatus(kind, text) {
  if (kind === "connected") { beep("connect"); showConnected(); requestWakeLock(); }
  else setStatus(`○ ${text}    ${fileLabel()}`, kind === "error" ? "err" : "");
}
function bigText(main, sub, color = "#fff") {
  $("big").textContent = main; $("big").style.color = color;
  $("sub").textContent = sub; $("sub").style.color = color;
}
function refresh() {
  for (const r of [1, 2, 3]) {
    const col = document.querySelector(`.col[data-r="${r}"]`);
    col.querySelector(".count").textContent = boardsOnCurrentPallet(state, r);
    col.querySelector(".pallet").textContent = `pildoma paletė Nr. ${palletCount(state, r) + 1}`;
  }
}

// ---------- įrašai (pirmiausia į DB, tik tada į ekraną)
async function record(event) {
  try { await appendEvent(session, event); }
  catch (e) { beep("err"); setStatus(`⚠ Nepavyko išsaugoti įrašo: ${e.message}`, "err"); return false; }
  events.push(event); state = replay(events); refresh(); return true;
}
async function addWidth(button, valueMm) {
  const rusis = BUTTON_TO_RUSIS[button];
  const value = Number.isInteger(valueMm) ? valueMm : Math.round(valueMm * 10) / 10;
  if (await record({ type: "width", rusis, value })) {
    beep("ok" + rusis);
    bigText(`${Math.round(value)} mm`, `→ ${RUSYS[rusis]}`); $("sub").style.color = COLORS[rusis];
  }
}
async function palletFull(rusis) {
  const nr = nextPalletNr(state, rusis);
  if (await record({ type: "pallet", rusis })) { beep("pallet"); bigText(`PALETĖ ${nr} PILNA`, RUSYS[rusis], COLORS[rusis]); }
}
async function undo() {
  if (!state.undoStack.length) { beep("err"); bigText("NĖRA KĄ ATŠAUKTI", "", "#f44336"); return; }
  if (await record({ type: "undo" })) {
    const u = lastUndone(events); beep("undo");
    const what = u.cell.kind === "pallet" ? `PALETĖ ${u.cell.nr} PILNA` : `${u.cell.value} mm`;
    bigText("ATŠAUKTA", `${RUSYS[u.rusis]}: ${what}`, "#ff9800");
  }
}
function applyActions(actions) {
  for (const a of actions) {
    if (a.type === "single") addWidth(a.button, a.valueMm);
    else if (a.type === "double") palletFull(BUTTON_TO_RUSIS[a.button]);
    else if (a.type === "triple") undo();
  }
}
function onReading(r) {
  if (r.kind === "M") { $("live").textContent = `${Math.round(r.valueMm)} mm`; return; }
  if (r.longPress || !(r.button in BUTTON_TO_RUSIS)) return;
  applyActions(presses.feed(r.button, r.valueMm, performance.now() / 1000));
}
setInterval(() => applyActions(presses.flush(performance.now() / 1000)), 50);

// ---------- sesijos
async function openLatestOrNew() {
  const ids = (await listSessions()).map(s => s.id);
  session = latestSessionName(ids) || await createSession(newSessionName(ids));
  events = await loadEvents(session); state = replay(events); refresh();
}
async function newSession() {
  const ids = (await listSessions()).map(s => s.id);
  session = await createSession(newSessionName(ids));
  events = []; state = replay(events); refresh();
  beep("connect"); bigText("NAUJA SESIJA", `${session}.xlsx`, "#03a9f4"); $("live").textContent = "—";
  if (link.connected) showConnected(); else setStatus(`○ ${fileLabel()}`);
}

// ---------- Excel išsaugojimas telefone (Share -> „Save to Files“) arba atsisiuntimas
async function saveExcel() {
  try {
    const blob = await workbookToBlob(buildWorkbook(window.ExcelJS, state.columns));
    const file = new File([blob], `${session}.xlsx`, { type: XLSX_MIME });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  } catch (e) {
    if (e.name !== "AbortError") { beep("err"); setStatus(`⚠ Nepavyko išsaugoti: ${e.message}`, "err"); }
  }
}

// ---------- ruletė, ekranas
async function pick() {
  if (!link.available) { setStatus("Ši naršyklė nemoka Bluetooth. Atidarykite programėlę Bluefy naršyklėje.", "err"); return; }
  try { await link.pick(); $("pickBtn").hidden = true; $("grid").hidden = false; }
  catch (e) { if (e.name !== "NotFoundError") setStatus(`⚠ ${e.message || e}`, "err"); }
}
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (_) {}
  try { navigator.bluetooth?.setScreenDimEnabled?.(false); } catch (_) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && link.connected) requestWakeLock(); });

// ---------- įvykiai
document.addEventListener("pointerdown", unlockAudio, { once: true });
$("pickBtn").onclick = pick;
$("saveBtn").onclick = saveExcel;
document.querySelectorAll(".full").forEach(b => b.onclick = () => palletFull(Number(b.closest(".col").dataset.r)));
$("menuBtn").onclick = e => { e.stopPropagation(); $("menu").hidden = !$("menu").hidden; };
document.addEventListener("click", () => { $("menu").hidden = true; });
$("menu").onclick = e => {
  const act = e.target.dataset.act; $("menu").hidden = true;
  if (act === "new") newSession(); else if (act === "save") saveExcel(); else if (act === "pick") pick();
};

openLatestOrNew()
  .then(() => setStatus(`○ Paspauskite „Prisijungti prie ruletės“    ${fileLabel()}`))
  .catch(e => setStatus(`⚠ Duomenų bazės klaida: ${e.message}`, "err"));
