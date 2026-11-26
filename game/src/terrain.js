// terrain.js — kepulauan prosedural: pulau, sungai, landasan, ketinggian, awan.
// Dunia memakai koordinat kaki (0..WORLD_SIZE). Peta pra-render digambar sekali
// ke canvas offscreen lalu dipakai render.js sebagai latar.
import { WORLD_SIZE, MAP_PIXELS } from './config.js';
import { mulberry32, range } from './random.js';

const ISLAND_NAMES = ['Pulau Besar', 'Pulau Karang', 'Pulau Hijau', 'Pulau Pasir', 'Pulau Angin', 'Pulau Ombak', 'Pulau Senja'];

// Landasan di sisi selatan Pulau Besar, membujur timur-barat.
export const RUNWAY = {
  x: 6000, y: 7450, length: 1500, width: 130, headingDeg: 90, elevation: 40,
  name: 'Landasan Nusantara (RWY 09/27)',
};

// Mercusuar di ujung barat Pulau Besar, di tepi laut — titik balik misi
// pendaratan; putaran kembali terjadi di atas laut, bukan di atas bukit.
export const LIGHTHOUSE = { x: 3000, y: 6100 };

// Titik final-approach (FAF) 1900 ft di barat landasan — pola pendaratan
// yang benar: sejajar landasan di atas koridor datar, baru turun ke landasan.
export const LANDING_FAF = { x: RUNWAY.x - 1900, y: RUNWAY.y, alt: 400, name: 'Final Approach' };

// Bangun daftar pulau dari seed. Pulau pertama selalu Pulau Besar di tengah.
export function buildIslands(seed) {
  const rng = mulberry32(seed);
  const islands = [
    { name: ISLAND_NAMES[0], cx: 6000, cy: 6000, rx: 2650, ry: 1950, peak: 780, trees: 26 },
    { name: ISLAND_NAMES[1], cx: 2350, cy: 2450, rx: 1150, ry: 850, peak: 520, trees: 12 },
    { name: ISLAND_NAMES[2], cx: 9500, cy: 2900, rx: 1350, ry: 1000, peak: 640, trees: 14 },
    { name: ISLAND_NAMES[3], cx: 9300, cy: 8800, rx: 1050, ry: 800, peak: 430, trees: 10 },
    { name: ISLAND_NAMES[4], cx: 2600, cy: 9300, rx: 900, ry: 700, peak: 380, trees: 9 },
    { name: ISLAND_NAMES[5], cx: 5900, cy: 1300, rx: 700, ry: 520, peak: 300, trees: 7 },
    { name: ISLAND_NAMES[6], cx: 10800, cy: 5900, rx: 620, ry: 480, peak: 260, trees: 6 },
  ];
  // Rumpun pohon & bukit kecil tiap pulau (dipakai gambar & ketinggian halus).
  for (const isl of islands) {
    isl.blobs = [];
    for (let i = 0; i < isl.trees; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * 0.72;
      isl.blobs.push({
        x: isl.cx + Math.cos(a) * d * isl.rx,
        y: isl.cy + Math.sin(a) * d * isl.ry,
        r: range(rng, 130, 330),
        shade: range(rng, 0.75, 1),
      });
    }
  }
  return islands;
}

// Ketinggian terrain (kaki) di satu titik. Laut = 0.
export function makeHeightAt(islands) {
  return function heightAt(x, y) {
    let h = 0;
    for (const isl of islands) {
      const dx = (x - isl.cx) / isl.rx;
      const dy = (y - isl.cy) / isl.ry;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1.6) {
        const fall = Math.exp(-d2 * 1.9);
        h += isl.peak * fall;
      }
    }
    // Area landasan diratakan ke elevasinya, termasuk koridor lepas landas
    // di kedua ujung landasan supaya climb-out awal aman dari bukit.
    const rdx = x - RUNWAY.x;
    const rdy = y - RUNWAY.y;
    const along = Math.abs(rdx);
    const across = Math.abs(rdy);
    if (along < RUNWAY.length / 2 + 900 && across < RUNWAY.width / 2 + 420) {
      const edge = Math.max(0, (along - RUNWAY.length / 2) / 900);
      const edge2 = Math.max(0, (across - RUNWAY.width / 2) / 420);
      const flat = 1 - Math.max(edge, edge2);
      h = h * (1 - flat) + RUNWAY.elevation * flat;
    }
    return h;
  };
}

// Sungai di Pulau Besar: garis berkelok dari tengah pulau ke pantai selatan.
export function buildRiver(seed) {
  const rng = mulberry32(seed + 77);
  const pts = [];
  let x = 6000 + range(rng, -300, 300);
  let y = 5600;
  pts.push([x, y]);
  while (y < 7900) {
    y += range(rng, 220, 420);
    x += range(rng, -260, 260);
    x = Math.max(4300, Math.min(7700, x));
    pts.push([x, y]);
  }
  return pts;
}

