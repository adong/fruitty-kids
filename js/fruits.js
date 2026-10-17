/* Fruit Teddy — fruit, zombie heads and freeze bubbles, built from primitives and canvas textures.
   A fruit is a list of parts. A whole fruit renders only its skins. A half reuses the same geometry with every
   material clipped by the cut plane, plus back-face "flesh" meshes: looking into the open half you see the inside
   of the far wall in flat flesh colour, which reads as a solid cut face. A smaller inner shell adds a rind ring. */
(function () {
  'use strict';
  const T = THREE;
  const FT = (window.FT = window.FT || {});
  const rand = (a, b) => a + Math.random() * (b - a);

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
  }
  function tex(c) {
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0 }, o));

  // ---------------------------------------------------------------- skins (equirectangular for spheres, u = around)

  function speckle(g, w, h, n, colors, rMin, rMax) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, rand(rMin, rMax), rand(rMin, rMax), 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  function melonSkin() {
    const [c, g] = canvas(512, 256);
    g.fillStyle = '#8cc152';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#2f6b2a';
    for (let k = 0; k < 10; k++) {
      const x0 = k * 51.2 + 10;
      g.beginPath();
      g.moveTo(x0, 0);
      for (let y = 0; y <= 256; y += 16) g.lineTo(x0 - 13 - Math.random() * 6 + Math.sin(y * 0.09) * 3, y);
      for (let y = 256; y >= 0; y -= 16) g.lineTo(x0 + 13 + Math.random() * 6 + Math.sin(y * 0.09) * 3, y);
      g.fill();
    }
    speckle(g, 512, 256, 160, ['rgba(255,255,255,0.08)', 'rgba(0,40,0,0.12)'], 1, 3);
    return tex(c);
  }

  function seededFlesh(base, seed, n) {
    const [c, g] = canvas(256, 128);
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, base);
    grd.addColorStop(0.5, base);
    grd.addColorStop(1, base);
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = seed;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 256, y = 30 + Math.random() * 68;
      g.save();
      g.translate(x, y);
      g.rotate(Math.random() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, 2.2, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    return tex(c);
  }

  function orangeSkin() {
    const [c, g] = canvas(256, 128);
    g.fillStyle = '#fb8c00';
    g.fillRect(0, 0, 256, 128);
    speckle(g, 256, 128, 900, ['#ffa22e', '#e67700', '#ffb347'], 0.6, 1.4);
    return tex(c);
  }

  function appleSkin(base = '#e2302b') {
    const [c, g] = canvas(256, 128);
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#c62828');
    grd.addColorStop(0.35, base);
    grd.addColorStop(1, '#a31515');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
    g.globalAlpha = 0.25;
    g.strokeStyle = '#ffb36b';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256;
      g.lineWidth = rand(1, 3);
      g.beginPath();
      g.moveTo(x, 128 * 0.25);
      g.lineTo(x + rand(-4, 4), 128 * rand(0.5, 0.85));
      g.stroke();
    }
    g.globalAlpha = 1;
    speckle(g, 256, 128, 70, ['rgba(255,240,200,0.5)'], 0.6, 1.1);
    return tex(c);
  }

  function pineSkin() {
    const [c, g] = canvas(512, 256);
    g.fillStyle = '#6e4314';
    g.fillRect(0, 0, 512, 256);
    const cw = 32, ch = 26;
    for (let j = -1; j <= 256 / ch + 1; j++) {
      for (let i = -1; i <= 512 / cw + 1; i++) {
        const x = i * cw + (j % 2 ? cw / 2 : 0), y = j * ch;
        const grd = g.createRadialGradient(x, y - 3, 2, x, y, cw * 0.55);
        grd.addColorStop(0, '#ffd166');
        grd.addColorStop(0.7, '#e0a030');
        grd.addColorStop(1, '#b8781c');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(x, y - ch * 0.47);
        g.lineTo(x + cw * 0.46, y);
        g.lineTo(x, y + ch * 0.47);
        g.lineTo(x - cw * 0.46, y);
        g.closePath();
        g.fill();
        g.fillStyle = '#7a8f2a';
        g.beginPath();
        g.arc(x, y + 2, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    return tex(c);
  }

  function berrySkin() {
    const [c, g] = canvas(256, 256);
    const grd = g.createLinearGradient(0, 256, 0, 0);
    grd.addColorStop(0, '#d81b2c');
    grd.addColorStop(0.7, '#ec2a3f');
    grd.addColorStop(1, '#c2182a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 12; col++) {
        const x = col * 21.3 + (row % 2 ? 10.6 : 0), y = 14 + row * 17;
        g.fillStyle = 'rgba(120,0,10,0.45)';
        g.beginPath();
        g.ellipse(x, y + 1, 3.2, 4.2, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffe36e';
        g.beginPath();
        g.ellipse(x, y, 1.5, 2.6, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return tex(c);
  }

  function bananaSkin() {
    const [c, g] = canvas(256, 64);
    const grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, '#4e342e');
    grd.addColorStop(0.05, '#8d6e2a');
    grd.addColorStop(0.12, '#ffd740');
    grd.addColorStop(0.88, '#ffe04a');
    grd.addColorStop(0.95, '#b8a030');
    grd.addColorStop(1, '#5d4a1e');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = 'rgba(200,150,0,0.35)';
    g.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.moveTo(20, k * 12.8 + 6);
      g.lineTo(236, k * 12.8 + 6);
      g.stroke();
    }
    speckle(g, 256, 64, 14, ['rgba(110,70,20,0.55)'], 1, 2);
    return tex(c);
  }

  // ---------------------------------------------------------------- geometry helpers

  const SPHERE = new T.SphereGeometry(1, 30, 20);
  const lathe = (pts, seg = 28) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);

  // A curved tube that tapers to points at both ends (the banana).
  function taperedArc(len, bend, rMax, n = 26, m = 12) {
    const span = bend, R = len / (2 * Math.sin(span / 2));
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (t - 0.5) * span;
      const cx = R * Math.sin(a), cy = -R * Math.cos(a) + (R + R * Math.cos(span / 2)) / 2;
      const nx = -Math.sin(a), ny = Math.cos(a); // in-plane normal, pointing to the inside of the curve
      const rr = rMax * Math.pow(Math.sin(Math.PI * t), 0.6) + 0.015;
      for (let j = 0; j <= m; j++) {
        const th = (j / m) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const ox = nx * cs, oy = ny * cs, oz = sn;
        pos.push(cx + ox * rr, cy + oy * rr, oz * rr);
        nor.push(ox, oy, oz);
        uv.push(t, j / m);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const a = i * (m + 1) + j, b = a + m + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }

  function star(points, rOut, rIn) {
    const s = new T.Shape();
    for (let i = 0; i <= points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2, r = i % 2 ? rIn : rOut;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new T.ShapeGeometry(s);
  }

  // ---------------------------------------------------------------- the fruit table

  // part: { geo, mat, pos, rot, scl, role: 'skin' | 'leaf' | 'stem', back: flesh colour, inner: { s, color, map } }
  function defineFruits() {
    const leaf = std('#43a047', { roughness: 0.6, side: T.DoubleSide });
    const leafDark = std('#2e7d32', { roughness: 0.6, side: T.DoubleSide });
    const stem = std('#6d4c2a', { roughness: 0.9 });
    const fruits = {};

    fruits.watermelon = {
      r: 1.05, juice: '#ff3b5c', emoji: '🍉',
      parts: [{
        geo: SPHERE, mat: std('#ffffff', { map: melonSkin(), roughness: 0.42 }), scl: [1, 1.22, 1], role: 'skin',
        back: '#eef7c4', inner: { s: 0.86, color: '#ffffff', map: seededFlesh('#ff4f6d', '#2a1712', 26) },
      }],
    };
    fruits.orange = {
      r: 0.8, juice: '#ffa000', emoji: '🍊',
      parts: [
        { geo: SPHERE, mat: std('#ffffff', { map: orangeSkin(), roughness: 0.7 }), scl: [0.8, 0.78, 0.8], role: 'skin', back: '#fff1d0', inner: { s: 0.88, color: '#ffa726' } },
        { geo: new T.CylinderGeometry(0.06, 0.08, 0.1, 8), mat: leafDark, pos: [0, 0.65, 0], role: 'stem' },
        { geo: SPHERE, mat: leaf, pos: [0.16, 0.68, 0], rot: [0, 0, -0.5], scl: [0.2, 0.05, 0.11], role: 'leaf' },
      ],
    };
    fruits.apple = {
      r: 0.8, juice: '#fff2a8', emoji: '🍎',
      parts: [
        {
          geo: lathe([[0, -0.66], [0.28, -0.7], [0.56, -0.6], [0.76, -0.36], [0.84, -0.03], [0.8, 0.28], [0.66, 0.54], [0.42, 0.68], [0.18, 0.62], [0.05, 0.5], [0, 0.48]]),
          mat: std('#ffffff', { map: appleSkin(), roughness: 0.32 }), role: 'skin', back: '#fff6dc', inner: { s: 0.2, color: '#c9a66b' },
        },
        { geo: new T.CylinderGeometry(0.035, 0.05, 0.36, 6), mat: stem, pos: [0.03, 0.62, 0], rot: [0, 0, -0.2], role: 'stem' },
        { geo: SPHERE, mat: leaf, pos: [0.2, 0.74, 0], rot: [0, 0.3, -0.45], scl: [0.22, 0.05, 0.11], role: 'leaf' },
      ],
    };
    fruits.banana = {
      r: 0.95, juice: '#fff4b8', emoji: '🍌',
      parts: [
        { geo: taperedArc(2.3, 1.7, 0.3), mat: std('#ffffff', { map: bananaSkin(), roughness: 0.5 }), role: 'skin', back: '#fff8de' },
        { geo: new T.CylinderGeometry(0.05, 0.07, 0.24, 6), mat: stem, pos: [1.2, 0.33, 0], rot: [0, 0, -0.72], role: 'stem' },
      ],
    };
    const crown = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, tilt = i % 2 ? 0.55 : 0.25, h = i % 2 ? 0.75 : 0.95;
      crown.push({
        geo: new T.ConeGeometry(0.13, h, 4), mat: i % 3 ? leaf : leafDark, role: 'leaf',
        pos: [Math.cos(a) * 0.12, 0.92 + h * 0.42, Math.sin(a) * 0.12],
        rot: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt], scl: [1, 1, 0.35],
      });
    }
    fruits.pineapple = {
      r: 0.95, juice: '#ffdf3a', emoji: '🍍',
      parts: [
        { geo: SPHERE, mat: std('#ffffff', { map: pineSkin(), roughness: 0.75 }), scl: [0.72, 0.98, 0.72], role: 'skin', back: '#ffe680', inner: { s: 0.3, color: '#fff3b8' } },
        ...crown,
      ],
    };
    fruits.strawberry = {
      r: 0.72, juice: '#ff2448', emoji: '🍓',
      parts: [
        {
          geo: lathe([[0, -0.82], [0.16, -0.74], [0.36, -0.5], [0.54, -0.16], [0.62, 0.14], [0.6, 0.36], [0.48, 0.54], [0.25, 0.62], [0, 0.62]]),
          mat: std('#ffffff', { map: berrySkin(), roughness: 0.38 }), role: 'skin', back: '#ff5a72', inner: { s: 0.55, color: '#ffd6dc' },
        },
        { geo: star(6, 0.42, 0.14), mat: leaf, pos: [0, 0.6, 0], rot: [-Math.PI / 2 + 0.12, 0, 0], role: 'leaf' },
        { geo: new T.CylinderGeometry(0.03, 0.04, 0.22, 6), mat: leafDark, pos: [0, 0.72, 0], role: 'stem' },
      ],
    };
    for (const id in fruits) {
      fruits[id].id = id;
      fruits[id].parts.forEach((p) => { p.geo.computeBoundingSphere(); });
    }
    return fruits;
  }

  function place(mesh, p, innerScale = 1) {
    if (p.pos) mesh.position.fromArray(p.pos);
    if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    const s = p.scl || [1, 1, 1];
    mesh.scale.set(s[0] * innerScale, s[1] * innerScale, s[2] * innerScale);
    return mesh;
  }

  let FRUITS = null, GOLD = null, GOLD_LEAF = null;
  const FLESH_GOLD = '#ffe7a0';

  function wholeFruit(def, golden) {
    const g = new T.Group();
    for (const p of def.parts) {
      let mat = p.mat;
      if (golden && p.role === 'skin') mat = GOLD;
      else if (golden) mat = GOLD_LEAF;
      g.add(place(new T.Mesh(p.geo, mat), p));
    }
    return g;
  }

  // One half of a sliced fruit. `plane` is a THREE.Plane shared by every material of this half; the game
  // re-aims it each frame from `local` (the cut plane in the fruit's own space) as the half tumbles.
  function halfFruit(def, golden, plane) {
    const g = new T.Group(), mats = [];
    const clip = (m) => {
      const c = m.clone();
      c.clippingPlanes = [plane];
      mats.push(c);
      return c;
    };
    const basic = (color, map) => {
      const m = new T.MeshBasicMaterial({ color, map: map || null, side: T.BackSide, clippingPlanes: [plane] });
      mats.push(m);
      return m;
    };
    for (const p of def.parts) {
      const front = golden ? (p.role === 'skin' ? GOLD : GOLD_LEAF) : p.mat;
      g.add(place(new T.Mesh(p.geo, clip(front)), p));
      if (p.back) g.add(place(new T.Mesh(p.geo, basic(golden ? FLESH_GOLD : p.back)), p));
      if (p.inner) g.add(place(new T.Mesh(p.geo, basic(golden ? '#ffd24a' : p.inner.color, golden ? null : p.inner.map)), p, p.inner.s));
    }
    return { obj: g, mats };
  }

  // ---------------------------------------------------------------- zombie head (placeholder until the kit lands)

  let zombieMaker = null;
  function placeholderZombie() {
    const g = new T.Group();
    const skin = std('#8bc34a', { roughness: 0.7 });
    const head = new T.Mesh(new T.BoxGeometry(1.3, 1.3, 1.2), skin);
    g.add(head);
    const eyeW = new T.MeshBasicMaterial({ color: '#fffde0' }), pupil = new T.MeshBasicMaterial({ color: '#ff3d00' });
    for (const s of [-1, 1]) {
      const e = new T.Mesh(new T.BoxGeometry(0.34, 0.3, 0.05), eyeW);
      e.position.set(0.3 * s, 0.15, 0.62);
      const p = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.05), pupil);
      p.position.set(0.3 * s, 0.13, 0.65);
      g.add(e, p);
    }
    const mouth = new T.Mesh(new T.BoxGeometry(0.6, 0.12, 0.05), new T.MeshBasicMaterial({ color: '#33261f' }));
    mouth.position.set(0, -0.32, 0.62);
    g.add(mouth);
    const hair = new T.Mesh(new T.BoxGeometry(1.36, 0.25, 1.25), std('#3e2b20'));
    hair.position.y = 0.7;
    g.add(hair);
    return g;
  }

  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    glowTex = tex(c);
    return glowTex;
  }

  function zombie() {
    const g = new T.Group();
    const head = zombieMaker ? zombieMaker() : placeholderZombie();
    g.add(head);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: '#9cff57', transparent: true, opacity: 0.55, depthWrite: false }));
    halo.scale.set(2.9, 2.9, 1);
    halo.position.z = -0.8;
    halo.renderOrder = -1;
    g.add(halo);
    g.userData.head = head;
    g.userData.halo = halo;
    return g;
  }

  // ---------------------------------------------------------------- freeze bubble with a face inside

  const bubbleMat = () => new T.MeshStandardMaterial({
    color: '#bfe9ff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false,
    emissive: '#6fc8ff', emissiveIntensity: 0.25,
  });
  let rimTex = null;
  function rimTexture() {
    if (rimTex) return rimTex;
    const [c, g] = canvas(256, 256);
    const grd = g.createRadialGradient(128, 128, 90, 128, 128, 128);
    grd.addColorStop(0, 'rgba(200,240,255,0)');
    grd.addColorStop(0.75, 'rgba(200,240,255,0.55)');
    grd.addColorStop(0.92, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(84, 70, 22, 12, -0.7, 0, Math.PI * 2);
    g.fill();
    rimTex = tex(c);
    return rimTex;
  }

  function bubble(faceTexture, label) {
    const g = new T.Group();
    const R = 1.15;
    const ball = new T.Mesh(SPHERE, bubbleMat());
    ball.scale.setScalar(R);
    g.add(ball);
    if (faceTexture) {
      const face = new T.Sprite(new T.SpriteMaterial({ map: faceTexture, transparent: true }));
      face.scale.set(1.7, 1.7, 1);
      g.add(face);
    }
    const rim = new T.Sprite(new T.SpriteMaterial({ map: rimTexture(), transparent: true, depthWrite: false }));
    rim.scale.set(R * 2.15, R * 2.15, 1);
    rim.renderOrder = 2;
    g.add(rim);
    g.userData.label = label;
    return g;
  }

  // ---------------------------------------------------------------- public

  FT.fruits = {
    init() {
      FRUITS = defineFruits();
      GOLD = std('#ffc21a', { roughness: 0.28, metalness: 0.45, emissive: '#8a5a00', emissiveIntensity: 0.55 });
      GOLD_LEAF = std('#ffdf6b', { roughness: 0.3, metalness: 0.4, emissive: '#6b4a00', emissiveIntensity: 0.4, side: T.DoubleSide });
      FT.fruits.types = Object.keys(FRUITS);
      FT.fruits.defs = FRUITS;
    },
    whole: (id, golden) => wholeFruit(FRUITS[id], golden),
    half: (id, golden, plane) => halfFruit(FRUITS[id], golden, plane),
    zombie,
    bubble,
    glowTexture,
    setZombieMaker(fn) { zombieMaker = fn; },
    canvas,
    tex,
  };
})();
