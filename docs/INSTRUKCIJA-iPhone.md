# Sola CITO → Excel registratorius iPhone telefone

## Diegimas (vieną kartą)
1. App Store įdiekite nemokamą naršyklę **Bluefy – Web BLE Browser**.
2. iPhone **Nustatymai → Bluefy → Bluetooth** turi būti įjungtas.
3. Bluefy atidarykite adresą ir pridėkite jį prie žymių:
   `https://titasli.github.io/cito-web/app/`
4. Rekomenduojama: **Nustatymai → Pritaikymas neįgaliesiems → Guided Access** įjungti, kad darbuotojas
   netyčia neišeitų iš Bluefy (paleidžiama triskart spustelėjus šoninį mygtuką).

## Darbo pradžia
- Puslapį atidarykite ten, kur yra internetas (Wi‑Fi arba mobilusis). Toliau internetas nereikalingas,
  bet **puslapio neuždarykite** – Bluefy neišsaugo jo darbui be tinklo.
- Įjunkite ruletę CITO, spauskite **PRISIJUNGTI PRIE RULETĖS**, pasirinkite `SOLA_Cito_…`.
  Viršuje atsiranda žalias „● Prijungta“. Ekranas neužgęsta, kol programėlė prijungta.
- Nutrūkus ryšiui (ruletė išsijungė) programėlė jungiasi pati, kai ruletė vėl įjungiama.

## Naudojimas
| Veiksmas ant ruletės | Rezultatas |
|---|---|
| trumpai mygtukas 1 | plotis į **III rūšį** (3 pyptelėjimai) |
| trumpai mygtukas 2 | plotis į **II rūšį** (2 pyptelėjimai) |
| trumpai mygtukas 3 | plotis į **I rūšį** (1 pyptelėjimas) |
| 2 greiti to paties mygtuko | **PALETĖ PILNA** tai rūšiai (melodija) – tas pats, kas didelis mygtukas lange |
| 3 greiti to paties mygtuko | **atšaukti** paskutinį įrašą |

Lange kiekvienai rūšiai rodoma, kelinta paletė pildoma ir kiek lentų jau ant jos.

## Excel failas
- Spauskite **IŠSAUGOTI EXCEL** (arba meniu ▼ → Išsaugoti Excel). Atsidaro dalijimosi langas:
  pasirinkite **Save to Files / Įrašyti į Failus** → **Downloads / Atsisiuntimai** → Save.
- Failas `plociai_2026-09-14.xlsx` su trimis stulpeliais ir geltonomis `PALETĖ n PILNA` žymomis, kaip Windows versijoje.
- Išsaugoti galima bet kada ir kiek norima kartų – failas visada sugeneruojamas iš visų sesijos įrašų.
- Meniu ▼ → **Nauja sesija** pradeda naują failą (`_2`, `_3` tą pačią dieną). Paleidus programėlę iš naujo
  tęsiama paskutinė sesija.

## Problemos
- „Ši naršyklė nemoka Bluetooth“ – puslapis atidarytas Safari, o ne Bluefy.
- Prisijungiant klaida – patikrinkite Nustatymai → Bluefy → Bluetooth; įjunkite ruletę (išsijungia po 3 min neveiklos).
- Diagnostika: `https://titasli.github.io/cito-web/spike/`.
