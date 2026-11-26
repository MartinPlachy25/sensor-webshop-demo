/* Placeholder camera models built from code.
   buildHandheld() follows the HIKMICRO M20W product photos: shield-shaped head,
   screen and keypad on the back, flip lens cover on top, angled ribbed grip,
   red trigger, battery with a chrome band. Each part is its own group with its
   own materials so it can be exploded and labelled. Replace with the HIKMICRO
   GLB when it arrives. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------- textures ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// thermal picture of power lines, like the photo on the M20W screen
export function screenTexture() {
  return canvasTex(512, 384, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a0a55'); bg.addColorStop(0.55, '#5a0f86'); bg.addColorStop(1, '#d4237a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    const line = (pts, width, col, blur) => {
      g.save(); g.shadowColor = '#ffb347'; g.shadowBlur = blur; g.strokeStyle = col; g.lineWidth = width;
      g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); g.restore();
    };
    line([0, 230, 512, 30], 14, '#ffd25a', 18);
    line([0, 250, 512, 50], 4, '#fff3b0', 6);
    for (let x = 40; x < 512; x += 56) line([x, 230 - x * 0.39, x + 30, 205 - x * 0.39], 5, '#ffe08a', 8);
    line([120, 384, 150, 180, 175, 384], 7, '#ffcf4a', 12);
    [[200, 120], [280, 80], [360, 55], [440, 35]].forEach(([x, y]) => line([x, y, x - 10, y + 160, x + 20, 384], 2.5, '#f7a640', 6));
    for (let i = 0; i < 6; i++) line([60 + i * 80, 0, 90 + i * 70, 384], 1.5, 'rgba(255,160,90,0.7)', 3);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '600 20px sans-serif';
    g.fillStyle = '#ff5a4a'; g.fillText('Max: 45.2', 16, 30);
    const bar = g.createLinearGradient(0, 20, 0, 300);
    bar.addColorStop(0, '#fff8d0'); bar.addColorStop(0.3, '#ffb000'); bar.addColorStop(0.65, '#d4237a'); bar.addColorStop(1, '#1a0a55');
    g.fillStyle = bar; g.fillRect(478, 24, 14, 280);
    g.fillStyle = '#fff'; g.font = '500 15px sans-serif'; g.fillText('2026-11-10  09:09', 180, 370);
  });
}

function labelTexture(text, { w = 256, h = 64, size = 38, color = '#d9d9d9', weight = 600 } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = color; g.font = `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  });
}

function brandTexture() {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#d2d4d7';
    g.fillRect(28, 34, 60, 60);
    g.fillStyle = '#2b2c30';
    g.beginPath(); g.moveTo(58, 46); g.lineTo(80, 64); g.lineTo(58, 82); g.lineTo(36, 64); g.closePath(); g.fill();
    g.fillStyle = '#d2d4d7'; g.font = '600 58px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('HIKMICRO', 108, 66);
  });
}

function pcbTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0d3b2b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(214,170,80,0.55)'; g.lineWidth = 3;
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w; const y = Math.random() * h; const l = 40 + Math.random() * 120;
      g.beginPath(); g.moveTo(x, y);
      if (Math.random() > 0.5) { g.lineTo(x + l, y); g.lineTo(x + l + 20, y + 20); } else { g.lineTo(x, y + l); g.lineTo(x + 20, y + l + 20); }
      g.stroke();
    }
    g.fillStyle = '#d9b25a';
    for (let i = 0; i < 160; i++) g.fillRect(Math.random() * w, Math.random() * h, 6, 6);
  });
}

/* ---------- helpers ---------- */
const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
const part = (name) => { const g = new THREE.Group(); g.name = name; return g; };

// front silhouette of the head: square top, chamfered towards the grip
function headShape(inset = 0) {
  const s = new THREE.Shape();
  const W = 0.52 - inset, top = 2.32 - inset, side = 1.58, neck = 0.27 - inset * 0.6, bot = 1.16 + inset, r = 0.12;
  s.moveTo(-W + r, top);
  s.lineTo(W - r, top);
  s.quadraticCurveTo(W, top, W, top - r);
  s.lineTo(W, side);
  s.quadraticCurveTo(W, side - 0.05, W - 0.04, side - 0.09);
  s.lineTo(neck + 0.03, bot + 0.04);
  s.quadraticCurveTo(neck, bot, neck - 0.05, bot);
  s.lineTo(-neck + 0.05, bot);
  s.quadraticCurveTo(-neck, bot, -neck - 0.03, bot + 0.04);
  s.lineTo(-W + 0.04, side - 0.09);
  s.quadraticCurveTo(-W, side - 0.05, -W, side);
  s.lineTo(-W, top - r);
  s.quadraticCurveTo(-W, top, -W + r, top);
  return s;
}
function extrude(shape, depth, bevel, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 18 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, mat);
}

