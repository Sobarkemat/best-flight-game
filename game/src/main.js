// main.js — loop game & mesin keadaan: menu, terbang, jeda, selesai.
// Menghubungkan physics, missions, render, hud, audio, input, dan shots.
import { CANVAS_W, CANVAS_H } from './config.js';
import { buildIslands, buildRiver, buildClouds, renderMapCanvas, makeHeightAt, RUNWAY } from './terrain.js';
import { createPlane, updatePlane } from './physics.js';
import { createMission, updateMission, currentTarget } from './missions.js';
import { drawWorld, drawOffscreenArrow } from './render.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { buildShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const menuEl = document.getElementById('menu');
const endEl = document.getElementById('endcard');
const endTitle = document.getElementById('endTitle');
const endText = document.getElementById('endText');
const endScore = document.getElementById('endScore');
const toastEl = document.getElementById('toast');
const btnSound = document.getElementById('btnSound');
const btnPause = document.getElementById('btnPause');
const btnMenu = document.getElementById('btnMenu');

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotKind = params.get('shot');

const islands = buildIslands(seed);
const river = buildRiver(seed);
const clouds = buildClouds(seed);
const mapCanvas = renderMapCanvas(islands, river);
const heightAt = makeHeightAt(islands);
const audio = createAudio();
const input = createInput();

const game = {
  plane: null,
  mission: null,
  mapCanvas,
  clouds,
  state: 'menu', // menu | fly | paused | done
  time: 0,
  toast: '',
  toastUntil: 0,
  stallBeepAt: 0,
  shot: null,
};

function newFlight(kind) {
  // Lepas landas menghadap barat (270°) — mercusuar & ring pertama di depan,
  // bukit tengah pulau tidak menghalangi putaran awal.
  const plane = createPlane(RUNWAY.x, RUNWAY.y, 270, RUNWAY.elevation + 2);
  plane.throttle = 0;
  const mission = createMission(kind, seed, islands);
  game.plane = plane;
  game.mission = mission;
  game.state = 'fly';
  game.time = 0;
  menuEl.style.display = 'none';
  endEl.style.display = 'none';
  showToast(`${mission.title} — ${mission.brief}`, 5200);
  audio.ensure();
}

function showToast(text, ms) {
  game.toast = text;
  game.toastUntil = performance.now() + (ms || 2600);
  toastEl.textContent = text;
  toastEl.style.display = 'block';
}

function endFlight(won, reason) {
  game.state = 'done';
  const m = game.mission;
  endTitle.textContent = won ? 'MISI SELESAI!' : 'MISI GAGAL';
  endTitle.style.color = won ? '#7dffb0' : '#ff6b5e';
  endText.textContent = won
    ? `${reason || 'Semua objektif tercapai.'} Kerusakan ${Math.round(game.plane.damage)}%, bahan bakar tersisa ${Math.round(game.plane.fuel)}%.`
    : (reason || m.failReason || 'Misi tidak selesai.');
  endScore.textContent = `SKOR AKHIR: ${m.score}`;
  endEl.style.display = 'block';
  if (won) audio.success();
}

function toMenu() {
  game.state = 'menu';
  game.mission = null;
  game.plane = createPlane(RUNWAY.x, RUNWAY.y, 90, 900);
  game.plane.throttle = 55;
  game.plane.speed = 150;
  game.plane.onGround = false;
  game.plane.altitude = 1500;
  menuEl.style.display = 'block';
  endEl.style.display = 'none';
}

// Menu: pilih misi (klik mouse).
document.querySelectorAll('#menu .mission').forEach((btn) => {
  btn.addEventListener('click', () => newFlight(btn.dataset.mission));
});
document.getElementById('btnAgain').addEventListener('click', () => {
  if (game.mission) newFlight(game.mission.kind);
});
document.getElementById('btnEndMenu').addEventListener('click', toMenu);
btnMenu.addEventListener('click', toMenu);
btnPause.addEventListener('click', () => {
  if (game.state === 'fly') {
    game.state = 'paused';
    showToast('Jeda — tekan P untuk lanjut', 2000);
  } else if (game.state === 'paused') {
    game.state = 'fly';
  }
});
btnSound.addEventListener('click', () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  btnSound.textContent = audio.muted ? 'Suara: Mati' : 'Suara: Nyala';
});

// Mode screenshot: bekukan adegan, tanpa menu, tanpa suara.
if (shotKind) {
  const scene = buildShotScene(shotKind, seed, islands);
  if (scene) {
    game.shot = shotKind;
    game.plane = scene.plane;
    game.mission = scene.mission;
    game.state = 'shot';
    menuEl.style.display = 'none';
    document.getElementById('hint').style.display = 'none';
    document.getElementById('topbar').style.display = 'none';
  } else {
    toMenu();
  }
} else {
  toMenu();
}

