// missions.js — tiga misi dengan tujuan berbeda: Ring Run, Island Hop,
// Runway Landing. Mengatur target, memeriksa pencapaian, dan menghitung skor.
import { MISSIONS } from './config.js';
import { LIGHTHOUSE, LANDING_FAF, RUNWAY } from './terrain.js';
import { mulberry32, range } from './random.js';
import { bearingTo, isOnRunway } from './physics.js';

export function createMission(kind, seed, islands) {
  const def = MISSIONS[kind];
  const rng = mulberry32(seed * 31 + kind.length * 7);
  const mission = {
    kind,
    title: def.title,
    subtitle: def.subtitle,
    brief: def.brief,
    timeLimit: def.timeLimit,
    timeLeft: def.timeLimit,
    score: 0,
    done: false,
    failed: false,
    failReason: '',
    rings: [],
    checkpoints: [],
    nextIndex: 0,
    phase: kind === 'land' ? 'takeoff' : 'fly', // land: takeoff -> beacon -> return -> landed
    beaconPassed: false,
    fafPassed: false,
    tookOff: false,
    landingBonus: 0,
    events: [],
  };
  if (kind === 'ring') {
    // 8 ring mengelilingi kepulauan pada ketinggian berbeda.
    const spots = [
      [6000, 4200, 1400], [7800, 5200, 1100], [8300, 7400, 1600],
      [6800, 8800, 1200], [4500, 8600, 1500], [3300, 6800, 1000],
      [3600, 4600, 1700], [5200, 3200, 1300],
    ];
    spots.forEach(([x, y, alt], i) => {
      mission.rings.push({ x, y, alt, radius: def.ringRadius, passed: false, index: i });
    });
  } else if (kind === 'hop') {
    // Checkpoint di 4 pulau selain Pulau Besar.
    const targets = islands.slice(1, 5);
    targets.forEach((isl, i) => {
      mission.checkpoints.push({
        x: isl.cx, y: isl.cy, name: isl.name, radius: def.checkpointRadius,
        reached: false, index: i,
      });
    });
  } else if (kind === 'land') {
    mission.checkpoints.push({
      x: LIGHTHOUSE.x, y: LIGHTHOUSE.y, name: 'Mercusuar', radius: 380,
      reached: false, index: 0,
    });
  }
  return mission;
}

// Target aktif saat ini (ring / checkpoint berikutnya), atau null.
export function currentTarget(mission) {
  if (mission.kind === 'ring') return mission.rings[mission.nextIndex] || null;
  if (mission.kind === 'hop') return mission.checkpoints[mission.nextIndex] || null;
  if (mission.kind === 'land') {
    if (mission.phase === 'beacon') return mission.checkpoints[0];
    if (mission.phase === 'return') {
      if (!mission.fafPassed) {
        return { x: LANDING_FAF.x, y: LANDING_FAF.y, alt: LANDING_FAF.alt, name: LANDING_FAF.name, radius: 400 };
      }
      return { x: RUNWAY.x, y: RUNWAY.y, name: 'Landasan Nusantara', radius: 400 };
    }
    return null;
  }
  return null;
}