/* ---------- the M20W-style handheld ---------- */
// Screen faces +z, lens faces -z, y is up. Returns { root, parts } where parts carry
// userData.explode / stage and a label { title, note, anchor }.
export function buildHandheld({ model = 'M20W' } = {}) {
  const mats = () => ({
    shell: new THREE.MeshPhysicalMaterial({ color: 0x232427, roughness: 0.62, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.9 }),
    bezel: new THREE.MeshPhysicalMaterial({ color: 0x2c2d31, roughness: 0.45, metalness: 0.1, clearcoat: 0.5 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd6d8dc, roughness: 0.18, metalness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.3, metalness: 0.9 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xd8443a, roughness: 0.5, clearcoat: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15161c, roughness: 0.04, metalness: 0.5, clearcoat: 1, envMapIntensity: 2.2 }),
    key: new THREE.MeshPhysicalMaterial({ color: 0x1d1e21, roughness: 0.5, clearcoat: 0.4 }),
  });
  const root = new THREE.Group();
  const parts = [];
  const add = (g, { explode, stage, label, shell = false }) => {
    g.userData = { explode, stage, shell, label };
    root.add(g); parts.push(g);
    return g;
  };

  // 1. lens cover, the flip cap on top-front
  {
    const m = mats();
    const g = part('cover');
    const cap = rbox(0.9, 0.08, 0.52, 0.04, m.rubber); cap.position.set(0, 2.39, -0.12); cap.rotation.x = 0.16; g.add(cap);
    const lip = rbox(0.86, 0.22, 0.06, 0.03, m.rubber); lip.position.set(0, 2.3, -0.39); g.add(lip);
    add(g, { explode: [0, 0.3, -2.05], stage: 0, label: { key: 'cover', title: 'Lens cover', note: 'Flips up, keeps dust off the lens', anchor: [0, 2.43, -0.15] } });
  }

  // 2. germanium lens with metal focus rings
  {
    const m = mats();
    const g = part('lens');
    const profile = [];
    for (let i = 0; i <= 6; i++) { const r = 0.205 - i * 0.022; profile.push(new THREE.Vector2(r, i % 2 ? -0.012 : 0)); profile.push(new THREE.Vector2(r - 0.006, i % 2 ? 0 : -0.012)); }
    profile.push(new THREE.Vector2(0.06, -0.02));
    const rings = new THREE.Mesh(new THREE.LatheGeometry(profile.reverse(), 64), m.metal);
    rings.rotation.x = -Math.PI / 2; g.add(rings);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.14, 64, 1, true), m.metal);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.07; g.add(barrel);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 48), m.glass);
    glass.rotation.y = Math.PI; glass.position.z = -0.021; g.add(glass);
    g.position.set(-0.12, 1.98, -0.36);
    add(g, { explode: [0, 0, -1.6], stage: 1, label: { key: 'lens', title: 'Germanium lens', note: 'Lets long-wave infrared through', anchor: [0, 0.21, 0] } });
  }

  // 3. front shell with the lens window
  {
    const m = mats();
    const g = part('front');
    g.add(extrude(headShape(), 0.3, 0.05, m.shell)).position.z = -0.17;
    const window = rbox(0.62, 0.62, 0.05, 0.08, m.rubber); window.position.set(-0.08, 1.97, -0.34); g.add(window);
    const cam2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 32), m.glass);
    cam2.rotation.x = Math.PI / 2; cam2.position.set(0.3, 1.72, -0.35); g.add(cam2);
    add(g, { explode: [0, 0, -1.08], stage: 0, shell: true, label: { key: 'front', title: 'Front housing', note: 'Rubberised, made for site work', anchor: [0.52, 1.8, -0.2] } });
  }

  // 4. thermal detector
  {
    const m = mats();
    const g = part('detector');
    const pkg = rbox(0.34, 0.34, 0.07, 0.02, new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.35, metalness: 0.8 })); g.add(pkg);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshPhysicalMaterial({ color: 0x2a1650, roughness: 0.1, metalness: 0.6, clearcoat: 1 }));
    win.position.z = -0.036; win.rotation.y = Math.PI; g.add(win);
    g.position.set(-0.12, 1.98, -0.12);
    add(g, { explode: [0, 0, -0.5], stage: 2, label: { key: 'detector', title: 'Thermal detector', note: 'Uncooled sensor, turns heat into a picture', anchor: [0, 0.17, 0] } });
  }

  // 5. main board
  {
    const g = part('board');
    const pcbMat = new THREE.MeshStandardMaterial({ map: pcbTexture(), roughness: 0.6, metalness: 0.1 });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.92, 0.025), pcbMat); g.add(pcb);
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 });
    [[-0.15, 0.15, 0.22], [0.2, 0.2, 0.14], [0.15, -0.2, 0.18], [-0.2, -0.22, 0.1]].forEach(([x, y, s]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.03), chipMat); c.position.set(x, y, 0.028); g.add(c);
    });
    const shield = rbox(0.3, 0.22, 0.04, 0.01, new THREE.MeshStandardMaterial({ color: 0xb8bbc0, roughness: 0.3, metalness: 0.9 }));
    shield.position.set(0.12, 0.25, 0.04); g.add(shield);
    g.position.set(0, 1.86, 0.02);
    add(g, { explode: [0, 0, 0], stage: 2, label: { key: 'board', title: 'Main board', note: 'Image processing, measurement and Wi-Fi', anchor: [0.41, 0.3, 0] } });
  }

  // 6. display
  {
    const m = mats();
    const g = part('display');
    const back = rbox(0.82, 0.62, 0.05, 0.02, m.metal); g.add(back);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.57), new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }));
    scr.position.z = 0.027; g.add(scr);
    g.position.set(0, 1.94, 0.22);
    add(g, { explode: [0, 0, 0.5], stage: 2, label: { key: 'display', title: 'Display', note: 'Bright screen, readable outdoors', anchor: [0.41, 0.31, 0] } });
  }

  // 7. rear housing with keypad, screen window and model name
  {
    const m = mats();
    const g = part('rear');
    g.add(extrude(headShape(), 0.24, 0.05, m.shell)).position.z = 0.17;
    const bez = extrude(headShape(0.05), 0.04, 0.02, m.bezel); bez.position.z = 0.33; g.add(bez);
    const frame = rbox(0.84, 0.64, 0.02, 0.02, m.rubber); frame.position.set(0, 1.94, 0.372); g.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.57), new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }));
    scr.position.set(0, 1.94, 0.384); g.add(scr);
    const brand = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), new THREE.MeshBasicMaterial({ map: brandTexture(), transparent: true }));
    brand.position.set(0.571, 1.86, 0.16); brand.rotation.y = Math.PI / 2; g.add(brand);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.08), new THREE.MeshBasicMaterial({ map: labelTexture(model), transparent: true }));
    name.position.set(0, 2.21, 0.373); g.add(name);
    // keypad: d-pad with OK and four side keys
    const kp = new THREE.Group(); kp.position.set(0, 1.42, 0.38); g.add(kp);
    const dpad = rbox(0.3, 0.3, 0.05, 0.05, m.key); kp.add(dpad);
    const ok = rbox(0.14, 0.14, 0.03, 0.03, m.key); ok.position.z = 0.03; kp.add(ok);
    const okLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ map: labelTexture('OK', { w: 128, h: 64, size: 40, color: '#f0f0f0', weight: 700 }), transparent: true }));
    okLabel.position.z = 0.047; kp.add(okLabel);
    [[-0.3, 0.08], [0.3, 0.08], [-0.28, -0.08], [0.28, -0.08]].forEach(([x, y]) => { const k = rbox(0.17, 0.11, 0.04, 0.03, m.key); k.position.set(x, y, 0); kp.add(k); });
    add(g, { explode: [0, 0, 1.05], stage: 0, shell: true, label: { key: 'keypad', title: 'Keypad', note: 'One-hand control with OK pad', anchor: [0, 1.42, 0.4] } });
  }

  // 8. grip with ribs, trigger and battery (angled like the photos)
  const gripPivot = new THREE.Vector3(0, 1.22, -0.04);
  const tilt = -0.3;
  {
    const m = mats();
    const g = part('grip');
    const inner = new THREE.Group(); inner.position.copy(gripPivot); inner.rotation.x = tilt; g.add(inner);
    const body = rbox(0.46, 1.02, 0.5, 0.18, m.rubber); body.position.set(0, -0.47, 0); inner.add(body);
    for (let i = 0; i < 7; i++) { const rib = rbox(0.4, 0.025, 0.04, 0.01, m.shell); rib.position.set(0, -0.38 - i * 0.075, 0.25); inner.add(rib); }
    const band = rbox(0.5, 0.05, 0.54, 0.05, m.chrome); band.position.set(0, -0.99, 0); inner.add(band);
    add(g, { explode: [0, -0.22, 0.25], stage: 1, label: { key: 'grip', title: 'Grip', note: 'Ribbed, sits well in a glove', anchor: [0.23, 0.75, 0.1] } });
  }
  {
    const m = mats();
    const g = part('trigger');
    const inner = new THREE.Group(); inner.position.copy(gripPivot); inner.rotation.x = tilt; g.add(inner);
    const t = rbox(0.14, 0.28, 0.14, 0.05, m.red); t.position.set(0, -0.18, -0.29); t.rotation.x = 0.25; inner.add(t);
    add(g, { explode: [0, -0.2, -0.55], stage: 1, label: { key: 'trigger', title: 'Trigger', note: 'Takes the picture', anchor: [0.07, 1.0, -0.35] } });
  }
  {
    const m = mats();
    const g = part('battery');
    const inner = new THREE.Group(); inner.position.copy(gripPivot); inner.rotation.x = tilt; g.add(inner);
    const bat = rbox(0.48, 0.34, 0.52, 0.12, m.rubber); bat.position.set(0, -1.19, 0); inner.add(bat);
    const latch = rbox(0.16, 0.12, 0.03, 0.02, m.key); latch.position.set(0, -1.2, 0.26); inner.add(latch);
    const dir = new THREE.Vector3(0, -1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt).multiplyScalar(0.95);
    add(g, { explode: [dir.x * 0.55, dir.y * 0.55 - 0.22, dir.z * 0.55 + 0.25], stage: 0, label: { key: 'battery', title: 'Battery', note: 'Swappable, charges in the camera', anchor: [0.24, 0.22, 0.2] } });
  }

  return { root, parts };
}

