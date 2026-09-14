// Visos grandinės patikra: programėlė (Chrome) -> relay (wrangler dev :8787) -> OneDrive.
// Paleidimas: node tools/relay-check.mjs  (reikia: statinis serveris :8765 iš app/, wrangler dev :8787)
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", m => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerror] ${e.message}`));
// config.js pakeičiame skrydyje į vietinį relay
await page.setRequestInterception(true);
page.on("request", req => {
  if (req.url().endsWith("/config.js")) req.respond({ contentType: "application/javascript",
    body: 'export const CONFIG = { relayUrl: "http://127.0.0.1:8787", relayKey: "test-key-123" };' });
  else req.continue();
});
await page.goto("http://127.0.0.1:8765/?e2e=1", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 800));
// nauja sesija su unikaliu vardu būtų geriau, bet vardas = data; naudojame esamą
await page.evaluate(() => { document.getElementById("grid").hidden = false; });
await page.click('.col[data-r="3"] .full');
const seen = [];
for (let i = 0; i < 20; i++) {           // stebime debesies būseną iki 10 s
  await new Promise(r => setTimeout(r, 500));
  const t = await page.$eval("#cloud", e => e.textContent);
  if (!seen.length || seen[seen.length - 1] !== t) seen.push(t);
  if (t.startsWith("☁ įkelta")) break;
}
const title = await page.$eval("#cloud", e => e.title);
console.log(JSON.stringify({ cloudStates: seen, cloudTitle: title, logs }, null, 2));
await browser.close();
