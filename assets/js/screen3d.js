/* A 3D camera whose screen plays a real SENSOR inspection while you scroll.
   The band is tall; its inner part sticks to the window. Scroll progress through
   the band picks the shot; a scan line wipes the screen from one shot to the next,
   the way the camera refreshes. Labels and the max reading beside it follow. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHandheld } from './models.js?v=80';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const stages = new Map();

function loadImage(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}

function mount(band) {
  const canvas = band.querySelector('[data-cam3d]');
  const shots = JSON.parse(band.querySelector('[data-shots]').textContent);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
  band.classList.add('has-3d');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff3344, 2.2); rim.position.set(3, 1.5, -3); scene.add(rim);

  const { root } = buildHandheld({ model: 'M60' });
  const pivot = new THREE.Group(); scene.add(pivot);
  const box = new THREE.Box3().setFromObject(root); const c = box.getCenter(new THREE.Vector3());
  root.position.sub(c); pivot.add(root);
  const size = box.getSize(new THREE.Vector3());

  // the screen: one canvas texture drawn from the shots, shared by every screen mesh
  const sc = document.createElement('canvas'); sc.width = 640; sc.height = 480;
  const g = sc.getContext('2d');
  const tex = new THREE.CanvasTexture(sc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  root.traverse((o) => {
    if (o.isMesh && o.material && o.material.map && o.geometry.type === 'PlaneGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 0.76) < 0.01 && Math.abs(p.height - 0.57) < 0.01) o.material = screenMat;
    }
  });

  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const dist = size.length() * 1.55;
  cam.position.set(0, 0.2, dist);

  const imgs = [];
  Promise.all(shots.map((s) => loadImage(s.src))).then((list) => { list.forEach((im, i) => { imgs[i] = im; }); state.dirty = true; });

  const label = band.querySelector('[data-shot-label]');
  const maxEl = band.querySelector('[data-shot-max]');
  const steps = [...band.querySelectorAll('.fb-steps li')];
  const state = { idx: 0, from: 0, wipe: 1, dirty: true, progress: 0, mx: 0, my: 0, tx: 0, ty: 0, visible: false };

  function cover(im) { // draw an image filling the screen
    const r = Math.max(sc.width / im.width, sc.height / im.height);
    const w = im.width * r, h = im.height * r;
    g.drawImage(im, (sc.width - w) / 2, (sc.height - h) / 2, w, h);
  }
  function drawScreen() {
    const a = imgs[state.from], b = imgs[state.idx];
    g.fillStyle = '#12051f'; g.fillRect(0, 0, sc.width, sc.height);
    if (a) cover(a);
    if (b && state.wipe > 0) {
      const y = sc.height * state.wipe;
      g.save(); g.beginPath(); g.rect(0, 0, sc.width, y); g.clip(); cover(b); g.restore();
      if (state.wipe < 1) {
        const gr = g.createLinearGradient(0, y - 60, 0, y);
        gr.addColorStop(0, 'rgba(255,140,60,0)'); gr.addColorStop(1, 'rgba(255,160,80,0.45)');
        g.fillStyle = gr; g.fillRect(0, y - 60, sc.width, 60);
        g.fillStyle = '#fff'; g.fillRect(0, y - 2, sc.width, 3);
      }
    }
    // a small crosshair like on the camera
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
    const cx = sc.width / 2, cy = sc.height / 2;
    g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.moveTo(cx - 20, cy); g.lineTo(cx - 12, cy); g.moveTo(cx + 12, cy); g.lineTo(cx + 20, cy);
    g.moveTo(cx, cy - 20); g.lineTo(cx, cy - 12); g.moveTo(cx, cy + 12); g.lineTo(cx, cy + 20); g.stroke();
    tex.needsUpdate = true;
  }

  function countTo(v) {
    const start = parseFloat(maxEl.textContent) || 0; const t0 = performance.now();
    const step = (t) => {
      const k = reduce ? 1 : Math.min(1, (t - t0) / 700); const e = 1 - Math.pow(1 - k, 3);
      maxEl.textContent = (start + (v - start) * e).toFixed(1);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function go(i) {
    if (i === state.idx) return;
    state.from = state.wipe >= 1 ? state.idx : state.from;
    state.idx = i; state.wipe = reduce ? 1 : 0; state.dirty = true;
    label.textContent = shots[i].label;
    countTo(shots[i].max);
    steps.forEach((li, k) => li.classList.toggle('is-on', k === i));
    if (reduce) state.from = i;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.position.z = dist * (cam.aspect < 0.9 ? 1.35 : 1);
    cam.updateProjectionMatrix();
  }
  if (fine) band.addEventListener('pointermove', (e) => { state.tx = (e.clientX / innerWidth - 0.5); state.ty = (e.clientY / innerHeight - 0.5); });

  function frame(t) {
    if (!state.visible) return;
    const r = band.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    state.progress = Math.min(1, Math.max(0, -r.top / span));
    const i = Math.min(shots.length - 1, Math.floor(state.progress * shots.length * 0.999));
    go(i);
    if (state.wipe < 1) { state.wipe = Math.min(1, state.wipe + 0.035); state.dirty = true; if (state.wipe >= 1) state.from = state.idx; }
    if (state.dirty) { drawScreen(); state.dirty = false; }
    state.mx += (state.tx - state.mx) * 0.06; state.my += (state.ty - state.my) * 0.06;
    const time = t / 1000;
    // turns from a three-quarter view to face you as the round goes on, with a slow float
    pivot.rotation.y = -0.55 + state.progress * 0.75 + state.mx * 0.35 + (reduce ? 0 : Math.sin(time * 0.6) * 0.04);
    pivot.rotation.x = 0.06 + state.my * 0.15;
    pivot.position.y = reduce ? 0 : Math.sin(time * 0.9) * 0.03;
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(([e]) => {
    const was = state.visible; state.visible = e.isIntersecting;
    if (state.visible && !was) { resize(); requestAnimationFrame(frame); }
  }, { rootMargin: '200px 0px' });
  io.observe(band);
  addEventListener('resize', resize);
  return { destroy() { io.disconnect(); removeEventListener('resize', resize); renderer.dispose(); } };
}

function scan() {
  stages.forEach((s, band) => { if (!document.contains(band)) { s && s.destroy(); stages.delete(band); } });
  document.querySelectorAll('.fb-screen').forEach((band) => { if (!stages.has(band)) stages.set(band, mount(band)); });
}
document.addEventListener('wall:update', () => requestAnimationFrame(scan));
scan();