/* ---------- the other camera types, built from parts so they can come apart too ---------- */
// Lens faces +z for all of these. Each builder returns { root, parts } like buildHandheld.
function kit() {
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: 0x2a2b2f, roughness: 0.55, metalness: 0.12, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.88 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x5a5c61, roughness: 0.35, metalness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.3, metalness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd8443a, roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15161c, roughness: 0.04, metalness: 0.5, clearcoat: 1, envMapIntensity: 2.2 }),
    pcb: new THREE.MeshStandardMaterial({ map: pcbTexture(), roughness: 0.6, metalness: 0.1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.35, metalness: 0.8 }),
    screen: new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }),
  };
  const root = new THREE.Group();
  const parts = [];
  const cyl = (r1, r2, h, mat, seg = 48) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.rotation.x = Math.PI / 2; return m; };
  const add = (name, build, { explode, stage = 1, shell = false, key, anchor }) => {
    const g = new THREE.Group(); g.name = name; build(g);
    g.userData = { explode, stage, shell, label: { key, anchor } };
    root.add(g); parts.push(g); return g;
  };
  // a lens front: metal barrel, red ring, dark glass
  const lens = (g, r, depth) => {
    g.add(cyl(r, r * 1.04, depth, M.rubber));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.97, r * 0.06, 16, 64), M.red); ring.position.z = depth / 2; g.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 48), M.glass); glass.position.z = depth / 2 + 0.002; g.add(glass);
  };
  const board = (g, w, h) => {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), M.pcb));
    const chip = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 });
    [[-0.25, 0.2, 0.3], [0.25, -0.15, 0.22], [0.1, 0.25, 0.14]].forEach(([x, y, s]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, 0.03), chip); c.position.set(x * w, y * h, 0.028); g.add(c);
    });
  };
  const detector = (g, s) => {
    g.add(rbox(s, s, s * 0.22, s * 0.06, M.gold));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.6, s * 0.6), new THREE.MeshPhysicalMaterial({ color: 0x2a1650, roughness: 0.1, metalness: 0.6, clearcoat: 1 }));
    win.position.z = s * 0.115; g.add(win);
  };
  return { M, root, parts, add, cyl, lens, board, detector };
}

