# CITO web app (Bluefy) – 1 etapas: registratorius su Excel išsaugojimu telefone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interneto programėlė Bluefy naršyklei, kuri veikia kaip Windows `cito_excel.py` (trys rūšių stulpeliai, PALETĖ PILNA, atšaukimas), saugo įrašus telefone ir leidžia išsaugoti .xlsx į telefono Files/Downloads.

**Architecture:** Statinė svetainė (ES moduliai, be kompiliavimo) GitHub Pages `app/` kataloge. Gryna logika (`protocol`, `presses`, `model`, `sessions`, `excel`) testuojama `node --test`; naršyklės adapteriai (`db`, `ble`, `audio`, `app`) ploni. Įvykių žurnalas IndexedDB yra tiesos šaltinis; Excel išvedamas iš jo.

**Tech Stack:** Vanilla JS (ES2022 moduliai), ExcelJS 4.4.0 (naršyklėje – `vendor/exceljs.min.js`, testuose – npm `exceljs`), Web Bluetooth, IndexedDB, Web Share API, Node 24 `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-14-cito-web-design.md` (7 skyrius – OneDrive – šiame etape pakeistas vietiniu išsaugojimu; `sync.js` neįgyvendinamas).

## Global Constraints

- UI kalba lietuvių; tamsus fonas `#111`, spalvos rūšims: 1 → `#2e7d32`, 2 → `#1565c0`, 3 → `#c62828`.
- Ruletės mygtukas → rūšis: `{1: 3, 2: 2, 3: 1}`. Paspaudimų langas 0,5 s.
- Excel failo pavadinimas `plociai_YYYY-MM-DD.xlsx`, kiti tos dienos `_2`, `_3`…; lapas „Pločiai“; antraštės `I rūšis (plotis, mm)` ir t. t.; paletės žyma `PALETĖ n PILNA`, užpildas `FFF2CC`.
- Jokių CDN užklausų vykdymo metu: visos bibliotekos `app/vendor/`.
- Web Bluetooth filtras `namePrefix: "SOLA_Cito"`, paslauga `0000fff0-0000-1000-8000-00805f9b34fb`, charakteristika `0000fff1-…`.
- Commit po kiekvienos užduoties, autorius Titas Lileikis, pabaigoje `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Failų struktūra

```
app/
  index.html          UI karkasas, įkelia vendor/exceljs.min.js ir src/app.js (type=module)
  styles.css          stiliai
  src/protocol.js     parseLine, LineBuffer
  src/presses.js      MultiPressDetector
  src/sessions.js     newSessionName, latestSessionName
  src/model.js        replay(events) -> {columns, undoStack}; addWidth/markPalletFull/undoLast helperiai
  src/excel.js        buildWorkbook(ExcelJS, columns) -> workbook; toBlob
  src/db.js           IndexedDB: openDb, listSessions, createSession, appendEvent, loadEvents
  src/audio.js        beep(pattern)
  src/ble.js          CitoLink (connect, auto-reconnect, onReading, onStatus)
  src/app.js          UI sujungimas
  vendor/exceljs.min.js