let last = performance.now();
let stallWarnAt = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;

  // Toggle jeda & suara (edge-trigger).
  if (input.pausePressed && game.state === 'fly') game.state = 'paused';
  else if (input.pausePressed && game.state === 'paused') game.state = 'fly';
  if (input.mutePressed) {
    audio.ensure();
    audio.setMuted(!audio.muted);
    btnSound.textContent = audio.muted ? 'Suara: Mati' : 'Suara: Nyala';
  }

  if (game.state === 'fly') {
    game.time += dt;
    const flight = input.readFlight();
    const physEvents = updatePlane(game.plane, flight, dt, heightAt);
    const missionEvents = updateMission(game.mission, game.plane, dt, physEvents);
    handleEvents(physEvents.concat(missionEvents));
    audio.updateEngine(game.plane.throttle, game.plane.speed, !game.plane.onGround);
    if (game.mission.done) endFlight(true, 'Semua objektif tercapai!');
    else if (game.mission.failed) endFlight(false, game.mission.failReason);
  } else if (game.state === 'menu') {
    // Attract mode: pesawat autopilot mengitari Pulau Besar.
    game.time += dt;
    const p = game.plane;
    p.heading += (9.81 * Math.tan((22 * Math.PI) / 180)) / (150 * 0.514444) * dt;
    p.roll = 22;
    p.speed = 150;
    p.altitude = 1500 + Math.sin(game.time * 0.2) * 60;
    p.x += Math.sin(p.heading) * 150 * 1.6878 * dt;
    p.y -= Math.cos(p.heading) * 150 * 1.6878 * dt;
    const dx = p.x - 6000;
    const dy = p.y - 6000;
    if (Math.hypot(dx, dy) > 3200) {
      p.heading = Math.atan2(6000 - p.x, -(6000 - p.y));
    }
  }
  // Mode 'shot' & 'paused' & 'done': tidak ada simulasi, render keadaan beku.

  // Gambar.
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawWorld(ctx, game, game.time);
  if (game.state === 'fly' || game.state === 'paused' || game.state === 'shot' || game.state === 'done') {
    drawOffscreenArrow(ctx, game.plane, currentTarget(game.mission), CANVAS_W, CANVAS_H);
    drawHud(ctx, game);
  }
  if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(6, 20, 38, 0.45)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 44px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JEDA', CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = '#eaf4ff';
    ctx.font = '18px Verdana, sans-serif';
    ctx.fillText('Tekan P atau tombol Jeda untuk melanjutkan', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }
  if (game.toast && now < game.toastUntil) {
    toastEl.style.display = 'block';
  } else if (game.toast) {
    toastEl.style.display = 'none';
    game.toast = '';
  }

  input.consumeEdges();
  requestAnimationFrame(frame);
}

function handleEvents(events) {
  for (const e of events) {
    if (e === 'ring-pass') {
      showToast(`RING! +100 — ${game.mission.nextIndex}/8 ring`, 2200);
      audio.ringPass();
    } else if (e === 'checkpoint') {
      showToast('CHECKPOINT! +150', 2200);
      audio.checkpoint();
    } else if (e === 'takeoff') {
      showToast('Lepas landas! Menuju Mercusuar.', 2600);
      audio.checkpoint();
    } else if (e === 'faf') {
      showToast('Final Approach — sejajar landasan, turun pelan.', 2600);
      audio.checkpoint();
    } else if (e === 'touchdown-soft') {
      showToast('Pendaratan mulus!', 2600);
      audio.success();
    } else if (e === 'touchdown-ok') {
      showToast('Mendarat. Agak keras — hati-hati.', 2600);
      audio.thud();
    } else if (e === 'touchdown-hard') {
      showToast('Pendaratan KERAS! -25 & kerusakan', 2600);
      audio.thud();
    } else if (e === 'touchdown-fast') {
      showToast('Terlalu cepat mendarat! -50', 2600);
      audio.thud();
    } else if (e === 'terrain-hit') {
      showToast('MENABRAK TERRAIN! -50 & kerusakan berat', 2600);
      audio.thud();
    } else if (e === 'stall') {
      const now = performance.now();
      if (now - stallWarnAt > 900) {
        stallWarnAt = now;
        audio.stallWarn();
      }
    } else if (e === 'fuel-empty') {
      showToast('BAHAN BAKAR HABIS — melayang, cari landasan!', 4000);
    } else if (e === 'time-up') {
      showToast('Waktu habis!', 2600);
    } else if (e === 'mission-done') {
      audio.success();
    }
  }
}

requestAnimationFrame(frame);
