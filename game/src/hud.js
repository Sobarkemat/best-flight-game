// hud.js — HUD & instrumen "menyala": pita kecepatan, pita ketinggian,
// kompas, horizon buatan, throttle, bahan bakar, kerusakan, skor, objektif.
import { CANVAS_W, CANVAS_H } from './config.js';
import { objectiveText, currentTarget } from './missions.js';
import { bearingTo } from './physics.js';

const DEG = Math.PI / 180;

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(6, 22, 40, ${alpha || 0.72})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Gambar seluruh HUD di atas dunia.
export function drawHud(ctx, game) {
  const { plane, mission } = game;
  const W = CANVAS_W;
  const H = CANVAS_H;
  drawCompass(ctx, plane.heading / DEG, W);
  drawAirspeedTape(ctx, plane.speed, plane.flaps);
  drawAltitudeTape(ctx, plane.altitude);
  drawArtificialHorizon(ctx, plane.pitch, plane.roll);
  drawEnginePanel(ctx, plane);
  drawMissionPanel(ctx, mission, plane);
  drawTargetArrow(ctx, plane, mission);
  if (plane.fuel <= 0) drawWarning(ctx, 'BAHAN BAKAR HABIS — MELAYANG!', W, 150);
  else if (plane.speed < (plane.flaps ? 50 : 68) && !plane.onGround && plane.altitude > 120) {
    drawWarning(ctx, 'STALL! TURUNKAN HIDUNG & TAMBAH THROTTLE', W, 150);
  }
}