// pocket camera: screen on the back (−z), lenses on the front (+z) near the top
export function buildPocket() {
  const { M, root, parts, add, lens, board, detector } = kit();
  add('lens', (g) => { lens(g, 0.12, 0.06); const cam = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), M.glass); cam.position.set(0.24, 0, 0.032); g.add(cam); g.position.set(-0.08, 1.22, 0.16); },
    { explode: [0, 0, 1.25], stage: 1, key: 'lens', anchor: [0, 0.13, 0] });
  add('rear', (g) => { const b = rbox(0.74, 1.46, 0.14, 0.12, M.body); b.position.set(0, 0.78, 0.06); g.add(b); },
    { explode: [0, 0, 0.85], stage: 0, shell: true, key: 'front', anchor: [0.37, 0.5, 0.1] });
  add('detector', (g) => { detector(g, 0.2); g.position.set(-0.08, 1.22, 0.02); }, { explode: [0, 0, 0.45], stage: 2, key: 'detector', anchor: [0, 0.11, 0] });
  add('board', (g) => { board(g, 0.62, 0.9); g.position.set(0, 0.95, -0.02); }, { explode: [0, 0, 0.05], stage: 2, key: 'board', anchor: [0.31, 0.3, 0] });
  add('battery', (g) => { const b = rbox(0.56, 0.42, 0.05, 0.03, M.rubber); b.position.set(0, 0.35, -0.04); g.add(b); },
    { explode: [0, -0.55, -0.1], stage: 2, key: 'battery', anchor: [0.28, 0.35, 0] });
  add('display', (g) => {
    const f = rbox(0.74, 1.46, 0.08, 0.12, M.rubber); f.position.set(0, 0.78, -0.08); g.add(f);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), M.screen); s.position.set(0, 0.95, -0.125); s.rotation.y = Math.PI; g.add(s);
    const btn = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), M.red); btn.position.set(0, 0.36, -0.124); btn.rotation.y = Math.PI; g.add(btn);
  }, { explode: [0, 0, -0.75], stage: 0, key: 'display', anchor: [-0.3, 1.35, -0.13] });
  return { root, parts };
}

// smartphone camera (Mini X style): a small dual-lens body with a clip behind it
export function buildPhoneCam() {
  const { M, root, parts, add, lens, board, detector } = kit();
  add('lens', (g) => { lens(g, 0.11, 0.06); g.position.set(-0.22, 0.62, 0.2); }, { explode: [0, 0, 1.0], stage: 1, key: 'lens', anchor: [0, 0.12, 0] });
  add('visual', (g) => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), M.glass); g.add(c); const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 12, 40), M.trim); g.add(r); g.position.set(0.16, 0.62, 0.18); },
    { explode: [0.15, 0.25, 0.9], stage: 1, key: 'visual', anchor: [0, 0.07, 0] });
  add('front', (g) => { const b = rbox(0.95, 0.42, 0.18, 0.12, M.body); b.position.set(0, 0.62, 0.06); g.add(b); }, { explode: [0, 0, 0.6], stage: 0, shell: true, key: 'front', anchor: [0.47, 0.75, 0.1] });
  add('detector', (g) => { detector(g, 0.16); g.position.set(-0.22, 0.62, 0.02); }, { explode: [0, 0, 0.3], stage: 2, key: 'detector', anchor: [0, 0.09, 0] });
  add('board', (g) => { board(g, 0.8, 0.3); g.position.set(0, 0.62, -0.03); }, { explode: [0, 0.35, 0], stage: 2, key: 'board', anchor: [0.4, 0.15, 0] });
  add('battery', (g) => { const b = rbox(0.5, 0.2, 0.06, 0.03, M.rubber); b.position.set(0.1, 0.62, -0.08); g.add(b); }, { explode: [0, -0.4, -0.2], stage: 2, key: 'battery', anchor: [0.25, 0, 0] });
  add('clip', (g) => {
    const plate = rbox(0.5, 0.36, 0.06, 0.04, M.rubber); plate.position.set(0, 0.62, -0.16); g.add(plate);
    const arm = rbox(0.12, 0.9, 0.05, 0.03, M.trim); arm.position.set(0, 0.3, -0.2); g.add(arm);
  }, { explode: [0, 0, -0.7], stage: 0, key: 'clip', anchor: [0, -0.1, -0.2] });
  return { root, parts };
}

