// Rankinio patikrinimo pagalbininkas: atidaro programėlę tikroje Chrome, surenka konsolę ir būseną.
import puppeteer from "puppeteer-core";
const url = process.argv[2] || "http://127.0.0.1:8765/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
const logs = [];
page.on("console", m => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1500));
const status = await page.$eval("#status", e => e.textContent);
const pallets = await page.$$eval(".pallet", es => es.map(e => e.textContent));
// simuliuojame: du PALETĖ PILNA paspaudimai (grid paslėptas, kviečiame per DOM)
await page.evaluate(() => { document.getElementById("grid").hidden = false; });
await page.click('.col[data-r="2"] .full');
await new Promise(r => setTimeout(r, 300));
const pallets2 = await page.$$eval(".pallet", es => es.map(e => e.textContent));
const big = await page.$eval("#big", e => e.textContent);
// Excel generavimas naršyklėje (be share) – tikriname, kad ExcelJS globalas veikia
const xlsxSize = await page.evaluate(async () => {
  const { buildWorkbook, workbookToBlob } = await import("./src/excel.js");
  const { replay } = await import("./src/model.js");
  const blob = await workbookToBlob(buildWorkbook(window.ExcelJS, replay([{ type: "width", rusis: 1, value: 100 }]).columns));
  return blob.size;
});
// perkrovus – įvykiai atstatomi iš IndexedDB
await page.reload({ waitUntil: "networkidle0" }); await new Promise(r => setTimeout(r, 1000));
const palletsAfterReload = await page.$$eval(".pallet", es => es.map(e => e.textContent));
console.log(JSON.stringify({ status, pallets, pallets2, big, xlsxSize, palletsAfterReload, logs }, null, 2));
await browser.close();
