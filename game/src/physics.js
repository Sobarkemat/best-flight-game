// physics.js — model terbang arcade yang nyata: throttle, lift, stall,
// belok dari bank, bahan bakar, kerusakan, dan pendaratan.
import { PLANE } from './config.js';
import { RUNWAY } from './terrain.js';

const DEG = Math.PI / 180;
const KNOT_TO_FTPS = 1.6878;

export function createPlane(x, y, headingDeg, altitudeFt) {
  return {
    x, y,
    heading: headingDeg * DEG, // radian, 0 = utara (-y)
    altitude: altitudeFt,
    speed: 0, // knot
    verticalSpeed: 0, // kaki/detik
    pitch: 0, // derajat, + = naik
    roll: 0, // derajat, + = bank kanan
    throttle: 0, // 0..100
    fuel: PLANE.fuelCapacity,
    damage: 0,
    flaps: false,
    airbrake: false,
    onGround: true,
    engineOut: false,
    crashed: false,
    landed: false,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Satu langkah simulasi. input: {pitchUp, pitchDown, rollLeft, rollRight,
// throttleUp, throttleDown, flapsToggle, airbrake}. heightAt: fungsi terrain.
// Mengembalikan daftar event: 'stall', 'touchdown', 'terrain-hit', 'fuel-empty'.
export function updatePlane(p, input, dt, heightAt) {
  const events = [];
  if (p.crashed) return events;

  // Throttle.
  if (input.throttleUp) p.throttle += PLANE.throttleRate * dt;
  if (input.throttleDown) p.throttle -= PLANE.throttleRate * dt;
  p.throttle = clamp(p.throttle, 0, 100);
  if (input.flapsToggle) p.flaps = !p.flaps;
  p.airbrake = !!input.airbrake;

  // Bahan bakar.
  const burn = (p.throttle / 100) * PLANE.fuelBurnFull * dt;
  p.fuel = Math.max(0, p.fuel - burn);
  if (p.fuel <= 0 && !p.engineOut) {
    p.engineOut = true;
    events.push('fuel-empty');
  }

  const stall = p.flaps ? PLANE.stallSpeedFlaps : PLANE.stallSpeed;
  const topSpeed = p.flaps ? PLANE.maxSpeedFlaps : PLANE.maxSpeed;

  // Pitch & roll dari input (kontrol melemah saat stall / di darat).
  const controlAuthority = p.onGround ? 0.4 : clamp((p.speed / stall) * 0.9, 0.25, 1);
  const pitchTarget = input.pitchUp ? PLANE.climbPitchMax
    : input.pitchDown ? -PLANE.divePitchMax : 0;
  const pitchStep = PLANE.pitchRate * controlAuthority * dt;
  p.pitch += clamp(pitchTarget - p.pitch, -pitchStep, pitchStep);
  if (!input.pitchUp && !input.pitchDown && !p.onGround) {
    p.pitch += clamp(0 - p.pitch, -pitchStep * 0.5, pitchStep * 0.5);
  }
  // Di darat pesawat tidak bisa bank — sayap tetap rata.
  const rollTarget = p.onGround ? 0
    : input.rollLeft ? -PLANE.maxBank
    : input.rollRight ? PLANE.maxBank : 0;
  const rollStep = PLANE.rollRate * controlAuthority * dt;
  p.roll += clamp(rollTarget - p.roll, -rollStep, rollStep);
  if (!input.rollLeft && !input.rollRight) {
    p.roll += clamp(0 - p.roll, -rollStep * 0.35, rollStep * 0.35);
  }

  // Kecepatan: dorong mesin lawan drag + efek pitch.
  const thrust = p.engineOut ? 0 : (p.throttle / 100) * PLANE.thrustFull;
  let drag = PLANE.dragClean + (p.flaps ? PLANE.dragFlaps : 0) + (p.airbrake ? PLANE.dragBrake : 0);
  drag += p.speed * PLANE.dragSpeed;
  const accel = thrust - drag * p.speed - Math.sin(p.pitch * DEG) * PLANE.pitchEffect;
  p.speed += accel * dt;
  p.speed = clamp(p.speed, 0, topSpeed + 12);

  // Belok: laju belok dari bank & kecepatan (rumus belok terkoordinasi).
  // Di darat hampir tidak bisa belok (roda hidung saja).
  const speedMs = Math.max(p.speed, 25) * 0.514444;
  const turnRate = (9.81 * Math.tan(p.roll * DEG)) / speedMs * (p.onGround ? 0.15 : 1); // rad/detik
  p.heading += turnRate * dt;

  // Lift & vertical speed: di bawah stall, pesawat tenggelam.
  const liftFactor = clamp((p.speed / stall) * (p.speed / stall), 0, 1.25);
  const speedFtps = p.speed * KNOT_TO_FTPS;
  let vs = speedFtps * Math.sin(p.pitch * DEG) * Math.min(liftFactor, 1);
  if (liftFactor < 1) {
    vs -= (1 - liftFactor) * 26; // tenggelam saat stall
    if (p.speed < stall && Math.abs(p.pitch) < 2 && !p.onGround) events.push('stall');
  }
  if (p.onGround) vs = Math.max(0, vs);
  p.verticalSpeed = vs;
  p.altitude += vs * dt;

  // Gerak horizontal.
  const dist = speedFtps * dt * (p.onGround ? 1 : Math.cos(p.pitch * DEG));
  p.x += Math.sin(p.heading) * dist;
  p.y -= Math.cos(p.heading) * dist;
  // Jaga di dalam dunia (pantai tak berujung: putar balik lembut).
  if (p.x < 200 || p.x > 11800 || p.y < 200 || p.y > 11800) {
    p.heading += Math.PI * dt * 0.6;
    p.x = clamp(p.x, 200, 11800);
    p.y = clamp(p.y, 200, 11800);
  }

  // Kontak dengan terrain.
  const ground = heightAt(p.x, p.y);
  const onRunway = isOnRunway(p.x, p.y);
  if (p.altitude <= ground + 2) {
    p.altitude = ground + 2;
    if (!p.onGround) {
      // Sentuhan pertama: nilai pendaratan dari kekerasan sentuhan.
      const hard = -p.verticalSpeed;
      if (onRunway && p.speed < 135 && hard < 7) {
        p.landed = true;
        events.push('touchdown-soft');
      } else if (onRunway && p.speed < 135 && hard < 16) {
        p.landed = true;
        events.push('touchdown-ok');
        p.damage = Math.min(100, p.damage + (hard - 7) * 2);
      } else if (onRunway && p.speed < 135 && hard < 30) {
        // Mendarat keras di landasan: rusak, tapi bukan tabrakan.
        p.landed = true;
        events.push('touchdown-hard');
        p.damage = Math.min(100, p.damage + 10 + (hard - 16) * 2);
      } else if (onRunway && p.speed >= 135) {
        p.damage = Math.min(100, p.damage + 25);
        events.push('touchdown-fast');
      } else {
        p.damage = Math.min(100, p.damage + 45 + Math.max(0, hard) * 2);
        events.push('terrain-hit');
      }
      if (p.damage >= 100) {
        p.crashed = true;
        events.push('crashed');
      }
    }
    p.onGround = true;
    p.pitch = 0;
    p.roll *= 0.8;
    // Gesekan roda: kuat saat throttle kecil (mengerem), ringan saat gas penuh.
    let friction = p.throttle < 25 ? 10 : 2.5;
    if (p.airbrake) friction += 18;
    p.speed = Math.max(0, p.speed - friction * dt);
    p.verticalSpeed = 0;
  } else {
    p.onGround = false;
    p.landed = false;
  }
  return events;
}

export function isOnRunway(x, y) {
  const dx = Math.abs(x - RUNWAY.x);
  const dy = Math.abs(y - RUNWAY.y);
  return dx < RUNWAY.length / 2 + 20 && dy < RUNWAY.width / 2 + 20;
}

// Jarak (kaki) & arah (derajat dari utara) dari pesawat ke target.
export function bearingTo(p, tx, ty) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  let brg = (Math.atan2(dx, -dy) / DEG + 360) % 360;
  return { dist, bearing: brg };
}
