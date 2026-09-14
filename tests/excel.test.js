import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildWorkbook } from "../app/src/excel.js";
import { replay } from "../app/src/model.js";

async function roundtrip(columns) {
  const wb = buildWorkbook(ExcelJS, columns);
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(buf);
  return wb2.getWorksheet("Pločiai");
}
test("headers, values, pallet marker styling", async () => {
  const s = replay([{ type: "width", rusis: 1, value: 99 }, { type: "pallet", rusis: 1 }, { type: "width", rusis: 2, value: 120.5 }, { type: "width", rusis: 3, value: 7 }, { type: "undo" }]);
  const ws = await roundtrip(s.columns);
  assert.equal(ws.getCell("A1").value, "I rūšis (plotis, mm)");
  assert.equal(ws.getCell("B1").value, "II rūšis (plotis, mm)");
  assert.equal(ws.getCell("C1").value, "III rūšis (plotis, mm)");
  assert.equal(ws.getCell("A1").font.bold, true);
  assert.equal(ws.getColumn(1).width, 24);
  assert.equal(ws.getCell("A2").value, 99);
  assert.equal(ws.getCell("A3").value, "PALETĖ 1 PILNA");
  assert.equal(ws.getCell("A3").font.bold, true);
  assert.equal(ws.getCell("A3").fill.fgColor.argb, "FFFFF2CC");
  assert.equal(ws.getCell("B2").value, 120.5);
  assert.equal(ws.getCell("C2").value, null); // atšaukta
});
