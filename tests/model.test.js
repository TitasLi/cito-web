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