// shared tube for monocular and riflescope: objective at +z, eyepiece at −z
function tubeDevice({ length, radius, objR, scope }) {
  const { M, root, parts, add, cyl, lens, board, detector } = kit();
  const half = length / 2;
  const y = scope ? 0.55 : 0.45;
  add('lens', (g) => { lens(g, objR, 0.16); g.position.set(0, y, half + 0.1); }, { explode: [0, 0, 1.25], stage: 1, key: 'lens', anchor: [0, objR, 0] });
  add('focus', (g) => {
    const ring = cyl(objR * 1.02, objR * 1.02, 0.14, M.rubber); g.add(ring);
    for (let i = 0; i < 18; i++) { const rib = rbox(0.02, 0.04, 0.13, 0.008, M.trim); const a = (i / 18) * Math.PI * 2; rib.position.set(Math.cos(a) * objR * 1.03, Math.sin(a) * objR * 1.03, 0); rib.rotation.z = a; g.add(rib); }
    g.position.set(0, y, half - 0.08);
  }, { explode: [0, 0, 0.85], stage: 1, key: 'focus', anchor: [0, objR * 1.05, 0] });
  add('front', (g) => { const b = scope ? cyl(radius, radius, half, M.body) : rbox(radius * 2, radius * 2, half, radius * 0.8, M.body); b.position.set(0, y, half / 2 - 0.15); g.add(b); },
    { explode: [0, 0, 0.5], stage: 0, shell: true, key: 'front', anchor: [radius, radius * 0.5, 0] });
  add('detector', (g) => { detector(g, radius * 0.9); g.position.set(0, y, 0.15); }, { explode: [0, 0, 0.2], stage: 2, key: 'detector', anchor: [0, radius * 0.45, 0] });
  add('board', (g) => { board(g, radius * 1.5, radius * 1.4); g.rotation.x = Math.PI / 2; g.position.set(0, y, -0.15); }, { explode: [0, radius * 2.6, -0.1], stage: 2, key: 'board', anchor: [radius * 0.7, 0, 0] });
  add('display', (g) => { const m = rbox(radius * 1.1, radius * 0.9, 0.08, 0.02, M.metal); g.add(m); const s = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.8, radius * 0.6), M.screen); s.position.z = 0.042; g.add(s); g.position.set(0, y, -half * 0.55); },
    { explode: [0, 0, -0.45], stage: 2, key: 'display', anchor: [radius * 0.55, radius * 0.45, 0] });
  add('rear', (g) => {
    const b = scope ? cyl(radius, radius, half, M.body) : rbox(radius * 2, radius * 2, half, radius * 0.8, M.body); b.position.set(0, y, -half / 2 - 0.15); g.add(b);
    const keys = rbox(radius * 0.9, 0.06, half * 0.5, 0.03, M.trim); keys.position.set(0, y + radius + 0.02, -half / 2); g.add(keys);
    const red = rbox(0.08, 0.04, 0.08, 0.02, M.red); red.position.set(0, y + radius + 0.06, -half * 0.3); g.add(red);
  }, { explode: [0, 0, -0.8], stage: 0, shell: true, key: 'keypad', anchor: [0, radius + 0.06, -half * 0.3] });
  add('eyepiece', (g) => { g.add(cyl(radius * 0.75, radius * 0.8, 0.32, M.rubber)); g.position.set(0, y, -half - 0.3); }, { explode: [0, 0, -1.2], stage: 1, key: 'eyepiece', anchor: [0, radius * 0.8, 0] });
  add('battery', (g) => { g.add(cyl(radius * 0.38, radius * 0.38, half * 0.6, M.trim)); g.position.set(0, y - radius * 0.2, -0.3); }, { explode: [0, -radius * 3, 0], stage: 2, key: 'battery', anchor: [0, -radius * 0.38, 0] });
  if (scope) {
    add('mount', (g) => { const rail = rbox(0.24, 0.12, length * 0.55, 0.03, M.rubber); rail.position.set(0, y - radius - 0.08, 0); g.add(rail); }, { explode: [0, -0.7, 0], stage: 0, key: 'mount', anchor: [0, -0.06, length * 0.2] });
  }
  return { root, parts };
}
export const buildMonocular = () => tubeDevice({ length: 1.5, radius: 0.3, objR: 0.3 });
export const buildScope = () => tubeDevice({ length: 2.1, radius: 0.18, objR: 0.3, scope: true });

// binocular (Habrok style): thermal lens and day camera side by side, two eyepieces
export function buildBinocular() {
  const { M, root, parts, add, cyl, lens, board, detector } = kit();
  const y = 0.45;
  add('lens', (g) => { lens(g, 0.24, 0.18); g.position.set(0.36, y, 0.78); }, { explode: [0, 0, 1.0], stage: 1, key: 'lens', anchor: [0, 0.25, 0] });
  add('visual', (g) => { lens(g, 0.17, 0.12); g.position.set(-0.36, y, 0.74); }, { explode: [0, 0, 0.9], stage: 1, key: 'visual', anchor: [0, 0.18, 0] });
  add('front', (g) => {
    [-0.36, 0.36].forEach((x) => { const b = rbox(0.6, 0.6, 0.62, 0.22, M.body); b.position.set(x, y, 0.36); g.add(b); });
    const bridge = rbox(0.4, 0.34, 0.6, 0.1, M.rubber); bridge.position.set(0, y + 0.04, 0.36); g.add(bridge);
  }, { explode: [0, 0, 0.55], stage: 0, shell: true, key: 'front', anchor: [0.66, y + 0.2, 0.36] });
  add('detector', (g) => { detector(g, 0.22); g.position.set(0.36, y, 0.1); }, { explode: [0, 0, 0.3], stage: 2, key: 'detector', anchor: [0, 0.12, 0] });
  add('board', (g) => { board(g, 1.1, 0.5); g.rotation.x = Math.PI / 2; g.position.set(0, y, -0.05); }, { explode: [0, 0.75, 0], stage: 2, key: 'board', anchor: [0.5, 0, 0] });
  add('display', (g) => {
    [-0.36, 0.36].forEach((x) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.17), M.screen); s.position.set(x, 0, 0.01); g.add(s); const f = rbox(0.28, 0.22, 0.04, 0.02, M.metal); f.position.set(x, 0, -0.02); g.add(f); });
    g.position.set(0, y, -0.3);
  }, { explode: [0, 0, -0.35], stage: 2, key: 'display', anchor: [0.48, 0.1, 0] });
  add('rear', (g) => {
    [-0.36, 0.36].forEach((x) => { const b = rbox(0.6, 0.6, 0.55, 0.22, M.body); b.position.set(x, y, -0.32); g.add(b); });
    const keys = rbox(0.5, 0.06, 0.4, 0.03, M.trim); keys.position.set(0, y + 0.32, -0.3); g.add(keys);
  }, { explode: [0, 0, -0.7], stage: 0, shell: true, key: 'keypad', anchor: [0, y + 0.35, -0.3] });
  add('eyepiece', (g) => { [-0.36, 0.36].forEach((x) => { const e = cyl(0.17, 0.19, 0.26, M.rubber); e.position.set(x, 0, 0); g.add(e); }); g.position.set(0, y, -0.73); },
    { explode: [0, 0, -1.1], stage: 1, key: 'eyepiece', anchor: [0.36, 0.19, 0] });
  add('battery', (g) => { const b = rbox(0.34, 0.16, 0.5, 0.05, M.trim); b.position.set(0, y - 0.22, 0); g.add(b); }, { explode: [0, -0.7, 0], stage: 2, key: 'battery', anchor: [0, -0.08, 0] });
  return { root, parts };
}


