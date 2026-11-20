/* Resolution guide, at the top of every camera range.
   The thermal picture of the chosen area (house, switchboard, deer) is shown at the
   resolution the visitor picks: what you can recognise, which cameras have it,
   and how much one pixel covers at 5 m. */
(() => {
  'use strict';
  const root = document.querySelector('[data-res]');
  if (!root || !window.HM_THERMAL) return;
  const { buildThermal, SCENES } = window.HM_THERMAL;
  const P = (window.HM_CATALOG && window.HM_CATALOG.products) || {};

  const TIERS = [
    { w: 96, h: 96, cams: ['eco', 'pockete'], ref: 'eco', good: 'Quick checks at home: a cold draught, a warm pipe, a radiator that stays cold. Not for reports.' },
    { w: 192, h: 144, cams: ['m11w', 'm11'], ref: 'm11w', good: 'Fast checks of fuse boxes, heating and motors for installers and electricians.' },
    { w: 256, h: 192, cams: ['pocket2', 'minix', 'm20w', 'm20', 'b20s'], ref: 'm20w', good: 'The sweet spot for trades: buildings, heating and electrics, sharp enough for customer reports.' },
    { w: 384, h: 288, cams: ['mini3', 'm31', 'g31'], ref: 'm31', good: 'Energy audits and maintenance where small details count, a few metres away.' },
    { w: 480, h: 360, cams: ['g41', 'g41h', 'sp40', 'sp40h'], ref: 'g41', good: 'Professional inspection with interchangeable lenses and more working distance.' },
    { w: 640, h: 480, cams: ['m60', 'g61', 'g61h', 'sp60', 'sp60h'], ref: 'g61', good: 'Full professional thermography: building reports, industry, small parts at a distance.' },
    { w: 1280, h: 1024, cams: ['sp100h', 'sp120h'], ref: 'sp120h', good: 'Research, R&D and long distances: more than four times the detail of 640 × 480. The SP100H has 1040 × 832.' },
  ];
  // what you can recognise at each step, per area
  const AREA = {
    industry: {
      scene: 'industry', src: 'assets/img/scene-industry.jpg', zoom: 'Zoom on the hot fuse', cap: 'Switchboard with a hot fuse holder. Simulated.',
      see: ['You see that something is warm, not which part.', 'You find the warm fuse holder.', 'You see which fuse is hot, from a metre or two.', 'Contacts and cables are clear, from further away.', 'Small parts stay sharp, even from a distance.', 'You see the detail of every terminal.', 'Every screw and wire, even across the hall.'],
    },
    building: {
      scene: 'building', src: 'assets/img/scene-building.jpg', zoom: 'Zoom on the window', cap: 'A house at dusk, heat escaping at the windows. Simulated.',
      see: ['You see that a window is warmer than the wall.', 'You find the window that loses heat.', 'Frames, sills and lintels show where heat escapes.', 'Small gaps and cold bridges become visible.', 'Sharp from the street, ready for a report.', 'Every joint and fixing in the facade.', 'Roof edges and seals, sharp from the ground.'],
    },
    outdoor: {
      scene: 'outdoor', src: 'assets/img/scene-outdoor.jpg', zoom: 'Zoom on the deer', cap: 'A roe deer at the edge of the forest. Simulated.',
      see: ['You see that something warm is there.', 'You see an animal, not which one.', 'You recognise a deer at a short distance.', 'Head and legs are clear, further out.', 'You tell a roe deer from a fox at range.', 'Details stay sharp at long range.', 'Almost like daylight, but in thermal.'],
    },
  };

  const fmt = (n) => n.toLocaleString('en-US');
  const name = (id) => (P[id] && P[id].name) || id.toUpperCase();
  function pixelAt5m(id, resW) {
    const v = P[id] && P[id].variants && P[id].variants[0];
    const fov = v && parseFloat(v.fov);
    return fov ? (2 * 5000 * Math.tan((fov * Math.PI) / 360)) / resW : null;
  }

  const $ = (s) => root.querySelector(s);
  const canvas = $('[data-res-canvas]'); const zoom = $('[data-res-zoom]'); const range = $('[data-res-range]');
  const out = { value: $('[data-res-value]'), pixels: $('[data-res-pixels]'), good: $('[data-res-good]'), detail: $('[data-res-detail]'), cams: $('[data-res-cams]'), see: $('[data-res-see]') };
  $('[data-res-ticks]').innerHTML = TIERS.map((t) => `<span>${t.w}</span>`).join('');

  let area = 'industry';
  try { const c = JSON.parse(localStorage.getItem('hm-choice')) || {}; if (c.area) area = c.area; } catch { /* private mode */ }
  let source = null;
  const cache = {};
  const small = document.createElement('canvas');
  let noise = null; // fixed sensor noise pattern, the same every time

  function sensorNoise(w, h, amount) {
    // real sensors are slightly grainy; fewer, larger pixels show it more
    if (!noise) { noise = new Float32Array(1280 * 1024); for (let i = 0; i < noise.length; i++) noise[i] = Math.random() - 0.5; }
    const c = small.getContext('2d'); const img = c.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0, n = w * h; i < n; i++) { const k = noise[i] * amount; d[i * 4] += k; d[i * 4 + 1] += k; d[i * 4 + 2] += k; }
    c.putImageData(img, 0, 0);
  }

  function draw(i) {
    const t = TIERS[i]; const A = AREA[area];
    out.value.textContent = `${t.w} × ${t.h}`;
    out.pixels.textContent = `${fmt(t.w * t.h)} measuring points`;
    out.good.textContent = t.good;
    out.see.textContent = A.see[i];
    const mm = pixelAt5m(t.ref, t.w);
    out.detail.textContent = mm ? `With the ${name(t.ref)}, one pixel covers ${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm at 5 m.` : '';
    out.cams.innerHTML = `Cameras: ${t.cams.filter((id) => P[id]).map((id) => `<a href="product.html?id=${id}">${name(id)}</a>`).join(', ')}`;
    range.setAttribute('aria-valuetext', `${t.w} by ${t.h} pixels`);
    if (!source) return;
    // squeeze the picture into the camera's pixel grid, then show it without smoothing
    const sw = t.w; const sh = Math.round((t.w * 3) / 4);
    small.width = sw; small.height = sh;
    const sc = small.getContext('2d', { willReadFrequently: true });
    sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
    sc.drawImage(source.canvas, source.sx, source.sy, source.sw, source.sh, 0, 0, sw, sh);
    sensorNoise(sw, sh, 9);
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(small, 0, 0, canvas.width, canvas.height);
    const [su, sv] = SCENES[A.scene].subject;
    const fu = (su * source.W - source.sx) / source.sw; const fv = (sv * source.H - source.sy) / source.sh;
    const zw = sw * 0.14;
    const z = zoom.getContext('2d');
    z.imageSmoothingEnabled = false;
    z.fillStyle = '#060312'; z.fillRect(0, 0, zoom.width, zoom.height);
    z.drawImage(small, fu * sw - zw / 2, fv * sh - zw / 2, zw, zw, 0, 0, zoom.width, zoom.height);
  }

  function load(a) {
    const A = AREA[a];
    if (cache[a]) return cache[a];
    cache[a] = new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        // extra fine detail, so the highest resolutions really show more
        const th = buildThermal(img, { ...SCENES[A.scene], detail: 0.22, soft: 1 }, 1600);
        const sh = th.H; const sw = Math.min(th.W, Math.round((sh * 4) / 3));
        const [su] = SCENES[A.scene].subject;
        const sx = Math.round(Math.min(Math.max(su * th.W - sw * 0.55, 0), th.W - sw));
        res({ canvas: th.canvas, W: th.W, H: th.H, sx, sy: 0, sw, sh });
      };
      img.src = A.src;
    });
    return cache[a];
  }

  let visible = false;
  async function show(a) {
    area = AREA[a] ? a : 'industry';
    const A = AREA[area];
    $('[data-res-zoomcap]').textContent = A.zoom;
    $('[data-res-cap]').textContent = A.cap;
    draw(+range.value);
    if (!visible) return;
    root.classList.remove('is-ready');
    const token = area;
    const s = await load(area);
    if (token !== area) return;
    source = s; root.classList.add('is-ready'); draw(+range.value);
  }
  window.HM_RES = { show };
  document.addEventListener('area:shown', (e) => show(e.detail));
  range.addEventListener('input', () => draw(+range.value));

  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect(); visible = true; show(area);
  }, { rootMargin: '300px' });
  io.observe(root);

  // link from the questions to the guide
  document.querySelectorAll('[data-go-res]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('resolution').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
})();