// Gambar seluruh peta ke canvas offscreen (sekali saat load).
export function renderMapCanvas(islands, river) {
  const c = document.createElement('canvas');
  c.width = MAP_PIXELS;
  c.height = MAP_PIXELS;
  const g = c.getContext('2d');
  const s = MAP_PIXELS / WORLD_SIZE; // px per kaki
  const X = (wx) => wx * s;
  const Y = (wy) => wy * s;

  // Laut: gradasi biru dalam ke biru dangkal.
  const sea = g.createLinearGradient(0, 0, MAP_PIXELS, MAP_PIXELS);
  sea.addColorStop(0, '#0d4d8a');
  sea.addColorStop(0.5, '#1468a8');
  sea.addColorStop(1, '#0a3f74');
  g.fillStyle = sea;
  g.fillRect(0, 0, MAP_PIXELS, MAP_PIXELS);

  // Kilau ombak acak di laut.
  const rng = mulberry32(4242);
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 2;
  for (let i = 0; i < 260; i++) {
    const x = rng() * MAP_PIXELS;
    const y = rng() * MAP_PIXELS;
    const r = 8 + rng() * 26;
    g.beginPath();
    g.arc(x, y, r, rng() * 6.28, rng() * 6.28 + 1.1 + rng());
    g.stroke();
  }

  // Tiap pulau: pasir, rumput, hutan, dan bayangan bukit.
  for (const isl of islands) {
    // Pantai pasir.
    g.fillStyle = '#e8d9a0';
    g.beginPath();
    g.ellipse(X(isl.cx), Y(isl.cy), isl.rx * s * 1.06, isl.ry * s * 1.06, 0, 0, Math.PI * 2);
    g.fill();
    // Daratan hijau dengan gradasi ke puncak.
    const grad = g.createRadialGradient(
      X(isl.cx), Y(isl.cy), 10,
      X(isl.cx), Y(isl.cy), Math.max(isl.rx, isl.ry) * s,
    );
    grad.addColorStop(0, '#5da24a');
    grad.addColorStop(0.55, '#79b657');
    grad.addColorStop(1, '#3f8a44');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(X(isl.cx), Y(isl.cy), isl.rx * s, isl.ry * s, 0, 0, Math.PI * 2);
    g.fill();
    // Rumpun hutan.
    for (const b of isl.blobs) {
      g.fillStyle = b.shade > 0.9 ? 'rgba(28, 96, 44, 0.85)' : 'rgba(46, 122, 54, 0.8)';
      g.beginPath();
      g.arc(X(b.x), Y(b.y), b.r * s, 0, Math.PI * 2);
      g.fill();
    }
    // Puncak bukit.
    g.fillStyle = 'rgba(190, 220, 170, 0.5)';
    g.beginPath();
    g.ellipse(X(isl.cx), Y(isl.cy), isl.rx * s * 0.22, isl.ry * s * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    // Nama pulau.
    g.fillStyle = 'rgba(10, 40, 20, 0.75)';
    g.font = `bold ${Math.max(20, isl.rx * s * 0.09)}px Verdana, sans-serif`;
    g.textAlign = 'center';
    g.fillText(isl.name, X(isl.cx), Y(isl.cy - isl.ry * 0.55));
  }

  // Sungai Pulau Besar.
  g.strokeStyle = '#3f8fd2';
  g.lineWidth = 26 * s;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  river.forEach(([x, y], i) => (i === 0 ? g.moveTo(X(x), Y(y)) : g.lineTo(X(x), Y(y))));
  g.stroke();
  g.strokeStyle = '#7cc0ee';
  g.lineWidth = 14 * s;
  g.beginPath();
  river.forEach(([x, y], i) => (i === 0 ? g.moveTo(X(x), Y(y)) : g.lineTo(X(x), Y(y))));
  g.stroke();

  drawRunwayOnMap(g, s, X, Y);
  drawLighthouseOnMap(g, s, X, Y);
  return c;
}

function drawRunwayOnMap(g, s, X, Y) {
  const r = RUNWAY;
  g.save();
  g.translate(X(r.x), Y(r.y));
  // Apron & landasan.
  g.fillStyle = '#5a5f66';
  g.fillRect(-r.length / 2 * s - 14, -r.width / 2 * s - 14, r.length * s + 28, r.width * s + 28);
  g.fillStyle = '#33373c';
  g.fillRect(-r.length / 2 * s, -r.width / 2 * s, r.length * s, r.width * s);
  // Garis tengah putus-putus.
  g.fillStyle = '#f5f5f0';
  const dash = 90 * s;
  for (let x = -r.length / 2 * s + 30; x < r.length / 2 * s - 30; x += dash * 2) {
    g.fillRect(x, -3, dash, 6);
  }
  // Angka landasan 09 / 27.
  g.fillStyle = '#f5f5f0';
  g.font = `bold ${Math.round(34 * s)}px Verdana, sans-serif`;
  g.textAlign = 'center';
  g.fillText('09', -r.length / 2 * s + 130, 12);
  g.fillText('27', r.length / 2 * s - 130, 12);
  g.restore();
  // Label landasan.
  g.fillStyle = 'rgba(10, 40, 20, 0.8)';
  g.font = `bold ${Math.round(30 * s)}px Verdana, sans-serif`;
  g.textAlign = 'center';
  g.fillText('LANDASAN NUSANTARA', X(r.x), Y(r.y + r.width / 2 + 260));
}

function drawLighthouseOnMap(g, s, X, Y) {
  const lx = X(LIGHTHOUSE.x);
  const ly = Y(LIGHTHOUSE.y);
  g.fillStyle = '#dfe6ea';
  g.beginPath();
  g.arc(lx, ly, 26 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.arc(lx, ly, 16 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255, 240, 150, 0.9)';
  g.beginPath();
  g.arc(lx, ly, 7 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(10, 40, 20, 0.8)';
  g.font = `bold ${Math.round(28 * s)}px Verdana, sans-serif`;
  g.textAlign = 'center';
  g.fillText('MERCUSUAR', lx, ly - 46 * s);
}

// Awan: posisi dunia + ukuran, digambar dengan parallax ringan.
export function buildClouds(seed) {
  const rng = mulberry32(seed + 913);
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: rng() * WORLD_SIZE,
      y: rng() * WORLD_SIZE,
      r: range(rng, 260, 620),
      puffs: Math.floor(range(rng, 3, 6)),
      drift: range(rng, 4, 12),
      phase: rng() * Math.PI * 2,
    });
  }
  return clouds;
}
