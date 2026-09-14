// Išsiuntimo eilė: nešvarios sesijos -> upload(id), kai yra tinklas ir prisijungimas.
// Grynas, be naršyklės API: laikas, tinklas, prisijungimas ir įkėlimas paduodami per opts.
// Būsenos: idle | pending | offline | needs-login | uploading | uploaded | error
export class Syncer {
  constructor(opts) {
    this.opts = { debounceMs: 3000, retryMs: 30000, onState: () => {}, ...opts };
    this.dirty = new Set();
    this.lastChange = 0;
    this.nextRetryAt = 0;
    this.busy = false;
    this.state = { status: "idle", error: null, uploadedAt: null, pending: 0 };
  }

  #set(patch) { this.state = { ...this.state, ...patch, pending: this.dirty.size }; this.opts.onState(this.state); }

  markDirty(sessionId) {
    this.dirty.add(sessionId);
    this.lastChange = this.opts.now();
    this.nextRetryAt = 0;
    if (this.state.status !== "uploading") this.#set({ status: "pending" });
  }

  async tick() {
    if (this.busy || !this.dirty.size) return;
    const t = this.opts.now();
    if (t - this.lastChange < this.opts.debounceMs) return;
    if (t < this.nextRetryAt) return;
    if (!this.opts.isOnline()) { if (this.state.status !== "offline") this.#set({ status: "offline" }); return; }
    if (!this.opts.isSignedIn()) { if (this.state.status !== "needs-login") this.#set({ status: "needs-login" }); return; }
    await this.#flush();
  }

  async uploadNow() {
    if (this.busy) return;
    if (!this.opts.isOnline()) { this.#set({ status: "offline" }); return; }
    if (!this.opts.isSignedIn()) { this.#set({ status: "needs-login" }); return; }
    await this.#flush();
  }

  async #flush() {
    this.busy = true;
    this.#set({ status: "uploading", error: null });
    try {
      for (const id of [...this.dirty]) {
        await this.opts.upload(id);
        this.dirty.delete(id);
      }
      this.#set({ status: "uploaded", error: null, uploadedAt: this.opts.now() });
    } catch (e) {
      this.nextRetryAt = this.opts.now() + this.opts.retryMs;
      this.#set({ status: "error", error: e && e.message ? e.message : String(e) });
    } finally { this.busy = false; }
  }
}
