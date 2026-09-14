// Įvykių žurnalas -> trys stulpeliai (kaip Windows ExcelStore).
// events: {type:"width", rusis, value} | {type:"pallet", rusis} | {type:"undo"}
// columns[r]: masyvas nuo 2-os Excel eilutės; Cell = {kind:"width", value} | {kind:"pallet", nr} | null (atšaukta)
export function replay(events) {
  const columns = { 1: [], 2: [], 3: [] }, undoStack = [];
  const nextIndex = col => { let i = col.length; while (i > 0 && col[i - 1] === null) i--; return i; };
  const put = (rusis, cell) => {
    const col = columns[rusis]; const i = nextIndex(col);
    col.length = i; col.push(cell); undoStack.push({ rusis, index: i });
  };
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