// SP series (SP40 / SP60 / SP100H / SP120H): a camera body like a system camera, built from the
// HIKMICRO SP60 renders. Lens on the right end of the front (+z), 5" touch screen on the back (−z),
// OLED viewfinder on top in the middle, hand grip with strap on the left end of the front.
export function buildPro(name = 'SP60') {
  const { M, root, parts, add, cyl, board, detector } = kit();
  const W = 2.1, H = 1.25, D = 0.62, LX = 0.66, LY = 0.66;
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

  // lens: built by makeProLens so the product page can swap it for another focal length
  let holder;
  add('lens', (g) => {
    holder = new THREE.Group(); holder.name = 'lensHolder';
    holder.position.set(LX, LY, D / 2);
    holder.add(makeProLens(25));
    g.add(holder);
  }, { explode: [0, 0, 1.5], stage: 1, key: 'lens', anchor: [LX, LY + 0.4, D / 2 + 0.3] });

  // front shell with the grip and strap
  add('front', (g) => {
    g.add(mesh(new RoundedBoxGeometry(W, H, D / 2, 4, 0.1), M.body, 0, H / 2, D / 4));
    const grip = mesh(new RoundedBoxGeometry(0.62, H * 0.96, 0.4, 5, 0.17), M.rubber, -W / 2 + 0.33, H / 2, D / 2 + 0.12); g.add(grip);
    const strap = mesh(new RoundedBoxGeometry(0.34, H * 0.8, 0.06, 3, 0.03), M.rubber, -W / 2 + 0.33, H / 2, D / 2 + 0.34); g.add(strap);
    const warn = mesh(new THREE.CircleGeometry(0.035, 3), new THREE.MeshBasicMaterial({ color: 0xe9c400 }), -0.2, 0.25, D / 2 + 0.002); g.add(warn);
    const vis = cyl(0.05, 0.05, 0.03, M.glass, 32); vis.position.set(LX - 0.5, LY + 0.38, D / 2 + 0.01); g.add(vis);
  }, { explode: [0, 0, 0.75], stage: 0, shell: true, key: 'front', anchor: [-W / 2 + 0.33, H * 0.85, D / 2 + 0.3] });

  // shutter button on top of the grip
  add('trigger', (g) => { const b = cyl(0.09, 0.09, 0.06, M.red, 32); b.rotation.x = 0; b.position.set(-W / 2 + 0.33, H + 0.03, D / 2 + 0.05); g.add(b); },
    { explode: [0, 0.45, 0.4], stage: 1, key: 'trigger', anchor: [-W / 2 + 0.33, H + 0.06, D / 2 + 0.05] });

  // OLED viewfinder on top, eyecup towards the user
  add('viewfinder', (g) => {
    g.add(mesh(new RoundedBoxGeometry(0.52, 0.34, 0.5, 4, 0.08), M.body, 0.02, H + 0.15, -0.04));
    const cup = mesh(new RoundedBoxGeometry(0.46, 0.3, 0.14, 4, 0.1), M.rubber, 0.02, H + 0.16, -D / 2 - 0.05); g.add(cup);
    const ocular = mesh(new THREE.CircleGeometry(0.09, 32), M.glass, 0.02, H + 0.16, -D / 2 - 0.121); ocular.rotation.y = Math.PI; g.add(ocular);
  }, { explode: [0, 0.75, -0.2], stage: 1, key: 'viewfinder', anchor: [0.02, H + 0.32, -0.1] });

  // thermal detector behind the lens
  add('detector', (g) => { detector(g, 0.34); g.position.set(LX, LY, 0.12); }, { explode: [0, 0, 0.6], stage: 2, key: 'detector', anchor: [0, 0.17, 0] });
  add('board', (g) => { board(g, 1.6, 0.9); g.position.set(-0.05, H / 2, -0.02); }, { explode: [0, 0, -0.05], stage: 2, key: 'board', anchor: [0.8, 0.3, 0] });

  // rear shell with the buttons and the dial
  add('rear', (g) => {
    g.add(mesh(new RoundedBoxGeometry(W, H, D / 2, 4, 0.1), M.body, 0, H / 2, -D / 4));
    const k = (x, y) => { const b = cyl(0.055, 0.055, 0.04, M.rubber, 24); b.position.set(x, y, -D / 2 - 0.01); g.add(b); };
    [[-0.86, 0.95], [-0.86, 0.72], [-0.86, 0.49], [-0.86, 0.26]].forEach(([x, y]) => k(x, y));
    const dial = cyl(0.13, 0.13, 0.06, M.trim, 40); dial.rotation.x = 0; dial.position.set(-0.7, H + 0.03, -0.12); g.add(dial);
    const ok = cyl(0.09, 0.09, 0.05, M.rubber, 32); ok.position.set(-0.6, 1.02, -D / 2 - 0.01); g.add(ok);
  }, { explode: [0, 0, -0.75], stage: 0, shell: true, key: 'keypad', anchor: [-0.86, 0.72, -D / 2 - 0.02] });

  // 5" touch screen
  add('display', (g) => {
    g.add(mesh(new RoundedBoxGeometry(1.36, 0.86, 0.05, 3, 0.04), M.rubber, 0.12, 0.6, -D / 2 - 0.03));
    const scr = mesh(new THREE.PlaneGeometry(1.24, 0.74), M.screen, 0.12, 0.6, -D / 2 - 0.058); scr.rotation.y = Math.PI; g.add(scr);
  }, { explode: [0, 0, -1.3], stage: 1, key: 'display', anchor: [0.75, 0.95, -D / 2 - 0.06] });

  // battery slides out of the grip bottom
  add('battery', (g) => { g.add(mesh(new RoundedBoxGeometry(0.44, 0.14, 0.5, 3, 0.05), M.rubber, -W / 2 + 0.33, 0.04, D / 2 - 0.1)); },
    { explode: [0, -0.6, 0], stage: 2, key: 'battery', anchor: [-W / 2 + 0.33, 0.0, D / 2 + 0.1] });

  // model name on the top
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: labelTexture(name.split('-')[0]), transparent: true }));
  label.position.set(-0.45, H + 0.002, 0.1); label.rotation.x = -Math.PI / 2;
  parts.find((x) => x.name === 'front').add(label);
  return { root, parts, lensHolder: holder };
}

