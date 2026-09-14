# Sola CITO → iPhone (Bluefy) → OneDrive: dizaino specifikacija

Data: 2026-09-14. Būsena: patvirtinta pokalbyje, laukia galutinės peržiūros.

## 1. Tikslas

Windows programos `cito_excel.py` (Sola CITO ruletė → Excel su trimis rūšių stulpeliais ir „PALETĖ PILNA“
žymomis) atitikmuo, veikiantis iPhone telefone be kompiuterio. Įrašai kaupiami telefone be interneto,
atsiradus internetui Excel failas atsiduria įmonės OneDrive aplanke.

Apribojimai (nustatyti su užsakovu):
- Nėra Mac ir Apple Developer paskyros → ne native iOS, o interneto programėlė **Bluefy** naršyklėje
  (patikrinta: Web Bluetooth veikia, filtras pagal vardą `SOLA_Cito` veikia, IndexedDB ir Wake Lock yra,
  Service Worker **nėra**, PWA diegimo į pradžios ekraną **nėra**).
- Vienas telefonas, viena ruletė.
- Rezultatas: tas pats Excel failas kiekvienai sesijai (`plociai_YYYY-MM-DD.xlsx`, `_2`, `_3`…), OneDrive/SharePoint.
- Užsakovas yra paprastas Microsoft 365 vartotojas, ne administratorius.
- Mobilusis internetas gamyboje silpnas ir ne visur.

## 2. Architektūra

Viena statinė svetainė be kompiliavimo žingsnio, talpinama GitHub Pages iš saugyklos `TitasLi/cito-web`:
`https://titasli.github.io/cito-web/app/`. Grynas JavaScript (ES moduliai), be karkasų. Trečiųjų šalių
bibliotekos įdedamos į saugyklą (`vendor/`), kad viskas būtų iš vienos kilmės ir nepriklausytų nuo CDN:
- **ExcelJS** (naršyklės UMD paketas) – .xlsx generavimas su stiliais (paryškinimas, geltonas užpildas, stulpelių plotis).
- **MSAL.js (msal-browser)** – prisijungimas prie Microsoft ir Graph žetonai.

Moduliai (`app/src/`), kiekvienas su vienu tikslu ir testuojamas atskirai:

| Modulis | Atsakomybė | Priklauso nuo |
|---|---|---|
| `protocol.js` | ASCII eilučių `M 168.00 mm F` / `B 1 170 mm F` analizė, `LineBuffer` (paketai gali sulipti/skilti). Tiesioginis `cito_protocol.py` perkėlimas. | – |
| `presses.js` | `MultiPressDetector`: 1 paspaudimas = matmuo, 2 greiti = paletė pilna, 3 greiti = atšaukti (langas 0,5 s). Perkėlimas iš `press_logic.py`. | – |
| `model.js` | Grynos funkcijos: įvykių sąrašas → trys stulpeliai (kaip `ExcelStore`): `addWidth`, `markPalletFull`, `undoLast`, `palletCount`, `boardsOnCurrentPallet`, `columns()`. | – |
| `sessions.js` | Sesijų pavadinimai `plociai_YYYY-MM-DD[_n]`, paskutinės sesijos parinkimas. Perkėlimas iš `excel_store.py`. | – |
| `db.js` | IndexedDB saugykla: `sessions`, `events`; `appendEvent`, `loadEvents(sessionId)`, `setSyncState`. | naršyklė |
| `excel.js` | `model.columns()` → .xlsx `Blob` per ExcelJS, identiškas Windows failui. | ExcelJS |
| `ble.js` | Web Bluetooth: pasirinkimas pagal `namePrefix: "SOLA_Cito"`, FFF0/FFF1 pranešimai, automatinis pakartotinis prisijungimas prie to paties `device`. | `protocol.js` |
| `sync.js` | Išsiuntimo eilė: nešvarios sesijos → įkėlimas į OneDrive per Graph; būsenos; pakartojimai. | MSAL, `excel.js`, `db.js` |
| `audio.js` | WebAudio pyptelėjimai: `ok1/ok2/ok3`, `undo`, `err`, `connect`, `pallet` (melodija). | naršyklė |
| `app.js` | UI sujungimas, būsenų rodymas, Wake Lock, meniu. | visi |

