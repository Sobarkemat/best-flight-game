// input.js — keyboard + mouse: panah/WASD terbang, W/S throttle,
// Spasi flap, B rem udara, M suara, P jeda. Klik mouse untuk tombol menu.
export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    flapsPressed: false, // edge-trigger: true hanya pada frame tombol ditekan
    pausePressed: false,
    mutePressed: false,
    anyKey: false,
  };

  function codeOf(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    const c = codeOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) {
      e.preventDefault();
    }
    if (c === 'Space' && !keys.has('Space')) input.flapsPressed = true;
    if (c === 'KeyP' && !keys.has('KeyP')) input.pausePressed = true;
    if (c === 'KeyM' && !keys.has('KeyM')) input.mutePressed = true;
    keys.add(c);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(codeOf(e));
  });
  window.addEventListener('blur', () => keys.clear());

  // Baca keadaan kontrol terbang dari tombol yang sedang ditekan.
  input.readFlight = function readFlight() {
    return {
      pitchUp: keys.has('ArrowUp') || keys.has('KeyI'),
      pitchDown: keys.has('ArrowDown') || keys.has('KeyK'),
      rollLeft: keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyJ'),
      rollRight: keys.has('ArrowRight') || keys.has('KeyD') || keys.has('KeyL'),
      throttleUp: keys.has('KeyW'),
      throttleDown: keys.has('KeyS'),
      flapsToggle: input.flapsPressed,
      airbrake: keys.has('KeyB'),
    };
  };

  // Konsumsi edge-trigger setelah dibaca tiap frame.
  input.consumeEdges = function consumeEdges() {
    input.flapsPressed = false;
    input.pausePressed = false;
    input.mutePressed = false;
  };

  return input;
}
