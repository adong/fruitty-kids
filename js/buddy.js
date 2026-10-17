/* Fruit Teddy — the buddy: the other brother comes to help as a second chef, like Metro Surfer's buddy.
   Kit.roster.buddyFor(chef) picks him: Tommy for everyone, Teddy when Tommy is the chef. Call him with his button,
   the T key or his card on the title screen; every call brings him, and calling again once he has handed over his
   treat makes him say hi and hand over another. A visit is about 10 s:
     run in from the right → hello signature (Tommy's Y, Teddy's boxing) → slice a fruit about every second with a
     blade swipe from his side → toss you a treat halfway → goodbye signature (Tommy's Y, Teddy's jump shot) → run off.
   While he's guarding (the first 9.6 s), dropped fruit and sliced zombie heads don't cost a heart (see game.js). */
(function () {
  'use strict';
  const T = THREE;
  const FT = (window.FT = window.FT || {});
  const Kit = window.Kit;
  const { rand, pick } = Kit.gfx;

  const V = { hello: 0.4, giveAt: 4.3, throwAt: 4.65, byeAt: 8.2, guardUntil: 9.6 }; // seconds into his visit
  const STRIKE_EVERY = 1.05, URGENT_EVERY = 0.35;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];

  let api = null, actor = null, entry = null, offX = 20;
  const b = { on: false, t: 0, x: 20, said: false, given: false, bye: false, nextStrike: 0, lastStrike: -9, hits: 0, blade: null };
  const treat = { sprite: null, flyT: -1, holdT: 0, from: new T.Vector3(), to: new T.Vector3() };
  const tmp = new T.Vector3();

  function init(a) {
    api = a;
    actor = FT.makeActor(-1);
    actor.init(a.scene, a.flyers);
    actor.visible = false;
    treat.sprite = new T.Sprite(new T.SpriteMaterial({ depthWrite: false, transparent: true }));
    treat.sprite.visible = false;
    treat.sprite.renderOrder = 7;
    a.scene.add(treat.sprite);
  }

  // The buddy for this chef. Rebuilds him only when he changes.
  function setFor(chefId) {
    const id = Kit.roster.buddyFor(chefId);
    if (entry && entry.id === id) return entry;
    if (b.on) dismiss();
    entry = Kit.roster.get(id);
    actor.set(id, entry.buddyScale || 0.8);
    const tag = Kit.gfx.nameTag(entry.name, entry.tag || '#ffb02e');
    tag.position.y = 2.55;
    actor.person.root.add(tag);
    actor.visible = false;
    return entry;
  }

  function place(v, portrait, reserve) {
    actor.place(v, portrait, reserve);
    offX = v.W / 2 + 1.2 * actor.scale; // just off the right edge
    if (!b.on) b.x = offX;
    actor.root.position.x = b.x;
  }

  // Every call brings him; once he has given his treat, another call makes him say hi and give one more.
  function call() {
    if (!b.on) return summon();
    if (b.given || b.t >= V.guardUntil) {
      Object.assign(b, { t: V.hello - 0.05, said: false, given: false, bye: false, nextStrike: V.hello + 0.5, lastStrike: -9 });
      api.toast(`${entry.name}'S HERE!`);
    }
    return 'again';
  }

  function summon() {
    Object.assign(b, { on: true, t: 0, x: offX, said: false, given: false, bye: false, nextStrike: 0.9, lastStrike: -9 });
    actor.visible = true;
    actor.react('idle');
    actor.root.position.x = b.x;
    api.toast(`${entry.name}'S HERE!`);
    FT.sfx.kit('powerup');
    return 'summoned';
  }

  function dismiss() {
    b.on = false;
    actor.visible = false;
    if (b.blade) endBlade();
  }

  // He starts leaving (the game ended): skip to the goodbye.
  function leave() {
    if (b.on && b.t < V.guardUntil) b.t = V.guardUntil;
  }

  const guarding = () => b.on && b.t < V.guardUntil;

  // ---------------------------------------------------------------- helping: a blade swipe from his side

  // The fruit that most needs saving: falling and low on the screen first, then whichever is lowest.
  function pickTarget() {
    const v = api.view, bottom = -v.H / 2;
    let best = null, bestScore = Infinity;
    for (const it of api.items()) {
      if (it.kind !== 'fruit' || it.age < 0.15) continue;
      if (it.y < bottom + it.r * 0.6 || it.y > v.H / 2 - it.r || Math.abs(it.x) > v.W / 2 - it.r * 0.5) continue;
      const score = it.y + (it.vy > 0 ? v.H : 0);
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  function strike(it) {
    b.lastStrike = b.t;
    b.hits++;
    // the blade sweeps across the fruit from his side (right to left), tracking it so it can't miss
    const a = rand(-0.55, 0.55), L = it.r * 2.2;
    b.blade = { it, k: 0, dx: Math.cos(a) * L, dy: Math.sin(a) * L, x: it.x, y: it.y, stroke: null };
    if (entry.id === 'teddy') {
      actor.act(b.hits % 2 ? 'jab' : 'straight', 0.3);
      FT.sfx.kit('punch');
      api.flyers.add('💥', it.x, it.y, 1, rand(-1, 1), rand(0.5, 1.5), 1.1, 0.45, 0, 0);
    } else actor.act('give', 0.3);
  }

  function updateBlade(dt) {
    const bl = b.blade;
    if (!bl) return;
    if (!bl.it.dead && api.items().includes(bl.it)) {
      bl.x = bl.it.x;
      bl.y = bl.it.y;
    }
    bl.k = Math.min(1, bl.k + dt / 0.12);
    const u = 1 - 2 * bl.k; // +1 (his side) → -1
    const p = api.toScreen(bl.x + bl.dx * u, bl.y + bl.dy * u);
    if (!bl.stroke) bl.stroke = api.blade.start('buddy', p.x, p.y, { color: entry.tag || '#ffb02e', helper: true, width: 16 });
    else api.blade.move(bl.stroke, p.x, p.y);
    if (bl.k >= 1) endBlade();
  }
  function endBlade() {
    api.blade.end('buddy');
    b.blade = null;
  }

  // ---------------------------------------------------------------- the treat

  function giveTreat() {
    const [emoji, label] = pick(TREATS);
    treat.sprite.material.map = Kit.gfx.emojiTexture(emoji);
    treat.sprite.material.needsUpdate = true;
    actor.root.updateMatrixWorld(true);
    Kit.people.handWorld(actor.person, 1, treat.from);
    treat.from.z += 0.5;
    api.scene.add(treat.sprite);
    treat.sprite.position.copy(treat.from);
    treat.sprite.scale.setScalar(0.9);
    treat.sprite.visible = true;
    treat.flyT = 0;
    treat.holdT = 0;
    api.toast(`${emoji} ${label} FROM ${entry.name}!`);
    FT.sfx.kit('coin', 6);
  }

  function updateTreat(dt) {
    const chef = FT.chef;
    if (treat.flyT >= 0) {
      // arc from his hand into the chef's left hand (the one on the middle side of the screen: the chef faces us)
      treat.flyT += dt / 0.6;
      chef.root.updateMatrixWorld(true);
      Kit.people.handWorld(chef.person, -1, treat.to);
      treat.to.z += 0.5;
      const k = Math.min(1, treat.flyT);
      treat.sprite.position.lerpVectors(treat.from, treat.to, k);
      treat.sprite.position.y += Math.sin(k * Math.PI) * 2.2;
      treat.sprite.material.rotation = k * Math.PI * 2;
      if (k >= 1) {
        treat.flyT = -1;
        treat.holdT = 9;
        treat.sprite.material.rotation = 0;
        chef.person.armL.add(treat.sprite);
        treat.sprite.position.set(0, -0.82, -0.3); // camera side of the hand (the chef faces the camera)
        treat.sprite.scale.setScalar(1.0);
        chef.react('cheer');
      }
    } else if (treat.holdT > 0) {
      treat.holdT -= dt;
      if (treat.holdT <= 0) dropTreat();
    }
  }

  function dropTreat() {
    treat.flyT = -1;
    treat.holdT = 0;
    treat.sprite.visible = false;
    if (treat.sprite.parent) treat.sprite.parent.remove(treat.sprite);
  }

  // ---------------------------------------------------------------- the visit

  function update(dt) {
    updateTreat(dt);
    updateBlade(dt);
    if (!b.on) return;
    b.t += dt;
    const t = b.t, s = actor.scale, leaving = t >= V.guardUntil;
    const target = leaving ? offX : actor.home.x;
    const step = 7 * s * dt; // running speed
    b.x += Math.max(-step, Math.min(step, target - b.x));
    const running = Math.abs(target - b.x) > 0.02 * s;
    actor.root.position.x = b.x;
    if (running) {
      actor.face = target < b.x ? Math.PI / 2 : -Math.PI / 2; // face where he's running
      actor.act('run', 0.2, 0, true);
    } else {
      actor.face = null;
      if (!leaving) {
        if (!b.said && t > V.hello) {
          b.said = true;
          actor.react('hello');
        }
        if (!b.given && t > V.giveAt) actor.act('give', 0.6, 0, true);
        if (!b.given && t > V.throwAt) {
          b.given = true;
          giveTreat();
        }
        if (!b.bye && t > V.byeAt) {
          b.bye = true;
          actor.react('goodbye');
        }
        // helping: a fruit about every second, sooner if one is about to drop
        const it = !b.blade && (t < V.giveAt - 0.1 || t > V.throwAt + 0.3) ? pickTarget() : null;
        if (it) {
          const urgent = it.vy < 0 && it.y < -api.view.H * 0.25;
          if (t >= b.nextStrike || (urgent && t - b.lastStrike > URGENT_EVERY)) {
            strike(it);
            b.nextStrike = t + STRIKE_EVERY;
          }
        }
      }
    }
    if (leaving && !running) dismiss();
    // look at the fruit he's after, else the middle
    const look = b.blade ? Math.max(-1, Math.min(1, (b.blade.x - b.x) / (api.view.W * 0.6))) : -0.4;
    actor.update(dt, look);
  }

  FT.buddy = {
    init, setFor, place, call, summon, dismiss, leave, update, dropTreat, guarding,
    get entry() { return entry; },
    get actor() { return actor; },
    get on() { return b.on; },
    get t() { return b.t; },
    get given() { return b.given; },
    get holding() { return treat.holdT > 0 || treat.flyT >= 0; },
    // 1 → 0 over the guarding time, for the HUD bar
    get guardLeft() { return guarding() ? 1 - b.t / V.guardUntil : 0; },
    GUARD_UNTIL: V.guardUntil,
  };
})();
