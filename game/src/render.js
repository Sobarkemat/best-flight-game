// render.js — semua gambar dunia: langit, terrain berputar mengikuti heading,
// awan parallax, ring, checkpoint, mercusuar, pesawat & bayangannya.
import { WORLD_SIZE, CANVAS_W, CANVAS_H, SKY } from './config.js';
import { RUNWAY, LIGHTHOUSE, LANDING_FAF } from './terrain.js';

const DEG = Math.PI / 180;

// Zoom: makin tinggi, makin luas yang terlihat.
export function viewScale(altitude) {
  const viewHeight = 2400 + altitude * 1.55;
  return CANVAS_H / viewHeight;
}

// Gambar satu frame dunia (tanpa HUD).
export function drawWorld(ctx, game, time) {
  const { plane, mapCanvas, clouds, mission } = game;
  const W = CANVAS_W;
  const H = CANVAS_H;

  // Langit: gradasi mengikuti ketinggian (makin tinggi makin biru gelap di atas).
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  const high = Math.min(1, plane.altitude / 6000);
  sky.addColorStop(0, mixColor(SKY.top, '#1d4a86', high));
  sky.addColorStop(0.55, mixColor(SKY.mid, '#5d9bd1', high));
  sky.addColorStop(1, SKY.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Matahari (di antara kompas dan pita ketinggian).
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(W - 300, 84, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#ffedb0';
  ctx.beginPath();
  ctx.arc(W - 300, 84, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Terrain: putar dunia supaya heading pesawat mengarah ke atas layar.
  const scale = viewScale(plane.altitude);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-plane.heading);
  ctx.scale(scale, scale);
  ctx.translate(-plane.x, -plane.y);
  ctx.drawImage(mapCanvas, 0, 0, WORLD_SIZE, WORLD_SIZE);

  // Bayangan awan di terrain.
  ctx.fillStyle = 'rgba(10, 30, 60, 0.10)';
  for (const c of clouds) {
    const sx = c.x + 420 + Math.sin(time * 0.02 + c.phase) * 60;
    const sy = c.y + 500;
    ctx.beginPath();
    ctx.ellipse(sx, sy, c.r * 0.9, c.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ring misi (lingkaran bercahaya di tanah + tiang penanda ketinggian).
  if (mission && mission.kind === 'ring') {
    for (const ring of mission.rings) {
      drawRing(ctx, ring, mission.nextIndex === ring.index, plane);
    }
  }
  // Checkpoint pulau.
  if (mission && (mission.kind === 'hop' || mission.kind === 'land')) {
    for (const cp of mission.checkpoints) {
      const active = mission.kind === 'hop'
        ? mission.nextIndex === cp.index
        : mission.phase === 'beacon';
      drawCheckpoint(ctx, cp, active, plane);
    }
  }
  // Penanda landasan saat misi landing fase kembali.
  if (mission && mission.kind === 'land' && mission.phase === 'return') {
    if (!mission.fafPassed) drawFafMarker(ctx);
    else drawRunwayMarker(ctx, plane);
  }

  // Bayangan pesawat di tanah (offset & ukuran mengikuti ketinggian).
  drawPlaneShadow(ctx, plane);
  ctx.restore();

  // Awan parallax di atas terrain (semi transparan, bergerak lambat).
  drawClouds(ctx, plane, clouds, time, W, H);

  // Ring target aktif digambar ulang di atas awan supaya selalu terbaca.
  drawActiveRingOverlay(ctx, game);

  // Pesawat di tengah layar (chase view dari belakang/atas).
  drawPlane(ctx, plane, W / 2, H / 2 + 26);

  // Garis kecepatan saat cepat & rendah.
  if (plane.speed > 170 && plane.altitude < 2500) {
    drawSpeedLines(ctx, plane.speed, W, H);
  }
}

function drawActiveRingOverlay(ctx, game) {
  const { plane, mission } = game;
  if (!mission || mission.kind !== 'ring') return;
  const ring = mission.rings[mission.nextIndex];
  if (!ring) return;
  const scale = viewScale(plane.altitude);
  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
  ctx.rotate(-plane.heading);
  ctx.scale(scale, scale);
  ctx.translate(-plane.x, -plane.y);
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 240);
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 64px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${ring.alt} FT`, ring.x, ring.y - ring.radius - 40);
  ctx.font = 'bold 52px Verdana, sans-serif';
  ctx.fillText(`RING ${ring.index + 1}`, ring.x, ring.y + ring.radius + 90);
  ctx.restore();
}

function drawRing(ctx, ring, active, plane) {
  const pulse = active ? 0.75 + 0.25 * Math.sin(performance.now() / 240) : 0.55;
  ctx.save();
  ctx.translate(ring.x, ring.y);
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = active ? '#ffd166' : (ring.passed ? '#7dffb0' : '#9fd4ff');
  ctx.lineWidth = ring.passed ? 14 : 22;
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = active ? 0.20 : 0.08;
  ctx.fillStyle = active ? '#ffd166' : '#9fd4ff';
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
  ctx.fill();
  // Label ketinggian ring.
  ctx.globalAlpha = 1;
  ctx.fillStyle = active ? '#ffd166' : '#eaf4ff';
  ctx.font = 'bold 64px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${ring.alt} FT`, 0, -ring.radius - 40);
  ctx.font = 'bold 52px Verdana, sans-serif';
  ctx.fillText(`RING ${ring.index + 1}`, 0, ring.radius + 90);
  ctx.restore();
}

function drawCheckpoint(ctx, cp, active, plane) {
  ctx.save();
  ctx.translate(cp.x, cp.y);
  const pulse = active ? 0.8 + 0.2 * Math.sin(performance.now() / 260) : 0.45;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = active ? '#ffd166' : '#7dffb0';
  ctx.lineWidth = 20;
  ctx.setLineDash([60, 34]);
  ctx.beginPath();
  ctx.arc(0, 0, cp.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = active ? '#ffd166' : '#eaf4ff';
  ctx.font = 'bold 64px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cp.name.toUpperCase(), 0, -cp.radius - 40);
  ctx.restore();
}

function drawFafMarker(ctx) {
  ctx.save();
  ctx.translate(LANDING_FAF.x, LANDING_FAF.y);
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 240);
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#7dffb0';
  ctx.lineWidth = 22;
  ctx.setLineDash([50, 30]);
  ctx.beginPath();
  ctx.arc(0, 0, 320, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#7dffb0';
  ctx.font = 'bold 56px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FINAL APPROACH 400 FT', 0, -380);
  ctx.restore();
}

function drawRunwayMarker(ctx, plane) {
  ctx.save();
  ctx.translate(RUNWAY.x, RUNWAY.y);
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 240);
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 26;
  ctx.strokeRect(-RUNWAY.length / 2, -RUNWAY.width / 2 - 60, RUNWAY.length, RUNWAY.width + 120);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 64px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LANDASAN — MENDARAT DI SINI', 0, -RUNWAY.width / 2 - 110);
  ctx.restore();
}

function drawPlaneShadow(ctx, plane) {
  const h = Math.max(0, plane.altitude);
  const fade = Math.max(0.05, 0.4 - h / 9000);
  const size = 1 + h / 9000;
  ctx.save();
  ctx.translate(plane.x + h * 0.06, plane.y + h * 0.10);
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#06233f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 95 * size, 26 * size, plane.heading * 0 + 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Pesawat tempur ringan digambar dari atas: badan, sayap, ekor, kanopi.
function drawPlane(ctx, plane, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  // Bank: miringkan gambar sesuai roll.
  ctx.rotate((plane.roll * DEG) * 0.55);
  const bankSquash = 1 - Math.abs(plane.roll) * 0.0012;
  ctx.scale(bankSquash, 1);
  // Bayangan kecil di bawah pesawat (kedalaman).
  ctx.fillStyle = 'rgba(5, 25, 45, 0.35)';
  ctx.beginPath();
  ctx.ellipse(4, 10, 52, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sayap utama (swept).
  ctx.fillStyle = '#c94f38';
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-78, 26);
  ctx.lineTo(-74, 40);
  ctx.lineTo(-4, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(78, 26);
  ctx.lineTo(74, 40);
  ctx.lineTo(4, 22);
  ctx.closePath();
  ctx.fill();
  // Ujung sayap kuning.
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-80, 24, 10, 14);
  ctx.fillRect(70, 24, 10, 14);
  // Ekor horizontal.
  ctx.fillStyle = '#a83d2a';
  ctx.beginPath();
  ctx.moveTo(-4, 34);
  ctx.lineTo(-34, 56);
  ctx.lineTo(-30, 64);
  ctx.lineTo(0, 46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 34);
  ctx.lineTo(34, 56);
  ctx.lineTo(30, 64);
  ctx.lineTo(0, 46);
  ctx.closePath();
  ctx.fill();
  // Badan pesawat.
  const body = ctx.createLinearGradient(-10, 0, 10, 0);
  body.addColorStop(0, '#e8eef2');
  body.addColorStop(0.5, '#ffffff');
  body.addColorStop(1, '#c7d2da');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.quadraticCurveTo(11, -30, 10, 6);
  ctx.quadraticCurveTo(9, 38, 0, 52);
  ctx.quadraticCurveTo(-9, 38, -10, 6);
  ctx.quadraticCurveTo(-11, -30, 0, -52);
  ctx.fill();
  // Kanopi.
  ctx.fillStyle = '#2f7fc4';
  ctx.beginPath();
  ctx.ellipse(0, -26, 6.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-2, -30, 2.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sirip ekor.
  ctx.fillStyle = '#c94f38';
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(-7, 52);
  ctx.lineTo(7, 52);
  ctx.closePath();
  ctx.fill();
  // Lampu navigasi.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-80, 31, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.beginPath();
  ctx.arc(80, 31, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClouds(ctx, plane, clouds, time, W, H) {
  const scale = viewScale(plane.altitude);
  ctx.save();
  for (const c of clouds) {
    // Parallax: awan bergeser lebih lambat dari terrain.
    const px = plane.x + (c.x - plane.x) * 0.92 + Math.sin(time * 0.02 + c.phase) * c.drift * 10;
    const py = plane.y + (c.y - plane.y) * 0.92;
    const dx = (px - plane.x) * scale;
    const dy = (py - plane.y) * scale;
    const sx = W / 2 + dx;
    const sy = H / 2 + dy;
    const r = c.r * scale;
    if (sx < -r * 2 || sx > W + r * 2 || sy < -r * 2 || sy > H + r * 2) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    for (let i = 0; i < c.puffs; i++) {
      const a = (i / c.puffs) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        sx + Math.cos(a) * r * 0.55,
        sy + Math.sin(a) * r * 0.3,
        r * (0.55 + (i % 2) * 0.18), r * 0.42, 0, 0, Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSpeedLines(ctx, speed, W, H) {
  const n = Math.min(14, Math.floor((speed - 160) / 8));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const x = ((i * 173 + 61) % W);
    const y = ((i * 251 + 37) % H);
    const len = 30 + (speed - 160) * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function mixColor(a, b, t) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Panah tepi layar menuju target (bila target di luar pandangan).
export function drawOffscreenArrow(ctx, plane, target, W, H) {
  if (!target) return;
  const dx = target.x - plane.x;
  const dy = target.y - plane.y;
  const dist = Math.hypot(dx, dy);
  const scale = viewScale(plane.altitude);
  const sx = W / 2 + (dx * Math.cos(-plane.heading) - dy * Math.sin(-plane.heading)) * scale;
  const sy = H / 2 + (dx * Math.sin(-plane.heading) + dy * Math.cos(-plane.heading)) * scale;
  if (sx > 60 && sx < W - 60 && sy > 60 && sy < H - 60) return;
  const cx = Math.max(50, Math.min(W - 50, sx));
  const cy = Math.max(50, Math.min(H - 50, sy));
  const ang = Math.atan2(sy - H / 2, sx - W / 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -13);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 15px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)} ft`, cx, cy + 30);
}
