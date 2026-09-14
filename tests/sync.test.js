import test from "node:test";
import assert from "node:assert/strict";
import { Syncer } from "../app/src/sync.js";

// Testinis pasaulis: valdomas laikas, įrašomi įkėlimai, valdomas online/prisijungimo būvis.
function world({ online = true, signedIn = true, fail = 0 } = {}) {
  const w = { t: 0, uploads: [], states: [], online, signedIn, fail };
  w.syncer = new Syncer({
    now: () => w.t,
    isOnline: () => w.online,
    isSignedIn: () => w.signedIn,
    upload: async id => { w.uploads.push([w.t, id]); if (w.fail > 0) { w.fail--; throw new Error("HTTP 503"); } },
    onState: s => w.states.push({ ...s }),
    debounceMs: 3000, retryMs: 30000,
  });
  w.run = async dt => { w.t += dt; await w.syncer.tick(); };
  return w;
}

test("uploads once, 3 s after the last change (debounce)", async () => {
  const w = world();
  w.syncer.markDirty("s1"); await w.run(1000);
  w.syncer.markDirty("s1"); await w.run(2000);   // 2 s po paskutinio – dar ne
  assert.deepEqual(w.uploads, []);
  await w.run(1100);                              // 3,1 s po paskutinio
  assert.deepEqual(w.uploads, [[4100, "s1"]]);
  await w.run(60000);
  assert.equal(w.uploads.length, 1, "nešvarumo nebėra – daugiau nekelia");
  assert.equal(w.syncer.state.status, "uploaded");
});
test("waits for network, then uploads", async () => {
  const w = world({ online: false });
  w.syncer.markDirty("s1"); await w.run(5000);
  assert.deepEqual(w.uploads, []); assert.equal(w.syncer.state.status, "offline");
  w.online = true; await w.run(100);
  assert.equal(w.uploads.length, 1);
});
test("needs sign-in: does not upload, reports it, uploads after sign-in", async () => {
  const w = world({ signedIn: false });
  w.syncer.markDirty("s1"); await w.run(5000);
  assert.deepEqual(w.uploads, []); assert.equal(w.syncer.state.status, "needs-login");
  w.signedIn = true; await w.run(100);
  assert.equal(w.uploads.length, 1);
});
test("on failure keeps the session dirty and retries after 30 s", async () => {
  const w = world({ fail: 1 });
  w.syncer.markDirty("s1"); await w.run(3100);
  assert.equal(w.uploads.length, 1); assert.equal(w.syncer.state.status, "error");
  assert.match(w.syncer.state.error, /503/);
  await w.run(10000); assert.equal(w.uploads.length, 1, "per anksti kartoti");
  await w.run(20100); assert.equal(w.uploads.length, 2); assert.equal(w.syncer.state.status, "uploaded");
});
test("uploadNow skips the debounce and uploads all dirty sessions", async () => {
  const w = world();
  w.syncer.markDirty("s1"); w.syncer.markDirty("s2");
  await w.syncer.uploadNow();
  assert.deepEqual(w.uploads.map(u => u[1]).sort(), ["s1", "s2"]);
});
test("does not run two uploads concurrently", async () => {
  const w = world();
  let resolve; w.syncer.opts.upload = () => new Promise(r => { resolve = r; });
  w.syncer.markDirty("s1"); w.t += 3100;
  const p1 = w.syncer.tick(); const p2 = w.syncer.tick();
  assert.equal(w.syncer.state.status, "uploading");
  resolve(); await p1; await p2;
  assert.equal(w.syncer.state.status, "uploaded");
});
