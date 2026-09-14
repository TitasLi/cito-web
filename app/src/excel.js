// columns -> .xlsx, identiškas Windows failui (lapas „Pločiai“, geltonos PALETĖ žymos).
// ExcelJS paduodamas parametru: naršyklėje window.ExcelJS, testuose npm paketas.
const HEADERS = { 1: "I rūšis (plotis, mm)", 2: "II rūšis (plotis, mm)", 3: "III rūšis (plotis, mm)" };
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function buildWorkbook(ExcelJS, columns) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pločiai");
  for (const col of [1, 2, 3]) {
    const h = ws.getCell(1, col);
    h.value = HEADERS[col]; h.font = { bold: true }; h.alignment = { horizontal: "center" };
    ws.getColumn(col).width = 24;
    columns[col].forEach((cell, i) => {
      if (!cell) return;
      const c = ws.getCell(i + 2, col); c.alignment = { horizontal: "center" };
      if (cell.kind === "pallet") {
        c.value = `PALETĖ ${cell.nr} PILNA`; c.font = { bold: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      } else c.value = cell.value;
    });
  }
  return wb;
}

export async function workbookToBlob(wb) {
  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME });
}
