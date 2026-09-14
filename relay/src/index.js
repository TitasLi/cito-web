// CITO relay: priima .xlsx iš telefono ir įkelia į anonimiškai bendrintą OneDrive aplanką
// kaip „Guest Contributor“ (be jokios paskyros). Naršyklė to padaryti tiesiogiai negali (slapukai, CORS).
//
// Aplinka (wrangler secrets / .dev.vars):
//   SHARE_LINK  – OneDrive bendrinimo nuoroda (Anyone with the link can edit)
//   API_KEY     – raktas, kurį siunčia programėlė antraštėje X-Cito-Key
//   ALLOWED_ORIGIN – (nebūtina) leidžiama kilmė CORS, pvz. https://titasli.github.io
//
// API: POST /upload?name=plociai_2026-09-14.xlsx  (body = failo baitai)  -> 200 {"name":..., "length":...}
//      GET  /health -> 200

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 CitoRelay/1.0";
const SAFE_NAME = /^[\w\-. ąčęėįšųūžĄČĘĖĮŠŲŪŽ]{1,120}\.xlsx$/u;

// ALLOWED_ORIGIN: kableliais atskirtos kilmės; grąžinama ta, kuri sutampa su užklausos Origin.
function cors(env, request, extra = {}) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map(s => s.trim());
  const origin = request.headers.get("Origin") || "";
  const allow = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]);
  return { "Access-Control-Allow-Origin": allow, Vary: "Origin", "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Cito-Key", "Access-Control-Max-Age": "86400", ...extra };
}
const json = (env, request, status, obj) => new Response(JSON.stringify(obj), { status, headers: cors(env, request, { "Content-Type": "application/json" }) });

// 1) Iškeičiame bendrinimo nuorodą į svečio sesiją: sekame peradresavimus rankiniu būdu ir renkame Set-Cookie.
async function redeem(shareLink) {
  let url = shareLink, cookies = new Map();
  for (let hop = 0; hop < 8; hop++) {
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, Cookie: cookieHeader(cookies) } });
    for (const sc of r.headers.getSetCookie?.() || []) { const [kv] = sc.split(";"); const i = kv.indexOf("="); cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1)); }
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).toString(); continue; }
    const finalUrl = new URL(url);
    const id = finalUrl.searchParams.get("id");                          // /personal/<user>/Documents/<Aplankas>
    if (!cookies.has("FedAuth") || !id) throw new Error(`share link redeem failed (status ${r.status}, FedAuth=${cookies.has("FedAuth")}, id=${!!id})`);
    const site = `${finalUrl.origin}${finalUrl.pathname.split("/_layouts/")[0]}`; // https://x-my.sharepoint.com/personal/<user>
    return { site, folder: id, cookies };
  }
  throw new Error("too many redirects");
}
const cookieHeader = m => [...m].map(([k, v]) => `${k}=${v}`).join("; ");

// 2) Form digest + 3) Files/add(overwrite=true)
async function uploadToOneDrive(env, name, body) {
  const { site, folder, cookies } = await redeem(env.SHARE_LINK);
  const common = { "User-Agent": UA, Cookie: cookieHeader(cookies), Accept: "application/json;odata=nometadata" };
  const ctx = await fetch(`${site}/_api/contextinfo`, { method: "POST", headers: { ...common, "Content-Length": "0" } });
  if (!ctx.ok) throw new Error(`contextinfo ${ctx.status}`);
  const digest = (await ctx.json()).FormDigestValue;
  const enc = s => encodeURIComponent(s).replace(/'/g, "''");
  const target = `${site}/_api/web/GetFolderByServerRelativeUrl('${enc(folder)}')/Files/add(url='${enc(name)}',overwrite=true)`;
  const up = await fetch(target, { method: "POST", headers: { ...common, "X-RequestDigest": digest, "Content-Type": "application/octet-stream" }, body });
  if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 300)}`);
  const info = await up.json();
  return { name: info.Name, length: Number(info.Length), modified: info.TimeLastModified };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const j = (status, obj) => json(env, request, status, obj);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, request) });
    if (url.pathname === "/health") return j(200, { ok: true });
    if (url.pathname !== "/upload" || request.method !== "POST") return j(404, { error: "not found" });
    if (!env.API_KEY || request.headers.get("X-Cito-Key") !== env.API_KEY) return j(401, { error: "bad key" });
    const name = url.searchParams.get("name") || "";
    if (!SAFE_NAME.test(name)) return j(400, { error: "bad name" });
    const body = await request.arrayBuffer();
    if (body.byteLength < 100 || body.byteLength > 8 * 1024 * 1024) return j(400, { error: "bad size" });
    try { return j(200, await uploadToOneDrive(env, name, body)); }
    catch (e) { return j(502, { error: String(e.message || e) }); }
  },
};
