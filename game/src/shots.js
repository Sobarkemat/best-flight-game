// shots.js — adegan deterministik untuk screenshot (?shot=cover|ring|landing|islands&seed=7).
// Setiap adegan membekukan satu keadaan permainan: posisi, heading, ketinggian,
// kecepatan, throttle, dan misi — sehingga render selalu sama.
import { createPlane } from './physics.js';
import { createMission } from './missions.js';
import { RUNWAY } from './terrain.js';

// Kembalikan {plane, mission} untuk adegan yang diminta, atau null bila bukan shot.
export function buildShotScene(kind, seed, islands) {
  const plane = createPlane(RUNWAY.x, RUNWAY.y, 90, RUNWAY.elevation + 2);
  let mission = null;
  if (kind === 'cover') {
    // Terbang di atas Pulau Besar menuju ring pertama: ring + runway + HUD penuh.
    mission = createMission('ring', seed, islands);
    plane.x = 5750;
    plane.y = 5400;
    plane.heading = (0 * Math.PI) / 180;
    plane.altitude = 1380;
    plane.speed = 168;
    plane.pitch = 4;
    plane.roll = -9;
    plane.throttle = 78;
    plane.fuel = 82;
    plane.onGround = false;
  } else if (kind === 'ring') {
    // Tepat di depan ring 2, rendah & cepat.
    mission = createMission('ring', seed, islands);
    mission.nextIndex = 1;
    plane.x = 7600;
    plane.y = 6300;
    plane.heading = (-32 * Math.PI) / 180;
    plane.altitude = 1120;
    plane.speed = 195;
    plane.pitch = 2;
    plane.roll = 14;
    plane.throttle = 86;
    plane.fuel = 76;
    plane.onGround = false;
  } else if (kind === 'landing') {
    // Final approach ke landasan: rendah, flap terbuka, landasan di depan.
    mission = createMission('land', seed, islands);
    mission.phase = 'return';
    mission.beaconPassed = true;
    mission.fafPassed = true;
    mission.score = 150;
    plane.x = RUNWAY.x - 1450;
    plane.y = RUNWAY.y + 40;
    plane.heading = (90 * Math.PI) / 180;
    plane.altitude = 320;
    plane.speed = 92;
    plane.pitch = -4;
    plane.roll = 0;
    plane.throttle = 32;
    plane.fuel = 54;
    plane.flaps = true;
    plane.onGround = false;
  } else if (kind === 'islands') {
    // Tinggi di atas kepulauan: panorama pulau + checkpoint.
    mission = createMission('hop', seed, islands);
    plane.x = 6200;
    plane.y = 5600;
    plane.heading = (38 * Math.PI) / 180;
    plane.altitude = 4300;
    plane.speed = 205;
    plane.pitch = 1;
    plane.roll = -16;
    plane.throttle = 82;
    plane.fuel = 88;
    plane.onGround = false;
  } else {
    return null;
  }
  plane.verticalSpeed = plane.speed * 1.6878 * Math.sin((plane.pitch * Math.PI) / 180);
  return { plane, mission };
}

export const SHOT_KINDS = ['cover', 'ring', 'landing', 'islands'];