/* Interchangeable SP lens, mount at z = 0, front towards +z. The shape follows the focal
   length: a wide lens is short and broad, a telephoto long, the 8° super telephoto longest. */
export function makeProLens(deg) {
  const k = deg >= 34 ? { r: 0.37, len: 0.34, flare: 1.02 } : deg >= 17 ? { r: 0.38, len: 0.5, flare: 1 }
    : deg >= 9 ? { r: 0.4, len: 0.78, flare: 1.04 } : { r: 0.42, len: 1.06, flare: 1.12 };
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.88 });
  const body = new THREE.MeshPhysicalMaterial({ color: 0x2a2b2f, roughness: 0.5, metalness: 0.15, clearcoat: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8443a, roughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x5a5c61, roughness: 0.35, metalness: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x10131a, roughness: 0.05, metalness: 0.7, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.9, envMapIntensity: 2.4 });
  const g = new THREE.Group();
  const along = (mesh, z) => { mesh.rotation.x = Math.PI / 2; mesh.position.z = z; g.add(mesh); return mesh; };
  const rFront = k.r * k.flare;
  along(new THREE.Mesh(new THREE.CylinderGeometry(rFront, k.r, k.len, 64), body), k.len / 2);
  const red1 = new THREE.Mesh(new THREE.TorusGeometry(k.r + 0.008, 0.022, 12, 64), red); red1.position.z = 0.05; g.add(red1);
  const ribs = Math.max(6, Math.round(k.len * 26));
  for (let i = 0; i < ribs; i++) {
    const t = (0.14 + i * 0.018); if (t > k.len - 0.08) break;
    const rr = k.r + (rFront - k.r) * (t / k.len);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.012, 0.011, 8, 64), rubber); rib.position.z = t; g.add(rib);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rFront - 0.02, 0.034, 12, 64), trim); rim.position.z = k.len; g.add(rim);
  const front = new THREE.Mesh(new THREE.CircleGeometry(rFront - 0.04, 64), glass); front.position.z = k.len - 0.03; g.add(front);
  g.userData.length = k.len;
  return g;
}

/* G series clip-on lens: a ring that sits in front of the fixed lens (front towards −z). */
export function makeClipLens(kind) {
  const k = /3x/.test(kind) ? { r: 0.3, len: 0.62 } : /2x/.test(kind) ? { r: 0.28, len: 0.42 } : { r: 0.33, len: 0.2 };
  const body = new THREE.MeshPhysicalMaterial({ color: 0x232427, roughness: 0.55, metalness: 0.1, clearcoat: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.3, metalness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x15161c, roughness: 0.04, metalness: 0.5, clearcoat: 1, iridescence: 0.6, envMapIntensity: 2.2 });
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(k.r, k.r * 0.92, k.len, 64), body);
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -k.len / 2; g.add(barrel);
  const clip = new THREE.Mesh(new THREE.TorusGeometry(k.r * 0.9, 0.025, 12, 64), metal); clip.position.z = -0.02; g.add(clip);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(k.r - 0.02, 0.025, 12, 64), metal); rim.position.z = -k.len; g.add(rim);
  const front = new THREE.Mesh(new THREE.CircleGeometry(k.r - 0.04, 64), glass); front.rotation.y = Math.PI; front.position.z = -k.len + 0.02; g.add(front);
  return g;
}

export const BUILDERS = {
  pro: (name) => buildPro(name),
  pistol: (name) => buildHandheld({ model: name }),
  pocket: () => buildPocket(),
  phone: () => buildPhoneCam(),
  monocular: () => buildMonocular(),
  binocular: () => buildBinocular(),
  scope: () => buildScope(),
};
// for the wall: just the assembled model
export function buildSimple(type, name) {
  return (BUILDERS[type] || BUILDERS.pocket)(name).root;
}

