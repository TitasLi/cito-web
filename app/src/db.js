// IndexedDB įvykių žurnalas: sessions {id, createdAt}, events {seq, sessionId, ts, type, rusis, value}
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
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && "result" in r ? r.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export async function listSessions() { return tx(await openDb(), "sessions", "readonly", s => s.getAll()); }
export async function createSession(id) { await tx(await openDb(), "sessions", "readwrite", s => s.add({ id, createdAt: Date.now() })); return id; }
export async function appendEvent(sessionId, event) { await tx(await openDb(), "events", "readwrite", s => s.add({ ...event, sessionId, ts: Date.now() })); }
export async function updateSession(id, patch) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction("sessions", "readwrite"), st = t.objectStore("sessions");
    const g = st.get(id);
    g.onsuccess = () => { if (g.result) st.put({ ...g.result, ...patch }); };
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
export async function loadEvents(sessionId) { return tx(await openDb(), "events", "readonly", s => s.index("bySession").getAll(sessionId)); }
