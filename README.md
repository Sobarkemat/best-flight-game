# Langit Nusantara — Game Terbang

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Sobarkemat/best-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Sobarkemat/best-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

**Langit Nusantara** adalah game terbang 2D yang berjalan sepenuhnya offline di
browser desktop, dibuat untuk kompetisi
[Make the best flight game](https://make.fun/c/best-flight-game-20261126-0057)
di make.fun. Kamu menerbangkan pesawat ringan di atas kepulauan tropis
prosedural — laut biru, tujuh pulau bernama, sungai, mercusuar, dan Landasan
Nusantara — dengan model terbang yang nyata: throttle, lift, stall, belok dari
bank, bahan bakar, dan kerusakan.

## Tiga misi

1. **Ring Run** — terbang melewati 8 ring di langit kepulauan (+100 per ring,
   bonus waktu bila cepat).
2. **Island Hop** — kunjungi 4 pulau berturut-turut; hemat bahan bakar karena
   tangki kosong berarti melayang.
3. **Runway Landing** — lepas landas, putari mercusuar di ujung barat, lalu
   mendarat kembali di landasan. Makin halus sentuhan, makin besar bonus.

## Cara main

- **Atas / Bawah** — naik / turun (pitch)
- **Kiri / Kanan** atau **A / D** — belok (bank)
- **W / S** — throttle naik / turun
- **Spasi** — flap (turunkan stall speed untuk mendarat)
- **B** — rem udara
- **M** — suara nyala/mati, **P** — jeda
- Mouse untuk menu, tombol suara, dan jeda.

HUD lengkap: pita kecepatan (knot), pita ketinggian (kaki), kompas heading,
horizon buatan, throttle, bahan bakar, kerusakan, skor, waktu, dan objektif
misi — plus panah penunjuk target. Suara mesin dan angin disintesis dengan
Web Audio API, tanpa file eksternal.

## Teknologi

Game 2D murni Canvas API tanpa library dan tanpa network: semua file di
`game/` (HTML + modul ES), gambar digambar dari bentuk kanvas, terrain
pra-render dari seed. Deterministik untuk screenshot:
`?shot=cover|ring|landing|islands&seed=7` membekukan satu adegan permainan.

```
game/
  index.html        — shell halaman + canvas 1280x720 + menu DOM
  src/
    config.js       — konstanta dunia, pesawat, dan misi
    random.js       — RNG berseed (mulberry32)
    terrain.js      — pulau, sungai, landasan, ketinggian, awan
    physics.js      — model terbang: lift, stall, belok, bahan bakar
    missions.js     — tiga misi: ring, lompat pulau, pendaratan
    render.js       — gambar dunia: terrain, awan, ring, pesawat
    hud.js          — instrumen: kompas, pita, horizon, panel mesin
    audio.js        — suara mesin & efek hasil sintesis Web Audio
    input.js        — keyboard + mouse
    shots.js        — adegan deterministik untuk screenshot
    main.js         — loop game + mesin keadaan (menu/terbang/jeda)
```

## Menjalankan

```sh
node serve.ts        # buka http://localhost:8080
```

Untuk hand-in (dipakai grader): `main.ts` di root menyalin `game/` dan
`screenshots/` ke `/output` dan menulis `/output/dossier.json` lewat
`vendor/makefun-game.ts`.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