tests/*.test.js       node:test
package.json          {"type":"module","scripts":{"test":"node --test tests/"},"devDependencies":{"exceljs":"^4.4.0"}}
```

---

### Task 1: Projekto karkasas ir ExcelJS

**Files:**
- Create: `package.json`, `.gitignore`, `app/vendor/exceljs.min.js`, `tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` paleidžia visus `tests/*.test.js`; `app/vendor/exceljs.min.js` naršyklėje sukuria globalų `ExcelJS`.

- [ ] **Step 1: package.json ir .gitignore**

```json
{
  "name": "cito-web",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" },
  "devDependencies": { "exceljs": "^4.4.0" }
}
```
`.gitignore`: `node_modules/`

- [ ] **Step 2: Įdiegti ir nukopijuoti naršyklės paketą**

Run: `npm install` ; `cp node_modules/exceljs/dist/exceljs.min.js app/vendor/exceljs.min.js`

- [ ] **Step 3: Smoke testas**

```js
import test from "node:test";
import assert from "node:assert/strict";
test("node test runner works", () => assert.equal(1 + 1, 2));
```
Run: `npm test` → PASS.

- [ ] **Step 4: Commit** `chore: project scaffold with ExcelJS vendor bundle`

---

### Task 2: protocol.js

**Files:** Create `app/src/protocol.js`, `tests/protocol.test.js`

**Interfaces:**
- Produces: `parseLine(str) -> {kind:"M"|"B", valueMm:number, ref:string, button:number|null, longPress:boolean, raw:string} | null`; `class LineBuffer { feed(Uint8Array|string) -> Reading[] }`; konstantos `SERVICE_UUID`, `NOTIFY_UUID`.

- [ ] **Step 1: Testai (perkelti iš `test_protocol.py`)**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseLine, LineBuffer } from "../app/src/protocol.js";

test("stream line", () => {
  const r = parseLine("M 168.00 mm F\r\n");
  assert.equal(r.kind, "M"); assert.equal(r.valueMm, 168); assert.equal(r.ref, "F"); assert.equal(r.button, null);
});
test("negative stream", () => assert.equal(parseLine("M -11.00 mm F").valueMm, -11));
test("button lines", () => {
  for (const n of [1, 2, 3]) {
    const r = parseLine(`B ${n} 118 mm F`);
    assert.equal(r.kind, "B"); assert.equal(r.button, n); assert.equal(r.valueMm, 118); assert.equal(r.longPress, false);
  }
});
test("long press", () => { const r = parseLine("B 3L 118 mm F"); assert.equal(r.button, 3); assert.equal(r.longPress, true); });
test("cm converted", () => assert.equal(parseLine("B 1 12.3 cm F").valueMm, 123));
test("garbage ignored", () => { assert.equal(parseLine(""), null); assert.equal(parseLine("OK"), null); });
test("buffer joins and splits packets", () => {
  const buf = new LineBuffer();
  const enc = s => new TextEncoder().encode(s);
  assert.deepEqual(buf.feed(enc("B 2 75 mm F\r\nB 3 75 mm F\r\n")).map(r => r.button), [2, 3]);
  assert.deepEqual(buf.feed(enc("B 1 7")), []);
  const got = buf.feed(enc("5 mm F\r\n"));
  assert.equal(got.length, 1); assert.equal(got[0].button, 1); assert.equal(got[0].valueMm, 75);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL (modulio nėra).

- [ ] **Step 3: Implementacija**

```js
export const SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
export const NOTIFY_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
const LINE = /^([MB])\s+(?:(\d)(L?)\s+)?(-?\d+(?:\.\d+)?)\s+(mm|cm)\s+(\w)$/;

export function parseLine(line) {
  const t = String(line).trim();
  const m = LINE.exec(t);
  if (!m) return null;
  let v = parseFloat(m[4]);
  if (m[5] === "cm") v *= 10;
  return { kind: m[1], valueMm: v, ref: m[6], button: m[2] ? Number(m[2]) : null, longPress: m[3] === "L", raw: t };
}

export class LineBuffer {
  #buf = "";
  #dec = new TextDecoder("ascii");
  feed(data) {
    this.#buf += typeof data === "string" ? data : this.#dec.decode(data);
    const out = [];
    let i;
    while ((i = this.#buf.indexOf("\n")) >= 0) {
      const line = this.#buf.slice(0, i); this.#buf = this.#buf.slice(i + 1);
      const r = parseLine(line); if (r) out.push(r);
    }
    return out;
  }
}
```

- [ ] **Step 4: Run** `npm test` → PASS. **Step 5: Commit** `feat: CITO line protocol parser`

---

### Task 3: presses.js

**Files:** Create `app/src/presses.js`, `tests/presses.test.js`

**Interfaces:**
- Produces: `class MultiPressDetector(windowS=0.5) { feed(button, valueMm, t) -> Action[]; flush(t) -> Action[] }`, `Action = {type:"single", button, valueMm} | {type:"double", button} | {type:"triple", button}`. Laikas `t` sekundėmis.

- [ ] **Step 1: Testai (iš `test_press_logic.py`)**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { MultiPressDetector } from "../app/src/presses.js";

test("single after window", () => {
  const d = new MultiPressDetector(0.5);
  assert.deepEqual(d.feed(1, 100, 0), []); assert.deepEqual(d.flush(0.3), []);
  assert.deepEqual(d.flush(0.6), [{ type: "single", button: 1, valueMm: 100 }]); assert.deepEqual(d.flush(1), []);
});
test("double emitted after window", () => {
  const d = new MultiPressDetector(0.5);
  d.feed(1, 100, 0); assert.deepEqual(d.feed(1, 100, 0.25), []);
  assert.deepEqual(d.flush(0.5), []); assert.deepEqual(d.flush(0.8), [{ type: "double", button: 1 }]);
});
test("triple immediately", () => {
  const d = new MultiPressDetector(0.5);
  d.feed(1, 100, 0); d.feed(1, 100, 0.3);
  assert.deepEqual(d.feed(1, 100, 0.6), [{ type: "triple", button: 1 }]); assert.deepEqual(d.flush(2), []);
});
test("two slow presses are two singles", () => {
  const d = new MultiPressDetector(0.5);
  d.feed(1, 100, 0);
  assert.deepEqual(d.feed(1, 120, 0.9), [{ type: "single", button: 1, valueMm: 100 }]);
  assert.deepEqual(d.flush(1.5), [{ type: "single", button: 1, valueMm: 120 }]);
});
test("different button commits previous", () => {
  const d = new MultiPressDetector(0.5);
  d.feed(1, 100, 0);
  assert.deepEqual(d.feed(2, 200, 0.2), [{ type: "single", button: 1, valueMm: 100 }]);
  assert.deepEqual(d.flush(0.8), [{ type: "single", button: 2, valueMm: 200 }]);
});
test("double then other button", () => {
  const d = new MultiPressDetector(0.5);
  d.feed(3, 100, 0); d.feed(3, 100, 0.2);
  assert.deepEqual(d.feed(1, 50, 0.3), [{ type: "double", button: 3 }]);
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implementacija**

```js
export class MultiPressDetector {
  constructor(windowS = 0.5) { this.window = windowS; this.pending = null; } // {button, valueMm, t, n}
  #finish() {
    if (!this.pending) return [];
    const { button, valueMm, n } = this.pending; this.pending = null;
    return n === 1 ? [{ type: "single", button, valueMm }] : [{ type: "double", button }];
  }
  feed(button, valueMm, t) {
    let out = [];
    if (this.pending) {
      const p = this.pending;
      if (p.button === button && t - p.t <= this.window) {
        if (p.n + 1 >= 3) { this.pending = null; return [{ type: "triple", button }]; }
        p.t = t; p.n += 1; return [];
      }
      out = this.#finish();
    }
    this.pending = { button, valueMm, t, n: 1 };
    return out;
  }
  flush(t) { return this.pending && t - this.pending.t > this.window ? this.#finish() : []; }
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat: multi-press detector`

---

### Task 4: sessions.js

**Files:** Create `app/src/sessions.js`, `tests/sessions.test.js`

**Interfaces:**
- Produces: `newSessionName(existingNames: string[], day: Date = new Date()) -> string` (be `.xlsx`), `latestSessionName(names: string[]) -> string|null`, `isoDay(date) -> "YYYY-MM-DD"` (vietinė data, ne UTC).

- [ ] **Step 1: Testai**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { newSessionName, latestSessionName, isoDay } from "../app/src/sessions.js";

const d = new Date(2026, 8, 14, 23, 30); // vietinis laikas
test("isoDay uses local date", () => assert.equal(isoDay(d), "2026-09-14"));
test("new session names", () => {
  assert.equal(newSessionName([], d), "plociai_2026-09-14");
  assert.equal(newSessionName(["plociai_2026-09-14"], d), "plociai_2026-09-14_2");
  assert.equal(newSessionName(["plociai_2026-09-14", "plociai_2026-09-14_2"], d), "plociai_2026-09-14_3");
});
test("latest session", () => {
  assert.equal(latestSessionName([]), null);
  assert.equal(latestSessionName(["plociai_2026-09-13", "plociai_2026-09-14", "plociai_2026-09-14_2", "plociai_2026-09-14_10", "plociai", "kitas"]), "plociai_2026-09-14_10");
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implementacija**

```js
const RE = /^plociai_(\d{4}-\d{2}-\d{2})(?:_(\d+))?$/;
export function isoDay(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function newSessionName(existing, day = new Date()) {
  const set = new Set(existing), stem = `plociai_${isoDay(day)}`;
  let name = stem, n = 2;
  while (set.has(name)) name = `${stem}_${n++}`;
  return name;
}
export function latestSessionName(names) {
  const key = s => { const m = RE.exec(s); return m ? [m[1], Number(m[2] || 1)] : null; };
  let best = null, bk = null;
  for (const s of names) { const k = key(s); if (!k) continue; if (!bk || k[0] > bk[0] || (k[0] === bk[0] && k[1] > bk[1])) { best = s; bk = k; } }
  return best;
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat: session naming`

---

### Task 5: model.js (įvykiai → stulpeliai)

**Files:** Create `app/src/model.js`, `tests/model.test.js`

**Interfaces:**
- Consumes: nieko.
- Produces:
  - `replay(events) -> State` kur `events = [{type:"width", rusis, value} | {type:"pallet", rusis} | {type:"undo"}]`,
    `State = { columns: {1: Cell[], 2: Cell[], 3: Cell[]}, undoStack: [{rusis, index}] }`, `Cell = {kind:"width", value:number} | {kind:"pallet", nr:number} | null`.
    Stulpelio masyvas yra eilutės nuo 2-os Excel eilutės; `null` = tuščias langelis (atšaukta).
  - `palletCount(state, rusis) -> number`, `boardsOnCurrentPallet(state, rusis) -> number`, `nextPalletNr(state, rusis)`.
  - `lastUndone(events) -> {rusis, cell} | null` – kas buvo atšaukta paskutiniu `undo` (UI pranešimui).

Semantika kaip Windows `ExcelStore`: naujas įrašas dedamas po paskutinio ne-null langelio tame stulpelyje (`_next_row`), `undo` išvalo paskutinį `undoStack` įrašą (langelis tampa `null`). Paletės numeris = jau esančių paletės žymų skaičius stulpelyje + 1 tuo metu, kai žyma dedama.

- [ ] **Step 1: Testai (iš `test_excel_store.py`)**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { replay, palletCount, boardsOnCurrentPallet, nextPalletNr, lastUndone } from "../app/src/model.js";

const W = (rusis, value) => ({ type: "width", rusis, value });
const P = rusis => ({ type: "pallet", rusis });
const U = () => ({ type: "undo" });

test("columns independent", () => {
  const s = replay([W(1, 100), W(1, 101), W(3, 300)]);
  assert.deepEqual(s.columns[1], [{ kind: "width", value: 100 }, { kind: "width", value: 101 }]);
  assert.deepEqual(s.columns[3], [{ kind: "width", value: 300 }]);
  assert.deepEqual(s.columns[2], []);
});
test("pallet marker and continue", () => {
  let s = replay([W(2, 120), W(2, 121), P(2)]);
  assert.deepEqual(s.columns[2][2], { kind: "pallet", nr: 1 });
  s = replay([W(2, 120), W(2, 121), P(2), W(2, 122)]);
  assert.deepEqual(s.columns[2][3], { kind: "width", value: 122 });
  assert.equal(boardsOnCurrentPallet(s, 2), 1);
  assert.equal(palletCount(s, 2), 1);
  assert.equal(nextPalletNr(s, 2), 2);
});
test("undo clears last write across columns", () => {
  let s = replay([W(1, 100), W(2, 200), U()]);
  assert.deepEqual(s.columns[2], [null]);
  assert.deepEqual(s.columns[1], [{ kind: "width", value: 100 }]);
  s = replay([W(1, 100), W(2, 200), U(), U()]);
  assert.deepEqual(s.columns[1], [null]);
  s = replay([W(1, 100), W(2, 200), U(), U(), U()]); // nėra ką atšaukti – ignoruojama
  assert.deepEqual(s.columns[1], [null]);
});
test("write after undo reuses the freed row (like _next_row)", () => {
  const s = replay([W(1, 100), W(1, 101), U(), W(1, 102)]);
  assert.deepEqual(s.columns[1], [{ kind: "width", value: 100 }, { kind: "width", value: 102 }]);
});
test("undo of a pallet marker restores pallet numbering", () => {
  const s = replay([W(1, 10), P(1), U(), P(1)]);
  assert.deepEqual(s.columns[1][1], { kind: "pallet", nr: 1 });
});
test("lastUndone reports what was removed", () => {
  assert.deepEqual(lastUndone([W(1, 100), W(2, 200), U()]), { rusis: 2, cell: { kind: "width", value: 200 } });
  assert.equal(lastUndone([W(1, 100)]), null);
  assert.equal(lastUndone([U()]), null);
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implementacija**

```js
export function replay(events) {
  const columns = { 1: [], 2: [], 3: [] }, undoStack = [];
  const nextIndex = col => { let i = col.length; while (i > 0 && col[i - 1] === null) i--; return i; };
  const put = (rusis, cell) => { const col = columns[rusis]; const i = nextIndex(col); col.length = i; col.push(cell); undoStack.push({ rusis, index: i }); };
  let last = null;
  for (const e of events) {
    if (e.type === "width") put(e.rusis, { kind: "width", value: e.value });
    else if (e.type === "pallet") put(e.rusis, { kind: "pallet", nr: palletCount({ columns }, e.rusis) + 1 });
    else if (e.type === "undo") {
      const u = undoStack.pop();
      if (u) { last = { rusis: u.rusis, cell: columns[u.rusis][u.index] }; columns[u.rusis][u.index] = null; }
    }
  }
  return { columns, undoStack, lastUndone: last };
}
export const palletCount = (s, r) => s.columns[r].filter(c => c && c.kind === "pallet").length;
export const nextPalletNr = (s, r) => palletCount(s, r) + 1;
export function boardsOnCurrentPallet(s, r) {
  let n = 0;
  for (const c of s.columns[r]) { if (!c) continue; if (c.kind === "pallet") n = 0; else n++; }
  return n;
}
export function lastUndone(events) {
  if (!events.length || events[events.length - 1].type !== "undo") return null;
  return replay(events).lastUndone;
}
```

Pastaba: `put` nukerpa gale esančius `null` (`col.length = i`), todėl atšauktas paskutinis langelis vėl panaudojamas, kaip Windows `_next_row`. `null` viduryje stulpelio lieka (Excel tuščias langelis) – tai atitinka Windows elgseną.

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat: event replay model for three grade columns`

---

### Task 6: excel.js

**Files:** Create `app/src/excel.js`, `tests/excel.test.js`

**Interfaces:**
- Consumes: `State.columns` iš Task 5.
- Produces: `buildWorkbook(ExcelJS, columns) -> ExcelJS.Workbook`; `workbookToBlob(wb) -> Promise<Blob>` (naršyklėje, `xlsx.writeBuffer()` → Blob su MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
  `ExcelJS` paduodamas parametru: naršyklėje `window.ExcelJS`, testuose `import ExcelJS from "exceljs"`.

- [ ] **Step 1: Testai**

```js
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildWorkbook } from "../app/src/excel.js";
import { replay } from "../app/src/model.js";

async function roundtrip(columns) {
  const wb = buildWorkbook(ExcelJS, columns);
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(buf);
  return wb2.getWorksheet("Pločiai");
}
test("headers, values, pallet marker styling", async () => {
  const s = replay([{ type: "width", rusis: 1, value: 99 }, { type: "pallet", rusis: 1 }, { type: "width", rusis: 2, value: 120.5 }, { type: "width", rusis: 3, value: 7 }, { type: "undo" }]);
  const ws = await roundtrip(s.columns);
  assert.equal(ws.getCell("A1").value, "I rūšis (plotis, mm)");
  assert.equal(ws.getCell("B1").value, "II rūšis (plotis, mm)");
  assert.equal(ws.getCell("C1").value, "III rūšis (plotis, mm)");
  assert.equal(ws.getCell("A1").font.bold, true);
  assert.equal(ws.getColumn(1).width, 24);
  assert.equal(ws.getCell("A2").value, 99);
  assert.equal(ws.getCell("A3").value, "PALETĖ 1 PILNA");
  assert.equal(ws.getCell("A3").font.bold, true);
  assert.equal(ws.getCell("A3").fill.fgColor.argb, "FFFFF2CC");
  assert.equal(ws.getCell("B2").value, 120.5);
  assert.equal(ws.getCell("C2").value, null); // atšaukta
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implementacija**

```js
const HEADERS = { 1: "I rūšis (plotis, mm)", 2: "II rūšis (plotis, mm)", 3: "III rūšis (plotis, mm)" };
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function buildWorkbook(ExcelJS, columns) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pločiai");
  for (const col of [1, 2, 3]) {
    const h = ws.getCell(1, col); h.value = HEADERS[col]; h.font = { bold: true }; h.alignment = { horizontal: "center" };
    ws.getColumn(col).width = 24;
    columns[col].forEach((cell, i) => {
      if (!cell) return;
      const c = ws.getCell(i + 2, col); c.alignment = { horizontal: "center" };
      if (cell.kind === "pallet") { c.value = `PALETĖ ${cell.nr} PILNA`; c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } }; }
      else c.value = cell.value;
    });
  }
  return wb;
}
export async function workbookToBlob(wb) { return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME }); }
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat: Excel workbook builder matching Windows layout`

---

### Task 7: db.js (IndexedDB)

**Files:** Create `app/src/db.js`

**Interfaces:**
- Produces (visi `async`): `openDb()`, `listSessions() -> [{id, createdAt}]`, `createSession(id)`, `appendEvent(sessionId, event)` (event su `type/rusis/value`, prideda `ts`), `loadEvents(sessionId) -> event[]` (pagal `seq`).
- Testas: rankinis naršyklėje (nėra IndexedDB Node aplinkoje be papildomų paketų).

- [ ] **Step 1: Implementacija**

```js
const NAME = "cito", VERSION = 1;
let dbp;
export function openDb() {
  return dbp ??= new Promise((res, rej) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("sessions", { keyPath: "id" });
      db.createObjectStore("events", { keyPath: "seq", autoIncrement: true }).createIndex("bySession", "sessionId");
    };
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
function tx(db, store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && "result" in r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
export async function listSessions() { return tx(await openDb(), "sessions", "readonly", s => s.getAll()); }
export async function createSession(id) { await tx(await openDb(), "sessions", "readwrite", s => s.add({ id, createdAt: Date.now() })); return id; }
export async function appendEvent(sessionId, event) { await tx(await openDb(), "events", "readwrite", s => s.add({ ...event, sessionId, ts: Date.now() })); }
export async function loadEvents(sessionId) { return tx(await openDb(), "events", "readonly", s => s.index("bySession").getAll(sessionId)); }
```

- [ ] **Step 2: Commit** `feat: IndexedDB event log`

---

### Task 8: audio.js ir ble.js

**Files:** Create `app/src/audio.js`, `app/src/ble.js`

**Interfaces:**
- `audio.js`: `beep(pattern)` – `"ok1"|"ok2"|"ok3"` (tiek 1800 Hz 90 ms pyptelėjimų), `"undo"` (600 Hz 350 ms), `"err"` (2×300 Hz 200 ms), `"connect"` (1000, 1500 Hz po 80 ms), `"pallet"` (900, 1200, 1600 Hz po 120 ms). `unlockAudio()` – kviesti per pirmą paspaudimą.
- `ble.js`: `class CitoLink { constructor({onReading, onStatus}); async pick() /* rodo įrenginių sąrašą, paskui connect */; get name; get connected }`. `onStatus(kind, text)` su `kind ∈ "connected"|"searching"|"error"`. Automatinis pakartotinis prisijungimas po `gattserverdisconnected`: kas 2 s, po 10 nesėkmių kas 5 s; nutraukiama sėkmingai prisijungus.

- [ ] **Step 1: audio.js**

```js
let ctx;
export function unlockAudio() { ctx ??= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); }
function tone(freq, ms) {
  return new Promise(res => {
    unlockAudio();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.3; o.connect(g); g.connect(ctx.destination);
    o.start(); setTimeout(() => { o.stop(); res(); }, ms);
  });
}
const pause = ms => new Promise(r => setTimeout(r, ms));
export async function beep(pattern) {
  try {
    if (pattern.startsWith("ok")) { for (let i = 0; i < Number(pattern[2]); i++) { await tone(1800, 90); await pause(60); } }
    else if (pattern === "undo") await tone(600, 350);
    else if (pattern === "connect") { await tone(1000, 80); await tone(1500, 80); }
    else if (pattern === "pallet") { for (const f of [900, 1200, 1600]) await tone(f, 120); }
    else { await tone(300, 200); await pause(60); await tone(300, 200); }
  } catch (_) { /* garsas neprivalomas */ }
}
```

- [ ] **Step 2: ble.js**

```js
import { LineBuffer, SERVICE_UUID, NOTIFY_UUID } from "./protocol.js";

