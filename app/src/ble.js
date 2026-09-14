// Web Bluetooth ryšys su Sola CITO ir automatinis pakartotinis prisijungimas.
import { LineBuffer, SERVICE_UUID, NOTIFY_UUID } from "./protocol.js";

export class CitoLink {
  constructor({ onReading, onStatus }) {
    this.onReading = onReading; this.onStatus = onStatus;
    this.device = null; this.buf = new LineBuffer(); this.connected = false; this._reconnecting = false;
  }
  get name() { return this.device?.name || ""; }
  get available() { return !!navigator.bluetooth; }

  async pick() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: "SOLA_Cito" }], optionalServices: [SERVICE_UUID] });
    this.device.addEventListener("gattserverdisconnected", () => {
      this.connected = false;
      this.onStatus("searching", "Ryšys nutrūko, jungiuosi iš naujo...");
      this.#reconnectLoop();
    });
    await this.#connect();
  }

  async #connect() {
    this.onStatus("searching", `Jungiuosi prie ${this.name}...`);
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    const ch = await svc.getCharacteristic(NOTIFY_UUID);
    ch.addEventListener("characteristicvaluechanged", ev => {
      const dv = ev.target.value;
      for (const r of this.buf.feed(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength))) this.onReading(r);
    });
    await ch.startNotifications();
    this.connected = true;
    this.onStatus("connected", this.name);
  }

  async #reconnectLoop() {
    if (this._reconnecting) return;
    this._reconnecting = true;
    try {
      for (let attempt = 1; !this.connected; attempt++) {
        await new Promise(r => setTimeout(r, attempt <= 10 ? 2000 : 5000));
        if (this.connected) return;
        try { await this.#connect(); }
        catch (e) { this.onStatus("searching", `Ieškau ruletės... (${attempt}) įjunkite CITO`); }
      }
    } finally { this._reconnecting = false; }
  }
}
