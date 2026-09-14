// Sesijų pavadinimai: plociai_YYYY-MM-DD, tos pačios dienos kiti – _2, _3 ...
const RE = /^plociai_(\d{4}-\d{2}-\d{2})(?:_(\d+))?$/;

export function isoDay(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newSessionName(existing, day = new Date()) {
  const set = new Set(existing), stem = `plociai_${isoDay(day)}`;
  let name = stem, n = 2;
  while (set.has(name)) name = `${stem}_${n++}`;
  return name;
}

export function latestSessionName(names) {
  const key = s => { const m = RE.exec(s); return m ? [m[1], Number(m[2] || 1)] : null; };
  let best = null, bk = null;
  for (const s of names) {
    const k = key(s); if (!k) continue;
    if (!bk || k[0] > bk[0] || (k[0] === bk[0] && k[1] > bk[1])) { best = s; bk = k; }
  }
  return best;
}
