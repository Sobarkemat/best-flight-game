// config.js — semua konstanta permainan Langit Nusantara: dunia, pesawat, misi.
export const WORLD_SIZE = 12000; // dunia 12000 x 12000 kaki
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const MAP_PIXELS = 2400; // peta terrain pra-render (px) untuk WORLD_SIZE

// Model terbang (satuan: knot, kaki, detik)
export const PLANE = {
  maxSpeed: 285, // knot pada throttle penuh, sayap bersih
  maxSpeedFlaps: 190, // knot dengan flap terbuka
  stallSpeed: 68, // knot, sayap bersih
  stallSpeedFlaps: 50, // knot, flap terbuka
  climbPitchMax: 24, // derajat
  divePitchMax: 20, // derajat
  maxBank: 62, // derajat
  rollRate: 70, // derajat/detik
  pitchRate: 26, // derajat/detik
  throttleRate: 45, // %/detik
  fuelCapacity: 100,
  fuelBurnFull: 0.34, // unit/detik pada throttle 100%
  thrustFull: 7.2, // knot/detik pada throttle 100%
  dragClean: 0.0147,
  dragSpeed: 0.000042, // tambahan drag per knot
  dragFlaps: 0.015,
  dragBrake: 0.06,
  pitchEffect: 1.2, // pengaruh pitch pada percepatan (naik = melambat)
};

export const MISSIONS = {
  ring: {
    id: 'ring',
    title: 'Ring Run',
    subtitle: 'Lomba Ring',
    brief: 'Terbang melewati 8 ring di langit kepulauan. Ring berikutnya bercahaya kuning — terbang tepat di tengahnya.',
    ringCount: 8,
    ringRadius: 260,
    ringAltBand: 220,
    ringScore: 100,
    timeLimit: 480,
  },
  hop: {
    id: 'hop',
    title: 'Island Hop',
    subtitle: 'Lompat Pulau',
    brief: 'Kunjungi 4 pulau berturut-turut mengikuti panah kompas. Hemat bahan bakar: tangki kosong berarti melayang.',
    checkpointCount: 4,
    checkpointRadius: 320,
    checkpointScore: 150,
    timeLimit: 420,
  },
  land: {
    id: 'land',
    title: 'Runway Landing',
    subtitle: 'Mendarat Mulus',
    brief: 'Lepas landas dari landasan, putari mercusuar di ujung barat, lalu mendarat kembali. Makin halus sentuhannya, makin besar bonus.',
    timeLimit: 420,
  },
};

// Warna langit & laut mengikuti ketinggian (dipakai render.js)
export const SKY = {
  top: '#2f6fb8',
  mid: '#7fb6e4',
  low: '#cfe8f7',
  horizon: '#e8f3fb',
};
