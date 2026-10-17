/* Fruit Teddy — sound. Kit.sound plays the shared effects (swipe, coin, powerup, bump, click, groan, punch,
   swish) and the music; the slicing sounds below are built from its tone() and hiss() so they share its mixer and
   mute. Every call is a silent no-op until Kit.sound.init() runs on the first tap. */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const S = () => window.Kit && Kit.sound;
  const tone = (o) => S() && S().tone(o);
  const hiss = (o) => S() && S().hiss(o);

  FT.sfx = {
    init() { if (S()) S().init(); },
    // any shared kit effect by name: FT.sfx.kit('groan')
    kit(name, ...args) {
      const s = S();
      if (s && typeof s[name] === 'function') s[name](...args);
    },
    music(mode) { if (S()) S().music(mode); },
    toggleMute() { return S() ? S().toggleMute() : true; },
    isMuted() { return S() ? S().isMuted() : true; },
    suspend() { if (S()) S().suspend(); },
    resume() { if (S()) S().resume(); },

    // a juicy "shk-splt": bright swish, then a falling wet blip; `pitch` varies it per fruit
    slice(pitch = 1) {
      hiss({ f: 4200, to: 1400, q: 1.2, dur: 0.09, vol: 0.32 });
      tone({ type: 'triangle', f: 620 * pitch, to: 150 * pitch, dur: 0.13, vol: 0.28, at: 0.015 });
      hiss({ filter: 'lowpass', f: 900, to: 250, dur: 0.12, vol: 0.22, at: 0.02 });
    },
    // the freeze bubble popping, then a sparkly chime
    pop() {
      tone({ f: 700, to: 1700, dur: 0.08, vol: 0.3 });
      hiss({ filter: 'highpass', f: 3000, to: 6000, dur: 0.06, vol: 0.18 });
    },
    freeze() {
      [1568, 1976, 2349, 3136, 2637].forEach((f, i) => tone({ f, dur: 0.35, vol: 0.12, at: 0.05 + i * 0.07 }));
      hiss({ filter: 'highpass', f: 6000, to: 2500, dur: 0.5, vol: 0.08 });
    },
    // rising arpeggio, one note per fruit in the combo
    combo(n) {
      const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
      for (let i = 0; i < Math.min(n + 1, notes.length); i++) tone({ type: 'square', f: notes[i], dur: 0.1, vol: 0.06, lp: 3500, at: i * 0.06 });
    },
    heart() {
      tone({ type: 'triangle', f: 880, dur: 0.14, vol: 0.2 });
      tone({ type: 'triangle', f: 1319, dur: 0.3, vol: 0.2, at: 0.1 });
    },
    // a soft "aww" slide for a dropped fruit
    miss() {
      tone({ type: 'triangle', f: 440, to: 260, dur: 0.35, vol: 0.18 });
    },
    // a toss: soft thump from below the screen
    toss() {
      tone({ f: 180, to: 320, dur: 0.08, vol: 0.06 });
    },
    // the zombie head going poof
    poof() {
      hiss({ filter: 'lowpass', f: 1800, to: 200, dur: 0.45, vol: 0.35 });
      tone({ type: 'square', f: 300, to: 90, dur: 0.3, vol: 0.06, lp: 1200 });
    },
  };
})();
