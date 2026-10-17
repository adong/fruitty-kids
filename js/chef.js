/* Fruit Teddy — the chefs. FT.makeActor(side) builds a character from a Kit.roster entry that stands in a bottom
   corner (side 1 = left, -1 = right), faces the camera and reacts. FT.chef is you (left); the buddy (js/buddy.js)
   is a second actor on the right. Reactions:
     slice (a little bounce), cheer (arms up), signature (the character's celebration: Tommy's Y, Teddy's
     jump shot or boxing combo), miss (a wobble), scare (a startled jump), hello, over (goodbye loop);
   act(pose, dur) plays any Kit pose for a moment. */
(function () {
  'use strict';
  const T = THREE;
  const FT = (window.FT = window.FT || {});
  const Kit = window.Kit;
  const rand = Kit.gfx.rand;

  const DUR = { cheer: 0.7, signature: 1.8, miss: 0.9, scare: 0.9, hello: 1.8, slice: 0 };
  const SPEED = { idle: 2.2, cheer: 6, boxing: 6, peace: 4.2, wave: 5, jumpshot: 3, fall: 3, jump: 3, run: 13, give: 6 };
  const BALL_SIZE = 0.24;

  const RIM = { y: -0.28, z: 0.42, r: 0.36 }; // rim centre relative to the backboard, in hoop units
  const SHOT_TIME = 0.75; // seconds from release to the rim

  function ballTexture() {
    const [c, g] = Kit.gfx.makeCanvas(256, 128);
    g.fillStyle = '#f07b1f';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#2a160a';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(256, 64);
    for (const x of [64, 192]) {
      g.moveTo(x, 0);
      g.lineTo(x, 128);
    }
    g.moveTo(128, 0);
    g.bezierCurveTo(90, 40, 90, 88, 128, 128);
    g.moveTo(0, 0);
    g.bezierCurveTo(38, 40, 38, 88, 0, 128);
    g.stroke();
    return Kit.gfx.toTexture(c);
  }

  function shadowTexture() {
    return Kit.gfx.radialTexture(128, [[0, 'rgba(20,10,0,0.55)'], [0.6, 'rgba(20,10,0,0.25)'], [1, 'rgba(20,10,0,0)']]);
  }

  // A pop-up basketball hoop for Teddy's jump shot: backboard, orange rim, white net.
  function buildHoop() {
    const g = new T.Group();
    const [c, x] = Kit.gfx.makeCanvas(160, 112);
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 160, 112);
    x.lineWidth = 8;
    x.strokeStyle = '#ff5a1f';
    x.strokeRect(6, 6, 148, 100);
    x.lineWidth = 6;
    x.strokeRect(52, 46, 56, 44);
    const white = Kit.gfx.std('#f4f4f4'), front = Kit.gfx.std('#ffffff', { map: Kit.gfx.toTexture(c) });
    g.add(new T.Mesh(new T.BoxGeometry(1.3, 0.9, 0.06), [white, white, white, white, front, white]));
    const orange = Kit.gfx.std('#ff5a1f', { roughness: 0.4, metalness: 0.3 });
    const bracket = new T.Mesh(new T.BoxGeometry(0.12, 0.06, RIM.z - RIM.r), orange);
    bracket.position.set(0, RIM.y, (RIM.z - RIM.r) / 2);
    g.add(bracket);
    const rim = new T.Mesh(new T.TorusGeometry(RIM.r, 0.035, 8, 28), orange);
    rim.rotation.x = Math.PI / 2 - 0.45; // nearly flat, tipped toward the camera so you can see the hoop
    rim.position.set(0, RIM.y, RIM.z);
    g.add(rim);
    const [nc, nx] = Kit.gfx.makeCanvas(128, 64);
    nx.strokeStyle = '#ffffff';
    nx.lineWidth = 3;
    for (let i = -8; i < 16; i++) {
      nx.beginPath();
      nx.moveTo(i * 16, 0);
      nx.lineTo(i * 16 + 64, 64);
      nx.moveTo(i * 16 + 64, 0);
      nx.lineTo(i * 16, 64);
      nx.stroke();
    }
    const net = new T.Mesh(
      new T.CylinderGeometry(RIM.r, RIM.r * 0.62, 0.42, 16, 1, true),
      new T.MeshBasicMaterial({ map: Kit.gfx.toTexture(nc), transparent: true, side: T.DoubleSide, depthWrite: false }),
    );
    net.rotation.x = -0.45;
    net.position.set(0, RIM.y - 0.2, RIM.z + 0.09);
    g.add(net);
    g.visible = false;
    return g;
  }

  function makeActor(side) {
    let scene = null, flyers = null, holder = null, p = null, entry = null, shadow = null, ball = null, hoop = null;
    const st = { mode: 'idle', pose: 'idle', t: 0, phase: 0, hopY: 0, hopV: 0, wob: 9, wobAmp: 0, sigIx: 0, beat: -1, loop: null, ballT: -1, look: 0, face: null, mul: 1 };
    const ballV = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), rimAt = new T.Vector3();
    const home = new T.Vector3();
    const facing = () => (st.face !== null ? st.face : Math.PI + 0.38 * side); // toward the camera, turned to the middle

    function showHoop() {
      const s = st.scale;
      hoop.position.set(holder.position.x + 2.7 * s * side, holder.position.y + 3.3 * s, holder.position.z + 0.2 * s);
      hoop.rotation.y = -0.25 * side;
      hoop.visible = true;
      st.hoopT = 0;
    }

    function init(sc, fl) {
      scene = sc;
      flyers = fl;
      holder = new T.Group();
      scene.add(holder);
      shadow = new T.Sprite(new T.SpriteMaterial({ map: shadowTexture(), depthWrite: false, transparent: true }));
      shadow.scale.set(1.5, 0.32, 1);
      shadow.position.set(0, 0.02, -0.4);
      holder.add(shadow);
      ball = new T.Mesh(new T.SphereGeometry(BALL_SIZE, 20, 14), Kit.gfx.std('#ffffff', { map: ballTexture(), roughness: 0.6 }));
      ball.visible = false;
      scene.add(ball);
      hoop = buildHoop();
      scene.add(hoop);
    }

    // Build the character for roster entry `id`; `mul` scales him (a buddy is smaller: entry.buddyScale).
    function set(id, mul = 1) {
      entry = Kit.roster.get(id) || Kit.roster.list[0];
      if (p) holder.remove(p.root);
      p = Kit.people.build(entry.look);
      p.root.rotation.y = facing();
      holder.add(p.root);
      st.mul = mul;
      st.sigIx = 0;
      st.mode = 'idle';
      st.loop = null;
      st.ballT = -1;
      ball.visible = hoop.visible = false;
      Kit.people.pose(p, 0, 'idle', 1);
      return entry;
    }

    // Stand in a bottom corner of the view rectangle `v` ({ W, H, z } at the actor's depth), keeping `reserve`
    // world units clear at that edge (the buddy leaves room for his button).
    function place(v, portrait, reserve = 0) {
      const h = portrait ? Math.min(v.H * 0.2, v.W * 0.42) : v.H * 0.3; // a full-size chef's height in world units
      const s = (h / 2.05) * st.mul;
      holder.scale.setScalar(s);
      home.set(-side * (v.W / 2 - reserve - 0.62 * s - v.W * 0.02), -v.H / 2 + 0.16 * s, v.z);
      holder.position.copy(home);
      st.scale = s;
    }

    // Start a reaction. Returns the pose used.
    function react(kind) {
      if (!p) return null;
      if (st.loop && kind !== 'hello' && kind !== 'idle') return st.pose; // game over: keep celebrating
      switch (kind) {
        case 'slice':
          if (st.mode === 'idle') st.hopV = Math.max(st.hopV, 1.6);
          return st.pose;
        case 'cheer':
          if (st.mode === 'signature') return st.pose;
          return begin('cheer', 'jump', DUR.cheer, 3.2);
        case 'signature': {
          if (st.mode === 'signature' && st.t > 0.5) return st.pose;
          const sig = entry.signature || ['wave'];
          const pose = sig[st.sigIx++ % sig.length];
          return begin('signature', pose, DUR.signature, hopFor(pose));
        }
        case 'hello':
          st.loop = null;
          return begin('signature', Kit.roster.signature(entry, 'hello'), DUR.hello, 2.6);
        case 'goodbye': {
          const pose = Kit.roster.signature(entry, 'goodbye');
          return begin('signature', pose, DUR.signature, hopFor(pose));
        }
        case 'miss':
          st.wob = 0;
          st.wobAmp = 0.22;
          if (st.mode === 'signature') return st.pose;
          return begin('miss', 'fall', DUR.miss, 0);
        case 'scare':
          st.wob = 0;
          st.wobAmp = 0.12;
          return begin('scare', 'jump', DUR.scare, 4.5);
        case 'over': {
          // goodbye pose first, then keep cycling the celebrations until the next game
          const sig = entry.signature || ['wave'];
          const pose = Kit.roster.signature(entry, 'goodbye');
          st.sigIx = sig.indexOf(pose) + 1;
          st.loop = true;
          st.loopWait = 0.8;
          return begin('signature', pose, DUR.signature, hopFor(pose));
        }
        case 'idle':
          st.loop = null;
          st.mode = 'idle';
          st.pose = 'idle';
          return 'idle';
      }
      return null;
    }

    // Play any Kit pose for `dur` seconds (the buddy's run, chop and hand-over), unless a celebration is on.
    function act(pose, dur, hop = 0, force = false) {
      if (!p || (!force && st.mode === 'signature' && st.t > 0.2)) return st.pose;
      if (st.mode === 'act' && st.pose === pose) {
        st.t = Math.max(st.t, dur); // already doing it: keep the cycle going
        return pose;
      }
      return begin('act', pose, dur, hop);
    }

    const hopFor = (pose) => (pose === 'jumpshot' ? 5.2 : pose === 'peace' ? 2.6 : 1.4);

    function begin(mode, pose, dur, hop) {
      st.mode = mode;
      st.pose = pose;
      st.t = dur;
      st.phase = 0;
      st.beat = -1;
      if (hop) st.hopV = hop;
      st.since = 0;
      st.bursts = 0;
      if (pose === 'jumpshot') {
        st.ballT = 0;
        st.swished = false;
        showHoop();
      }
      return pose;
    }

    function update(dt, lookX) {
      if (!p) return;
      st.t -= dt;
      if (st.mode !== 'idle' && st.t <= 0) {
        st.mode = 'idle';
        st.pose = 'idle';
      }
      if (st.loop && st.mode === 'idle') {
        st.loopWait -= dt;
        if (st.loopWait <= 0) {
          st.loopWait = 0.8;
          const sig = entry.signature || ['wave'];
          const pose = sig[st.sigIx++ % sig.length];
          begin('signature', pose, DUR.signature, hopFor(pose));
        }
      }
      st.phase += dt * (SPEED[st.pose] || 2.2);
      p.root.rotation.y += (facing() - p.root.rotation.y) * (1 - Math.exp(-10 * dt));
      Kit.people.pose(p, st.phase, st.pose, 1 - Math.exp(-14 * dt));
      // the chef stands still: tone the running stride of the celebration poses down to a little dance
      if (st.pose === 'peace' || st.pose === 'wave' || st.pose === 'idle' || st.pose === 'give') {
        p.legL.rotation.x *= 0.35;
        p.legR.rotation.x *= 0.35;
      }
      if (st.pose === 'idle') {
        const breathe = Math.sin(st.phase) * 0.03;
        p.armL.rotation.z = -0.08 - breathe;
        p.armR.rotation.z = 0.08 + breathe;
      }
      // hop
      st.hopV -= 14 * dt;
      st.hopY = Math.max(0, st.hopY + st.hopV * dt);
      if (st.hopY === 0 && st.hopV < 0) st.hopV = 0;
      p.root.position.y = st.hopY;
      shadow.material.opacity = 1 / (1 + st.hopY * 1.5);
      // wobble after a miss or a scare
      st.wob += dt;
      holder.rotation.z = st.wobAmp * Math.sin(st.wob * 17) * Math.exp(-st.wob * 3.2);
      // head follows the fruit (lookX: -1 left .. 1 right of the chef)
      st.look += ((lookX || 0) * 0.55 - st.look) * (1 - Math.exp(-5 * dt));
      p.head.rotation.y = st.look;

      holder.updateMatrixWorld(true);
      // boxing: a POW at each punch
      if (st.pose === 'boxing') {
        const beat = Math.floor((((st.phase / (Math.PI * 2)) % 1) + 1) % 1 * 4);
        if (beat !== st.beat) {
          st.beat = beat;
          if (beat === 0 || beat === 2) {
            FT.sfx.kit('punch');
            // the jab is the lead (left) hand, the straight the right
            Kit.people.handWorld(p, beat === 0 ? -1 : 1, tmp);
            flyers.add('💥', tmp.x + 0.25 * st.scale * side, tmp.y, tmp.z + 0.6, rand(0.5, 1.2), rand(0.4, 1), 0.6 * st.scale, 0.45, 0, 0);
          }
        }
      }
      // the Y pose: ✌️ and stars float up from both hands, three little bursts
      st.since += dt;
      if (st.pose === 'peace' && st.bursts < 3 && st.since > 0.15 + st.bursts * 0.55) {
        st.bursts++;
        for (const side of [-1, 1]) {
          Kit.people.handWorld(p, side, tmp);
          flyers.add(Math.random() < 0.7 ? '✌️' : '⭐', tmp.x, tmp.y, tmp.z + 0.6, side * rand(0.3, 0.9), rand(1.6, 2.6), rand(0.45, 0.6) * st.scale, 1.1, rand(-1, 1), 0.15);
        }
      }
      updateBall(dt);
    }

    // Teddy's jump shot: the ball rides up in his hands, leaves them at the top of the jump, drops through the hoop.
    function updateBall(dt) {
      if (hoop.visible) {
        st.hoopT += dt;
        const k = st.hoopT < 0.25 ? st.hoopT / 0.25 : st.hoopT > 2.2 ? Math.max(0, 1 - (st.hoopT - 2.2) / 0.25) : 1;
        hoop.scale.setScalar(st.scale * (k < 1 ? k * (1.25 - 0.25 * k) : 1));
        if (st.hoopT > 2.45) hoop.visible = false;
      }
      if (st.ballT < 0) return;
      st.ballT += dt;
      const s = st.scale, g = 9 * s;
      ball.scale.setScalar(s);
      hoop.updateMatrixWorld(true);
      rimAt.set(0, RIM.y, RIM.z).applyMatrix4(hoop.matrixWorld);
      if (st.ballT < 0.38) {
        Kit.people.handWorld(p, -1, tmp);
        Kit.people.handWorld(p, 1, tmp2);
        ball.position.copy(tmp).add(tmp2).multiplyScalar(0.5);
        ball.position.y += BALL_SIZE * s;
        ball.position.z = rimAt.z;
        ball.visible = true;
        // aim: reach the rim centre (a ball-radius above it) SHOT_TIME seconds after release
        ballV.set((rimAt.x - ball.position.x) / SHOT_TIME, (rimAt.y + BALL_SIZE * s * 0.5 - ball.position.y) / SHOT_TIME + 0.5 * g * SHOT_TIME, 0);
      } else {
        ballV.y -= g * dt;
        ball.position.addScaledVector(ballV, dt);
        ball.rotation.z -= 6 * dt;
        if (!st.swished && st.ballT > 0.38 + SHOT_TIME) {
          st.swished = true;
          ballV.x *= 0.15; // the net catches it
          ballV.y *= 0.5;
          FT.sfx.kit('swish');
          if (actor.onSwish) actor.onSwish(rimAt);
        }
        if (st.ballT > 2.3) {
          ball.visible = false;
          st.ballT = -1;
        }
      }
    }

    const actor = {
      init, set, place, react, act, update,
      onSwish: null,
      home,
      get entry() { return entry; },
      get person() { return p; },
      get mode() { return st.mode; },
      get pose() { return st.pose; },
      get root() { return holder; },
      get scale() { return st.scale; },
      // turn to face a direction (radians, as root.rotation.y), or null to face the camera again
      set face(a) { st.face = a; },
      set visible(v) { holder.visible = v; if (!v) { ball.visible = false; hoop.visible = false; st.ballT = -1; } },
      get visible() { return holder.visible; },
    };
    return actor;
  }

  FT.makeActor = makeActor;
  FT.chef = makeActor(1);
})();
