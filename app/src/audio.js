// WebAudio pyptelėjimai, tokie pat kaip Windows winsound versijoje.
let ctx;
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch (_) {}
}
function tone(freq, ms) {
  return new Promise(res => {
    unlockAudio();
    if (!ctx) return res();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.3; o.connect(g); g.connect(ctx.destination);
    o.start(); setTimeout(() => { o.stop(); res(); }, ms);
  });
}
const pause = ms => new Promise(r => setTimeout(r, ms));

export async function beep(pattern) {
  try {
    if (pattern.startsWith("ok")) { for (let i = 0; i < Number(pattern[2]); i++) { await tone(1800, 90); await pause(60); } }
    else if (pattern === "undo") await tone(600, 350);
    else if (pattern === "connect") { await tone(1000, 80); await tone(1500, 80); }
    else if (pattern === "pallet") { for (const f of [900, 1200, 1600]) await tone(f, 120); }
    else { await tone(300, 200); await pause(60); await tone(300, 200); }
  } catch (_) { /* garsas neprivalomas */ }
}