// Perbarui misi tiap frame. Mengembalikan event string untuk HUD & suara.
export function updateMission(mission, plane, dt, events) {
  const out = [];
  if (mission.done || mission.failed) return out;
  mission.timeLeft -= dt;
  if (mission.timeLeft <= 0) {
    mission.failed = true;
    mission.failReason = 'Waktu habis.';
    out.push('time-up');
    return out;
  }
  if (plane.crashed) {
    mission.failed = true;
    mission.failReason = 'Pesawat jatuh — misi gagal.';
    out.push('crashed');
    return out;
  }
  if (plane.fuel <= 0 && plane.onGround && plane.speed < 5 && !plane.crashed) {
    mission.failed = true;
    mission.failReason = 'Bahan bakar habis dan pesawat berhenti di luar landasan.';
    out.push('fuel-out');
    return out;
  }

  if (mission.kind === 'ring') {
    const ring = mission.rings[mission.nextIndex];
    if (ring) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const horiz = Math.hypot(dx, dy);
      const altDiff = Math.abs(plane.altitude - ring.alt);
      if (horiz < ring.radius * 0.95 && altDiff < MISSIONS.ring.ringAltBand) {
        ring.passed = true;
        mission.score += MISSIONS.ring.ringScore;
        mission.nextIndex += 1;
        out.push('ring-pass');
        if (mission.nextIndex >= mission.rings.length) {
          mission.done = true;
          const bonus = Math.round(mission.timeLeft) * 2;
          mission.score += bonus;
          out.push('mission-done');
        }
      }
    }
  } else if (mission.kind === 'hop') {
    const cp = mission.checkpoints[mission.nextIndex];
    if (cp) {
      const { dist } = bearingTo(plane, cp.x, cp.y);
      if (dist < cp.radius && plane.altitude > 150) {
        cp.reached = true;
        mission.score += MISSIONS.hop.checkpointScore;
        mission.nextIndex += 1;
        out.push('checkpoint');
        if (mission.nextIndex >= mission.checkpoints.length) {
          mission.done = true;
          const bonus = Math.round(mission.timeLeft) * 2;
          mission.score += bonus;
          out.push('mission-done');
        }
      }
    }
  } else if (mission.kind === 'land') {
    if (mission.phase === 'takeoff') {
      if (!plane.onGround && plane.altitude > 250) {
        mission.tookOff = true;
        mission.phase = 'beacon';
        out.push('takeoff');
      }
    } else if (mission.phase === 'beacon') {
      const cp = mission.checkpoints[0];
      const { dist } = bearingTo(plane, cp.x, cp.y);
      if (dist < cp.radius && plane.altitude > 150) {
        cp.reached = true;
        mission.beaconPassed = true;
        mission.phase = 'return';
        mission.score += 150;
        out.push('checkpoint');
      }
    } else if (mission.phase === 'return') {
      if (!mission.fafPassed) {
        const { dist } = bearingTo(plane, LANDING_FAF.x, LANDING_FAF.y);
        if (dist < 500) {
          mission.fafPassed = true;
          out.push('faf');
        }
      }
      if (plane.onGround && isOnRunway(plane.x, plane.y) && plane.speed < 40) {
        mission.phase = 'landed';
        mission.done = true;
        // Bonus pendaratan: makin sedikit kerusakan & makin pelan sentuhan, makin besar.
        const smooth = Math.max(0, 100 - plane.damage);
        mission.landingBonus = 200 + Math.round(smooth * 3);
        mission.score += mission.landingBonus;
        out.push('mission-done');
      }
    }
  }

  // Event fisika diteruskan ke skor/kerusakan.
  for (const e of events) {
    if (e === 'terrain-hit' || e === 'touchdown-fast') {
      mission.score = Math.max(0, mission.score - 50);
      out.push(e);
    } else if (e === 'touchdown-hard') {
      mission.score = Math.max(0, mission.score - 25);
      out.push(e);
    }
  }
  return out;
}

// Teks objektif untuk HUD.
export function objectiveText(mission) {
  if (mission.kind === 'ring') {
    return `Ring ${Math.min(mission.nextIndex + 1, 8)}/8 — terbang ke ring kuning`;
  }
  if (mission.kind === 'hop') {
    const cp = mission.checkpoints[mission.nextIndex];
    return cp ? `Pulau ${mission.nextIndex + 1}/4 — menuju ${cp.name}` : 'Semua pulau dikunjungi';
  }
  if (mission.kind === 'land') {
    if (mission.phase === 'takeoff') return 'Lepas landas dari landasan (throttle penuh, tarik naik)';
    if (mission.phase === 'beacon') return 'Menuju Mercusuar di barat';
    if (mission.phase === 'return') {
      return mission.fafPassed
        ? 'Final: turun pelan ke Landasan Nusantara'
        : 'Kembali via Final Approach di barat landasan';
    }
    return 'Mendarat mulus — misi selesai';
  }
  return '';
}