export class CitoLink {
  constructor({ onReading, onStatus }) { this.onReading = onReading; this.onStatus = onStatus; this.device = null; this.buf = new LineBuffer(); this.connected = false; this._stop = false; }
  get name() { return this.device?.name || ""; }
  get available() { return !!navigator.bluetooth; }

  async pick() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: "SOLA_Cito" }], optionalServices: [SERVICE_UUID] });
    this.device.addEventListener("gattserverdisconnected", () => { this.connected = false; this.onStatus("searching", "Ryšys nutrūko, jungiuosi iš naujo..."); this.#reconnectLoop(); });
    await this.#connect();
  }
  async #connect() {
    this.onStatus("searching", `Jungiuosi prie ${this.name}...`);
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    const ch = await svc.getCharacteristic(NOTIFY_UUID);
    ch.addEventListener("characteristicvaluechanged", ev => {
      const dv = ev.target.value;
      for (const r of this.buf.feed(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength))) this.onReading(r);
    });
    await ch.startNotifications();
    this.connected = true;
    this.onStatus("connected", this.name);
  }
  async #reconnectLoop() {
    for (let attempt = 1; !this.connected && !this._stop; attempt++) {
      await new Promise(r => setTimeout(r, attempt <= 10 ? 2000 : 5000));
      if (this.connected) return;
      try { await this.#connect(); } catch (e) { this.onStatus("searching", `Ieškau ruletės... (${attempt}) įjunkite CITO`); }
    }
  }
}
```

- [ ] **Step 3: Commit** `feat: audio cues and BLE link with auto-reconnect`

---

### Task 9: UI (index.html, styles.css, app.js)

**Files:** Create `app/index.html`, `app/styles.css`, `app/src/app.js`

**Interfaces:** Consumes viską iš Task 2–8.

Elgsena (kaip Windows `cito_excel.App`):
- Paleidus: atidaro DB, paima `latestSessionName(listSessions ids)` arba sukuria naują; `events = loadEvents`; `state = replay(events)`; atnaujina skaitiklius; rodo didelį mygtuką „PRISIJUNGTI PRIE RULETĖS“.
- `onReading(r)`: `M` → gyvas matmuo; `B` ilgas → ignoruoti; `B` 1–3 → `presses.feed(button, valueMm, performance.now()/1000)`; kas 50 ms `presses.flush`.
- Veiksmai: `single` → `record({type:"width", rusis: BUTTON_TO_RUSIS[button], value: round-if-integer})`, `beep("ok"+rusis)`; `double` → `palletFull(rusis)`; `triple` → `undo()`.
- `record(event)`: `await appendEvent(session, event)` **prieš** `events.push`, tada `state = replay(events)`, `refresh()`. Klaida → raudona būsena + `beep("err")`.
- `palletFull(rusis)`: `nr = nextPalletNr(state, rusis)`; `record({type:"pallet", rusis})`; `beep("pallet")`; didelis tekstas `PALETĖ nr PILNA`.
- `undo()`: jei `state.undoStack.length === 0` → `beep("err")`, „NĖRA KĄ ATŠAUKTI“; kitaip `record({type:"undo"})`, `beep("undo")`, „ATŠAUKTA“ + `lastUndone(events)` aprašas.
- Meniu ▼: „Nauja sesija“ (`createSession(newSessionName(ids))`, `events=[]`, `beep("connect")`), „Išsaugoti Excel“ (žr. žemiau), „Prisijungti prie ruletės“ (pick()).
- „IŠSAUGOTI EXCEL“ (ir atskiras didelis mygtukas būsenos juostoje): `blob = await workbookToBlob(buildWorkbook(window.ExcelJS, state.columns))`; `file = new File([blob], session + ".xlsx", {type: XLSX_MIME})`; jei `navigator.canShare?.({files:[file]})` → `navigator.share({files:[file], title: file.name})` (iOS atidaro „Save to Files“ → Downloads); kitaip `<a download>` su `URL.createObjectURL`.
- Būsenos eilutė: `● Prijungta: {name} · Failas: {session}.xlsx` / `○ {tekstas} · Failas: …`.
- Wake Lock: po `pick()` sėkmės ir `visibilitychange` → `navigator.wakeLock?.request("screen")`; jei yra `navigator.bluetooth.setScreenDimEnabled`, kviesti `(false)`.
- `unlockAudio()` per pirmą bet kurį `pointerdown`.

- [ ] **Step 1: index.html**

```html
<!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Sola CITO → Excel</title>
<link rel="stylesheet" href="styles.css">
<script src="vendor/exceljs.min.js"></script>
</head>
<body>
<header>
  <div id="status">Paleidžiama...</div>
  <button id="menuBtn" aria-label="Meniu">▼</button>
  <div id="menu" hidden>
    <button data-act="new">Nauja sesija</button>
    <button data-act="save">Išsaugoti Excel</button>
    <button data-act="pick">Prisijungti prie ruletės</button>
  </div>
