// Kelių paspaudimų atpažinimas be laikmačių: feed() gavus mygtuką, flush() periodiškai.
//   {type:"single", button, valueMm} – vienas paspaudimas (matmuo)
//   {type:"double", button}          – du greiti (paletė pilna)
//   {type:"triple", button}          – trys greiti (atšaukti)
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