## 3. Duomenų modelis (IndexedDB, DB `cito`, versija 1)

`sessions`: `{ id (string, = failo kamienas, pvz. "plociai_2026-09-14_2"), createdAt, dirty (bool), lastUploadedAt, lastError }`
`events`: `{ seq (autoIncrement), sessionId, ts, type: "width" | "pallet" | "undo", rusis (1..3), value (mm, tik width) }`

Įvykių žurnalas yra tiesa; stulpeliai ir Excel visada išvedami iš jo perleidžiant `model.js`. `undo` reiškia
„pašalinti paskutinį dar neatšauktą width/pallet įrašą“ nepriklausomai nuo stulpelio (kaip Windows `_undo` stekas).
Kiekvienas įvykis įrašomas į IndexedDB **prieš** atnaujinant ekraną. Perkrovus puslapį atstatoma paskutinė sesija.

Rūšių atitikmuo toks pats kaip Windows: ruletės mygtukas 1 → III rūšis (3 stulpelis), 2 → II, 3 → I.

## 4. Ekranas (vienas puslapis, lietuviškai, tamsus fonas, dideli elementai)

Viršuje: būsenos eilutė (● Prijungta: SOLA_Cito_225548 · Failas: plociai_2026-09-14.xlsx · ☁ įkelta 13:42 /
⏳ laukia interneto / ⚠ prisijunkite prie Microsoft / ⚠ ryšys su rulete nutrūko, jungiuosi…) ir meniu ▼:
„Nauja sesija“, „Prisijungti prie Microsoft“, „Įkelti dabar“, „Prisijungti prie ruletės“.
Centre: gyvas matmuo (pilkas), paskutinis įrašas (didelis) ir paaiškinimas („→ II rūšis“, „PALETĖ 3 PILNA“, „ATŠAUKTA“).
Apačioje: trys stulpeliai I / II / III rūšis, kiekviename „pildoma paletė Nr. n“, lentų skaičius, didelis spalvotas
mygtukas „PALETĖ PILNA“. Po jais pagalbos eilutė apie ruletės mygtukus.
Kol ruletė nepasirinkta (po puslapio atidarymo): vietoje stulpelių didelis mygtukas „PRISIJUNGTI PRIE RULETĖS“
(Web Bluetooth reikalauja paspaudimo). Po atsijungimo programėlė jungiasi pati; mygtukas rodomas tik jei
pakartotinis prisijungimas nepavyksta 60 s.

## 5. Ruletės ryšys (`ble.js`)

- `requestDevice({ filters: [{ namePrefix: "SOLA_Cito" }], optionalServices: [FFF0] })` (patikrinta Bluefy).
- Prisijungus: `getPrimaryService(FFF0)` → `getCharacteristic(FFF1)` → `startNotifications`; baitai → `LineBuffer`.
- `gattserverdisconnected` → bandymai `device.gatt.connect()` kas 2 s, po 10 nesėkmių kas 5 s, be sąrašo.
- Ekranas neužgęsta: `navigator.wakeLock.request("screen")` po prisijungimo ir kaskart `visibilitychange` → visible;
  jei yra Bluefy `bluetooth.setScreenDimEnabled`, iškviečiama ir ji.
- Ilgi paspaudimai (`L`) ignoruojami, kaip Windows.

## 6. Excel (`excel.js`)

Lapas „Pločiai“; A1:C1 antraštės „I rūšis (plotis, mm)“, „II rūšis (plotis, mm)“, „III rūšis (plotis, mm)“,
paryškintos, centruotos, plotis 24. Reikšmės – skaičiai (sveiki, jei be trupmenos), centruotos. Paletės žyma –
tekstas `PALETĖ n PILNA`, paryškintas, užpildas `FFF2CC`. Eilutės numeruojamos kiekviename stulpelyje atskirai,
kaip Windows (`_next_row` logika).

## 7. Sinchronizacija su OneDrive (`sync.js`)

