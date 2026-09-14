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
