// audio.js — semua suara disintesis Web Audio API, tanpa file eksternal.
// Mesin (osilator + noise angin), bip ring, lonceng checkpoint, dan dentuman.
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    started: false,
  };

  audio.ensure = function ensureAudio() {
    if (audio.ctx || audio.muted) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      // Mesin: dua osilator gergaji yang difilter rendah.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      const osc2 = audio.ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 28;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      osc2.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc.start();
      osc2.start();
      audio.engineOsc2 = osc2;
      // Angin: noise putih yang difilter pita.
      const len = audio.ctx.sampleRate * 2;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      audio.windSource = audio.ctx.createBufferSource();
      audio.windSource.buffer = buf;
      audio.windSource.loop = true;
      audio.windFilter = audio.ctx.createBiquadFilter();
      audio.windFilter.type = 'bandpass';
      audio.windFilter.frequency.value = 700;
      audio.windFilter.Q.value = 0.6;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      audio.windSource.connect(audio.windFilter);
      audio.windFilter.connect(audio.windGain);
      audio.windGain.connect(audio.ctx.destination);
      audio.windSource.start();
      audio.started = true;
    } catch (err) {
      audio.ctx = null;
    }
  };

  // Perbarui suara mesin & angin mengikuti throttle & kecepatan.
  audio.updateEngine = function updateEngine(throttle, speed, flying) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const rpm = 42 + (throttle / 100) * 58;
    audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    audio.engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
    const vol = flying ? 0.02 + (throttle / 100) * 0.055 : 0.012 + (throttle / 100) * 0.03;
    audio.engineGain.gain.setTargetAtTime(vol, t, 0.1);
    const wind = flying ? Math.min(0.12, (speed / 285) * 0.12) : 0;
    audio.windGain.gain.setTargetAtTime(wind, t, 0.15);
    audio.windFilter.frequency.setTargetAtTime(500 + speed * 2.4, t, 0.15);
  };

  audio.beep = function beep(freq, dur, type, vol) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audio.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  audio.ringPass = function ringPass() {
    audio.beep(880, 0.16, 'sine', 0.2);
    setTimeout(() => audio.beep(1318, 0.22, 'sine', 0.2), 90);
  };

  audio.checkpoint = function checkpoint() {
    audio.beep(659, 0.14, 'triangle', 0.2);
    setTimeout(() => audio.beep(988, 0.2, 'triangle', 0.2), 110);
  };

  audio.success = function success() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => audio.beep(f, 0.3, 'triangle', 0.2), i * 130));
  };

  audio.thud = function thud() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g);
    g.connect(audio.ctx.destination);
    o.start(t);
    o.stop(t + 0.4);
  };

  audio.stallWarn = function stallWarn() {
    audio.beep(220, 0.12, 'square', 0.07);
  };

  audio.setMuted = function setMuted(m) {
    audio.muted = m;
    if (audio.ctx) {
      if (m) {
        audio.engineGain.gain.value = 0;
        audio.windGain.gain.value = 0;
      } else {
        audio.ctx.resume();
      }
    }
  };

  return audio;
}