Pagrindinis kelias – **Microsoft Graph** su vartotojo prisijungimu:
- MSAL redirect srautas (PKCE), scope `Files.ReadWrite`, `offline_access`. `clientId`/`tenantId` laikomi
  `app/config.js` (nėra paslaptis). Prisijungimas rodomas tik paspaudus meniu punktą arba kai reikia įkelti, o
  tylus žetono gavimas nepavyksta.
- Įkėlimas: `PUT /me/drive/root:/CITO/{sessionId}.xlsx:/content` su `Blob` (failai < 4 MB, vienas užklausimas).
  Perrašoma visa byla; OneDrive saugo versijas, todėl kolegos atidarytas failas įkėlimo neblokuoja.
- Kada: po paskutinio įvykio praėjus 3 s (debounce); `online` įvykis; kas 30 s, kol yra nešvarių sesijų; meniu „Įkelti dabar“.
- Būsenos: `dirty=false` po sėkmės su `lastUploadedAt`; klaidos rodomos būsenos eilutėje, įrašai lieka telefone.
- Atsarginis kelias, jei Entra registracija vartotojui neleidžiama: **nesprendžiamas šioje specifikacijoje**;
  `sync.js` turi vieną sąsają `uploader.upload(name, blob)`, kad būtų galima pakeisti įgyvendinimą
  (numatomas variantas – Power Automate srautas per el. paštą). Sprendimas priimamas gavus Azure patikrinimo rezultatą.

## 8. Darbas be interneto

Bluefy neturi Service Worker ir neišsaugo puslapio kešo, todėl **šaltas paleidimas reikalauja interneto**.
Darbo tvarka: puslapis atidaromas ten, kur yra ryšys (ar mobilusis), ir lieka atidarytas visą pamainą; visa
logika, saugojimas ir Excel generavimas vyksta telefone be tinklo; įkėlimas įvyksta, kai ryšys atsiranda.
Apsaugos: kiekvienas įvykis iškart IndexedDB; „Guided Access“ rekomendacija instrukcijoje; Wake Lock.
Ateities galimybė (ne šioje apimtyje): talpinimas su ilgu `Cache-Control`, jei bandymai parodys, kad Bluefy jį gerbia.

## 9. Klaidų tvarkymas

- Nesuprasta eilutė iš ruletės → žurnalas konsolėje, ignoruojama.
- IndexedDB klaida rašant → raudona būsena „Nepavyko išsaugoti įrašo“, garsas `err`, įrašas nerodomas kaip priimtas.
- Graph 401/žetonas pasibaigęs → būsena „⚠ prisijunkite prie Microsoft“, meniu punktas; 5xx/tinklas → pakartojimas.
- Bluetooth nepasiekiamas (`navigator.bluetooth` nėra) → aiškus pranešimas „Atidarykite Bluefy naršyklėje“.

## 10. Testavimas

- Automatiniai testai `node --test` (Node 24) moduliams `protocol`, `presses`, `model`, `sessions`, `excel`
  (Excel tikrinamas įkeliant sugeneruotą bylą atgal per ExcelJS ir lyginant langelius/stilius).
  Testų atvejai perkeliami iš Python testų (`test_protocol.py`, `test_press_logic.py`, `test_excel_store.py`, `test_sessions.py`).
- `db.js`, `ble.js`, `sync.js` – ploni adapteriai; tikrinami rankiniu būdu telefone pagal kontrolinį sąrašą
  (prisijungimas, atsijungimas/atsijungimas ir grįžimas, lėktuvo režimas → įrašai → tinklas → failas OneDrive).
- Bandomasis puslapis `spike/` lieka saugykloje diagnostikai.

## 11. Ne šioje apimtyje

Keli telefonai / vartotojai; bendra suvestinė; native iOS; darbas be interneto nuo šalto paleidimo; Power Automate
įgyvendinimas (kol nežinomas Azure rezultatas).

## 12. Atviri klausimai

1. Entra „App registration“ galimybė paprastam vartotojui → lemia 7 skyriaus pagrindinį ar atsarginį kelią.
2. WebAudio pyptelėjimai Bluefy – veikė bandomajame puslapyje? (patvirtinti telefone su garsu).
