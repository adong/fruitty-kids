/* Fruit Teddy — juice, splats, sparkles and the 2D overlay (blade trail, floating score, missed-fruit marks). */
(function () {
  'use strict';
  const T = THREE;
  const FT = (window.FT = window.FT || {});
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------------------------------------------------------------- particles (one Points object, a pool)

  const VS = `
    attribute float size; attribute float alpha; attribute vec3 tint;
    uniform float scale;
    varying float vAlpha; varying vec3 vTint;
    void main() {
      vAlpha = alpha; vTint = tint;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * scale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const FS = `
    uniform sampler2D map;
    varying float vAlpha; varying vec3 vTint;
    void main() {
      vec4 t = texture2D(map, gl_PointCoord);
      gl_FragColor = vec4(vTint * t.rgb, t.a * vAlpha);
    }`;

  function dotTexture() {
    const [c, g] = FT.fruits.canvas(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.75, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }

  function makeParticles(n) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3), tint = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('tint', new T.BufferAttribute(tint, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('size', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('alpha', new T.BufferAttribute(alpha, 1).setUsage(T.DynamicDrawUsage));
    const mat = new T.ShaderMaterial({
      uniforms: { map: { value: dotTexture() }, scale: { value: 500 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    });
    const obj = new T.Points(geo, mat);
    obj.frustumCulled = false;
    obj.renderOrder = 5;
    const P = {
      obj, n, next: 0, live: 0,
      vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), size0: new Float32Array(n),
      grav: new Float32Array(n), drag: new Float32Array(n), grow: new Float32Array(n),
    };
    // all colours here are sRGB, written straight to the screen
    P.emit = function (x, y, z, vx, vy, vz, color, sz, life, grav = 1, drag = 0.6, grow = 0) {
      const i = P.next;
      P.next = (P.next + 1) % n;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
      tint[i * 3] = color.r; tint[i * 3 + 1] = color.g; tint[i * 3 + 2] = color.b;
      P.size0[i] = sz; size[i] = sz; alpha[i] = 1;
      P.life[i] = life; P.max[i] = life; P.grav[i] = grav; P.drag[i] = drag; P.grow[i] = grow;
    };
    P.update = function (dt, g) {
      for (let i = 0; i < n; i++) {
        if (P.life[i] <= 0) continue;
        P.life[i] -= dt;
        if (P.life[i] <= 0) {
          alpha[i] = 0;
          continue;
        }
        const k = Math.exp(-P.drag[i] * dt);
        P.vel[i * 3] *= k;
        P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * k - g * P.grav[i] * dt;
        P.vel[i * 3 + 2] *= k;
        pos[i * 3] += P.vel[i * 3] * dt;
        pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
        const f = P.life[i] / P.max[i];
        alpha[i] = Math.min(1, f * 2.2);
        size[i] = P.size0[i] * (1 + P.grow[i] * (1 - f));
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.tint.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
    };
    P.clear = function () {
      P.life.fill(0);
      alpha.fill(0);
      geo.attributes.alpha.needsUpdate = true;
    };
    return P;
  }

  // ---------------------------------------------------------------- splats on the wall

  function splatTexture() {
    const [c, g] = FT.fruits.canvas(256, 256);
    g.fillStyle = '#fff';
    const blob = (cx, cy, r, lumps) => {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        let rr = r;
        for (const [f, amp, ph] of lumps) rr += Math.sin(a * f + ph) * amp;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.fill();
    };
    blob(128, 118, 58, [[5, 9, 0.3], [9, 5, 1.2], [3, 6, 2.1]]);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = rand(70, 110);
      g.beginPath();
      g.arc(128 + Math.cos(a) * d, 118 + Math.sin(a) * d * 0.9, rand(4, 11), 0, Math.PI * 2);
      g.fill();
    }
    for (const [x, w, len] of [[104, 9, 70], [140, 7, 95], [160, 6, 55]]) {
      g.fillRect(x - w / 2, 150, w, len);
      g.beginPath();
      g.arc(x, 150 + len, w * 0.85, 0, Math.PI * 2);
      g.fill();
    }
    return new T.CanvasTexture(c);
  }

  function makeSplats(n, z) {
    const tex = splatTexture();
    const geo = new T.PlaneGeometry(1, 1);
    const list = [];
    const group = new T.Group();
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      m.visible = false;
      m.position.z = z;
      m.renderOrder = -5;
      group.add(m);
      list.push({ m, t: 0, life: 0 });
    }
    let next = 0;
    return {
      group,
      add(x, y, size, color) {
        const s = list[next];
        next = (next + 1) % n;
        s.m.visible = true;
        s.m.position.set(x, y, z);
        s.m.rotation.z = rand(-0.5, 0.5);
        s.m.scale.set(size, size, 1);
        s.m.material.color.set(color);
        s.t = 0;
        s.life = 2.6;
      },
      update(dt) {
        for (const s of list) {
          if (!s.m.visible) continue;
          s.t += dt;
          s.m.material.opacity = 0.85 * Math.min(1, Math.max(0, (s.life - s.t) / 1.2));
          if (s.t >= s.life) s.m.visible = false;
        }
      },
      clear() { list.forEach((s) => { s.m.visible = false; }); },
    };
  }

  // ---------------------------------------------------------------- 2D overlay: blade trails and floating text

  function makeOverlay(canvas) {
    const g = canvas.getContext('2d');
    let w = 1, h = 1, dpr = 1;
    const texts = [], marks = [];
    const ov = {
      resize(cw, ch, ratio) {
        w = cw; h = ch; dpr = ratio;
        canvas.width = Math.round(cw * ratio);
        canvas.height = Math.round(ch * ratio);
      },
      text(txt, x, y, opts = {}) {
        texts.push({ txt, x, y, t: 0, life: opts.life || 0.9, color: opts.color || '#ffd400', size: opts.size || 34 });
      },
      miss(x) {
        marks.push({ x, t: 0 });
      },
      clear() { texts.length = 0; marks.length = 0; },
      draw(strokes, now, dt) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        for (const s of strokes) drawBlade(s, now);
        for (let i = marks.length - 1; i >= 0; i--) {
          const m = marks[i];
          m.t += dt;
          if (m.t > 1.3) { marks.splice(i, 1); continue; }
          const a = Math.min(1, (1.3 - m.t) / 0.5), sc = m.t < 0.15 ? 0.5 + m.t / 0.3 : 1, r = 20 * sc;
          const x = Math.min(w - 30, Math.max(30, m.x)), y = h - 46 - m.t * 10;
          g.globalAlpha = a;
          g.lineCap = 'round';
          g.strokeStyle = '#14121f';
          g.lineWidth = 15;
          xMark(x, y, r);
          g.strokeStyle = '#ff4b4b';
          g.lineWidth = 9;
          xMark(x, y, r);
          g.globalAlpha = 1;
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (let i = texts.length - 1; i >= 0; i--) {
          const t = texts[i];
          t.t += dt;
          if (t.t > t.life) { texts.splice(i, 1); continue; }
          const k = t.t / t.life, pop = t.t < 0.12 ? 0.5 + (t.t / 0.12) * 0.7 : 1.2 - Math.min(0.2, (t.t - 0.12) * 1.5);
          g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
          g.font = `${Math.round(t.size * pop)}px Bungee, 'Arial Black', Impact, sans-serif`;
          const y = t.y - k * 46;
          g.lineJoin = 'round';
          g.lineWidth = 7;
          g.strokeStyle = '#14121f';
          g.strokeText(t.txt, t.x, y);
          g.fillStyle = t.color;
          g.fillText(t.txt, t.x, y);
          g.globalAlpha = 1;
        }
      },
    };
    function xMark(x, y, r) {
      g.beginPath();
      g.moveTo(x - r, y - r);
      g.lineTo(x + r, y + r);
      g.moveTo(x + r, y - r);
      g.lineTo(x - r, y + r);
      g.stroke();
    }
    const LIFE = 0.16;
    function drawBlade(s, now) {
      const pts = s.pts;
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      if (pts.length < 2) return;
      const n = pts.length, L = [], R = [];
      const maxW = s.width || 16;
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let nx = -(b.y - a.y), ny = b.x - a.x;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len; ny /= len;
        const age = (now - pts[i].t) / LIFE;
        const wv = maxW * Math.pow(i / (n - 1), 0.7) * Math.max(0, 1 - age * 0.6) * 0.5;
        L.push([pts[i].x + nx * wv, pts[i].y + ny * wv]);
        R.push([pts[i].x - nx * wv, pts[i].y - ny * wv]);
      }
      // the ribbon: left edge tail→head, a round cap, right edge head→tail; `scale` thins it for the white core
      const poly = (scale) => {
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const x = pts[i].x + (L[i][0] - pts[i].x) * scale, y = pts[i].y + (L[i][1] - pts[i].y) * scale;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        const head = pts[n - 1], hr = Math.hypot(L[n - 1][0] - head.x, L[n - 1][1] - head.y) * scale;
        const a0 = Math.atan2(L[n - 1][1] - head.y, L[n - 1][0] - head.x);
        g.arc(head.x, head.y, hr, a0, a0 + Math.PI, true); // through the forward side
        for (let i = n - 1; i >= 0; i--) {
          g.lineTo(pts[i].x + (R[i][0] - pts[i].x) * scale, pts[i].y + (R[i][1] - pts[i].y) * scale);
        }
        g.closePath();
        g.fill();
      };
      g.save();
      g.shadowColor = s.color || '#18d4ff';
      g.shadowBlur = 18;
      g.fillStyle = s.color || '#18d4ff';
      poly(1.6);
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      poly(0.75);
      g.restore();
    }
    return ov;
  }

  // ---------------------------------------------------------------- textures made from emoji (snowflakes, stars)

  const emojiCache = {};
  function emojiTexture(e) {
    if (window.Kit && Kit.gfx && Kit.gfx.emojiTexture) return Kit.gfx.emojiTexture(e);
    if (emojiCache[e]) return emojiCache[e];
    const [c, g] = FT.fruits.canvas(128, 128);
    g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, 64, 72);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    emojiCache[e] = t;
    return t;
  }

  // Sprites that fly out and fade (stars from a zombie poof, snowflakes from a freeze bubble, ✌️ from Tommy).
  function makeFlyers(scene) {
    const list = [];
    return {
      add(emoji, x, y, z, vx, vy, size, life, spin = 0, grav = 0.3) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false }));
        sp.position.set(x, y, z);
        sp.scale.set(size, size, 1);
        sp.renderOrder = 6;
        scene.add(sp);
        list.push({ sp, vx, vy, t: 0, life, size, spin, grav });
      },
      update(dt, g) {
        for (let i = list.length - 1; i >= 0; i--) {
          const f = list[i];
          f.t += dt;
          if (f.t >= f.life) {
            scene.remove(f.sp);
            f.sp.material.dispose();
            list.splice(i, 1);
            continue;
          }
          f.vy -= g * f.grav * dt;
          f.sp.position.x += f.vx * dt;
          f.sp.position.y += f.vy * dt;
          f.sp.material.rotation += f.spin * dt;
          const k = f.t / f.life;
          f.sp.material.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
          const s = f.size * (k < 0.15 ? 0.4 + k * 4 : 1);
          f.sp.scale.set(s, s, 1);
        }
      },
      clear() {
        list.forEach((f) => { scene.remove(f.sp); f.sp.material.dispose(); });
        list.length = 0;
      },
    };
  }

  FT.fx = { makeParticles, makeSplats, makeOverlay, makeFlyers, emojiTexture };
})();
