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
