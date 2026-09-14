// Sola CITO ASCII protokolas per GATT FFF1 (notify):
//   M 168.00 mm F   – nuolatinis srautas
//   B 1 170 mm F    – trumpai paspaustas 1 mygtukas
//   B 3L 118 mm F   – ilgai paspaustas 3 mygtukas
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
