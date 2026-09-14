# cito-relay (Cloudflare Worker)

Priima .xlsx iš programėlės ir įkelia į anonimiškai bendrintą OneDrive aplanką kaip „Guest Contributor“.

## Diegimas (vieną kartą)
```bash
cd relay
npx wrangler login                      # atsidaro naršyklė, prisijungiate prie Cloudflare
npx wrangler secret put SHARE_LINK      # įklijuojate OneDrive bendrinimo nuorodą
npx wrangler secret put API_KEY         # ilgas atsitiktinis raktas (tas pats į app/config.js)
npx wrangler deploy                     # gaunate https://cito-relay.<subdomenas>.workers.dev
```
Tada `app/config.js`: `relayUrl: "https://cito-relay.<subdomenas>.workers.dev"`, `relayKey: "<raktas>"`.

## Vietinis testas
`relay/.dev.vars` su `SHARE_LINK=...` ir `API_KEY=...`, tada `npx wrangler dev --port 8787 --local`;
`node tools/relay-check.mjs` (reikia statinio serverio :8765 iš `app/`).