function drawCompass(ctx, headingDeg, W) {
  const w = 420;
  const h = 34;
  const x0 = (W - w) / 2;
  const y0 = 12;
  panel(ctx, x0, y0, w, h, 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.fillStyle = '#cfeaff';
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const hd = Math.round(((headingDeg + d) % 360 + 360) % 360);
    const sx = x0 + w / 2 + d * 3.2;
    const major = hd % 30 === 0;
    ctx.strokeStyle = major ? '#ffd166' : 'rgba(207, 234, 255, 0.6)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, y0 + h - 6);
    ctx.lineTo(sx, y0 + h - (major ? 16 : 10));
    ctx.stroke();
    if (major) {
      const label = hd === 0 ? 'N' : hd === 90 ? 'E' : hd === 180 ? 'S' : hd === 270 ? 'W' : String(hd).padStart(3, '0');
      ctx.fillText(label, sx, y0 + 15);
    }
  }
  ctx.restore();
  // Penanda heading tengah.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 7, y0);
  ctx.lineTo(W / 2 + 7, y0);
  ctx.lineTo(W / 2, y0 + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(3, '0')}°`, W / 2, y0 + h + 15);
}

// Pita kecepatan (kiri atas).
function drawAirspeedTape(ctx, speed, flaps) {
  const x = 14;
  const y = 56;
  const w = 112;
  const h = 190;
  panel(ctx, x, y, w, h, 0.72);
  ctx.fillStyle = '#9fd4ff';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KECEPATAN (KT)', x + 8, y + 15);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, y + 22, w - 8, h - 30);
  ctx.clip();
  ctx.font = '12px Verdana, sans-serif';
  const center = y + 22 + (h - 30) / 2;
  for (let s = 0; s <= 300; s += 10) {
    const sy = center - (s - speed) * 1.1;
    if (sy < y + 20 || sy > y + h - 6) continue;
    const major = s % 50 === 0;
    ctx.strokeStyle = major ? '#ffd166' : 'rgba(207,234,255,0.55)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 32, sy);
    ctx.lineTo(x + (major ? 48 : 42), sy);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#eaf4ff';
      ctx.fillText(String(s), x + 8, sy + 4);
    }
  }
  ctx.restore();
  // Nilai sekarang.
  ctx.fillStyle = '#0a1626';
  ctx.fillRect(x + 52, center - 13, w - 58, 26);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 52, center - 13, w - 58, 26);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 15px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(Math.round(speed)), x + 57, center + 5);
  if (flaps) {
    ctx.fillStyle = '#7dffb0';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.fillText('FLAP', x + 8, y + h - 8);
  }
}

// Pita ketinggian (kanan atas).
function drawAltitudeTape(ctx, altitude) {
  const W = CANVAS_W;
  const w = 112;
  const x = W - w - 14;
  const y = 56;
  const h = 190;
  panel(ctx, x, y, w, h, 0.72);
  ctx.fillStyle = '#9fd4ff';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KETINGGIAN (FT)', x + 8, y + 15);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, y + 22, w - 8, h - 30);
  ctx.clip();
  ctx.font = '12px Verdana, sans-serif';
  const center = y + 22 + (h - 30) / 2;
  for (let a = 0; a <= 6000; a += 100) {
    const sy = center - (a - altitude) * 0.055;
    if (sy < y + 20 || sy > y + h - 6) continue;
    const major = a % 500 === 0;
    ctx.strokeStyle = major ? '#ffd166' : 'rgba(207,234,255,0.55)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + w - 32, sy);
    ctx.lineTo(x + w - (major ? 48 : 42), sy);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#eaf4ff';
      ctx.textAlign = 'right';
      ctx.fillText(String(a), x + w - 52, sy + 4);
      ctx.textAlign = 'left';
    }
  }
  ctx.restore();
  ctx.fillStyle = '#0a1626';
  ctx.fillRect(x + 6, center - 13, w - 58, 26);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 6, center - 13, w - 58, 26);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 15px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(Math.round(altitude)), x + 11, center + 5);
}

// Horizon buatan (bawah tengah).
function drawArtificialHorizon(ctx, pitch, roll) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H - 92;
  const r = 62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-roll * DEG);
  const shift = pitch * 2.2;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r - 4, -r - 4 - shift, r * 2 + 8, r + 4 + shift);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-r - 4, -shift, r * 2 + 8, r + 4 + shift);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -shift);
  ctx.lineTo(r, -shift);
  ctx.stroke();
  ctx.rotate(roll * DEG);
  // Sayap tetap (simbol pesawat).
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r + 8, 0);
  ctx.lineTo(-10, 0);
  ctx.moveTo(10, 0);
  ctx.lineTo(r - 8, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9fd4ff';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HORIZON', cx, cy + r + 14);
  ctx.fillText(`PITCH ${pitch >= 0 ? '+' : ''}${Math.round(pitch)}°`, cx, cy - r - 6);
}

// Panel mesin kiri bawah: throttle, bahan bakar, kerusakan.
function drawEnginePanel(ctx, plane) {
  const x = 14;
  const y = CANVAS_H - 150;
  const w = 210;
  const h = 136;
  panel(ctx, x, y, w, h, 0.72);
  ctx.textAlign = 'left';
  drawBar(ctx, x + 12, y + 26, w - 24, 14, plane.throttle / 100, '#ffd166', `THROTTLE ${Math.round(plane.throttle)}%`);
  drawBar(ctx, x + 12, y + 62, w - 24, 14, plane.fuel / 100, plane.fuel < 25 ? '#ff6b5e' : '#7dffb0', `FUEL ${Math.round(plane.fuel)}%`);
  drawBar(ctx, x + 12, y + 98, w - 24, 14, plane.damage / 100, '#ff9d5c', `DAMAGE ${Math.round(plane.damage)}%`);
  if (plane.engineOut) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.fillText('MESIN MATI', x + 12, y + h - 8);
  }
}

function drawBar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  ctx.strokeStyle = 'rgba(207,234,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#eaf4ff';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.fillText(label, x, y - 6);
}

// Panel misi kanan bawah: skor, waktu, objektif, target.
function drawMissionPanel(ctx, mission, plane) {
  if (!mission) return;
  const W = CANVAS_W;
  const w = 300;
  const h = 118;
  const x = W - w - 14;
  const y = CANVAS_H - 132;
  panel(ctx, x, y, w, h, 0.72);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.fillText(`${mission.title.toUpperCase()} — ${mission.subtitle.toUpperCase()}`, x + 12, y + 20);
  ctx.fillStyle = '#eaf4ff';
  ctx.font = '13px Verdana, sans-serif';
  ctx.fillText(objectiveText(mission), x + 12, y + 42);
  const mm = Math.floor(Math.max(0, mission.timeLeft) / 60);
  const ss = Math.floor(Math.max(0, mission.timeLeft) % 60);
  ctx.fillStyle = mission.timeLeft < 60 ? '#ff6b5e' : '#9fd4ff';
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.fillText(`WAKTU ${mm}:${String(ss).padStart(2, '0')}`, x + 12, y + 64);
  ctx.fillStyle = '#7dffb0';
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.fillText(`SKOR ${mission.score}`, x + 12, y + 90);
  const t = currentTarget(mission);
  if (t) {
    const { dist, bearing } = bearingTo(plane, t.x, t.y);
    ctx.fillStyle = '#cfeaff';
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillText(`TARGET ${Math.round(dist)} ft · ${Math.round(bearing)}°`, x + 12, y + 110);
  }
}

// Panah kecil di tengah bawah menuju target + jarak.
function drawTargetArrow(ctx, plane, mission) {
  const t = currentTarget(mission);
  if (!t) return;
  const { dist, bearing } = bearingTo(plane, t.x, t.y);
  const heading = plane.heading / DEG;
  let rel = ((bearing - heading) % 360 + 540) % 360 - 180; // -180..180
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H - 238;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rel * DEG);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(11, 10);
  ctx.lineTo(0, 4);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 12px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${t.name || 'TARGET'} · ${Math.round(dist)} ft`, cx, cy + 32);
}

function drawWarning(ctx, text, W, y) {
  const blink = Math.floor(performance.now() / 350) % 2 === 0;
  if (!blink) return;
  ctx.save();
  ctx.font = 'bold 20px Verdana, sans-serif';
  const w = ctx.measureText(text).width + 36;
  panel(ctx, (W - w) / 2, y, w, 38, 0.85);
  ctx.fillStyle = '#ff6b5e';
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y + 26);
  ctx.restore();
}
