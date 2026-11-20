/* The wall of cameras in 3D.
   One WebGL canvas covers the window; each shelf on the page is drawn into
   its own rectangle (scissor), so the HTML stays in charge of layout.
   The camera models are simple placeholders built from code until the
   HIKMICRO GLB files arrive. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildHandheld, buildSimple, buildCadMini, CAD_MODELS } from './models.js?v=80';

const canvas = document.querySelector('[data-wall-canvas]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  renderer = null;
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setScissorTest(true);
  document.body.classList.add('has-3d');

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* ---------- materials ---------- */
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: 0x2b2c30, roughness: 0.55, metalness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.85, metalness: 0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.35, metalness: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0xe3101e, roughness: 0.4, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0a0a12, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2 }),
  };
  M.screen = new THREE.MeshBasicMaterial({ map: thermalTexture(), toneMapped: false });

  // a small thermal picture for the screens
  function thermalTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#1d0a4a'; g.fillRect(0, 0, 256, 192);
    const blob = (x, y, r, stops) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      stops.forEach(([o, col]) => gr.addColorStop(o, col));
      g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
    };
    blob(150, 110, 120, [[0, 'rgba(168,18,108,0.9)'], [1, 'rgba(168,18,108,0)']]);
    blob(140, 100, 60, [[0, 'rgba(240,90,26,1)'], [0.5, 'rgba(218,36,46,0.8)'], [1, 'rgba(218,36,46,0)']]);
    blob(136, 96, 22, [[0, 'rgba(255,250,210,1)'], [0.6, 'rgba(251,166,30,0.9)'], [1, 'rgba(251,166,30,0)']]);
    blob(60, 150, 40, [[0, 'rgba(92,14,120,0.8)'], [1, 'rgba(92,14,120,0)']]);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '600 14px sans-serif'; g.fillText('38.6°', 12, 22);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  const cyl = (r1, r2, h, mat, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  function lensFront(r, depth) {
    const g = new THREE.Group();
    const barrel = cyl(r, r * 1.04, depth, M.rubber); barrel.rotation.x = Math.PI / 2; g.add(barrel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.06, 16, 64), M.red);
    ring.position.z = depth / 2; g.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 48), M.glass);
    glass.position.z = depth / 2 + 0.001; g.add(glass);
    return g;
  }

  /* ---------- placeholder models (front of the lens points to +z) ---------- */
  const BUILD = {
    pistol() {
      const g = new THREE.Group();
      const body = rbox(0.9, 0.82, 1.6, 0.18, M.body); body.position.set(0, 1.0, 0); g.add(body);
      const top = rbox(0.7, 0.08, 1.1, 0.04, M.trim); top.position.set(0, 1.43, -0.05); g.add(top);
      const lens = lensFront(0.3, 0.34); lens.position.set(0, 1.02, 0.95); g.add(lens);
      const cam2 = cyl(0.06, 0.06, 0.05, M.glass); cam2.rotation.x = Math.PI / 2; cam2.position.set(0.3, 1.28, 0.81); g.add(cam2);
      const hood = rbox(1.0, 0.92, 0.16, 0.08, M.rubber); hood.position.set(0, 1.04, -0.84); hood.rotation.x = 0.18; g.add(hood);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.6), M.screen);
      screen.position.set(0, 1.05, -0.93); screen.rotation.set(-0.18, Math.PI, 0); g.add(screen);
      const grip = rbox(0.46, 1.0, 0.52, 0.16, M.rubber); grip.position.set(0, 0.42, -0.22); grip.rotation.x = 0.22; g.add(grip);
      const trigger = rbox(0.14, 0.22, 0.12, 0.04, M.red); trigger.position.set(0, 0.62, 0.12); trigger.rotation.x = 0.22; g.add(trigger);
      const side = rbox(0.02, 0.05, 0.9, 0.01, M.red); side.position.set(0.455, 0.84, 0.15); g.add(side);
      return g;
    },
    pocket() {
      const g = new THREE.Group();
      const body = rbox(0.72, 1.45, 0.26, 0.12, M.body); body.position.y = 0.76; g.add(body);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.78), M.screen);
      screen.position.set(0, 0.95, -0.131); screen.rotation.y = Math.PI; g.add(screen);
      const lens = lensFront(0.12, 0.06); lens.position.set(0, 1.25, 0.15); g.add(lens);
      const btn = cyl(0.08, 0.08, 0.03, M.red); btn.rotation.x = Math.PI / 2; btn.position.set(0, 0.32, -0.14); g.add(btn);
      return g;
    },
    phone() {
      const g = new THREE.Group();
      const phone = rbox(0.78, 1.55, 0.09, 0.1, M.rubber); phone.position.y = 0.95; g.add(phone);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.42), M.screen);
      screen.position.set(0, 0.95, -0.047); screen.rotation.y = Math.PI; g.add(screen);
      const dongle = rbox(0.42, 0.24, 0.2, 0.06, M.body); dongle.position.set(0, 0.07, 0); g.add(dongle);
      const lens = lensFront(0.07, 0.04); lens.position.set(0, 0.08, 0.12); g.add(lens);
      return g;
    },
    monocular() {
      const g = new THREE.Group();
      const body = rbox(0.62, 0.62, 1.5, 0.26, M.body); body.position.set(0, 0.42, 0); g.add(body);
      const lens = lensFront(0.3, 0.3); lens.position.set(0, 0.42, 0.85); g.add(lens);
      const eye = cyl(0.2, 0.22, 0.32, M.rubber); eye.rotation.x = Math.PI / 2; eye.position.set(0, 0.42, -0.9); g.add(eye);
      const btns = rbox(0.3, 0.08, 0.5, 0.03, M.trim); btns.position.set(0, 0.75, -0.1); g.add(btns);
      const red = rbox(0.08, 0.05, 0.08, 0.02, M.red); red.position.set(0, 0.8, 0.1); g.add(red);
      return g;
    },
    binocular() {
      const g = new THREE.Group();
      [-0.36, 0.36].forEach((x) => {
        const b = rbox(0.6, 0.6, 1.3, 0.24, M.body); b.position.set(x, 0.42, 0); g.add(b);
        const eye = cyl(0.18, 0.2, 0.26, M.rubber); eye.rotation.x = Math.PI / 2; eye.position.set(x, 0.42, -0.76); g.add(eye);
      });
      const bridge = rbox(0.5, 0.36, 0.9, 0.1, M.rubber); bridge.position.set(0, 0.5, 0); g.add(bridge);
      const lens = lensFront(0.24, 0.24); lens.position.set(0.36, 0.42, 0.75); g.add(lens);
      const lens2 = lensFront(0.2, 0.2); lens2.position.set(-0.36, 0.42, 0.73); g.add(lens2);
      return g;
    },
    scope() {
      const g = new THREE.Group();
      const tube = cyl(0.17, 0.17, 1.9, M.body); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.5, 0); g.add(tube);
      const bell = cyl(0.3, 0.2, 0.5, M.body); bell.rotation.x = Math.PI / 2; bell.position.set(0, 0.5, 1.05); g.add(bell);
      const lens = lensFront(0.29, 0.1); lens.position.set(0, 0.5, 1.32); g.add(lens);
      const eye = cyl(0.21, 0.19, 0.42, M.rubber); eye.rotation.x = Math.PI / 2; eye.position.set(0, 0.5, -1.1); g.add(eye);
      const turret = rbox(0.34, 0.26, 0.34, 0.06, M.trim); turret.position.set(0, 0.74, 0.05); g.add(turret);
      const knob = cyl(0.1, 0.1, 0.12, M.red); knob.position.set(0, 0.92, 0.05); g.add(knob);
      [-0.45, 0.45].forEach((z) => { const m = rbox(0.2, 0.4, 0.14, 0.04, M.rubber); m.position.set(0, 0.25, z); g.add(m); });
      return g;
    },
  };

  /* ---------- one little scene per shelf ---------- */
  const sharedGlowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const cadCache = {};
  function makeView(el) {
    const scene = new THREE.Scene();
    scene.environment = envTex;

    const key = new THREE.DirectionalLight(0xfff1ea, 2.4); key.position.set(-3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcc8ff, 1.2); rim.position.set(3, 2, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // glass shelf with a light strip along its front edge
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 1.05),
      new THREE.MeshPhysicalMaterial({ color: 0xa8b4bf, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1 }));
    shelf.position.y = -0.025; scene.add(shelf);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, toneMapped: false });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.014, 0.014), edgeMat);
    edge.position.set(0, -0.003, 0.53); scene.add(edge);
    const best = el.dataset.best === '1';
    const glowMat = new THREE.MeshBasicMaterial({ map: sharedGlowTex, color: best ? 0xf2b33d : 0xe3101e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.6), glowMat);
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.002; scene.add(glow);
    const under = new THREE.PointLight(best ? 0xffc35a : 0xff3a30, 0, 3, 2); under.position.set(0, 0.25, 0.9); scene.add(under);

    const pivot = new THREE.Group();
    // fit a model to the shelf and stand it on the glass
    const place = (model, centre = false) => {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(1.7 / Math.max(size.x, size.z, size.y * 1.1));
      box.setFromObject(model);
      if (centre) { model.position.x -= (box.min.x + box.max.x) / 2; model.position.z -= (box.min.z + box.max.z) / 2; }
      model.position.y -= box.min.y;
      pivot.clear(); pivot.add(model);
    };
    place(buildSimple(el.dataset.type, el.dataset.name));
    // the real camera from HIKMICRO's CAD data replaces the illustration when it has loaded
    const cadUrl = CAD_MODELS[el.dataset.view];
    if (cadUrl) {
      cadCache[cadUrl] ||= buildCadMini(cadUrl).then((b) => b.root);
      cadCache[cadUrl].then((root) => place(root.clone(true), true)).catch(() => {});
    }
    scene.add(pivot);

    const camera = new THREE.PerspectiveCamera(28, 1.25, 0.1, 50);
    camera.position.set(0, 1.05, 5.6);
    camera.lookAt(0, 0.62, 0);

    const shelfEl = el.closest('.shelf');
    const baseAngle = cadUrl ? -0.45 : { pistol: -0.6, pro: 2.55, pocket: 2.6, phone: 0.5, monocular: -1.05, binocular: -0.7, scope: -1.2 }[el.dataset.type] ?? -0.6;
    const v = { el, shelfEl, scene, camera, pivot, baseAngle, best, glowMat, edgeMat, under, lit: 0, litTarget: 0, spin: 0, phase: Math.random() * Math.PI * 2 };
    const on = () => { v.litTarget = 1; shelfEl.classList.add('is-lit'); };
    const off = () => { v.litTarget = 0; shelfEl.classList.remove('is-lit'); };
    if (finePointer) { shelfEl.addEventListener('pointerenter', on); shelfEl.addEventListener('pointerleave', off); }
    shelfEl.addEventListener('focusin', on); shelfEl.addEventListener('focusout', off);
    return v;
  }

  let views = [];
  function rebuild() {
    views.forEach((v) => v.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }));
    views = [...document.querySelectorAll('.shelf-stage[data-view]')].map(makeView);
  }
  document.addEventListener('wall:update', rebuild);
  document.addEventListener('wall:clear', () => { views = []; wipe(); });
  document.addEventListener('wall:spin', (e) => {
    const v = views.find((x) => x.el.dataset.view === e.detail);
    if (v) v.spin = Math.PI * 2;
  });
  if (document.querySelector('[data-view]')) rebuild();

  function resize() {
    const w = document.documentElement.clientWidth; const h = window.innerHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
    }
  }

  const clock = new THREE.Clock();
  let painted = false;
  function wipe() {
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear();
    painted = false;
  }
  function frame() {
    requestAnimationFrame(frame);
    if (!views.length || document.hidden) { if (painted) wipe(); return; }
    painted = true;
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const H = window.innerHeight;
    // pin the canvas to where the viewport is now; rects below are read in the same frame
    canvas.style.transform = `translate3d(0, ${window.scrollY}px, 0)`;
    renderer.setScissor(0, 0, window.innerWidth, H);
    renderer.setViewport(0, 0, window.innerWidth, H);
    renderer.clear();
    for (const v of views) {
      const r = v.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.width === 0) continue;

      v.lit += (v.litTarget - v.lit) * Math.min(1, dt * 7);
      const idle = reduceMotion ? 0 : Math.sin(t * 0.5 + v.phase) * 0.12;
      const target = v.baseAngle + idle;
      if (v.spin > 0) {
        const step = Math.min(v.spin, dt * 6);
        v.spin -= step;
        v.pivot.rotation.y += step;
        if (v.spin <= 0) v.pivot.rotation.y -= Math.PI * 2;
      } else if (v.litTarget > 0 && !reduceMotion) {
        // pointer on the shelf: a slow, steady turntable
        v.pivot.rotation.y += dt * 0.9;
      } else {
        // settle back to the resting angle by the shortest way round
        const TAU = Math.PI * 2;
        let diff = ((target - v.pivot.rotation.y) % TAU + TAU) % TAU;
        if (diff > Math.PI) diff -= TAU;
        v.pivot.rotation.y += diff * Math.min(1, dt * 4);
      }
      v.pivot.position.y = v.lit * 0.06;
      v.glowMat.opacity = (v.best ? 0.45 : 0.05) + v.lit * (v.best ? 0.5 : 0.85);
      v.edgeMat.opacity = 0.3 + v.lit * 0.7;
      v.under.intensity = (v.best ? 1.2 : 0) + v.lit * 4;

      v.camera.aspect = r.width / r.height;
      v.camera.updateProjectionMatrix();
      const bottom = H - r.bottom;
      renderer.setViewport(r.left, bottom, r.width, r.height);
      renderer.setScissor(r.left, bottom, r.width, r.height);
      renderer.render(v.scene, v.camera);
    }
  }
  requestAnimationFrame(frame);
}
