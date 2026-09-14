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