</header>
<main>
  <div id="live">—</div>
  <div id="big"></div>
  <div id="sub"></div>
  <button id="pickBtn" class="pick">PRISIJUNGTI PRIE RULETĖS</button>
  <section id="grid" hidden>
    <div class="col" data-r="1"><h2>I rūšis</h2><div class="pallet"></div><div class="count">0</div><div class="hint">lentų ant paletės</div><button class="full" style="background:#2e7d32">PALETĖ<br>PILNA</button></div>
    <div class="col" data-r="2"><h2>II rūšis</h2><div class="pallet"></div><div class="count">0</div><div class="hint">lentų ant paletės</div><button class="full" style="background:#1565c0">PALETĖ<br>PILNA</button></div>
    <div class="col" data-r="3"><h2>III rūšis</h2><div class="pallet"></div><div class="count">0</div><div class="hint">lentų ant paletės</div><button class="full" style="background:#c62828">PALETĖ<br>PILNA</button></div>
  </section>
  <button id="saveBtn" class="save">IŠSAUGOTI EXCEL</button>
</main>
<footer>Ruletės mygtukas 1 = III rūšis, 2 = II rūšis, 3 = I rūšis • 2 greiti = PALETĖ PILNA • 3 greiti = ATŠAUKTI paskutinį</footer>
<script type="module" src="src/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: styles.css**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; background: #111; color: #eee; font-family: -apple-system, "Segoe UI", sans-serif; user-select: none; }
header { display: flex; align-items: center; gap: 8px; padding: 10px 12px 0; position: relative; }
#status { flex: 1; font-size: 14px; color: #aaa; }
#status.ok { color: #4caf50; } #status.warn { color: #ff9800; } #status.err { color: #f44336; }
#menuBtn { background: none; border: 0; color: #888; font-size: 20px; padding: 6px 10px; }
#menu { position: absolute; right: 12px; top: 44px; background: #222; border-radius: 10px; overflow: hidden; z-index: 5; box-shadow: 0 4px 16px #000a; }
#menu button { display: block; width: 100%; text-align: left; background: none; border: 0; color: #eee; font-size: 17px; padding: 14px 18px; }
#menu button:active { background: #333; }
main { flex: 1; display: flex; flex-direction: column; padding: 0 12px 12px; }
#live { text-align: center; font-size: 26px; color: #666; margin-top: 4px; }
#big { text-align: center; font-size: 64px; font-weight: 700; line-height: 1.1; min-height: 70px; }
#sub { text-align: center; font-size: 22px; color: #4caf50; min-height: 30px; }
.pick { margin: 24px 0; padding: 28px 16px; font-size: 24px; font-weight: 700; border: 0; border-radius: 14px; background: #1565c0; color: #fff; }
#grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.col { background: #1c1c1c; border-radius: 10px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center; }
.col h2 { margin: 0; font-size: 16px; color: #ddd; }
.pallet { font-size: 11px; color: #999; text-align: center; }
.count { font-size: 40px; font-weight: 700; }
.hint { font-size: 10px; color: #777; }
.full { flex: 1; width: 100%; margin-top: 8px; min-height: 110px; border: 0; border-radius: 10px; color: #fff; font-size: 20px; font-weight: 700; }
.full:active { filter: brightness(1.25); }
.save { margin-top: 10px; padding: 16px; font-size: 18px; font-weight: 700; border: 0; border-radius: 12px; background: #333; color: #fff; }
footer { font-size: 11px; color: #555; text-align: center; padding: 6px 12px 10px; }
```

- [ ] **Step 3: app.js**

```js
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
function bigText(main, sub, color = "#fff") { $("big").textContent = main; $("big").style.color = color; $("sub").textContent = sub; $("sub").style.color = color; }
function refresh() {
  for (const r of [1, 2, 3]) {
    const col = document.querySelector(`.col[data-r="${r}"]`);
    col.querySelector(".count").textContent = boardsOnCurrentPallet(state, r);
    col.querySelector(".pallet").textContent = `pildoma paletė Nr. ${palletCount(state, r) + 1}`;
  }
}

// ---------- įrašai
async function record(event) {
  try { await appendEvent(session, event); }
  catch (e) { beep("err"); setStatus(`⚠ Nepavyko išsaugoti įrašo: ${e.message}`, "err"); return false; }
  events.push(event); state = replay(events); refresh(); return true;
}
async function addWidth(button, valueMm) {
  const rusis = BUTTON_TO_RUSIS[button];
  const value = Number.isInteger(valueMm) ? valueMm : Math.round(valueMm * 10) / 10;
  if (await record({ type: "width", rusis, value })) { beep("ok" + rusis); bigText(`${Math.round(value)} mm`, `→ ${RUSYS[rusis]}`); $("sub").style.color = COLORS[rusis]; }
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
  link.connected ? showConnected() : setStatus(`○ ${fileLabel()}`);
}

// ---------- Excel išsaugojimas telefone
async function saveExcel() {
  try {
    const blob = await workbookToBlob(buildWorkbook(window.ExcelJS, state.columns));
    const file = new File([blob], `${session}.xlsx`, { type: XLSX_MIME });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  } catch (e) { if (e.name !== "AbortError") { beep("err"); setStatus(`⚠ Nepavyko išsaugoti: ${e.message}`, "err"); } }
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

openLatestOrNew().then(() => setStatus(`○ Paspauskite „Prisijungti prie ruletės“    ${fileLabel()}`))
  .catch(e => setStatus(`⚠ Duomenų bazės klaida: ${e.message}`, "err"));
```

- [ ] **Step 4: Rankinis patikrinimas kompiuteryje** – `python -m http.server 8080` iš `app/` ir Chrome: puslapis atsidaro, meniu veikia, „IŠSAUGOTI EXCEL“ atsisiunčia tuščią lentelę su antraštėmis, `PALETĖ PILNA` mygtukas po prisijungimo (Windows Chrome Web Bluetooth veikia – galima prisijungti prie ruletės ir kompiuteryje).

- [ ] **Step 5: Commit** `feat: registrator UI with local Excel export`

---

### Task 10: Publikavimas ir instrukcija

**Files:** Modify `index.html` (šakninis) – nuoroda į `app/`; Create `docs/INSTRUKCIJA-iPhone.md`.

- [ ] **Step 1:** Šakniniame `index.html` pridėti `<a href="app/">Registratorius →</a>` virš spike nuorodos.
- [ ] **Step 2:** `docs/INSTRUKCIJA-iPhone.md`: Bluefy diegimas; adresas `https://titasli.github.io/cito-web/app/`; Bluetooth leidimas Nustatymuose; „Prisijungti prie ruletės“; ruletės mygtukų reikšmės; „IŠSAUGOTI EXCEL“ → „Save to Files“ → Downloads; „Guided Access“ (Nustatymai → Pritaikymas neįgaliesiems → Guided Access) kad neišeitų iš Bluefy; puslapį atidaryti ten, kur yra internetas, ir neuždaryti.
- [ ] **Step 3:** `git push`; palaukti Pages; `curl -s https://titasli.github.io/cito-web/app/ | grep -c PRISIJUNGTI` → 1.
- [ ] **Step 4: Commit** `docs: iPhone instructions and landing link`

---

## Self-review

- Spec coverage: 2 (architektūra, moduliai) → T1–T9; 3 (duomenų modelis) → T5, T7; 4 (ekranas) → T9; 5 (ryšys, Wake Lock) → T8, T9; 6 (Excel) → T6; 7 (OneDrive) → sąmoningai atidėta į 2 etapą, vietoje jo vietinis išsaugojimas T9; 8 (be interneto) → T10 instrukcija; 9 (klaidos) → T9 `record`, `pick`, `saveExcel`; 10 (testai) → T2–T6.
- Placeholder scan: nėra.
- Tipai: `Action.type` (T3) naudojamas T9 `applyActions`; `State.columns/undoStack` (T5) naudojami T6, T9; `onStatus(kind, text)` (T8) atitinka T9; `XLSX_MIME` eksportuojamas T6 ir importuojamas T9.
