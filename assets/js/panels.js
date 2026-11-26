/* Start cards: a thermal lens follows the pointer inside each card, the photo
   drifts a little against it, and the cards rise in when the page opens. */
(() => {
  'use strict';
  const panels = [...document.querySelectorAll('.panel')];
  if (!panels.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const animate = typeof window.gsap !== 'undefined' && !reduce;

  // Temperature range per scene (°C). Colours and readings come from the same heat map.
  const RANGE = { outdoor: [-2, 36], building: [-4, 22], industry: [20, 88], fire: [14, 260] };

  const inR = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  // the glass in the building photo (fractions of the photo: left, top, right, bottom)
  const BUILDING_GLASS = [
    [0.428, 0.326, 0.588, 0.469], [0.413, 0.569, 0.599, 0.748], [0.42, 0.897, 0.566, 0.946], // the house: big window, sliding doors, basement
    [0.102, 0.408, 0.286, 0.576], [0.104, 0.657, 0.287, 0.8], [0.19, 0.278, 0.24, 0.311], // the neighbour on the left
    [0.648, 0.39, 0.672, 0.449], [0.727, 0.384, 0.744, 0.435], [0.856, 0.359, 0.89, 0.421], [0.928, 0.362, 0.949, 0.421], // houses on the right
  ];

  const BUILDING_BARS = [0.559, 0.48, 0.539]; // upright frame bars in the big window and the sliding doors

  // How warm each pixel is, per scene: animals and lit windows warm, fog and sky cold.
  const HEAT = {
    // backlit deer in fog: the dark silhouettes are the warm bodies, the bright fog is cold air
    outdoor: (r, g, b, lum) => Math.min(1, Math.max(0, (0.78 - lum) * 2.1 + 0.08)),
    // house at dusk, seen as a thermographer would: glass does not let heat through, it reflects the cold
    // evening sky, so the lit windows read cool and you cannot see into the rooms. Heat leaks at the
    // frames, the lintel and the floor slab; the wall lamps are the only hot spots; light on a wall is not heat.
    building: (r, g, b, lum, u, v) => {
      for (const w of BUILDING_GLASS) {
        if (!inR(u, v, w)) continue;
        const du = Math.min(u - w[0], w[2] - u); const dv = Math.min(v - w[1], w[3] - v);
        if (du < 0.006 || dv < 0.009) return v - w[1] < 0.009 ? 0.62 : 0.54; // frame and seal: warm air escapes, most at the top
        if (BUILDING_BARS.some((x) => Math.abs(u - x) < 0.003)) return 0.5; // the frame bars between the panes
        return 0.17 + 0.07 * ((v - w[1]) / (w[3] - w[1])); // glass: the sky above reflects colder than the deck below
      }
      let h;
      if ((v < 0.24 && lum > 0.3) || (v < 0.32 && b > r * 1.05 && g < r && lum > 0.3)) h = 0.03 + lum * 0.05; // clear sky, very cold
      else if (g > r * 1.02 && g > b) h = 0.29 + lum * 0.04; // plants: air temperature
      else if (lum < 0.22) h = 0.3; // trees, shadows, roofs at dusk
      else h = 0.37 + lum * 0.06; // walls: mild, evenly warm whether lit or not
      if (h > 0.35 && inR(u, v, [0.36, 0.2, 0.645, 0.56])) h += 0.04 * (1 - (v - 0.2) / 0.36); // warm air rises: the upper storey loses a little more
      if (inR(u, v, [0.428, 0.302, 0.588, 0.326])) h = 0.5; // lintel above the big window: a thermal bridge
      if (inR(u, v, [0.37, 0.54, 0.645, 0.556])) h = Math.max(h, 0.45); // floor slab between the storeys
      const spot = (cx, cy, rx, ry, k) => { const dx = (u - cx) / rx; const dy = (v - cy) / ry; return k * Math.exp(-(dx * dx + dy * dy) * 1.4); };
      h += spot(0.39, 0.592, 0.01, 0.014, 0.55) + spot(0.622, 0.587, 0.01, 0.014, 0.55); // wall lamps
      h += spot(0.441, 0.615, 0.012, 0.012, 0.45) + spot(0.66, 0.601, 0.016, 0.01, 0.45); // patio lamps
      return Math.min(1, h);
    },
    // switchboard: metal and fuses in the light warmer, one fuse holder running hot
    industry: (r, g, b, lum, u, v) => {
      let h = 0.12 + Math.pow(lum, 1.3) * 0.55;
      const spot = (cx, cy, rx, ry, k) => { const dx = (u - cx) / rx; const dy = (v - cy) / ry; return k * Math.exp(-(dx * dx + dy * dy) * 1.4); };
      h += spot(0.632, 0.42, 0.06, 0.13, 0.55) + spot(0.478, 0.77, 0.045, 0.07, 0.35);
      return Math.min(1, h);
    },
    // firefighter in smoke: the camera sees through the white smoke; the person is warm, charred wood and embers hot
    fire: (r, g, b, lum, u, v) => window.HM_FIRE_HEAT(r, g, b, lum, u, v),
  };

  // ironbow palette, as on the thermal cameras
  const STOPS = [[0, [6, 3, 18]], [0.16, [32, 10, 78]], [0.32, [92, 14, 120]], [0.47, [168, 18, 108]], [0.6, [218, 36, 46]],
    [0.72, [240, 90, 26]], [0.84, [251, 166, 30]], [0.94, [253, 226, 122]], [1, [255, 255, 255]]];
  const LUT = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0;
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    const [a0, c0] = STOPS[k]; const [a1, c1] = STOPS[k + 1];
    const f = Math.min(1, Math.max(0, (t - a0) / (a1 - a0)));
    for (let c = 0; c < 3; c++) LUT[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
  }
  const blur = (src, W, H, rad) => {
    const tmp = new Float32Array(src.length); const out = new Float32Array(src.length); const n = rad * 2 + 1;
    for (let y = 0; y < H; y++) { let acc = 0; for (let x = -rad; x <= rad; x++) acc += src[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) { tmp[y * W + x] = acc / n; acc += src[y * W + Math.min(W - 1, x + rad + 1)] - src[y * W + Math.max(0, x - rad)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = acc / n; acc += tmp[Math.min(H - 1, y + rad + 1) * W + x] - tmp[Math.max(0, y - rad) * W + x]; } }
    return out;
  };

  // heat map + thermal picture of one photo, made once
  function heatMap(img, area) {
    const W = 420;
    const H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const data = g.getImageData(0, 0, W, H);
    const d = data.data;
    const fn = HEAT[area] || ((r, gg, b, lum) => lum);
    let heat = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4]; const gg = d[i * 4 + 1]; const b = d[i * 4 + 2];
      heat[i] = fn(r, gg, b, (0.3 * r + 0.59 * gg + 0.11 * b) / 255, (i % W) / W, Math.floor(i / W) / H);
    }
    heat = blur(heat, W, H, 2);
    for (let i = 0; i < W * H; i++) {
      const li = Math.round(Math.min(1, Math.max(0, heat[i])) * 255) * 3;
      d[i * 4] = LUT[li]; d[i * 4 + 1] = LUT[li + 1]; d[i * 4 + 2] = LUT[li + 2]; d[i * 4 + 3] = 255;
    }
    g.putImageData(data, 0, 0);
    return { canvas: c, lum: heat, W, H };
  }

  // where the ring sits in the photo, honouring object-fit: cover, object-position and the drift
  function readAt(img, map, clientX, clientY) {
    const rect = img.getBoundingClientRect();
    const ew = img.offsetWidth; const eh = img.offsetHeight;
    if (!ew || !eh) return null;
    const ratio = rect.width / ew;
    const lx = (clientX - rect.left) / ratio;
    const ly = (clientY - rect.top) / ratio;
    const iw = img.naturalWidth; const ih = img.naturalHeight;
    const sc = Math.max(ew / iw, eh / ih);
    const dw = iw * sc; const dh = ih * sc;
    const pos = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const u = (lx - (ew - dw) * (isNaN(pos[0]) ? 0.5 : pos[0])) / dw;
    const v = (ly - (eh - dh) * (isNaN(pos[1]) ? 0.5 : pos[1])) / dh;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const cx = Math.floor(u * (map.W - 1)); const cy = Math.floor(v * (map.H - 1));
    let sum = 0; let n = 0;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const xx = Math.min(map.W - 1, Math.max(0, cx + x));
      const yy = Math.min(map.H - 1, Math.max(0, cy + y));
      sum += map.lum[yy * map.W + xx]; n++;
    }
    return sum / n;
  }

  if (fine) {
    panels.forEach((panel) => {
      const photo = panel.querySelector(':scope > .panel-photo');
      let heatPhoto = panel.querySelector('.panel-heat-img');
      const tempEl = panel.querySelector('.panel-temp');
      const [t0, t1] = RANGE[panel.dataset.area] || [0, 40];
      let map = null;
      const ready = () => {
        try {
          map = heatMap(photo, panel.dataset.area);
          // the thermal layer shows exactly the map the readings come from
          map.canvas.className = 'panel-heat-img is-map';
          map.canvas.style.objectPosition = getComputedStyle(photo).objectPosition;
          heatPhoto.replaceWith(map.canvas);
          heatPhoto = map.canvas;
        } catch { map = null; }
      };
      if (photo.complete && photo.naturalWidth) ready(); else photo.addEventListener('load', ready, { once: true });
      let lastRead = 0;
      const target = { x: 0.5, y: 0.5 };
      const now = { x: 0.5, y: 0.5 };
      let raf = 0;
      const tick = () => {
        // ease towards the pointer so the lens trails it slightly instead of snapping
        now.x += (target.x - now.x) * 0.2;
        now.y += (target.y - now.y) * 0.2;
        const r = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${now.x * r.width}px`);
        panel.style.setProperty('--my', `${now.y * r.height}px`);
        if (!reduce) {
          const t = `translate3d(${(0.5 - now.x) * 22}px, ${(0.5 - now.y) * 16}px, 0) scale(1.04)`;
          photo.style.transform = t;
          heatPhoto.style.transform = t;
        }
        const t = performance.now();
        if (map && tempEl && t - lastRead > 70) {
          lastRead = t;
          const l = readAt(photo, map, r.left + now.x * r.width, r.top + now.y * r.height);
          if (l != null) tempEl.textContent = `${(t0 + l * (t1 - t0)).toFixed(1).replace('-', '−')} °C`;
        }
        if (Math.abs(target.x - now.x) > 0.001 || Math.abs(target.y - now.y) > 0.001) raf = requestAnimationFrame(tick);
        else raf = 0;
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
      panel.addEventListener('pointerenter', (e) => {
        const r = panel.getBoundingClientRect();
        now.x = target.x = (e.clientX - r.left) / r.width;
        now.y = target.y = (e.clientY - r.top) / r.height;
        panel.classList.add('is-hot');
        kick();
      });
      panel.addEventListener('pointermove', (e) => {
        const r = panel.getBoundingClientRect();
        target.x = (e.clientX - r.left) / r.width;
        target.y = (e.clientY - r.top) / r.height;
        kick();
      });
      panel.addEventListener('pointerleave', () => {
        panel.classList.remove('is-hot');
        target.x = 0.5; target.y = 0.5;
        kick();
      });
    });
  }

  // the cards rise in from below, revealed through their own rounded shape
  if (animate) {
    gsap.fromTo(panels, { clipPath: 'inset(100% 0% 0% 0% round 34px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 34px)', duration: 1.1, stagger: 0.1, ease: 'expo.out', delay: 0.15, clearProps: 'clipPath',
    });
    gsap.fromTo(panels.map((p) => p.querySelector(':scope > .panel-photo')), { scale: 1.25 }, { scale: 1.04, duration: 1.6, stagger: 0.1, ease: 'expo.out', delay: 0.15, clearProps: 'scale' });
  }
})();
