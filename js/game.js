/* Fruit Teddy — game logic.
   The camera looks straight at the z = 0 plane, where every fruit flies, so slicing is 2D maths in world units:
   pointer drags become world segments, and a segment passing within a fruit's padded radius cuts it.
   The camera distance is fitted so at least MIN_W × MIN_H world units are visible on any screen. */
(function () {
  'use strict';
  const T = THREE, FT = window.FT, Kit = window.Kit, S = FT.sfx;
  const { rand, pick } = Kit.gfx;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------------------------------------------------------- tuning
  const FOV = 40, MIN_W = 10, MIN_H = 14.5;
  const WALL_Z = -12, CHEF_Z = -2.5;
  // Kid-friendly pace: waves every 2.7 s at first, easing toward 1.25 s; a top-of-screen toss takes 3.4 s at
  // first, 2.4 s at full speed. Difficulty d = 1 - e^(-t / RAMP_TIME): about 0.4 after a minute, 0.66 after two.
  const START_GAP = 2.7, END_GAP = 1.25, START_AIR = 3.4, END_AIR = 2.4, RAMP_TIME = 110;
  const HIT_PAD = 1.25, ZOMBIE_PAD = 0.7; // slice radius × this: generous for fruit, strict for zombie heads
  const CHAIN_GAP = 0.35; // a combo: fruit in one swipe, each within this many seconds of the last
  const LIVES = 3, HEART_EVERY = 50; // a lost heart comes back every 50 points
  const GRACE = 12; // for the first seconds a dropped fruit only shows a hint, so little ones can find their feet
  const ZOMBIE_FROM = 25, GOLD_FROM = 15, GOLD_POINTS = 5, BUBBLE_POINTS = 3;
  const FREEZE_TIME = 4.5, FREEZE_SCALE = 0.12;
  const CARD_POINTS = 5, MAX_CARDS = 2; // calling the buddy also tosses up a character card to slice
  const BLADE = { teddy: '#4aa8ff', tommy: '#3fe0b0', zombie: '#a6ff5c' };
  const PITCH = { watermelon: 0.75, pineapple: 0.85, banana: 1.0, apple: 1.1, orange: 1.0, strawberry: 1.3 };

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('fruitTeddy.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try { localStorage.setItem('fruitTeddy.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };

  let renderer, scene, camera, wall, bunting, particles, splats, flyers, overlay;
  const view = { W: MIN_W, H: MIN_H, D: 20, w: 1, h: 1 }; // world size of the z = 0 plane, camera distance, CSS px
  const items = [], halves = [], trails = [], chains = [], batted = [];
  const strokes = new Map(); // pointerId -> stroke being drawn
  const G = {
    state: 'loading', t: 0, clock: 0, score: 0, lives: LIVES, sliced: 0, bestCombo: 0, best: 0, newBest: false,
    nextWave: 0, queue: [], nextBubble: 0, nextHeart: HEART_EVERY, freezeT: 0, timeScale: 1, shake: 0,
    scareT: 0, booT: 0, booAt: null, endT: 0, attractT: 0, chefId: 'teddy', paused: false, autoPause: true,
  };
  const ui = {};
  let portraits = {}, faceTex = {};

  const difficulty = () => 1 - Math.exp(-G.t / RAMP_TIME);
  const airTime = () => lerp(START_AIR, END_AIR, difficulty());
  // gravity that makes a toss rising from below the screen to near the top take airTime() seconds
  const gravity = () => (8 * (view.H * 0.86 + 1.6)) / (airTime() * airTime());

  // sRGB 0..1 (the particle shader writes colours straight to the screen)
  const srgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });

  // ---------------------------------------------------------------- view helpers

  function toWorld(cx, cy) {
    return { x: (cx / view.w - 0.5) * view.W, y: (0.5 - cy / view.h) * view.H };
  }
  function toScreen(x, y, z = 0) {
    const k = view.D / (view.D - z);
    return { x: ((x * k) / view.W + 0.5) * view.w, y: (0.5 - (y * k) / view.H) * view.h };
  }
  const atDepth = (z) => {
    const k = (view.D - z) / view.D;
    return { W: view.W * k, H: view.H * k, z };
  };

  // ---------------------------------------------------------------- the backdrop: a wooden fruit-stand wall

  function wallTexture() {
    const [c, g] = Kit.gfx.makeCanvas(1024, 1024);
    const woods = ['#8a5430', '#96603a', '#7f4c2a', '#9a6640', '#8d5733', '#835030', '#93603b', '#7b4a29'];
    const pw = 128;
    for (let i = 0; i < 8; i++) {
      const x = i * pw;
      g.fillStyle = woods[i];
      g.fillRect(x, 0, pw, 1024);
      // grain
      for (let k = 0; k < 9; k++) {
        g.strokeStyle = `rgba(${k % 2 ? '60,30,10' : '190,130,80'},${rand(0.12, 0.25)})`;
        g.lineWidth = rand(1, 3);
        g.beginPath();
        let gx = x + rand(10, pw - 10);
        g.moveTo(gx, 0);
        for (let y = 0; y <= 1024; y += 32) {
          gx += Math.sin(y * 0.011 + i * 3 + k) * 2.2;
          g.lineTo(clamp(gx, x + 4, x + pw - 4), y);
        }
        g.stroke();
      }
      // a knot or two
      for (let n = 0; n < 2; n++) {
        const kx = x + rand(30, pw - 30), ky = rand(80, 940);
        for (let r = 16; r > 2; r -= 4) {
          g.strokeStyle = `rgba(60,30,10,${0.15 + (16 - r) * 0.025})`;
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(kx, ky, r * 0.7, r * 1.6, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      // groove + nails
      g.fillStyle = 'rgba(40,20,8,0.75)';
      g.fillRect(x, 0, 5, 1024);
      g.fillStyle = 'rgba(255,220,180,0.10)';
      g.fillRect(x + 5, 0, 3, 1024);
      for (const ny of [60, 964]) {
        g.fillStyle = '#4a3a30';
        g.beginPath();
        g.arc(x + pw / 2, ny, 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath();
        g.arc(x + pw / 2 - 2, ny - 2, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    return Kit.gfx.toTexture(c, true);
  }

  function buntingTexture() {
    const [c, g] = Kit.gfx.makeCanvas(512, 160);
    const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#7ed957'];
    g.strokeStyle = '#f4ead8';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 22);
    g.quadraticCurveTo(256, 52, 512, 22);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const x0 = i * 128 + 14, x1 = x0 + 100, sag = (x) => 22 + Math.sin((x / 512) * Math.PI) * 30;
      g.fillStyle = cols[i];
      g.beginPath();
      g.moveTo(x0, sag(x0));
      g.lineTo(x1, sag(x1));
      g.lineTo((x0 + x1) / 2, sag((x0 + x1) / 2) + 100);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc((x0 + x1) / 2, sag((x0 + x1) / 2) + 34, 9, 0, Math.PI * 2);
      g.fill();
    }
    return Kit.gfx.toTexture(c, true);
  }

  function buildBackdrop() {
    wall = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: wallTexture() }));
    wall.position.z = WALL_Z;
    wall.renderOrder = -10;
    bunting = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: buntingTexture(), transparent: true, depthWrite: false }));
    bunting.position.z = WALL_Z + 0.05;
    bunting.renderOrder = -9;
    scene.add(wall, bunting);
  }

  function layoutBackdrop() {
    const v = atDepth(WALL_Z);
    wall.scale.set(v.W * 1.04, v.H * 1.04, 1);
    wall.material.map.repeat.set((v.W / v.H) * 1.2, 1);
    const bh = Math.min(v.H * 0.1, v.W * 0.075);
    bunting.scale.set(v.W * 1.04, bh, 1);
    bunting.position.y = v.H / 2 - bh / 2;
    bunting.material.map.repeat.set(Math.max(1, Math.round(v.W / (bh * 3.2))), 1);
  }

  // ---------------------------------------------------------------- items: fruit, zombie heads, freeze bubbles

  function bubbleFace() {
    const id = G.chefId === 'tommy' ? 'teddy' : G.chefId === 'teddy' ? 'tommy' : pick(['teddy', 'tommy']);
    return { id, tex: faceTex[id] || null, name: (Kit.roster.get(id) || {}).name || 'TOMMY' };
  }

  function toss(kind, o = {}) {
    const { W, H } = view, g = o.g !== undefined ? o.g : gravity();
    const y0 = -H / 2 - 1.6;
    const x0 = o.x !== undefined ? o.x : rand(-W * 0.36, W * 0.36);
    const apex = o.apex !== undefined ? o.apex : rand(H * 0.1, H * 0.36);
    const vy = Math.sqrt(2 * g * Math.max(1, apex - y0)), tf = (2 * vy) / g;
    const xEnd = o.xEnd !== undefined ? o.xEnd : clamp(-x0 * rand(0.1, 0.8) + rand(-W * 0.18, W * 0.18), -W * 0.42, W * 0.42);
    let obj, r, type = null, face = null;
    const golden = !!o.golden;
    if (kind === 'fruit') {
      type = o.type || pick(FT.fruits.types);
      obj = FT.fruits.whole(type, golden);
      r = FT.fruits.defs[type].r;
      if (golden) {
        const glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#ffd84a', transparent: true, opacity: 0.8, depthWrite: false }));
        glow.scale.set(3.4, 3.4, 1);
        obj.userData.glow = glow;
      }
    } else if (kind === 'zombie') {
      obj = FT.fruits.zombie();
      r = 0.95;
    } else if (kind === 'card') {
      type = FT.fruits.card(o.entry, portraits[o.entry.id]);
      obj = FT.fruits.whole(type, false);
      r = FT.fruits.defs[type].r;
    } else {
      face = bubbleFace();
      obj = FT.fruits.bubble(face.tex, face.name);
      r = 1.2;
    }
    const it = {
      kind, type, golden, obj, r, face, x: x0, y: y0, vx: (xEnd - x0) / tf, vy, g, age: 0, seen: false,
      w: new T.Vector3(rand(-2.4, 2.4), rand(-2.4, 2.4), rand(-1.6, 1.6)),
    };
    if (kind === 'fruit') obj.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(-0.6, 0.6));
    if (o.place) {
      // tests and screenshots: hang the item still at a screen position
      const p = toWorld(o.place[0], o.place[1]);
      Object.assign(it, { x: p.x, y: p.y, vx: 0, vy: 0, g: 0, seen: true });
    }
    obj.position.set(it.x, it.y, 0);
    scene.add(obj);
    if (obj.userData.glow) scene.add(obj.userData.glow);
    items.push(it);
    if (G.state === 'play' && kind === 'fruit') S.toss();
    return it;
  }

  function removeItem(it) {
    const i = items.indexOf(it);
    if (i >= 0) items.splice(i, 1);
    scene.remove(it.obj);
    if (it.obj.userData.glow) scene.remove(it.obj.userData.glow);
  }

  function updateItems(gdt) {
    const bottom = -view.H / 2;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.age += gdt;
      it.vy -= it.g * gdt;
      it.x += it.vx * gdt;
      it.y += it.vy * gdt;
      it.obj.position.set(it.x, it.y, 0);
      if (it.kind === 'fruit') {
        it.obj.rotation.x += it.w.x * gdt;
        it.obj.rotation.y += it.w.y * gdt;
        it.obj.rotation.z += it.w.z * gdt;
        if (it.golden) {
          const gl = it.obj.userData.glow;
          gl.position.set(it.x, it.y, -1.2);
          const s = 3.2 + Math.sin(it.age * 7) * 0.35;
          gl.scale.set(s, s, 1);
          if (Math.random() < gdt * 14) {
            particles.emit(it.x + rand(-0.8, 0.8), it.y + rand(-0.8, 0.8), 0.9, 0, rand(0.2, 0.8), 0, srgb('#fff3a0'), rand(0.12, 0.26), 0.5, 0, 1);
          }
        }
      } else if (it.kind === 'card') {
        it.obj.rotation.set(Math.sin(it.age * 1.7) * 0.25, Math.sin(it.age * 2.1) * 1.0, Math.sin(it.age * 2.6) * 0.3); // rocks, face mostly forward
      } else if (it.kind === 'zombie') {
        it.obj.rotation.set(0, Math.sin(it.age * 2.3) * 0.35, Math.sin(it.age * 3.1) * 0.22);
        const halo = it.obj.userData.halo;
        const s = 2.8 + Math.sin(it.age * 6) * 0.25;
        halo.scale.set(s, s, 1);
      } else {
        const sq = 1 + Math.sin(it.age * 5) * 0.04;
        it.obj.scale.set(sq, 2 - sq, 1);
        it.obj.rotation.z = Math.sin(it.age * 1.7) * 0.15;
      }
      if (!it.seen && it.y > bottom + it.r * 0.5) it.seen = true;
      if (it.vy < 0 && it.y < bottom - it.r - 0.5) {
        removeItem(it);
        if (it.kind === 'fruit' && !it.golden && it.seen && G.state === 'play') missFruit(it);
      }
    }
  }

  // ---------------------------------------------------------------- slicing

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function sliceSegment(s, ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-4) return;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!it || it.age < 0.05) continue;
      if (s.helper && it.kind !== 'fruit') continue; // the buddy's blade only cuts fruit
      const pad = it.kind === 'zombie' ? ZOMBIE_PAD : HIT_PAD;
      if (segDist(it.x, it.y, ax, ay, bx, by) <= it.r * pad) hit(it, ux, uy, s);
    }
  }

  function hit(it, ux, uy, s) {
    removeItem(it);
    const scr = toScreen(it.x, it.y);
    if (it.kind === 'zombie') return hitZombie(it, scr);
    if (it.kind === 'bubble') return hitBubble(it, scr);
    if (it.kind === 'card') return hitCard(it, ux, uy, scr);
    split(it, ux, uy);
    juice(it, ux, uy);
    S.slice(PITCH[it.type] || 1);
    if (G.state !== 'play') {
      FT.chef.react(it.golden ? 'signature' : 'slice');
      return;
    }
    const pts = it.golden ? GOLD_POINTS : 1;
    G.sliced++;
    overlay.text('+' + pts, scr.x, scr.y - 10, { color: it.golden ? '#ffd400' : '#ffffff', size: it.golden ? 46 : 30 });
    if (it.golden) {
      S.kit('coin', 10);
      toast('⭐ GOLDEN! +' + GOLD_POINTS);
      FT.chef.react('signature');
    } else FT.chef.react('slice');
    addScore(pts);
    let c = s.chain;
    if (!c || G.clock - c.lastT > CHAIN_GAP) {
      c = s.chain = { n: 0, lastT: 0, x: 0, y: 0 };
      chains.push(c);
    }
    c.n++;
    c.lastT = G.clock;
    c.x = scr.x;
    c.y = scr.y;
  }

  // Two copies of the fruit, each clipped by the cut plane (perpendicular to the swipe, through the centre).
  function split(it, ux, uy) {
    const n = new T.Vector3(-uy, ux, 0);
    const nLocal = n.clone().applyQuaternion(it.obj.quaternion.clone().invert());
    for (const sgn of [1, -1]) {
      const plane = new T.Plane();
      const local = new T.Plane(nLocal.clone().multiplyScalar(sgn), 0);
      const h = FT.fruits.half(it.type, it.golden, plane);
      h.obj.position.copy(it.obj.position);
      h.obj.quaternion.copy(it.obj.quaternion);
      scene.add(h.obj);
      const push = rand(2.2, 3.0);
      halves.push({
        obj: h.obj, mats: h.mats, plane, local, g: it.g || gravity(),
        vx: it.vx * 0.5 + n.x * sgn * push, vy: Math.max(0, it.vy * 0.4) + n.y * sgn * push + 1.2,
        // turn each half about the swipe line so its cut face swings round toward the camera
        axis: new T.Vector3(ux, uy, 0), spin: -sgn * rand(1.5, 2.6),
      });
    }
  }

  function updateHalves(gdt) {
    const floor = -view.H / 2 - 3;
    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      h.vy -= h.g * gdt;
      h.obj.position.x += h.vx * gdt;
      h.obj.position.y += h.vy * gdt;
      h.obj.rotateOnWorldAxis(h.axis, h.spin * gdt);
      if (h.obj.position.y < floor) {
        scene.remove(h.obj);
        h.mats.forEach((m) => m.dispose());
        halves.splice(i, 1);
      }
    }
  }

  function aimClipPlanes() {
    for (const h of halves) {
      h.obj.updateMatrixWorld();
      h.plane.copy(h.local).applyMatrix4(h.obj.matrixWorld);
    }
  }

  function juice(it, ux, uy) {
    const def = FT.fruits.defs[it.type];
    const hex = it.golden ? '#ffd54a' : def.juice, col = srgb(hex);
    const nx = -uy, ny = ux;
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1, sp = rand(2, 7.5), a = rand(-0.9, 0.9);
      const dx = nx * side * Math.cos(a) + ux * Math.sin(a), dy = ny * side * Math.cos(a) + uy * Math.sin(a);
      particles.emit(it.x + rand(-0.3, 0.3), it.y + rand(-0.3, 0.3), rand(-0.2, 0.8), dx * sp, dy * sp + 2, 0, col, rand(0.16, 0.42), rand(0.5, 0.95), 0.85, 1.4);
    }
    for (let i = 0; i < 6; i++) {
      particles.emit(it.x, it.y, 0.5, rand(-1.5, 1.5), rand(-0.5, 2), 0, col, rand(0.9, 1.5), 0.32, 0, 2, 1.3);
    }
    const k = (view.D - WALL_Z) / view.D;
    splats.add(it.x * k + rand(-0.3, 0.3), it.y * k, it.r * 3.2 * k, hex);
    if (it.golden) {
      for (let i = 0; i < 10; i++) flyers.add('✨', it.x, it.y, 1, rand(-3, 3), rand(0, 4), rand(0.5, 0.9), 0.8, rand(-2, 2), 0.4);
    }
  }

  // ---------------------------------------------------------------- zombie heads, freeze bubbles, lives, score

  function hitZombie(it, scr) {
    if (G.state === 'play' && FT.buddy.guarding()) return batAway(it);
    S.poof();
    S.kit('groan');
    const green = srgb('#8fe36a'), dark = srgb('#4f8a3a');
    for (let i = 0; i < 16; i++) {
      particles.emit(it.x + rand(-0.5, 0.5), it.y + rand(-0.5, 0.5), 0.5, rand(-2, 2), rand(-0.5, 2.5), 0, i % 3 ? green : dark, rand(0.8, 1.6), rand(0.6, 1.0), -0.05, 2.5, 1.2);
    }
    for (let i = 0; i < 6; i++) flyers.add(i % 2 ? '⭐' : '💫', it.x, it.y, 1, rand(-3.5, 3.5), rand(1, 4.5), rand(0.6, 0.9), 0.9, rand(-3, 3), 0.4);
    G.shake = 0.55;
    G.scareT = 0.75;
    G.booAt = scr; // the groan ends in a "BOO" 2.45 s later; show it then
    G.booT = 2.45;
    FT.chef.react('scare');
    if (G.state === 'play') {
      toast('🧟 OOPS, A ZOMBIE!', 'warn');
      loseLife();
    }
  }

  // With the buddy guarding, a sliced zombie head gets batted off the screen instead: no scare, no lost heart.
  function batAway(it) {
    S.kit('punch');
    S.poof();
    scene.add(it.obj);
    const dir = it.x < FT.buddy.actor.root.position.x ? -1 : 1;
    batted.push({ obj: it.obj, vx: dir * rand(9, 12), vy: rand(7, 10), spin: rand(8, 12) * dir, g: gravity() });
    for (let i = 0; i < 6; i++) flyers.add(i % 2 ? '⭐' : '💥', it.x, it.y, 1, rand(-3, 3), rand(1, 4), rand(0.6, 0.9), 0.7, rand(-3, 3), 0.4);
    G.shake = 0.2;
    saved();
  }

  function saved() {
    FT.buddy.actor.react('cheer');
    FT.chef.react('cheer');
    if (G.clock - (G.savedAt || -9) > 1.2) {
      G.savedAt = G.clock;
      toast(`${FT.buddy.entry.name} SAVED YOU!`);
      S.heart();
    }
  }

  function updateBatted(dt) {
    for (let i = batted.length - 1; i >= 0; i--) {
      const z = batted[i];
      z.vy -= z.g * dt;
      z.obj.position.x += z.vx * dt;
      z.obj.position.y += z.vy * dt;
      z.obj.rotation.z += z.spin * dt;
      if (Math.abs(z.obj.position.x) > view.W / 2 + 3 || z.obj.position.y < -view.H / 2 - 3) {
        scene.remove(z.obj);
        batted.splice(i, 1);
      }
    }
  }

  function hitCard(it, ux, uy, scr) {
    const def = FT.fruits.defs[it.type];
    split(it, ux, uy);
    const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#7ed957', '#b45cff', '#ffffff'].map(srgb);
    for (let i = 0; i < 40; i++) {
      particles.emit(it.x, it.y, 0.6, rand(-6, 6), rand(-2, 8), 0, cols[i % cols.length], rand(0.18, 0.34), rand(0.7, 1.2), 0.7, 1.2);
    }
    S.slice(1.4);
    FT.chef.react('cheer');
    if (def.entryId === 'zombie') {
      // the zombie card: a groan and a "BOO!" for fun, never a lost heart
      S.kit('groan');
      G.booAt = scr;
      G.booT = 2.45;
    } else S.kit('coin', 10);
    if (G.state !== 'play') return;
    overlay.text('+' + CARD_POINTS, scr.x, scr.y - 10, { color: '#ffd400', size: 44 });
    toast(`🃏 ${def.name} CARD! +${CARD_POINTS}`);
    addScore(CARD_POINTS);
  }

  // Calling the buddy (button, T, his card): he comes, and a random character card flies up to slice.
  function callBuddy() {
    if (G.state === 'paused' || G.state === 'loading') return null;
    S.init();
    const r = FT.buddy.call();
    tossCard();
    return r;
  }

  function tossCard(id) {
    if (items.filter((it) => it.kind === 'card').length >= MAX_CARDS) return null;
    const entry = Kit.roster.get(id) || pick(Kit.roster.list);
    return toss('card', { entry, apex: rand(view.H * 0.05, view.H * 0.25), x: rand(-view.W * 0.3, view.W * 0.3) });
  }

  function hitBubble(it, scr) {
    S.pop();
    S.freeze();
    const ice = srgb('#bfefff');
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      particles.emit(it.x + Math.cos(a) * 1.1, it.y + Math.sin(a) * 1.1, 0.4, Math.cos(a) * 3, Math.sin(a) * 3, 0, ice, rand(0.15, 0.3), 0.5, 0.3, 2);
    }
    for (let i = 0; i < 8; i++) flyers.add('❄️', it.x, it.y, 1, rand(-3.5, 3.5), rand(-1, 4), rand(0.6, 1.0), 1.2, rand(-2, 2), 0.2);
    freeze(it.face ? it.face.name : 'TOMMY');
    FT.chef.react('signature');
    if (G.state === 'play') {
      overlay.text('+' + BUBBLE_POINTS, scr.x, scr.y - 10, { color: '#bfefff', size: 40 });
      addScore(BUBBLE_POINTS);
    }
  }

  function freeze(name) {
    G.freezeT = FREEZE_TIME;
    toast(`❄️ ${name} FREEZE! ❄️`, 'ice');
    ui.frost.classList.add('on');
  }

  function missFruit(it) {
    if (FT.buddy.guarding()) {
      // he dives for it: no heart lost
      overlay.text(Kit.lang.t('SAVED!'), toScreen(it.x, 0).x, view.h - 70, { color: '#7ed957', size: 30 });
      return saved();
    }
    S.miss();
    FT.chef.react('miss');
    if (G.t < GRACE) {
      if (G.clock - (G.hintAt || -9) > 3) {
        G.hintAt = G.clock;
        toast('👆 SWIPE ACROSS THE FRUIT!', 'hint');
      }
      return;
    }
    overlay.miss(toScreen(it.x, 0).x);
    loseLife();
  }

  function loseLife() {
    if (G.state !== 'play') return;
    G.lives = Math.max(0, G.lives - 1);
    renderLives(G.lives);
    if (G.lives <= 0) endGame();
  }

  function addScore(n) {
    G.score += n;
    ui.score.textContent = G.score;
    ui.score.classList.remove('bump');
    void ui.score.offsetWidth;
    ui.score.classList.add('bump');
    while (G.score >= G.nextHeart) {
      G.nextHeart += HEART_EVERY;
      if (G.lives < LIVES && G.state === 'play') {
        G.lives++;
        renderLives(G.lives - 1);
        toast('+❤️ BONUS HEART!');
        S.heart();
      }
    }
  }

  function resolveChains() {
    for (let i = chains.length - 1; i >= 0; i--) {
      const c = chains[i];
      if (G.clock - c.lastT <= CHAIN_GAP) continue;
      chains.splice(i, 1);
      if (c.n < 2 || G.state !== 'play') continue;
      const bonus = c.n === 2 ? 1 : c.n;
      G.bestCombo = Math.max(G.bestCombo, c.n);
      S.combo(c.n);
      overlay.text(`+${bonus}`, clamp(c.x, 60, view.w - 60), c.y - 50, { color: c.n >= 3 ? '#ff7ad1' : '#18d4ff', size: c.n >= 3 ? 44 : 36, life: 1.1 });
      toast(c.n === 2 ? 'DOUBLE! +1' : c.n === 3 ? 'TRIPLE COMBO! +3' : c.n >= 5 ? `MEGA COMBO ×${c.n}! +${bonus}` : `SUPER COMBO ×${c.n}! +${bonus}`);
      FT.chef.react(c.n >= 3 ? 'signature' : 'cheer');
      addScore(bonus);
    }
  }

  // ---------------------------------------------------------------- waves

  function planWave() {
    const { W, H } = view, d = difficulty();
    let n = G.t < 12 ? 1 : 1 + Math.floor(Math.random() * (1.5 + d * 3.7));
    n = Math.min(n, 5);
    const stagger = n >= 3 && Math.random() < 0.45;
    const zChance = G.t < ZOMBIE_FROM ? 0 : 0.08 + d * 0.14, maxZ = d > 0.6 ? 2 : 1;
    const kinds = [];
    let z = 0;
    for (let i = 0; i < n; i++) {
      const canZ = z < maxZ && (n === 1 ? Math.random() < 0.4 : z < n - 1);
      if (canZ && Math.random() < zChance) {
        kinds.push('zombie');
        z++;
      } else kinds.push('fruit');
    }
    const fruitIx = kinds.map((k, i) => (k === 'fruit' ? i : -1)).filter((i) => i >= 0);
    const goldIx = G.t > GOLD_FROM && !items.some((it) => it.golden) && Math.random() < 0.07 ? pick(fruitIx) : -1;
    // spread the wave across the screen; a staggered wave sweeps from one side
    const dir = Math.random() < 0.5 ? 1 : -1, slot = (W * 0.72) / n;
    const order = kinds.map((_, i) => i).sort(() => Math.random() - 0.5);
    kinds.forEach((kind, i) => {
      const k = stagger ? i : order[i];
      const x = dir * (-W * 0.36 + (k + rand(0.25, 0.75)) * slot);
      G.queue.push({
        at: G.t + (stagger ? i * 0.28 : rand(0, 0.12)), kind, golden: i === goldIx, x,
        apex: rand(H * 0.06, H * 0.36), xEnd: stagger ? x + dir * W * 0.2 : undefined,
      });
    });
    const crowd = items.filter((it) => it.kind === 'fruit').length >= 6 ? 0.6 : 0;
    G.nextWave = G.t + lerp(START_GAP, END_GAP, d) + (stagger ? n * 0.28 : 0) + (n - 1) * 0.12 + crowd;
  }

  function spawnTick() {
    if (G.t >= G.nextWave) planWave();
    for (let i = G.queue.length - 1; i >= 0; i--) {
      if (G.t < G.queue[i].at) continue;
      const q = G.queue.splice(i, 1)[0];
      toss(q.kind, q);
    }
    if (G.t >= G.nextBubble && G.freezeT <= 0 && !items.some((it) => it.kind === 'bubble')) {
      toss('bubble', { apex: rand(view.H * 0.04, view.H * 0.26), x: rand(-view.W * 0.25, view.W * 0.25) });
      G.nextBubble = G.t + rand(35, 50);
    }
  }

  function attractTick(gdt) {
    G.attractT -= gdt;
    if (G.attractT > 0 || items.length >= 3) return;
    toss('fruit', { apex: rand(view.H * 0.0, view.H * 0.3), g: (8 * (view.H * 0.86 + 1.6)) / (START_AIR * START_AIR) });
    G.attractT = rand(1.2, 1.9);
  }

  // ---------------------------------------------------------------- game flow

  function clearField() {
    items.slice().forEach(removeItem);
    halves.forEach((h) => {
      scene.remove(h.obj);
      h.mats.forEach((m) => m.dispose());
    });
    halves.length = 0;
    batted.forEach((z) => scene.remove(z.obj));
    batted.length = 0;
    chains.length = 0;
    G.queue.length = 0;
    particles.clear();
    splats.clear();
    flyers.clear();
    overlay.clear();
  }

  function startGame() {
    S.init();
    clearField();
    Object.assign(G, {
      state: 'play', t: 0, score: 0, lives: LIVES, sliced: 0, bestCombo: 0, newBest: false, nextWave: 0.8,
      nextBubble: rand(30, 40), nextHeart: HEART_EVERY, freezeT: 0, timeScale: 1, scareT: 0, booT: 0, endT: 0, paused: false,
    });
    G.best = bestFor(G.chefId);
    ui.score.textContent = '0';
    ui.hudBest.textContent = G.best;
    renderLives();
    ui.frost.classList.remove('on');
    show('hud');
    S.music('play');
    FT.chef.react('hello');
  }

  function endGame() {
    G.state = 'ending';
    G.endT = 1.6;
    G.queue.length = 0;
    FT.chef.react('over');
    FT.buddy.leave();
    S.music('over');
  }

  function showOver() {
    G.state = 'over';
    G.attractT = 2;
    const best = bestFor(G.chefId);
    G.newBest = G.score > best;
    if (G.newBest) store.set('best.' + G.chefId, G.score);
    ui.ovScore.textContent = G.score;
    ui.ovSliced.textContent = G.sliced;
    ui.ovCombo.textContent = G.bestCombo >= 2 ? '×' + G.bestCombo : '–';
    ui.ovBest.textContent = Math.max(best, G.score);
    ui.ovBestLabel.textContent = FT.chef.entry.name + "'S BEST";
    ui.ovTitle.textContent = G.score >= 100 ? 'FRUIT MASTER!' : G.score >= 40 ? 'AWESOME!' : 'NICE CHOPPING!';
    ui.newBest.classList.toggle('on', G.newBest);
    show('over');
    buildPicker();
    if (G.newBest) S.kit('powerup');
  }

  function goTitle() {
    G.state = 'title';
    G.attractT = 0.4;
    ui.frost.classList.remove('on');
    G.freezeT = 0;
    show('title');
    buildPicker();
    S.music('title');
    FT.chef.react('idle');
  }

  function setPaused(on) {
    if (on && G.state === 'play') {
      G.state = 'paused';
      show('pause', true);
      S.music('pause');
      strokes.clear();
    } else if (!on && G.state === 'paused') {
      G.state = 'play';
      show('hud');
      S.music('play');
    }
  }

  function show(which, keepHud) {
    ui.title.classList.toggle('hidden', which !== 'title');
    ui.over.classList.toggle('hidden', which !== 'over');
    ui.pause.classList.toggle('hidden', which !== 'pause');
    ui.hud.classList.toggle('hidden', !(which === 'hud' || keepHud));
  }

  const bestFor = (id) => store.get('best.' + id, 0);

  function renderLives(pop = -1) {
    ui.lives.innerHTML = '';
    for (let i = 0; i < LIVES; i++) {
      const h = document.createElement('span');
      h.className = 'heart' + (i < G.lives ? '' : ' lost') + (i === pop ? ' pop' : '');
      h.textContent = i < G.lives ? '❤️' : '🤍';
      ui.lives.appendChild(h);
    }
    if (pop >= G.lives) {
      ui.lives.classList.remove('hurt');
      void ui.lives.offsetWidth;
      ui.lives.classList.add('hurt');
    }
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
    setTimeout(() => el.remove(), 1300);
  }

  // ---------------------------------------------------------------- characters and the picker

  function setChef(id, react) {
    const e = Kit.roster.get(id) ? id : 'teddy';
    G.chefId = e;
    FT.buddy.dropTreat(); // it was in the old chef's hand
    FT.chef.set(e);
    FT.chef.place(atDepth(CHEF_Z), view.W < view.H * 0.8);
    setBuddy(e);
    store.set('chef', e);
    if (ui.picker) {
      ui.picker.querySelectorAll('.avatar').forEach((b) => b.setAttribute('aria-checked', b.dataset.id === e ? 'true' : 'false'));
      ui.bestName.textContent = Kit.roster.get(e).name;
      ui.bestTitle.textContent = bestFor(e);
    }
    if (react) FT.chef.react('hello');
  }

  // The buddy who comes for this chef: rebuild him and relabel his button, HUD row and title card.
  function setBuddy(chefId) {
    const b = FT.buddy.setFor(chefId);
    placeBuddy();
    const nice = b.name[0] + b.name.slice(1).toLowerCase();
    ui.buddyFace.src = ui.pwBuddyFace.src = portraits[b.id] || '';
    ui.buddyName.textContent = b.name;
    ui.buddyBtn.title = `Call ${nice} (T)`;
    ui.buddyKey.textContent = nice;
    const card = $('buddyCard');
    if (card) {
      card.querySelector('img').src = portraits[b.id] || '';
      card.querySelector('.nm').textContent = b.name;
    }
  }

  // The buddy stands bottom-right, left of his button.
  function placeBuddy() {
    const v = atDepth(CHEF_Z), btn = ui.buddyBtn.getBoundingClientRect();
    const reservePx = btn.width ? view.w - btn.left + 6 : 110;
    FT.buddy.place(v, view.W < view.H * 0.8, (reservePx / view.w) * v.W);
  }

  function buildPicker() {
    ui.picker.innerHTML = '';
    for (const c of Kit.roster.list) {
      const b = document.createElement('button');
      b.className = 'avatar' + (c.id === 'teddy' || c.id === 'tommy' ? ' hero' : '');
      b.dataset.id = c.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', c.id === G.chefId ? 'true' : 'false');
      b.innerHTML = `<img alt="" src="${portraits[c.id] || ''}"><span class="nm">${c.name}</span><span class="bs">BEST ${bestFor(c.id)}</span>`;
      b.addEventListener('click', () => {
        S.init();
        S.kit('click');
        setChef(c.id, true);
        if (G.state === 'over') goTitle();
      });
      ui.picker.appendChild(b);
      if (c.id === 'tommy') ui.picker.appendChild(Object.assign(document.createElement('i'), { className: 'brk' }));
    }
    // the buddy card: tap it and he comes right now (and a card to slice flies up)
    const bd = FT.buddy.entry;
    const card = document.createElement('button');
    card.className = 'avatar buddy';
    card.id = 'buddyCard';
    card.title = 'Call your buddy (T)';
    card.innerHTML = `<img alt="" src="${portraits[bd.id] || ''}"><span class="nm">${bd.name}</span><span class="bs">BUDDY · TAP ME!</span>`;
    card.addEventListener('click', () => {
      S.kit('click');
      callBuddy();
      card.blur();
    });
    ui.picker.appendChild(card);
    ui.bestName.textContent = Kit.roster.get(G.chefId).name;
    ui.bestTitle.textContent = bestFor(G.chefId);
  }

  // A round face for the freeze bubble, from the menu portrait.
  function makeFace(id) {
    const [c, g] = Kit.gfx.makeCanvas(256, 256);
    const t = Kit.gfx.toTexture(c);
    const img = new Image();
    img.onload = () => {
      g.save();
      g.beginPath();
      g.arc(128, 128, 120, 0, Math.PI * 2);
      g.clip();
      const grd = g.createRadialGradient(128, 100, 10, 128, 128, 130);
      grd.addColorStop(0, id === 'tommy' ? '#fff3d0' : '#d9f0ff');
      grd.addColorStop(1, id === 'tommy' ? '#ffb02e' : '#4aa8ff');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
      g.drawImage(img, 0, 0, 256, 256);
      g.restore();
      t.needsUpdate = true;
    };
    img.src = portraits[id];
    return t;
  }

  // ---------------------------------------------------------------- input

  function bladeColor() {
    return BLADE[G.chefId] || '#ffd400';
  }

  function strokeStart(id, cx, cy, o = {}) {
    const s = { id, pts: [], last: null, color: o.color || bladeColor(), width: o.width || 20, helper: !!o.helper, chain: null, ended: false, whoosh: -1 };
    strokes.set(id, s);
    trails.push(s);
    strokeMove(s, cx, cy);
    return s;
  }

  function strokeMove(s, cx, cy) {
    s.pts.push({ x: cx, y: cy, t: G.clock });
    if (s.pts.length > 48) s.pts.shift();
    const w = toWorld(cx, cy);
    if (s.last && G.state !== 'paused') {
      sliceSegment(s, s.last.x, s.last.y, w.x, w.y);
      // a whoosh for a quick swipe
      const old = s.helper ? null : s.pts.find((p) => G.clock - p.t < 0.09);
      if (old && Math.hypot(cx - old.x, cy - old.y) > view.w * 0.08 && G.clock - s.whoosh > 0.3) {
        s.whoosh = G.clock;
        S.kit('swipe');
      }
    }
    s.last = w;
  }

  function strokeEnd(id) {
    const s = strokes.get(id);
    if (!s) return;
    s.ended = true;
    strokes.delete(id);
  }

  function bindInput() {
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      S.init();
      if (G.state === 'paused') return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      strokeStart(e.pointerId, e.clientX, e.clientY);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      const s = strokes.get(e.pointerId);
      if (!s) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (evs.length) evs.forEach((ev) => strokeMove(s, ev.clientX, ev.clientY));
      else strokeMove(s, e.clientX, e.clientY);
    });
    const end = (e) => strokeEnd(e.pointerId);
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('lostpointercapture', end);

    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'm' || k === 'M') toggleMute();
      else if (k === 't' || k === 'T') callBuddy();
      else if (k === 'p' || k === 'P' || k === 'Escape') setPaused(G.state === 'play');
      else if ((k === ' ' || k === 'Enter') && (G.state === 'title' || G.state === 'over')) {
        if (document.activeElement && document.activeElement.classList.contains('avatar') && k === 'Enter') return;
        e.preventDefault();
        startGame();
      } else if ((k === ' ' || k === 'Enter') && G.state === 'paused') setPaused(false);
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && G.state === 'title') {
        const ids = Kit.roster.list.map((c) => c.id), i = ids.indexOf(G.chefId);
        setChef(ids[(i + (k === 'ArrowLeft' ? ids.length - 1 : 1)) % ids.length], true);
      }
    });
    $('playBtn').addEventListener('click', startGame);
    $('againBtn').addEventListener('click', startGame);
    $('chefBtn').addEventListener('click', () => { S.kit('click'); goTitle(); });
    $('resumeBtn').addEventListener('click', () => setPaused(false));
    $('quitBtn').addEventListener('click', () => { clearField(); goTitle(); });
    $('pauseBtn').addEventListener('click', () => setPaused(true));
    $('muteBtn').addEventListener('click', toggleMute);
    ui.buddyBtn.addEventListener('click', (e) => {
      callBuddy();
      e.currentTarget.blur();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause) setPaused(true);
        S.suspend();
      } else S.resume();
    });
    window.addEventListener('resize', resize);
  }

  function toggleMute() {
    S.init();
    const m = S.toggleMute();
    ui.muteBtn.textContent = m ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- loop

  function resize() {
    // a hidden or collapsed page can report 0 × 0: keep a sane view until it has a real size
    const w = window.innerWidth || view.w || 800, h = window.innerHeight || view.h || 600, aspect = w / h;
    const H = Math.max(MIN_H, MIN_W / aspect), W = H * aspect;
    const D = H / 2 / Math.tan((FOV * Math.PI) / 360);
    Object.assign(view, { W, H, D, w, h });
    camera.aspect = aspect;
    camera.position.set(0, 0, D);
    camera.far = D - WALL_Z + 10;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const dpr = renderer.getPixelRatio();
    particles.obj.material.uniforms.scale.value = (h * dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
    overlay.resize(w, h, dpr);
    layoutBackdrop();
    FT.chef.place(atDepth(CHEF_Z), W < H * 0.8);
    if (FT.buddy.entry) placeBuddy();
  }

  function tick(dt) {
    G.clock += dt;
    if (G.state === 'paused' || G.state === 'loading') return;
    const target = G.freezeT > 0 ? FREEZE_SCALE : G.state === 'ending' ? 0.35 : 1;
    G.timeScale += (target - G.timeScale) * (1 - Math.exp(-8 * dt));
    const gdt = dt * G.timeScale;
    if (G.freezeT > 0) {
      G.freezeT -= dt;
      if (G.freezeT <= 0) ui.frost.classList.remove('on');
    }
    if (G.state === 'play') {
      G.t += gdt;
      spawnTick();
    } else if (G.state === 'title' || G.state === 'over') attractTick(gdt);
    updateItems(gdt);
    updateHalves(gdt);
    particles.update(dt * Math.max(G.timeScale, 0.3), gravity() * 0.8);
    splats.update(dt);
    flyers.update(dt, 9);
    resolveChains();

    // the chef looks at the highest fruit
    let look = 0, best = -1e9;
    const cx = FT.chef.root.position.x;
    for (const it of items) if (it.y > best) { best = it.y; look = clamp((it.x - cx) / (view.W * 0.6), -1, 1); }
    FT.chef.update(dt, look);
    FT.buddy.update(dt);
    updateBatted(gdt);
    const guard = FT.buddy.guardLeft;
    ui.pwBuddy.classList.toggle('on', guard > 0);
    ui.buddyBtn.classList.toggle('guarding', guard > 0);
    if (guard > 0) ui.pwBuddyFill.style.transform = `scaleX(${guard})`;

    if (G.scareT > 0) {
      G.scareT -= dt;
      ui.scare.classList.toggle('on', G.scareT > 0);
    }
    if (G.booT > 0) {
      G.booT -= dt;
      if (G.booT <= 0 && G.booAt) overlay.text(Kit.lang.t('BOO!'), G.booAt.x, G.booAt.y, { color: '#9be37a', size: 56, life: 0.9 });
    }
    G.shake = Math.max(0, G.shake - dt);
    if (G.state === 'ending') {
      G.endT -= dt;
      if (G.endT <= 0) showOver();
    }
    if (G.freezeT > 0) ui.freezeFill.style.transform = `scaleX(${clamp(G.freezeT / FREEZE_TIME, 0, 1)})`;
    for (let i = trails.length - 1; i >= 0; i--) if (trails[i].ended && (!trails[i].pts.length || G.clock - trails[i].pts[trails[i].pts.length - 1].t > 0.3)) trails.splice(i, 1);
  }

  function render(dt) {
    const s = G.shake;
    camera.position.x = s > 0 ? Math.sin(G.clock * 70) * s * 0.35 : 0;
    camera.position.y = s > 0 ? Math.cos(G.clock * 53) * s * 0.3 : 0;
    aimClipPlanes();
    renderer.render(scene, camera);
    overlay.draw(trails, G.clock, dt);
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!G.hold) {
      tick(dt);
      render(dt);
    }
    requestAnimationFrame(frame);
  }

  // Compile the clipped-half shaders up front, so the first slice doesn't hitch.
  function prewarm() {
    const tmp = [];
    for (const id of FT.fruits.types) {
      for (const golden of [false, true]) {
        const h = FT.fruits.half(id, golden, new T.Plane(new T.Vector3(1, 0, 0), 0));
        h.obj.position.set(0, -100, 0);
        scene.add(h.obj);
        tmp.push(h);
      }
      const w = FT.fruits.whole(id, false);
      w.position.set(0, -100, 0);
      scene.add(w);
      tmp.push({ obj: w, mats: [] });
    }
    const z = FT.fruits.zombie(), b = FT.fruits.bubble(null, '');
    z.position.y = b.position.y = -100;
    scene.add(z, b);
    tmp.push({ obj: z, mats: [] }, { obj: b, mats: [] });
    renderer.compile(scene, camera);
    tmp.forEach((h) => {
      scene.remove(h.obj);
      h.mats.forEach((m) => m.dispose());
    });
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    try {
      await Promise.race([document.fonts.load('64px Bungee'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { /* system fonts */ }
    try {
      renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('loading').textContent = 'This browser can’t run WebGL, so the game can’t start.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.localClippingEnabled = true;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV, 1, 0.5, 100);
    scene.add(new T.HemisphereLight('#fff6e8', '#6b4a2e', 0.95));
    const sun = new T.DirectionalLight('#fff4e0', 1.15);
    sun.position.set(-4, 7, 10);
    scene.add(sun);

    FT.fruits.init();
    // zombie heads are the kit's zombie, head only, turned to face the camera
    const zLook = (Kit.roster.get('zombie') || {}).look;
    if (zLook) {
      let proto = null; // built once; every toss is a clone sharing its geometry and materials
      FT.fruits.setZombieMaker(() => {
        if (!proto) {
          const head = Kit.people.build(zLook).head;
          head.parent.remove(head);
          head.position.set(0, -0.05, 0);
          head.rotation.set(0, Math.PI, 0);
          head.scale.setScalar(2.9);
          proto = new T.Group();
          proto.add(head);
        }
        return proto.clone();
      });
    }
    buildBackdrop();
    particles = FT.fx.makeParticles(1200);
    splats = FT.fx.makeSplats(16, WALL_Z + 0.1);
    flyers = FT.fx.makeFlyers(scene);
    overlay = FT.fx.makeOverlay($('fx'));
    scene.add(particles.obj, splats.group);
    FT.chef.init(scene, flyers);
    FT.chef.onSwish = (at) => {
      const p = toScreen(at.x, at.y, at.z);
      overlay.text(Kit.lang.t('SWISH!'), p.x, p.y + 30, { color: '#ff9f1c', size: 34, life: 1 });
    };

    Object.assign(ui, {
      hud: $('hud'), title: $('title'), over: $('over'), pause: $('pause'), score: $('score'), hudBest: $('hudBest'),
      lives: $('lives'), toasts: $('toasts'), scare: $('scare'), frost: $('frost'), freezeFill: $('freezeFill'),
      muteBtn: $('muteBtn'), picker: $('picker'), bestName: $('bestName'), bestTitle: $('bestTitle'),
      ovScore: $('ovScore'), ovSliced: $('ovSliced'), ovCombo: $('ovCombo'), ovBest: $('ovBest'), ovBestLabel: $('ovBestLabel'),
      ovTitle: $('ovTitle'), newBest: $('newBest'),
      buddyBtn: $('buddyBtn'), buddyFace: $('buddyFace'), buddyName: $('buddyName'), buddyKey: $('buddyKeyName'),
      pwBuddy: $('pwBuddy'), pwBuddyFace: $('pwBuddyFace'), pwBuddyFill: $('pwBuddyFill'),
    });
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    try {
      portraits = Kit.portraits(Kit.roster.list, { size: 152 });
    } catch (e) {
      portraits = {};
    }
    faceTex = { teddy: makeFace('teddy'), tommy: makeFace('tommy') };
    FT.buddy.init({
      scene, flyers, view, toScreen, toast, items: () => items,
      blade: { start: strokeStart, move: strokeMove, end: strokeEnd },
    });
    FT.buddy.actor.onSwish = FT.chef.onSwish;
    resize();
    setChef(store.get('chef', 'teddy'));
    buildPicker();
    bindInput();
    prewarm();
    goTitle();
    $('loading').remove();
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- console hooks for testing and showing off

  window.fruit = {
    get state() { return G.state; },
    G, items, halves, view,
    start(id) {
      if (id) setChef(id);
      startGame();
      return G.state;
    },
    title() { goTitle(); return G.state; },
    // Advance `seconds` of game time right now, drawing every frame (handy when the tab's animation is throttled).
    step(seconds = 1) {
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
        tick(1 / 60);
        render(1 / 60);
      }
      return fruit.info();
    },
    info() {
      return { state: G.state, t: +G.t.toFixed(1), score: G.score, lives: G.lives, sliced: G.sliced, items: items.length, halves: halves.length, freeze: +G.freezeT.toFixed(1), chef: G.chefId, pose: FT.chef.pose };
    },
    // Drag a blade through `path` (screen px, [[x, y], ...]) over `dur` seconds, stepping the game as it goes.
    swipe(path, dur = 0.18) {
      const n = Math.max(2, Math.ceil(dur * 60)), segs = path.length - 1;
      const before = { score: G.score, sliced: G.sliced, items: items.length };
      const s = strokeStart(999, path[0][0], path[0][1]);
      for (let i = 1; i <= n; i++) {
        const f = (i / n) * segs, k = Math.min(segs - 1, Math.floor(f)), u = f - k;
        strokeMove(s, lerp(path[k][0], path[k + 1][0], u), lerp(path[k][1], path[k + 1][1], u));
        tick(1 / 60);
        render(1 / 60);
      }
      strokeEnd(999);
      return { cut: before.items - items.length, scoreGained: G.score - before.score };
    },
    // Where everything is on screen, in px.
    where() {
      return items.map((it) => {
        const p = toScreen(it.x, it.y);
        return { kind: it.kind, type: it.type, golden: it.golden, x: Math.round(p.x), y: Math.round(p.y), r: Math.round((it.r / view.W) * view.w) };
      });
    },
    // One swipe through every fruit on screen (left to right); zombies are avoided unless asked.
    sliceAll(withZombies = false) {
      const pts = fruit.where().filter((p) => withZombies || p.kind !== 'zombie').filter((p) => p.y > 0 && p.y < view.h).sort((a, b) => a.x - b.x);
      if (!pts.length) return { cut: 0 };
      const path = [[pts[0].x - 60, pts[0].y + 30], ...pts.map((p) => [p.x, p.y]), [pts[pts.length - 1].x + 60, pts[pts.length - 1].y - 30]];
      return fruit.swipe(path, 0.08 + pts.length * 0.04);
    },
    // Toss something now. kind: 'fruit' | 'zombie' | 'bubble'; opts: { type, golden, x, apex, place: [sx, sy] }
    spawn(kind = 'fruit', opts = {}) {
      const it = toss(kind, opts);
      const p = toScreen(it.x, it.y);
      return { kind, type: it.type, x: Math.round(p.x), y: Math.round(p.y) };
    },
    chef(kind) { return FT.chef.react(kind); },
    // the buddy: call him like the button / T does (also tosses a card); buddyInfo() reports his visit
    buddy() { return callBuddy(); },
    buddyInfo() {
      const r = FT.buddy.actor.root.position;
      return { id: FT.buddy.entry.id, on: FT.buddy.on, t: +FT.buddy.t.toFixed(2), guarding: FT.buddy.guarding(), given: FT.buddy.given, holding: FT.buddy.holding, pose: FT.buddy.actor.pose, x: +r.x.toFixed(2), home: +FT.buddy.actor.home.x.toFixed(2), cards: items.filter((it) => it.kind === 'card').length };
    },
    card(id) { const it = tossCard(id); return it ? it.type : null; },
    setChef(id) { setChef(id, true); return G.chefId; },
    pause(on = true) { setPaused(on); return G.state; },
    // the Browser pane hides the page between test steps; this stops that from pausing the game
    set autoPause(on) { G.autoPause = !!on; },
    // hold(true) stops the live loop so only step() moves time: screenshots then show exactly what step() drew
    hold(on = true) { G.hold = !!on; return G.hold; },
  };

  boot();
})();