/* ---------- real HIKMICRO CAD models ----------
   Mini2 V3 from HIKMICRO's STEP file (tools/cad-mini2.mjs groups the solids by part).
   The CAD has no colours, so the materials are set here. In the CAD file the lens
   faces −y and the plug points to +z, in millimetres; on the page the lens faces the
   viewer (+z) and the plug points up. */
// cameras with a real 3D model from HIKMICRO's CAD data (the others are illustrations)
// product id → GLB. The Mini2 V3 model (assets/models/mini2-v3.glb) is ready for when the
// Mini2 V3 joins the shop; it is not the Mini2Plus V2 (that one has another body and a focus lens).
export const CAD_MODELS = { 'mini2plus-v2': 'assets/models/mini2-v3.glb' }; // Martin's choice for the demo: shown on the Mini2Plus V2 until the Mini2 V3 has its own page
export async function buildCadMini(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const S = 1 / 68; // 68 mm wide → one unit, like the other models
  const P = (x, y, z) => [x * S, z * S, -y * S]; // a CAD point in page space
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: 0x232427, roughness: 0.5, metalness: 0.08, clearcoat: 0.35, clearcoatRoughness: 0.45 }),
    base: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.75 }),
    print: new THREE.MeshStandardMaterial({ color: 0xc9cacd, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1a1430, roughness: 0.06, metalness: 0.6, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 2.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8bbc1, roughness: 0.28, metalness: 0.95 }),
    inner: new THREE.MeshStandardMaterial({ color: 0x3a3c41, roughness: 0.6, metalness: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.35, metalness: 0.8 }),
  };
  // outer parts from the CAD file; spaced along the lens axis (+z) like a technical drawing
  const PARTS = {
    shell: { from: ['shell', 'printTop'], explode: [0, 0, -0.62], stage: 0, shell: true, label: { key: 'front', anchor: P(26, 6.4, 22) } },
    panel: { from: ['panel', 'printBase'], explode: [0, 0, 0.5], stage: 0 },
    lens: { from: ['lens'], explode: [0, 0, 0.98], stage: 1, label: { key: 'lens', anchor: P(-18, -7.6, 19) } },
    window: { from: ['window'], explode: [0, 0, 0.38], stage: 2 },
    plug: { from: ['plug'], explode: [0, 0.58, 0], stage: 1, label: { key: 'plug', title: 'USB-C plug', note: 'Plugs straight into your phone', anchor: P(0, 0, 41) } },
    plugBlock: { from: ['plugBlock'], explode: [0, 0.34, 0], stage: 2 },
    base: { from: ['base'], explode: [0, 0, 0], stage: 0 },
  };
  const matFor = { shell: M.body, printTop: M.print, panel: M.base, printBase: M.print, lens: M.glass, window: M.gold, plug: M.metal, plugBlock: M.inner, base: M.body };
  const src = {}; gltf.scene.children.forEach((n) => { src[n.name] = n; });
  const root = new THREE.Group(); const parts = [];
  const addPart = (name, obj, d) => {
    obj.name = name;
    obj.userData = { explode: d.explode, stage: d.stage, shell: !!d.shell, label: d.label || null };
    root.add(obj); parts.push(obj); return obj;
  };
  for (const [name, d] of Object.entries(PARTS)) {
    const part = new THREE.Group();
    const inner = new THREE.Group(); inner.rotation.x = -Math.PI / 2; inner.scale.setScalar(S); part.add(inner);
    d.from.forEach((k) => {
      const n = src[k]; if (!n) return;
      n.traverse((o) => { if (o.isMesh) o.material = matFor[k]; });
      inner.add(n);
    });
    addPart(name, part, d);
  }

  /* inner parts: the CAD file only has the outside, so the inside is illustrated
     (sensor, optics, board, flex cable), sized to fit the real housing */
  const [lx, ly] = P(-18, 0, 15.9); // lens axis on the page
  const k = kit();
  const germanium = new THREE.MeshPhysicalMaterial({ color: 0x3b3d44, roughness: 0.12, metalness: 0.85, clearcoat: 1, iridescence: 0.4, envMapIntensity: 1.8 });
  const disc = (r, t, z) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 48), germanium); m.rotation.x = Math.PI / 2; g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t * 0.35, 10, 48), M.metal); g.add(ring);
    g.position.set(lx, ly, z); return g;
  };
  addPart('optic1', disc(0.044, 0.012, 0.04), { explode: [0, 0, 0.82], stage: 2 });
  addPart('optic2', disc(0.04, 0.01, 0.025), { explode: [0, 0, 0.68], stage: 2, label: { key: 'optics', title: 'Germanium optics', note: 'Let long-wave infrared through, unlike glass', anchor: [0.04, 0.03, 0] } });
  { // thermal sensor on its carrier
    const g = new THREE.Group(); k.detector(g, 0.1); g.position.set(lx, ly, 0.0);
    addPart('detector', g, { explode: [0, 0, 0.24], stage: 3, label: { key: 'detector', anchor: [0, 0.06, 0] } });
  }
  { // main board behind the sensor
    const g = new THREE.Group(); k.board(g, 0.84, 0.36); g.position.set(0, 0.235, -0.035);
    addPart('board', g, { explode: [0, 0, -0.3], stage: 3, label: { key: 'board', anchor: [0.38, 0.12, 0] } });
  }
  { // flex cable from the board to the plug
    const g = new THREE.Group();
    const flex = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.006), new THREE.MeshStandardMaterial({ color: 0xc8862e, roughness: 0.45, metalness: 0.2 }));
    g.add(flex); g.position.set(0, 0.4, -0.03);
    addPart('flex', g, { explode: [0, 0.16, -0.3], stage: 3 });
  }
  return { root, parts, cad: true };
}
