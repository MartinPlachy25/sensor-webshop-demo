/* HIKMICRO shop (SENSOR GmbH) – homepage demo
   Start (buyer, then area), a wall of cameras with comparison, and a band
   with a small lens showing a simulated thermal view. 3D lives in wall3d.js. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';

  /* ---------- Scenes ---------- */
  const inR = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const edge = (x, y, r, d) => inR(x, y, r) && !inR(x, y, [r[0] + d, r[1] + d * 1.5, r[2] - d, r[3] - d * 1.5]);
  // outside the house: the front at dusk, the solar roof at noon, the heat pump in the garden
  const FRONT_HOUSE = [[0.19, 0.5], [0.31, 0.395], [0.43, 0.222], [0.52, 0.285], [0.555, 0.28], [0.64, 0.278], [0.69, 0.298], [0.82, 0.335], [0.84, 0.5], [0.845, 0.735], [0.19, 0.735]];
  const FRONT_WIN = [[0.358, 0.4, 0.41, 0.468], [0.461, 0.385, 0.52, 0.468], [0.58, 0.385, 0.617, 0.465], [0.675, 0.548, 0.74, 0.64], [0.137, 0.578, 0.168, 0.64]];
  // solar roof: the modules sit in three rows, drawn in perspective
  const PV_ROWS = [[0.118, 0.372, [0.33, 0.515, 0.69]], [0.372, 0.637, [0.1, 0.3, 0.49, 0.685, 0.86]], [0.64, 0.93, [0.06, 0.27, 0.47, 0.665, 0.86]]];
  function pvModule(x, y) {
    const yp = y - 0.035 * x;
    for (let r = 0; r < 3; r++) {
      const [t, b, cols] = PV_ROWS[r];
      if (yp < t || yp > b) continue;
      const c = x - (0.5 + 0.15 * x) * (yp - t);
      for (let k = 0; k < cols.length - 1; k++) if (c >= cols[k] && c < cols[k + 1]) return { r, k, f: (c - cols[k]) / (cols[k + 1] - cols[k]), g: (yp - t) / (b - t) };
    }
    return null;
  }
  // Positions are fractions of the photograph (0–1). Temperatures in °C.
  const SCENES = {
    outdoor: {
      pos: [0.5, 0.62],
      subject: [0.535, 0.6],
      temps: [5, 39],
      caption: 'Roe deer behind the treeline',
      heat(px) {
        const { r, g, b, x, y, lumBlur } = px;
        let h = 0.1 + 0.3 * lumBlur;
        const inBox = x > 0.4 && x < 0.7 && y > 0.44 && y < 0.86;
        px.mask = inBox && r > 80 && r > g * 1.16 && r > b * 1.3 ? 1 : 0;
        return h;
      },
      maskGain: 0.66,
      spots: [],
    },
    industry: {
      pos: [0.5, 0.6],
      subject: [0.632, 0.42],
      temps: [22, 94],
      caption: 'Fuse holder running hot under load',
      heat(px) {
        px.mask = 0;
        return 0.2 + 0.28 * px.lumBlur;
      },
      maskGain: 0,
      spots: [
        // x, y, radiusX, radiusY, strength
        [0.632, 0.42, 0.045, 0.12, 0.7],
        [0.478, 0.77, 0.04, 0.06, 0.4],
        [0.565, 0.67, 0.03, 0.05, 0.26],
        [0.43, 0.6, 0.03, 0.05, 0.18],
      ],
    },
    fire: {
      pos: [0.42, 0.6],
      subject: [0.41, 0.6],
      temps: [14, 260],
      caption: 'Firefighter and glowing wood, seen through the smoke',
      heat(px) {
        px.mask = 0;
        return window.HM_FIRE_HEAT(px.r, px.g, px.b, px.lumBlur, px.x, px.y);
      },
      maskGain: 0,
      detail: 0.35,
      spots: [],
    },
    building: {
      pos: [0.5, 0.45],
      subject: [0.515, 0.4],
      temps: [-3, 21],
      caption: 'Heat escaping through the glazing',
      heat(px) {
        const { r, g, b, x, y, lum, lumBlur } = px;
        const sky = y < 0.36 && b > r * 0.85 && lum > 0.35;
        px.mask = y > 0.3 && lum > 0.6 && r > b * 1.15 ? 1 : 0;
        return sky ? 0.03 : 0.12 + 0.24 * lumBlur;
      },
      maskGain: 0.5,
      spots: [
        [0.515, 0.42, 0.11, 0.13, 0.12],
        [0.515, 0.7, 0.09, 0.08, 0.14],
      ],
      findings: [
        { at: [0.515, 0.42], r: 0.09, kind: 'glass', title: 'Warm glow at the windows', text: 'Heat leaves through frames and glazing. Glass also reflects, so a good check looks at frames and walls too.' },
        { at: [0.515, 0.7], r: 0.08, kind: 'hot', title: 'Heat escaping downstairs', text: 'The ground floor loses more heat than the walls around it. Worth a closer look from inside.' },
      ],
    },
    // Inside the house: one photo per room, heat drawn by hand where it really is.
    kitchen: {
      pos: [0.5, 0.5],
      subject: [0.56, 0.45],
      temps: [8, 68],
      caption: 'Kitchen',
      detail: 0.13,
      levels: [0.02, 0.56],
      soft: 2,
      heat(px) {
        const { x, y, lum, lumBlur } = px;
        px.mask = 0;
        let h = 0.2 + 0.04 * lumBlur;
        if (inR(x, y, [0.84, 0.08, 1, 0.5])) h = 0.15 + 0.03 * lum; // blinds, cooled by the glass behind
        if (inR(x, y, [0.565, 0.245, 0.84, 0.475])) { h = 0.165 + 0.01 * lumBlur; px.flat = 1; } // glass: a mirror of the room
        if (inR(x, y, [0.565, 0.475, 0.84, 0.497])) h = 0.07; // leaky seal
        if (x < 0.14) h = 0.18 + 0.02 * lumBlur; // fridge door
        if (inR(x, y, [0.1, 0.18, 0.125, 0.62])) h = 0.08; // cold air at the door seal
        if (y > 0.64 && x > 0.12 && x < 0.83) h += 0.07 * lum * lum; // floor warmed by the sun
        return h + 0.05 * (0.45 - y); // warm air collects under the ceiling, the floor is cooler
      },
      maskGain: 0,
      spots: [
        [0.45, 0.527, 0.05, 0.018, 0.62],
        [0.405, 0.517, 0.035, 0.014, 0.38],
        [0.785, 0.49, 0.02, 0.03, 0.22],
      ],
      findings: [
        { at: [0.7, 0.36], r: 0.09, kind: 'glass', title: 'Glass reflects heat', text: 'A thermal camera cannot see through glass. The window shows a reflection of the room, not the street behind it.' },
        { at: [0.7, 0.486], r: 0.05, kind: 'cold', title: 'Cold air at the window seal', text: 'The seal has gone hard. Cold air gets in along the bottom of the frame.' },
        { at: [0.44, 0.525], r: 0.06, kind: 'hot', title: 'Hob still hot', text: 'Long after cooking the hob is still far too hot to touch. The camera shows it at a glance.' },
        { at: [0.112, 0.4], r: 0.05, kind: 'cold', title: 'Fridge door seal leaks', text: 'Cold air escapes along the door, so the fridge runs longer and uses more power.' },
      ],
    },
    bathroom: {
      pos: [0.5, 0.6],
      subject: [0.72, 0.86],
      temps: [8, 58],
      caption: 'Bathroom',
      levels: [0.08, 0.74],
      soft: 2,
      detail: 0.1,
      heat(px) {
        const { x, y, lum } = px;
        px.mask = 0; px.flat = 0;
        let h = 0.3 + 0.015 * lum; // tiles: dark or white, the same temperature
        if (inR(x, y, [0, 0.58, 0.51, 1])) h = 0.29 + 0.01 * lum; // bath
        if (inR(x, y, [0.195, 0.18, 0.405, 0.43])) { h = 0.29; px.flat = 1; } // mirror: a reflection
        if (inR(x, y, [0.448, 0.3, 0.585, 0.665])) { h = 0.28; px.flat = 1; } // shower glass: a reflection
        if (inR(x, y, [0.6, 0.04, 0.93, 0.1])) h = 0.17; // cold lintel above the window
        if (inR(x, y, [0.6, 0.09, 0.925, 0.525])) h = 0.25; // window frame
        if (inR(x, y, [0.625, 0.12, 0.905, 0.37])) { h = 0.2; px.flat = 1; } // glass
        if (inR(x, y, [0.62, 0.36, 0.912, 0.495])) h = 0.215 + 0.02 * lum; // curtain cooled by the glass
        if (inR(x, y, [0.59, 0.5, 0.925, 0.535])) h = 0.29; // sill
        if (inR(x, y, [0.655, 0.53, 0.79, 0.575])) h = 0.42; // warm air rising from the radiator
        if (inR(x, y, [0.668, 0.57, 0.778, 0.71])) h = 0.5 + 0.16 * lum * lum; // radiator fins
        // floor with underfloor heating: one warm line per pipe, seen in perspective
        const yWall = x < 0.6 ? 0.67 : 0.68 + 0.4 * (x - 0.6);
        if (y > yWall && x > 0.505 - (y - 0.69) * 0.05) {
          const yd = y - 0.4 * Math.max(0, x - 0.6);
          const wk = (1 / Math.max(0.02, yd - 0.5)) * 2.3;
          const idx = Math.floor(wk); const f = wk - idx;
          const pipe = Math.exp(-(((f - 0.5) / 0.14) ** 2));
          const cold = idx === 9 || idx === 10; // one loop with air in it
          h = 0.36 + pipe * (cold ? 0.015 : 0.16) - (cold ? 0.03 : 0);
          px.flat = 1; // black and white tiles look alike: the camera sees heat, not colour
        }
        return h;
      },
      maskGain: 0,
      spots: [
        [0.05, 0.585, 0.06, 0.007, 0.22], // hot water pipe in the wall
        [0.495, 0.18, 0.008, 0.008, 0.35], // ceiling light
        [0.772, 0.7, 0.008, 0.012, 0.25], // radiator valve
      ],
      findings: [
        { at: [0.66, 0.93], r: 0.05, kind: 'hot', title: 'Underfloor heating', text: 'Every warm line is a heating pipe under the tiles. You see exactly where they run before you drill.' },
        { at: [0.75, 0.8], r: 0.045, kind: 'cold', title: 'One loop stays cold', text: 'Air in the circuit or a closed valve. Without a thermal camera you would have to open the floor to find it.' },
        { at: [0.92, 0.97], r: 0.04, kind: 'glass', title: 'Black or white: no difference', text: 'Dark and light tiles show the same temperature. A thermal camera measures heat, not colour.' },
        { at: [0.76, 0.25], r: 0.08, kind: 'glass', title: 'Glass reflects heat', text: 'You cannot see the garden through the window. Glass reflects heat like a mirror, the shower door too.' },
        { at: [0.72, 0.64], r: 0.05, kind: 'ok', title: 'Radiator works', text: 'Hot across all fins, with warm air rising up the wall.' },
        { at: [0.05, 0.585], r: 0.05, kind: 'hot', title: 'Hidden hot water pipe', text: 'The pipe to the bath taps shows through the tiles. Good to know before you drill a hole.' },
        { at: [0.76, 0.07], r: 0.05, kind: 'cold', title: 'Cold lintel above the window', text: 'The beam above the window lets heat out: a thermal bridge, where damp collects first.' },
      ],
    },
    living: {
      pos: [0.5, 0.5],
      subject: [0.46, 0.62],
      temps: [6, 62],
      caption: 'Living room',
      detail: 0.12,
      levels: [0.06, 0.68],
      soft: 2,
      heat(px) {
        const { x, y, lum, lumBlur } = px;
        px.mask = 0;
        let h = 0.25 + 0.03 * lumBlur;
        if (inR(x, y, [0.305, 0.1, 0.618, 0.3])) h = 0.18 + (y - 0.1) * 0.1; // blind, colder at the top
        if (inR(x, y, [0.32, 0.3, 0.605, 0.53])) { h = 0.19; px.flat = 1; } // glass: reflection
        if (inR(x, y, [0.305, 0.3, 0.325, 0.535]) || inR(x, y, [0.598, 0.3, 0.618, 0.535])) h = 0.1; // draught at the frame
        if (inR(x, y, [0.31, 0.53, 0.615, 0.56])) h = 0.32; // sill warmed from below
        if (inR(x, y, [0.395, 0.565, 0.532, 0.675])) h = 0.52 + 0.14 * lum * lum + 0.04 * Math.cos(x * 900); // radiator: the fins show
        if (y > 0.7 && x < 0.42) h += 0.06 * lum * lum; // sun on the floor
        return h + 0.05 * (0.45 - y); // warm air under the ceiling
      },
      maskGain: 0,
      spots: [
        [0, 0, 0.2, 0.1, -0.13],
        [0.68, 0, 0.15, 0.07, -0.08],
        [0.07, 0.765, 0.012, 0.014, 0.16],
        [0.633, 0.47, 0.012, 0.012, 0.3],
      ],
      findings: [
        { at: [0.46, 0.42], r: 0.09, kind: 'glass', title: 'Glass reflects heat', text: 'You cannot look through a window with a thermal camera. The glass shows a reflection, not the garden.' },
        { at: [0.46, 0.62], r: 0.07, kind: 'ok', title: 'Radiator works', text: 'Hot from top to bottom: no air inside, no need to bleed it.' },
        { at: [0.315, 0.42], r: 0.04, kind: 'cold', title: 'Draught at the window frame', text: 'Cold air leaks in at the side of the frame. New seals or foam fix it.' },
        { at: [0.05, 0.04], r: 0.07, kind: 'cold', title: 'Thermal bridge in the corner', text: 'The corner between outer wall and ceiling is colder. Damp collects here first.' },
        { at: [0.07, 0.765], r: 0.04, kind: 'hot', title: 'Socket under load', text: 'Slightly warm is normal. A socket above 50 °C is a fire risk and needs an electrician.' },
      ],
    },
  };
  Object.assign(SCENES, {
    front: {
      pos: [0.5, 0.55],
      subject: [0.6, 0.6],
      temps: [-8, 20],
      caption: 'Front of the house, winter evening',
      detail: 0.08,
      levels: [0.02, 0.8],
      soft: 3,
      heat(px) {
        const { x, y, r, g, b, lum, lumBlur } = px;
        px.mask = 0; px.flat = 0;
        if (y > 0.735) { // street, wet drive and lawn: wet ground mirrors the house a little
          if (g > r * 1.08 && g > b) return 0.2 + 0.03 * lum;
          return 0.15 + 0.12 * lumBlur * lumBlur + (y < 0.75 ? 0.08 : 0);
        }
        const neighbour = (x < 0.19 && y > 0.49) || (x > 0.845 && y > 0.52);
        if (!neighbour && !inPoly(x, y, FRONT_HOUSE)) { px.flat = 1; return 0.01 + 0.07 * y; } // clear sky: very cold
        if (neighbour) {
          if (inR(x, y, FRONT_WIN[4])) return edge(x, y, FRONT_WIN[4], 0.004) ? 0.48 : 0.41;
          return (lum < 0.3 ? 0.21 : 0.29) + 0.03 * lumBlur;
        }
        let h = lum < 0.3 && b > r * 0.9 ? 0.2 + 0.02 * lumBlur : 0.31 + 0.03 * lumBlur; // roof or wall
        if (inR(x, y, [0.66, 0.35, 0.79, 0.47]) && lum < 0.3) h += 0.1 + 0.05 * Math.cos(x * 520); // roof: no insulation between the rafters
        for (let i = 0; i < 4; i++) {
          const w = FRONT_WIN[i];
          if (!inR(x, y, w)) continue;
          px.flat = 1;
          h = edge(x, y, w, 0.005) ? 0.5 : 0.38 + 0.08 * ((y - w[1]) / (w[3] - w[1])); // glass mirrors the cold sky at the top
          if (i === 0 && (x < w[0] + 0.006 || y > w[3] - 0.008)) h = 0.7; // leaky frame
        }
        if (inR(x, y, [0.333, 0.565, 0.505, 0.712])) h = y > 0.7 ? 0.66 : (y < 0.588 ? 0.47 : 0.43); // garage door, warm air under the seal
        if (inR(x, y, [0.226, 0.565, 0.301, 0.697])) h = 0.4;
        if (inR(x, y, [0.583, 0.574, 0.614, 0.69])) h = edge(x, y, [0.583, 0.574, 0.614, 0.69], 0.004) ? 0.72 : 0.52; // front door
        if (inR(x, y, [0.58, 0.551, 0.616, 0.567])) h = 0.46;
        if (inR(x, y, [0.545, 0.527, 0.79, 0.547]) && lum > 0.3) h += 0.13; // floor slab: a thermal bridge
        if (y > 0.705 && y < 0.735) h += 0.04; // base of the wall
        return h;
      },
      maskGain: 0,
      spots: [
        [0.311, 0.574, 0.006, 0.01, 0.7], [0.519, 0.574, 0.006, 0.01, 0.7], // outside lamps
        [0.559, 0.268, 0.006, 0.014, 0.35], // flue
      ],
      findings: [
        { at: [0.72, 0.41], r: 0.07, kind: 'hot', title: 'Heat escaping through the roof', text: 'Warm stripes between the rafters: the insulation is missing or has slipped. In winter this costs money every day.' },
        { at: [0.36, 0.44], r: 0.035, kind: 'hot', title: 'Window frame leaks', text: 'The frame glows along the side and the sill. Worn seals or a gap in the fitting let warm air out.' },
        { at: [0.49, 0.43], r: 0.04, kind: 'glass', title: 'Glass mirrors the sky', text: 'The panes look cooler at the top because glass reflects the cold sky. Judge windows by their frames.' },
        { at: [0.42, 0.705], r: 0.05, kind: 'hot', title: 'Garage door seal', text: 'Warm air escapes under the door. A new floor seal pays for itself quickly.' },
        { at: [0.598, 0.63], r: 0.035, kind: 'hot', title: 'Front door loses heat', text: 'A warm outline all around the door: it no longer closes tight.' },
        { at: [0.67, 0.537], r: 0.05, kind: 'hot', title: 'Thermal bridge at the floor slab', text: 'Where the concrete floor meets the outer wall, heat finds a shortcut outside. Damp can collect inside along this line.' },
      ],
    },
    solar: {
      pos: [0.5, 0.5],
      subject: [0.42, 0.52],
      temps: [12, 78],
      caption: 'Solar panels at noon, under load',
      detail: 0.06,
      levels: [0.12, 0.86],
      soft: 2,
      heat(px) {
        const { x, y, r, g, b, lum, lumBlur } = px;
        px.mask = 0; px.flat = 0;
        if (inR(x, y, [0.81, 0.3, 0.98, 0.52])) { // roof window: glass mirrors the sky
          if (g > r * 1.05) return 0.2;
          px.flat = !edge(x, y, [0.81, 0.3, 0.98, 0.52], 0.012) ? 1 : 0;
          return px.flat ? 0.1 : 0.36;
        }
        if (x > 0.7 && y > 0.32 && g > r * 0.95 && g > b) return 0.2 + 0.05 * lumBlur; // leaves: shade and evaporation keep them cool
        const m = pvModule(x, y);
        if (m && !(r > g * 1.45)) {
          if (lum > 0.62) return 0.36; // aluminium frame reflects
          let h = 0.5 + 0.02 * lum + 0.04 * m.g; // warmer towards the bottom, where less air flows
          if (m.r === 2 && m.k === 1) h += 0.1; // a module that is not connected
          if (m.r === 1 && m.k === 2 && m.f > 0.66) h += 0.13; // one third of a module: bypass diode
          return h;
        }
        return 0.38 + 0.06 * lumBlur; // tiles: hot in the sun, but less than working panels
      },
      maskGain: 0,
      spots: [
        [0.405, 0.525, 0.008, 0.011, 0.42], // one cell burning hot
        [0.445, 0.225, 0.009, 0.011, 0.22], // dirt on the glass
        [0.7, 0.76, 0.011, 0.015, 0.2], // shaded by the tree
      ],
      findings: [
        { at: [0.405, 0.525], r: 0.04, kind: 'hot', title: 'One cell runs hot', text: 'A damaged cell turns power into heat instead of electricity. Hot spots like this can burn through the module.' },
        { at: [0.65, 0.5], r: 0.06, kind: 'hot', title: 'Bypass diode switched on', text: 'One third of the module is warmer than the rest: that part no longer produces power.' },
        { at: [0.42, 0.79], r: 0.07, kind: 'hot', title: 'Module not connected', text: 'The whole module is evenly warmer. It is not feeding in: check the plug and the cable.' },
        { at: [0.445, 0.225], r: 0.035, kind: 'hot', title: 'Dirt on the glass', text: 'Bird droppings or leaves shade a cell, and the cell heats up. Cleaning fixes it.' },
        { at: [0.7, 0.76], r: 0.04, kind: 'hot', title: 'Shade from the tree', text: 'Shaded cells heat up and slow down the whole string. Trim the branches.' },
        { at: [0.89, 0.41], r: 0.06, kind: 'glass', title: 'Roof window mirrors the sky', text: 'The glass shows the cold sky, not the room below. Glass always reflects.' },
      ],
    },
    heatpump: {
      pos: [0.5, 0.5],
      subject: [0.47, 0.42],
      temps: [-4, 30],
      caption: 'Heat pump in the garden',
      detail: 0.12,
      levels: [0, 0.82],
      soft: 2,
      heat(px) {
        const { x, y, lum, lumBlur, green } = px;
        px.mask = 0; px.flat = 0;
        if (inR(x, y, [0.355, 0.205, 0.715, 0.245])) return 0.32; // lid
        if (inR(x, y, [0.355, 0.245, 0.425, 0.69])) return 0.5 + 0.12 * ((y - 0.245) / 0.445); // compressor behind the panel
        if (inR(x, y, [0.425, 0.24, 0.64, 0.69])) { // fan: it blows out air colder than the garden
          const d = Math.hypot((x - 0.535) / 0.11, (y - 0.465) / 0.2);
          return 0.06 + 0.08 * Math.min(1, d) + 0.03 * lum;
        }
        if (inR(x, y, [0.64, 0.24, 0.715, 0.69])) return 0.06 + 0.03 * lum; // evaporator fins, ice cold
        if (inR(x, y, [0.36, 0.69, 0.705, 0.82])) return 0.25 + 0.03 * lumBlur; // base
        if (inR(x, y, [0.435, 0, 0.453, 0.235])) return 0.27; // downpipe
        if (inR(x, y, [0.715, 0.255, 1, 0.292])) return x < 0.9 ? 0.58 : 0.5; // window sill, a thermal bridge
        if (inR(x, y, [0.71, 0, 1, 0.26])) { px.flat = 1; return x < 0.724 ? 0.46 : 0.12 + 0.03 * y; } // frame, and glass that mirrors the sky
        if (green > 0.1) { // leaves and grass
          let h = 0.25 + 0.07 * lumBlur;
          if (y > 0.78) h -= 0.08 * Math.exp(-(((x - 0.54) / 0.17) ** 2)); // grass where the cold air lands
          if (y > 0.29) h -= 0.11 * Math.exp(-(((x - 0.72) / 0.09) ** 2)); // bush at the air intake, chilled
          return h;
        }
        if (x < 0.13 && y < 0.45) return lumBlur > 0.8 ? 0.05 : 0.34; // sky and the house next door
        if (y > 0.8) return 0.21 + 0.03 * lumBlur; // soil
        if (y < 0.2 && x < 0.42) return lumBlur > 0.75 ? 0.06 : 0.27; // sky between the branches
        if (x < 0.355 && y > 0.18) return 0.24 + 0.05 * lumBlur; // deep shade inside the hedge
        if (x > 0.715 && y > 0.29) return 0.2 + 0.05 * lumBlur; // gaps in the bush
        return 0.38 + 0.02 * lumBlur; // brick wall
      },
      maskGain: 0,
      spots: [[0.39, 0.6, 0.03, 0.06, 0.08]],
      findings: [
        { at: [0.535, 0.46], r: 0.08, kind: 'ok', title: 'Cold air out: it works', text: 'The heat pump takes warmth out of the outside air, so the air it blows out is colder. A cold fan is a good sign.' },
        { at: [0.39, 0.55], r: 0.05, kind: 'ok', title: 'Compressor runs warm', text: 'Warm is normal. Take a picture every year: a part that gets hotter over time needs a service.' },
        { at: [0.77, 0.5], r: 0.07, kind: 'cold', title: 'Air intake blocked', text: 'The bush grows right at the intake. The heat pump breathes in its own cold air and works harder. Keep the sides free.' },
        { at: [0.82, 0.275], r: 0.045, kind: 'hot', title: 'Warm window sill', text: 'The sill carries heat from the room straight outside: a thermal bridge, typical for older windows.' },
        { at: [0.86, 0.12], r: 0.07, kind: 'glass', title: 'Glass reflects heat', text: 'You cannot see into the room. The window mirrors the sky, like every pane of glass.' },
      ],
    },
  });
  SCENES.industry.findings = [
    { at: [0.632, 0.42], r: 0.06, kind: 'hot', title: 'Fuse holder running hot', text: 'Much hotter than its neighbours under the same load: a loose contact, found before it fails.' },
  ];

  // Ironbow palette, the classic look of a thermal camera.
  const STOPS = [
    [0, [6, 3, 18]], [0.16, [32, 10, 78]], [0.32, [92, 14, 120]], [0.47, [168, 18, 108]],
    [0.6, [218, 36, 46]], [0.72, [240, 90, 26]], [0.84, [251, 166, 30]], [0.94, [253, 226, 122]], [1, [255, 255, 255]],
  ];
  const LUT = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    const [t0, c0] = STOPS[k];
    const [t1, c1] = STOPS[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    for (let c = 0; c < 3; c++) LUT[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
  }

  function boxBlur(src, w, h, radius) {
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    const size = radius * 2 + 1;
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -radius; x <= radius; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / size;
        acc += src[row + Math.min(w - 1, x + radius + 1)] - src[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / size;
        acc += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
      }
    }
    return out;
  }

  // Turns a photograph into a thermal picture plus a heat map for the readout.
  // phones get a smaller thermal picture: a quarter of the work, still sharp on the small screen
  const THERMAL_W = Math.min(screen.width, screen.height) < 700 ? 440 : 800;
  function buildThermal(img, scene, W = THERMAL_W) {
    const H = Math.round((W * img.naturalHeight) / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H);
    const d = data.data;
    const n = W * H;
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    const lumBlur = boxBlur(boxBlur(lum, W, H, 5), W, H, 3);
    // how green each spot is, smoothed: leaves and grass as soft shapes, not speckles
    const grn = new Float32Array(n);
    for (let i = 0; i < n; i++) grn[i] = (d[i * 4 + 1] - (d[i * 4] + d[i * 4 + 2]) / 2) / (d[i * 4 + 1] + 30); // dark hedges count too
    const green = boxBlur(grn, W, H, 3);

    const base = new Float32Array(n);
    const flat = new Uint8Array(n);
    let mask = new Float32Array(n);
    const px = {};
    for (let i = 0; i < n; i++) {
      px.r = d[i * 4]; px.g = d[i * 4 + 1]; px.b = d[i * 4 + 2];
      px.x = (i % W) / W; px.y = Math.floor(i / W) / H;
      px.lum = lum[i]; px.lumBlur = lumBlur[i]; px.green = green[i];
      base[i] = scene.heat(px);
      mask[i] = px.mask;
      flat[i] = px.flat ? 1 : 0;
    }
    // real thermal pictures show the outlines of things faintly: add a little of the photo's fine detail
    if (scene.detail) {
      const wide = boxBlur(lum, W, H, 10);
      for (let i = 0; i < n; i++) if (!flat[i]) base[i] += scene.detail * (lum[i] - wide[i]);
    }
    mask = boxBlur(boxBlur(mask, W, H, 4), W, H, 2);
    const baseSoft = boxBlur(base, W, H, scene.soft || 2);

    const heat = new Float32Array(n);
    const lv = scene.levels; // colour stretch: room temperature sits mid-palette, hot goes white, cold goes dark
    for (let i = 0; i < n; i++) {
      const x = (i % W) / W;
      const y = Math.floor(i / W) / H;
      let h = baseSoft[i] + Math.min(1, mask[i] * 2.2) * scene.maskGain;
      for (const [sx, sy, rx, ry, s] of scene.spots) {
        const dx = (x - sx) / rx;
        const dy = (y - sy) / ry;
        const q = dx * dx + dy * dy;
        if (q < 4) h += s * Math.exp(-q * 1.4);
      }
      h += (Math.random() - 0.5) * 0.018;
      h = Math.min(1, Math.max(0, h));
      heat[i] = h;
      const hc = lv ? Math.min(1, Math.max(0, (h - lv[0]) / (lv[1] - lv[0]))) : h;
      const li = Math.round(hc * 255) * 3;
      d[i * 4] = LUT[li]; d[i * 4 + 1] = LUT[li + 1]; d[i * 4 + 2] = LUT[li + 2]; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    return { canvas: c, heat, W, H };
  }

  /* ---------- Content ---------- */
  const AREAS = {
    outdoor: {
      short: 'Outdoor', wall: 'Outdoor & hunting', demo: true,
      lead: 'Monoculars, binoculars and riflescopes for the hours after dark.',
      title: 'See every movement after dark.',
      thermalLead: 'Move across the picture. This is how a thermal camera finds game behind the treeline.',
    },
    building: {
      short: 'Building', wall: 'Cameras for buildings',
      lead: 'From a quick check at home to a full energy audit, plus acoustic water leak detection.',
      title: 'Check your house like a pro.',
      thermalLead: 'Move the camera across the house. Then go inside and check the rooms.',
    },
    fire: {
      short: 'Fire service', wall: 'Cameras for the fire service',
      lead: 'Three series for every job: the FB for every vehicle, the FP on your gear, the FT for the attack team.',
      title: 'See through the smoke.',
      thermalLead: 'Move the camera across the smoke. The firefighter and the glowing wood show at once.',
    },
    industry: {
      short: 'Industry', wall: 'Industrial cameras',
      lead: 'From the M series to the SP120H, plus acoustic and gas imaging. Calibrated and repaired by SENSOR.',
      title: 'Find the fault before it fails.',
      thermalLead: 'Move across the switchboard. The hot fuse holder gives itself away.',
    },
  };
  const BUYERS = {
    business: {
      short: 'Business', cta: 'Request a quote', href: '#quote', add: 'Add to quote', added: 'Added to quote',
      price: 'Price on request', vat: 'excl. VAT',
      terms: 'Prices excl. VAT. Pay on invoice after we check your order. Shipped from Germany: 2–3 days in stock, otherwise 4–5 days.',
    },
    private: {
      short: 'Private', cta: 'Talk to an expert', href: '#contact', add: 'Ask for price', added: 'Request sent',
      price: 'Price on request', vat: 'incl. VAT',
      terms: 'Prices incl. VAT. Pay with PayPal or prepayment. Shipped from Germany: 2–3 days in stock, otherwise 4–5 days.',
    },
  };
  const { TYPES, PRODUCTS, SERIES, SERIES_LINE } = window.HM_DATA;
  const NUMBERS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
  const resText = (p) => p.res || '–';
  window.HM_PRODUCTS = PRODUCTS;

  // Flat drawings: shown until the 3D layer is ready, and in the comparison table.
  const SCREEN = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#2a0d4e"/>
    <circle cx="${x + w * 0.55}" cy="${y + h * 0.55}" r="${Math.min(w, h) * 0.3}" fill="#a8126f"/>
    <circle cx="${x + w * 0.55}" cy="${y + h * 0.55}" r="${Math.min(w, h) * 0.19}" fill="#e3101e"/>
    <circle cx="${x + w * 0.57}" cy="${y + h * 0.52}" r="${Math.min(w, h) * 0.1}" fill="#fba61e"/>`;
  const ART = {
    pistol: `<rect x="80" y="70" width="240" height="170" rx="28" fill="#3a3a3e"/>${SCREEN(100, 90, 200, 128)}<path d="M168 238h70l-6 112h-74z" fill="#3a3a3e"/>`,
    pocket: `<rect x="128" y="50" width="144" height="290" rx="26" fill="#3a3a3e"/>${SCREEN(144, 70, 112, 150)}<circle cx="200" cy="270" r="22" fill="#555"/>`,
    phone: `<rect x="112" y="30" width="176" height="300" rx="28" fill="#3a3a3e"/>${SCREEN(126, 52, 148, 250)}<rect x="166" y="326" width="68" height="44" rx="12" fill="#555"/>`,
    monocular: `<rect x="70" y="150" width="250" height="100" rx="48" fill="#3a3a3e"/><rect x="300" y="166" width="54" height="68" rx="14" fill="#555"/><circle cx="96" cy="200" r="58" fill="#4a4a4e"/><circle cx="96" cy="200" r="38" fill="#0d0d0e" stroke="#e3101e" stroke-width="6"/>`,
    binocular: `<rect x="70" y="110" width="250" height="84" rx="40" fill="#3a3a3e"/><rect x="70" y="206" width="250" height="84" rx="40" fill="#3a3a3e"/><circle cx="96" cy="152" r="46" fill="#4a4a4e"/><circle cx="96" cy="248" r="46" fill="#4a4a4e"/>`,
    scope: `<rect x="40" y="184" width="300" height="40" rx="20" fill="#3a3a3e"/><rect x="20" y="166" width="84" height="76" rx="18" fill="#4a4a4e"/><rect x="180" y="150" width="46" height="36" rx="8" fill="#555"/><rect x="320" y="176" width="60" height="56" rx="14" fill="#555"/>`,
  };
  const art = (type) => `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ART[type]}</svg>`;

  const KEY = 'hm-choice';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } },
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const animate = hasGsap && !reduceMotion;
  if (animate) gsap.registerPlugin(SplitText);

  /* ---------- Thermal band: a camera in your hand (a round lens for outdoor) ---------- */
  const seeSection = $('[data-seesection]');
  const stage = $('[data-stage]');
  const media = $('[data-media]', stage);
  const lens = $('[data-lens]', stage);
  const view = $('[data-thermal]', stage);
  const readout = $('[data-readout]', stage);
  const tempEl = $('[data-temp]', stage);
  const device = $('[data-device]', stage);
  const deviceView = $('[data-device-thermal]', stage);
  const deviceTemp = $('[data-device-temp]', stage);
  const spotHot = $('[data-spot-hot]', stage); const spotCold = $('[data-spot-cold]', stage);
  const scaleMax = $('[data-scale-max]', stage); const scaleMin = $('[data-scale-min]', stage);
  const findCard = $('[data-find-card]', stage);
  const devBox = $('[data-device-box]', stage);
  const pins = $('[data-pins]', stage);
  const hunt = $('[data-hunt]', stage);
  const caption = $('[data-caption]', stage);
  const photos = Object.fromEntries($$('[data-photo]', stage).map((el) => [el.dataset.photo, el]));
  const cache = {};
  const state = { scene: null, running: false, w: 0, h: 0, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, a: 0, last: 0, pointerActive: false, t0: performance.now(), found: new Set(), near: -1, box: null };
  // The camera in your hand: HIKMICRO product photos. Fire service holds the FT31, everything else the M60.
  // box = the screen's bounding box in the photo (px); quad = the screen's corners when the photo is at an angle
  const DEVICES = {
    ft31: { src: 'assets/img/camera-ft31.webp', w: 480, h: 1003, box: [62, 112, 418, 328] },
    m60: { src: 'assets/img/camera-m60.webp', w: 480, h: 951, box: [82, 121, 329, 319], quad: [[131, 121], [329, 121], [287, 319], [82, 319]] },
  };
  const deviceFor = (scene) => (scene === 'fire' ? 'ft31' : 'm60');
  const deviceImg = $('.device-body', stage);
  const deviceScreen = $('.device-screen', stage);
  let dev = DEVICES.m60;
  let CAM_SCREEN;
  function setDevice(key) {
    dev = DEVICES[key];
    const [x0, y0, x1, y1] = dev.box;
    CAM_SCREEN = { l: x0 / dev.w, t: y0 / dev.h, w: (x1 - x0) / dev.w, h: (y1 - y0) / dev.h, ratio: dev.h / dev.w };
    if (deviceImg.getAttribute('src') !== dev.src) { deviceImg.src = dev.src; deviceImg.width = dev.w; deviceImg.height = dev.h; }
    Object.assign(deviceScreen.style, { left: `${CAM_SCREEN.l * 100}%`, top: `${CAM_SCREEN.t * 100}%`, width: `${CAM_SCREEN.w * 100}%`, height: `${CAM_SCREEN.h * 100}%` });
  }
  setDevice('m60');
  // bends the flat screen onto the angled screen in the photo (a perspective transform)
  function screenWarp(scale) {
    if (!dev.quad) return 'none';
    const [x0, y0, x1, y1] = dev.box; const w = (x1 - x0) * scale; const h = (y1 - y0) * scale;
    const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = dev.quad.map(([x, y]) => [(x - x0) * scale, (y - y0) * scale]);
    // unit square → quad
    const sx = ax - bx + cx - dx; const sy = ay - by + cy - dy;
    const dx1 = bx - cx; const dx2 = dx - cx; const dy1 = by - cy; const dy2 = dy - cy;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / den; const hh = (dx1 * sy - sx * dy1) / den;
    const a = bx - ax + g * bx; const b = dx - ax + hh * dx; const c = ax;
    const d = by - ay + g * by; const e = dy - ay + hh * dy; const f = ay;
    // then scale the rectangle w × h down to the unit square first
    const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
    return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
  }
  const useDevice = () => state.scene && state.scene !== 'outdoor';
  // a real camera at arm's length shows more than the patch it covers: the screen shows about twice its own width
  const ZOOM = 0.42;

  const loaded = (img) => {
    if (!img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src; // room photos load only when asked for
    return img.complete && img.naturalWidth
      ? Promise.resolve(img)
      : new Promise((res, rej) => { img.addEventListener('load', () => res(img), { once: true }); img.addEventListener('error', rej, { once: true }); });
  };
  const getThermal = (key) => (cache[key] ||= loaded(photos[key]).then((img) => buildThermal(img, SCENES[key])));
  function coverBox(key) {
    const img = photos[key];
    const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
    const s = Math.max(state.w / iw, state.h / ih);
    const dw = iw * s; const dh = ih * s;
    const [px, py] = SCENES[key].pos;
    return { ox: (state.w - dw) * px, oy: (state.h - dh) * py, dw, dh };
  }
  const toMedia = (key, [u, v]) => { const b = coverBox(key); return { x: b.ox + u * b.dw, y: b.oy + v * b.dh }; };
  const subjectPoint = (key) => toMedia(key, SCENES[key].subject);
  const lensRadius = () => (state.w < 700 ? 48 : Math.round(Math.min(Math.max(Math.min(state.w, state.h) * 0.085, 58), 80)));
  const screenW = () => (state.w < 700 ? 150 : Math.round(Math.min(Math.max(state.w * 0.17, 210), 290)));
  function measure() {
    const r = media.getBoundingClientRect(); state.w = r.width; state.h = r.height;
    [lens, device].forEach((el) => { el.style.setProperty('--mw', `${state.w}px`); el.style.setProperty('--mh', `${state.h}px`); });
    lens.style.setProperty('--lr', `${lensRadius()}px`);
    device.style.setProperty('--dw', `${screenW() / CAM_SCREEN.w}px`);
    deviceScreen.style.transform = screenWarp(screenW() / CAM_SCREEN.w / dev.w);
  }

  let lastTemp = ''; let lastTempAt = 0;
  function sampleTemp(now, x, y) {
    const th = cache[state.scene + ':ready'];
    if (!th || now - lastTempAt < 90) return;
    lastTempAt = now;
    const b = coverBox(state.scene);
    const u = (x - b.ox) / b.dw; const v = (y - b.oy) / b.dh;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const ix = Math.floor(u * (th.W - 1)); const iy = Math.floor(v * (th.H - 1));
    let sum = 0, cnt = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      sum += th.heat[Math.min(th.H - 1, Math.max(0, iy + dy)) * th.W + Math.min(th.W - 1, Math.max(0, ix + dx))]; cnt++;
    }
    const [t0, t1] = SCENES[state.scene].temps;
    const text = `${(t0 + (sum / cnt) * (t1 - t0)).toFixed(1).replace('-', '−')} °C`;
    if (text !== lastTemp) { tempEl.textContent = text; deviceTemp.textContent = text; lastTemp = text; }
    if (useDevice() && state.scr) screenStats(th, b, t0, t1);
    checkFindings(u, v, b);
  }

  // like a real camera: hottest and coldest point on the screen, and the scale from min to max
  const fmtT = (t) => `${t.toFixed(1).replace('-', '−')}°`;
  function screenStats(th, b, t0, t1) {
    const { sx, sy, sw, sh } = state.scr;
    let hi = -1, lo = 2, hx = 0, hy = 0, lx = 0, ly = 0;
    for (let j = 3; j < 16; j++) for (let i = 3; i < 20; i++) {
      const mx = sx + (sw * i) / 24; const my = sy + (sh * j) / 18;
      const u = (mx - b.ox) / b.dw; const v = (my - b.oy) / b.dh;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const hv = th.heat[Math.floor(v * (th.H - 1)) * th.W + Math.floor(u * (th.W - 1))];
      if (hv > hi) { hi = hv; hx = mx - sx; hy = my - sy; }
      if (hv < lo) { lo = hv; lx = mx - sx; ly = my - sy; }
    }
    if (hi < 0) return;
    const T0 = t0 + lo * (t1 - t0); const T1 = t0 + hi * (t1 - t0);
    scaleMax.textContent = fmtT(T1); scaleMin.textContent = fmtT(T0);
    spotHot.style.transform = `translate(${hx * ZOOM}px, ${hy * ZOOM}px)`; spotHot.querySelector('em').textContent = fmtT(T1);
    spotCold.style.transform = `translate(${lx * ZOOM}px, ${ly * ZOOM}px)`; spotCold.querySelector('em').textContent = fmtT(T0);
    const spread = T1 - T0 > 2;
    spotHot.classList.toggle('is-on', spread); spotCold.classList.toggle('is-on', spread);
  }

  /* findings: the problems hidden in each picture */
  const KIND = { hot: 'Hot spot', cold: 'Heat loss', glass: 'Good to know', ok: 'Works as it should' };
  function checkFindings(u, v, b) {
    const list = SCENES[state.scene].findings || [];
    let near = -1;
    list.forEach((f, i) => {
      const dx = (u - f.at[0]) * b.dw; const dy = (v - f.at[1]) * b.dh;
      if (Math.hypot(dx, dy) < f.r * b.dw) near = i;
    });
    if (near >= 0 && state.pointerActive && !state.found.has(near)) { state.found.add(near); renderHunt(); }
    if (near === state.near) return;
    state.near = near;
    if (near < 0) { findCard.classList.remove('is-on'); state.box = null; return; }
    const f = list[near];
    // what the box reads: the hottest or coldest point inside it
    const th = cache[state.scene + ':ready']; const [t0, t1] = SCENES[state.scene].temps;
    let hi = 0, lo = 1;
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const u = Math.min(1, Math.max(0, f.at[0] + (i / 6) * f.r * 0.6)); const v = Math.min(1, Math.max(0, f.at[1] + (j / 6) * f.r * 0.6 * (b.dw / b.dh)));
      const hv = th.heat[Math.floor(v * (th.H - 1)) * th.W + Math.floor(u * (th.W - 1))]; hi = Math.max(hi, hv); lo = Math.min(lo, hv);
    }
    const cold = f.kind === 'cold';
    state.box = { at: f.at, r: f.r };
    devBox.dataset.kind = f.kind;
    $('em', devBox).textContent = `B${near + 1} ${cold ? 'Min' : 'Max'} ${fmtT(t0 + (cold ? lo : hi) * (t1 - t0))}`;
    findCard.dataset.kind = f.kind;
    $('[data-find-kind]', findCard).textContent = KIND[f.kind];
    $('[data-find-title]', findCard).textContent = f.title;
    $('[data-find-text]', findCard).textContent = f.text;
    findCard.classList.add('is-on');
  }
  // a numbered pin stays on every problem you have found
  function renderPins() {
    const list = (useDevice() && SCENES[state.scene]?.findings) || [];
    pins.innerHTML = list.map((f, i) => {
      if (!state.found.has(i) || !state.w) return '';
      const p = toMedia(state.scene, f.at);
      return `<button type="button" class="find-pin" data-kind="${f.kind}" data-pin="${i}" style="transform: translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)" aria-label="${f.title}"><span>${i + 1}</span><em>${f.title}</em></button>`;
    }).join('');
  }
  function goTo(i) {
    const list = SCENES[state.scene].findings;
    const p = toMedia(state.scene, list[i].at);
    state.pointerActive = true; state.tx = p.x; state.ty = p.y; state.near = -2;
    state.found.add(i); renderHunt();
  }
  pins.addEventListener('click', (e) => { const b = e.target.closest('[data-pin]'); if (b) goTo(+b.dataset.pin); });
  function renderHunt() {
    renderPins();
    const list = SCENES[state.scene]?.findings || [];
    hunt.hidden = list.length < 2;
    if (hunt.hidden) return;
    const n = state.found.size;
    $('[data-hunt-count]', hunt).textContent = n === list.length
      ? `All ${list.length} found. Well spotted.`
      : `${n} of ${list.length} found`;
    $('[data-hunt-dots]', hunt).innerHTML = list.map((f, i) => `<button type="button" class="hunt-dot${state.found.has(i) ? ' is-found' : ''}" data-kind="${f.kind}" data-dot="${i}" aria-label="${state.found.has(i) ? f.title : `Problem ${i + 1}`}"></button>`).join('');
    $('[data-hunt-next]', hunt).textContent = n === list.length ? 'Look again' : (finePointer ? 'Show me one' : 'Next problem');
  }
  $('[data-hunt-next]', hunt).addEventListener('click', () => {
    const list = SCENES[state.scene].findings;
    if (state.found.size === list.length) state.found.clear();
    goTo(list.findIndex((_, k) => !state.found.has(k)));
  });
  $('[data-hunt-dots]', hunt).addEventListener('click', (e) => { const d = e.target.closest('[data-dot]'); if (d) goTo(+d.dataset.dot); });

  function render(now) {
    if (state.running && state.scene) {
      const t = (now - state.t0) / 1000;
      if (!state.pointerActive && !reduceMotion) {
        // nobody is steering: the camera slowly scans around the subject, like a hand looking for something
        const s = subjectPoint(state.scene); const amp = Math.min(state.w, state.h) * 0.06;
        state.tx = s.x + Math.sin(t * 0.37) * amp * 1.3 + Math.sin(t * 0.9) * amp * 0.25;
        state.ty = s.y + Math.sin(t * 0.29 + 1.2) * amp * 0.8;
      }
      const dt = Math.min(0.05, (now - (state.last || now)) / 1000) || 0.016; state.last = now;
      if (reduceMotion) { state.x = state.tx; state.y = state.ty; state.vx = state.vy = 0; } else {
        // a spring with a little weight: the camera starts, glides and settles like a real object in a hand
        const K = 90; const C = 2 * Math.sqrt(K) * 0.82;
        state.vx += (K * (state.tx - state.x) - C * state.vx) * dt; state.vy += (K * (state.ty - state.y) - C * state.vy) * dt;
        state.x += state.vx * dt; state.y += state.vy * dt;
      }
      let x, y;
      if (useDevice()) {
        // the screen of the camera follows the pointer and shows the heat of what is behind it
        const sw = screenW(); const sh = sw * (CAM_SCREEN.h * CAM_SCREEN.ratio / CAM_SCREEN.w);
        // a hand is never perfectly still: breathing and a faint tremor
        const hand = reduceMotion ? [0, 0] : [Math.sin(t * 7.1) * 0.5 + Math.sin(t * 12.7) * 0.3, Math.sin(t * 1.4) * 1.6 + Math.sin(t * 9.3) * 0.4];
        x = Math.min(Math.max(state.x + hand[0], sw / 2), state.w - sw / 2); y = Math.min(Math.max(state.y + hand[1], sh / 2), state.h - sh / 2);
        const dw = sw / CAM_SCREEN.w; const dh = dw * CAM_SCREEN.ratio;
        // the camera leans into the movement and back; the picture on the screen stays level with the world
        const lean = reduceMotion ? 0 : Math.max(-6, Math.min(6, state.vx * 0.009)) + Math.sin(t * 0.8) * 0.5;
        state.a += (lean - state.a) * 0.12;
        const a = Math.round(state.a * 100) / 100;
        const level = `translate(${sw / 2}px, ${sh / 2}px) rotate(${-a}deg) translate(${-sw / 2}px, ${-sh / 2}px)`;
        const sx = x - sw / 2; const sy = y - sh / 2;
        state.scr = { sx: x - sw / (2 * ZOOM), sy: y - sh / (2 * ZOOM), sw: sw / ZOOM, sh: sh / ZOOM };
        const dx = Math.round((sx - CAM_SCREEN.l * dw) * 10) / 10; const dy = Math.round((sy - CAM_SCREEN.t * dh) * 10) / 10;
        device.style.transformOrigin = `${(CAM_SCREEN.l + CAM_SCREEN.w / 2) * dw}px ${(CAM_SCREEN.t + CAM_SCREEN.h / 2) * dh}px`;
        device.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${a}deg)`;
        deviceView.style.transform = `${level} translate3d(${Math.round((sw / 2 - x * ZOOM) * 10) / 10}px, ${Math.round((sh / 2 - y * ZOOM) * 10) / 10}px, 0) scale(${ZOOM})`;
        // a measuring box around the problem, the way the camera marks an area
        if (state.near >= 0 && state.box) {
          const p = toMedia(state.scene, state.box.at);
          const size = Math.min(sh * 0.8, Math.max(26, state.box.r * coverBox(state.scene).dw * ZOOM * 1.5));
          const bx = (p.x - state.scr.sx) * ZOOM - size / 2; const by = (p.y - state.scr.sy) * ZOOM - size / 2;
          devBox.style.width = `${size}px`; devBox.style.height = `${size}px`;
          devBox.style.transform = `${level} translate3d(${Math.round(bx)}px, ${Math.round(by)}px, 0)`;
          devBox.classList.add('is-on');
        } else devBox.classList.remove('is-on');
        const right = x + sw / 2 + 300 < state.w;
        findCard.style.transform = `translate3d(${right ? x + sw / 2 + 18 : x - sw / 2 - 18}px, ${sy}px, 0) translateX(${right ? 0 : -100}%)`;
      } else {
        const r = lensRadius();
        x = Math.min(Math.max(state.x, r), state.w - r); y = Math.min(Math.max(state.y, r), state.h - r);
        const lx = Math.round((x - r) * 10) / 10; const ly = Math.round((y - r) * 10) / 10;
        lens.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
        view.style.transform = `translate3d(${-lx}px, ${-ly}px, 0)`;
        readout.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        readout.style.opacity = '1';
      }
      sampleTemp(now, x, y);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  let sceneToken = 0;
  async function showScene(key) {
    const token = ++sceneToken;
    stage.classList.add('is-loading');
    const th = await getThermal(key);
    if (token !== sceneToken) return;
    stage.classList.remove('is-loading');
    cache[key + ':ready'] = th;
    setDevice(deviceFor(key));
    measure();
    state.scene = key;
    const [px, py] = SCENES[key].pos;
    media.style.setProperty('--pos', `${px * 100}% ${py * 100}%`);
    [view, deviceView].forEach((c) => { c.width = th.W; c.height = th.H; c.getContext('2d').drawImage(th.canvas, 0, 0); });
    Object.entries(photos).forEach(([k, el]) => el.classList.toggle('is-active', k === key));
    caption.textContent = SCENES[key].caption;
    const s = subjectPoint(key);
    state.x = state.tx = s.x; state.y = state.ty = s.y; state.vx = state.vy = 0; state.a = 0; state.box = null;
    state.pointerActive = false; state.t0 = performance.now(); lastTemp = '';
    state.found = new Set(); state.near = -1; findCard.classList.remove('is-on');
    renderHunt();
    lens.classList.toggle('is-ready', !useDevice());
    readout.hidden = useDevice();
    device.classList.toggle('is-ready', useDevice());
    state.running = true;
  }
  media.addEventListener('pointermove', (e) => {
    if (!finePointer && e.pointerType !== 'touch') return;
    if (e.pointerType === 'touch' && !e.buttons && e.pressure === 0) return;
    const r = media.getBoundingClientRect();
    state.pointerActive = true; state.tx = e.clientX - r.left; state.ty = e.clientY - r.top;
  });
  media.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { state.pointerActive = false; state.t0 = performance.now(); } });
  media.addEventListener('click', (e) => {
    if (finePointer) return;
    const r = media.getBoundingClientRect();
    state.pointerActive = true; state.tx = e.clientX - r.left; state.ty = e.clientY - r.top;
  });
  new ResizeObserver(() => {
    measure(); if (state.scene) renderPins();
    if (state.scene && !state.pointerActive) { const s = subjectPoint(state.scene); state.tx = s.x; state.ty = s.y; }
  }).observe(media);

  /* building: outside, or inside one of three rooms */
  const rooms = $('[data-rooms]', stage);
  const roomList = $('[data-room-list]', rooms);
  const outList = $('[data-out-list]', rooms);
  const OUTSIDE = ['front', 'solar', 'heatpump'];
  const LEADS = {
    front: 'Move the camera across the house. Find where the heat gets out.',
    solar: 'Move the camera across the roof. Find the modules that lose power.',
    heatpump: 'Move the camera around the heat pump. See what works and what does not.',
    inside: 'Move the camera through the room. Find the problems a thermal camera shows at once.',
  };
  let lastRoom = 'kitchen'; let lastOut = 'front';
  function setPlace(place) {
    if (place === 'outside') place = lastOut;
    if (place === 'inside') place = lastRoom;
    const inside = !OUTSIDE.includes(place);
    if (inside) lastRoom = place; else lastOut = place;
    $$('[data-place]', rooms).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.place === (inside ? 'inside' : 'outside'))));
    $$('[data-room]', rooms).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === place)));
    roomList.hidden = !inside; outList.hidden = inside;
    stage.classList.toggle('is-explore', true);
    $('[data-area-lead]').textContent = LEADS[inside ? 'inside' : place];
    showScene(place);
  }
  $$('[data-place]', rooms).forEach((b) => b.addEventListener('click', () => setPlace(b.dataset.place)));
  $$('[data-room]', rooms).forEach((b) => b.addEventListener('click', () => setPlace(b.dataset.room)));
  window.HM_THERMAL = { buildThermal, SCENES };
  window.HM_GO = (id) => goSection(id);

  /* ---------- Start ---------- */
  const start = $('[data-chooser]');
  const buyerStep = $('[data-buyer-step]');
  const wall = $('[data-areasection]');
  let choice = store.get();
  let pendingArea = null;

  function showStart({ askBuyer = true } = {}) {
    state.running = false;
    wall.hidden = true; seeSection.hidden = true; compareBar.hidden = true;
    start.hidden = false;
    // the start is one screen: nothing to scroll to until an area is chosen
    document.body.classList.add('is-start');
    $$('.panel', start).forEach((p) => p.classList.remove('is-picked'));
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('wall:clear'));
    if (askBuyer || !choice.buyer) askForBuyer(); else askForArea();
  }
  function askForBuyer() {
    start.classList.remove('is-choosing');
    buyerStep.hidden = false;
    if (animate) {
      const split = SplitText.create('.buyer-title', { type: 'lines', mask: 'lines' });
      gsap.from(split.lines, { yPercent: 110, duration: 1, stagger: 0.08, ease: 'expo.out', onComplete: () => split.revert() });
      gsap.from(['.buyer-q', ...$$('.buyer-option')], { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, delay: 0.25, ease: 'expo.out', clearProps: 'all' });
    }
  }
  function askForArea() {
    $('[data-where-buyer]').textContent = BUYERS[choice.buyer].short;
    const go = () => {
      buyerStep.hidden = true;
      start.classList.add('is-choosing');
      if (animate) gsap.from($$('.panel-text', start), { y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', clearProps: 'all' });
    };
    if (animate && !buyerStep.hidden) gsap.to(buyerStep, { opacity: 0, y: -20, duration: 0.45, ease: 'power2.in', onComplete: () => { gsap.set(buyerStep, { clearProps: 'all' }); go(); } });
    else go();
  }

  $$('[data-buyer]').forEach((btn) => btn.addEventListener('click', () => {
    choice = { buyer: btn.dataset.buyer };
    if (pendingArea) { choice.area = pendingArea; pendingArea = null; store.set(choice); showArea(); return; }
    askForArea();
  }));
  $('[data-rebuyer]').addEventListener('click', () => { choice = {}; store.clear(); askForBuyer(); });
  $$('.panel', start).forEach((panel) => panel.addEventListener('click', () => {
    if (!start.classList.contains('is-choosing')) return;
    choice.area = panel.dataset.area;
    store.set(choice);
    if (!animate) { showArea(); return; }
    panel.classList.add('is-picked');
    setTimeout(() => showArea({ fromPanel: true }), 750);
  }));

  /* ---------- Wall of cameras ---------- */
  const shelves = $('[data-shelves]');
  const compareBox = $('[data-compare]');
  const compareTable = $('[data-compare-table]');
  const compareBar = $('[data-compare-bar]');
  const MAX_COMPARE = 3;
  let picked = [];
  let compareInView = false;
  new IntersectionObserver(([e]) => {
    compareInView = e.isIntersecting;
    compareBar.hidden = compareInView || picked.length < 2 || wall.hidden;
  }, { threshold: 0.15 }).observe(compareBox);

  function renderCompare() {
    const ok = picked.length >= 2;
    compareBox.hidden = !ok;
    compareBar.hidden = !ok || compareInView;
    $$('.cam-compare input', shelves).forEach((inp) => { inp.disabled = !inp.checked && picked.length >= MAX_COMPARE; });
    if (!ok) return;
    $('[data-compare-count]').textContent = `${NUMBERS[picked.length]} cameras selected`;
    const ps = picked.map((id) => PRODUCTS[id]);
    const b = BUYERS[choice.buyer];
    const row = (label, cells) => `<tr><th scope="row">${label}</th>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    compareTable.innerHTML = `<thead><tr><th scope="col"><span class="sr-only">Camera</span></th>${ps.map((p) => `<th scope="col">${p.name}</th>`).join('')}</tr></thead>
      <tbody>
        ${row('', ps.map((p) => `<span class="compare-art">${art(p.type)}</span>`))}
        ${row('Type', ps.map((p) => p.typeLabel || TYPES[p.type]))}
        ${row('Thermal resolution', ps.map(resText))}
        ${row('Best for', ps.map((p) => p.use))}
        ${row('Temperature range', ps.map((p) => p.range || '–'))}
        ${row('Display', ps.map((p) => p.display || '–'))}
        ${row('Warranty', ps.map((p) => (p.warranty ? p.warranty.base : '–')))}
        ${row('Calibration by SENSOR', ps.map((p) => (p.calibration ? `${window.HM_PRICE(p.calibration.price, choice.buyer)}` : '–')))}
        ${row('Price', ps.map((p) => (p.quoteOnly ? 'On request' : `${p.from ? 'from ' : ''}${window.HM_PRICE(p.price, choice.buyer)} ${window.HM_VATNOTE(choice.buyer)}`)))}
      </tbody>`;
  }

  /* ---------- Field bands: real pictures between the series (motion lives in field.js) ---------- */
  const FIELD = window.HM_FIELD || {};
  const img = (x, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${x.src}" width="${x.w}" height="${x.h}" alt="${x.alt}" loading="lazy" decoding="async">`;
  const pic = (x, cls = '') => `<figure class="fb-pic${cls}"><div class="fb-par">${img(x)}</div>${x.label ? `<figcaption>${x.label}</figcaption>` : ''}</figure>`;
  function fieldBand(f) {
    if (!f) return '';
    const copy = (extra = '') => `<div class="fb-copy"><p class="fb-kicker">${f.kicker}</p><h3 class="fb-title">${f.title}</h3><p class="fb-text">${f.text}</p>${extra}</div>`;
    let body = '';
    if (f.kind === 'hand') {
      body = `<figure class="fb-pic fb-main"><div class="fb-par">${img(f.pics[0])}</div></figure>
        <div class="fb-side">${copy()}<div class="fb-thumbs">${f.pics.slice(1).map((x, i) => pic(x, ` fb-float" data-speed="${i % 2 ? 1.4 : 0.8}`)).join('')}</div></div>`;
    } else if (f.kind === 'scan') {
      const [eye, heat] = f.pics;
      body = `<div class="fb-frame" data-scan>
          ${img(eye, 'fb-eye')}
          <div class="fb-heat">${img(heat)}</div>
          <span class="fb-line" aria-hidden="true"></span>
          <span class="fb-mode" aria-hidden="true"><i class="is-eye">Eye</i><i class="is-heat">Thermal</i></span>
        </div>
        ${copy(`<div class="fb-switch" role="group" aria-label="View">
            <button type="button" data-view="eye" aria-pressed="false">What you see</button>
            <button type="button" data-view="heat" aria-pressed="true">Thermal</button>
          </div>
          <p class="fb-read"><span>Max</span> <b data-max="${f.max}">${f.max.toFixed(1)}</b> <span>°C</span></p>`)}`;
    } else if (f.kind === 'reel') {
      body = `${copy(`<p class="fb-hint" aria-hidden="true"><span></span>Scroll to run the film</p>`)}
        <div class="fb-film"><ul class="fb-track">${f.pics.map((x) => `<li>${pic(x)}</li>`).join('')}</ul></div>`;
    } else if (f.kind === 'wide') {
      body = `<figure class="fb-pic fb-main" data-tilt><div class="fb-par">${img(f.pics[0])}</div><span class="fb-glare" aria-hidden="true"></span></figure>${copy()}`;
    } else if (f.kind === 'screen') {
      const s0 = f.shots[0];
      body = `<div class="fb-sticky">
          <div class="fb-cam"><canvas data-cam3d aria-hidden="true"></canvas><img class="fb-cam-still" src="${s0.src}" alt="" loading="lazy"></div>
          ${copy(`<div class="fb-shot" aria-live="polite"><p class="fb-shot-label" data-shot-label>${s0.label}</p>
              <p class="fb-read"><span>Max</span> <b data-shot-max>${s0.max.toFixed(1)}</b> <span>°C</span></p></div>
            <ol class="fb-steps">${f.shots.map((x, i) => `<li${i ? '' : ' class="is-on"'}><span>${String(i + 1).padStart(2, '0')}</span>${x.label}</li>`).join('')}</ol>`)}
        </div>
        <script type="application/json" data-shots>${JSON.stringify(f.shots)}</script>`;
    } else if (f.kind === 'bento') {
      body = `${copy()}<div class="fb-grid">${f.pics.map((x, i) => pic(x, i ? '' : ' is-lead')).join('')}</div>`;
    } else if (f.kind === 'video') {
      body = `<div class="fb-stage" data-grow><video src="${f.video}" poster="${f.poster}" width="${f.w}" height="${f.h}" muted loop playsinline preload="none" aria-label="${f.alt}"></video>
        <div class="fb-overlay">${copy()}</div></div>`;
    }
    return `<li class="fb fb-${f.kind}${f.wide ? ' is-wide' : ''}">${body}</li>`;
  }


  /* ---------- Sets and accessories at the end of each area ---------- */
  const money = (v) => window.HM_PRICE(v, choice.buyer);
  const plus = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function setBand(area) {
    const S = (window.HM_SETS || {})[area];
    if (!S) return '';
    const cards = S.sets.map((set) => {
      const items = set.parts.map((id) => window.HM_ITEM(id)).filter(Boolean);
      if (items.length !== set.parts.length) return '';
      const total = items.reduce((t, it) => t + it.price, 0);
      return `<article class="set-card${set.pic ? ' has-pic' : ''}">
          ${set.pic ? `<figure class="set-pic"><img src="${set.pic.src}" width="900" height="900" alt="${set.pic.alt}" loading="lazy" decoding="async"></figure>` : ''}
          <h4 class="set-name">${set.name}</h4>
          <ul class="set-parts">${items.map((it) => `<li><span>${it.name.replace(/^HIKMICRO /, '')}</span><b>${money(it.price)}</b></li>`).join('')}</ul>
          <div class="set-foot">
            <p class="set-total"><span>Set</span> ${money(total)} <small>${window.HM_VATNOTE(choice.buyer)}</small></p>
            <button class="btn btn-light btn-small" type="button" data-add-set="${set.parts.join(',')}">${plus}<span>Add set to cart</span></button>
          </div>
        </article>`;
    }).join('');
    return `<li class="set-band">
        <div class="set-copy"><p class="fb-kicker">${S.kicker}</p><h3 class="set-title">${S.title}</h3><p class="set-text">${S.text}</p></div>
        <div class="set-grid" data-sets="${S.sets.length}">${cards}</div>
      </li>`;
  }
  function accBand(area) {
    const ids = SERIES.filter((x) => x.areas.includes(area)).map((x) => x.id);
    const all = Object.values(window.HM_DATA.ACCESSORIES || {}).filter((a) => a.price != null && a.fits && a.fits.some((f) => ids.includes(f)));
    if (!all.length) return '';
    const groups = ids.map((sid) => {
      const list = all.filter((a) => a.fits[0] === sid || (!ids.includes(a.fits[0]) && a.fits.includes(sid)));
      if (!list.length) return '';
      const sr = SERIES.find((x) => x.id === sid);
      return `<div class="acc-group"><h4 class="acc-series">${sr ? sr.name : sid}</h4><ul class="acc-rows">${list.map((a) => `
          <li class="acc-row">
            <div class="acc-what"><b>${a.name}</b><span><span>${a.code}</span>${a.note ? ` · <span>${a.note}</span>` : ''}</span></div>
            <p class="acc-price">${money(a.price)} <small>${window.HM_VATNOTE(choice.buyer)}</small></p>
            <button class="acc-add" type="button" data-add-cart="acc:${a.id}" aria-label="Add ${a.name} to cart">${plus}</button>
          </li>`).join('')}</ul></div>`;
    }).join('');
    return `<li class="acc-band">
        <details${all.length <= 8 ? ' open' : ''}>
          <summary><span class="acc-title">Accessories</span><span class="acc-count">${all.length} items</span><span class="acc-toggle" aria-hidden="true">${plus}</span></summary>
          <div class="acc-body">${groups}</div>
        </details>
      </li>`;
  }

  function renderWall() {
    const a = AREAS[choice.area];
    const b = BUYERS[choice.buyer];
    picked = [];
    $('[data-summary-buyer]').textContent = b.short;
    $('[data-summary-area]').textContent = a.short;
    $('[data-wall-title]').textContent = a.wall;
    $('[data-wall-lead]').textContent = a.lead;
    $('[data-wall-demo]').hidden = !a.demo;
    $('[data-buyer-terms]').textContent = b.terms;
    // shelves grouped by series; best sellers first within each series, then by price
    const star = '<svg class="best-star" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.6l2.8 6 6.6.7-4.9 4.4 1.4 6.5L12 16.9l-5.9 3.3 1.4-6.5L2.6 9.3l6.6-.7z" fill="currentColor"/></svg>';
    const shelf = (p) => {
      const id = p.id;
      const priceText = p.quoteOnly ? 'Price on request' : `${p.from ? '<small>from</small> ' : ''}${window.HM_PRICE(p.price, choice.buyer)}<span>${window.HM_VATNOTE(choice.buyer)}</span>`;
      const action = p.quoteOnly
        ? `<button class="btn btn-light btn-small" type="button" data-open-form="quote" data-camera="${p.name}">Request a quote</button>`
        : p.variants && p.variants.length > 1
          ? `<a class="btn btn-light btn-small" href="product.html?id=${id}">Choose lens</a>`
          : `<button class="btn btn-light btn-small" type="button" data-add-cart="${id}">Add to cart</button>`;
      return `<li class="shelf${p.best ? ' is-best' : ''}" data-id="${id}">
        <a class="shelf-link" href="product.html?id=${id}" aria-label="${p.name}, ${p.typeLabel || TYPES[p.type]}${p.best ? ', best seller' : ''}">
          <div class="shelf-stage" data-view="${id}" data-type="${p.type}" data-name="${p.name}"${p.best ? ' data-best="1"' : ''}><span class="shelf-fallback">${art(p.type)}</span></div>
          ${p.best ? `<span class="best-badge">${star}</span>` : ''}
          <div class="shelf-info">
            <div>
              <h3 class="shelf-name">${p.name}</h3>
              ${p.best ? '<p class="best-line">Bestseller</p>' : ''}${p.sample ? '<p class="demo-line">Demo · sample price</p>' : ''}
              <p class="shelf-spec">${p.typeLabel || TYPES[p.type]}${p.res ? ` · ${p.res}` : ''}</p>
            </div>
            <p class="shelf-price">${priceText}</p>
          </div>
          ${(window.HM_KEYS || {})[id] ? `<ul class="shelf-keys">${window.HM_KEYS[id].map((k) => `<li>${k}</li>`).join('')}</ul>` : ''}
        </a>
        <div class="shelf-actions">
          <label class="cam-compare"><input type="checkbox" value="${id}"><span>Compare</span></label>
          ${action}
        </div>
      </li>`;
    };
    const groups = SERIES.filter((x) => x.areas.includes(choice.area)).map((sr) => {
      const list = Object.values(PRODUCTS).filter((p) => p.series === sr.id)
        .sort((x, y) => (y.best - x.best) || ((x.price ?? 1e9) - (y.price ?? 1e9)));
      if (!list.length) return '';
      return `<li class="series-head"><h3 class="series-title">${sr.name}</h3><p class="series-line">${sr.tier ? `<span>${sr.tier}</span>` : ''}${SERIES_LINE[sr.id] || ''}</p></li>${list.map(shelf).join('')}${fieldBand(FIELD[`${choice.area}:${sr.id}`])}`;
    });
    shelves.dataset.count = 'many';
    shelves.innerHTML = groups.join('') + setBand(choice.area) + accBand(choice.area);
    renderCompare();

    $$('.cam-compare input', shelves).forEach((inp) => inp.addEventListener('change', () => {
      picked = inp.checked ? [...picked, inp.value] : picked.filter((v) => v !== inp.value);
      renderCompare();
      if (inp.checked && picked.length === 2 && animate) gsap.from(compareBox, { y: 24, opacity: 0, duration: 0.6, ease: 'expo.out', clearProps: 'all' });
    }));
    document.dispatchEvent(new CustomEvent('wall:update'));
  }

  function showArea({ fromPanel = false } = {}) {
    const a = AREAS[choice.area];
    const b = BUYERS[choice.buyer];
    start.hidden = true;
    document.body.classList.remove('is-start');
    wall.hidden = false;
    seeSection.hidden = false;
    window.scrollTo(0, 0);
    renderWall();

    $('[data-area-title]').textContent = a.title;
    $('[data-area-lead]').textContent = a.thermalLead;
    const bc = $('[data-buyer-cta]'); bc.textContent = b.cta; bc.href = b.href; bc.dataset.openForm = choice.buyer === 'business' ? 'quote' : 'contact';
    const isBuilding = choice.area === 'building';
    rooms.hidden = !isBuilding;
    stage.classList.toggle('is-explore', isBuilding);
    if (isBuilding) setPlace('outside'); else showScene(choice.area);
    document.dispatchEvent(new CustomEvent('area:shown', { detail: choice.area }));

    if (animate) {
      const split = SplitText.create('[data-wall-title]', { type: 'lines', mask: 'lines' });
      gsap.from(split.lines, { yPercent: 110, duration: 1, ease: 'expo.out', delay: fromPanel ? 0.1 : 0.2, onComplete: () => split.revert() });
      gsap.from(['[data-wall-lead]', '[data-buyer-terms]'], { y: 20, opacity: 0, duration: 0.9, stagger: 0.08, delay: 0.35, ease: 'expo.out', clearProps: 'all' });
      gsap.from($$('.shelf-info, .shelf-actions', shelves), { y: 24, opacity: 0, duration: 0.9, stagger: 0.05, delay: 0.5, ease: 'expo.out', clearProps: 'all' });
      gsap.from(wall, { opacity: 0, duration: 0.6, ease: 'power2.out', clearProps: 'opacity' });
    }
  }

  // back to choosing the area; who is buying stays remembered (changed with 'Change' on the start screen)
  function reset(e) {
    if (e) e.preventDefault();
    pendingArea = null; picked = [];
    if (choice.buyer && BUYERS[choice.buyer]) {
      choice = { buyer: choice.buyer };
      store.set(choice);
      showStart({ askBuyer: false });
    } else {
      choice = {};
      store.clear();
      showStart({ askBuyer: true });
    }
  }
  $$('[data-reset]').forEach((el) => el.addEventListener('click', reset));
  $$('[data-go-area]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const area = a.dataset.goArea;
    if (choice.buyer) { choice.area = area; store.set(choice); showArea(); return; }
    pendingArea = area;
    showStart({ askBuyer: true });
  }));
  // Service and Contact sit under the start screen: a link to them opens the page below and scrolls there
  function goSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    document.body.classList.remove('is-start');
    requestAnimationFrame(() => el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href$="#services"], a[href$="#contact"], a[href$="#faq"], a[href$="#about"]');
    if (!a) return;
    const id = a.getAttribute('href').split('#')[1];
    if (!document.getElementById(id)) return;
    e.preventDefault();
    goSection(id);
  });
  $('[data-compare-clear]').addEventListener('click', () => {
    picked = []; $$('.cam-compare input', shelves).forEach((inp) => { inp.checked = false; }); renderCompare();
  });
  $('[data-compare-go]').addEventListener('click', (e) => {
    e.preventDefault(); compareBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  // a link like ./#industry opens that area (from the product page or the footer)
  const hashArea = location.hash.slice(1);
  if (hashArea === 'start') {
    history.replaceState(null, '', location.pathname);
    if (choice.buyer && BUYERS[choice.buyer]) { choice = { buyer: choice.buyer }; store.set(choice); showStart({ askBuyer: false }); }
    else { choice = {}; showStart(); }
  } else if (AREAS[hashArea]) {
    history.replaceState(null, '', location.pathname);
    if (choice.buyer && BUYERS[choice.buyer]) { choice.area = hashArea; store.set(choice); showArea(); }
    else { choice = {}; pendingArea = hashArea; showStart(); }
  } else if (['services', 'contact', 'faq', 'about'].includes(hashArea)) {
    history.replaceState(null, '', location.pathname);
    if (choice.buyer && choice.area && AREAS[choice.area] && BUYERS[choice.buyer]) showArea();
    else { choice = {}; showStart(); }
    setTimeout(() => goSection(hashArea), 60);
  } else if (choice.buyer && choice.area && AREAS[choice.area] && BUYERS[choice.buyer]) showArea();
  else { choice = {}; showStart(); }

  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 500));
  // computers prepare all thermal pictures ahead; phones make each one only when it is shown, so scrolling stays smooth
  if (THERMAL_W === 800) idle(() => ['outdoor', 'industry', 'building', 'fire', 'kitchen'].reduce((p, k) => p.then(() => getThermal(k)), Promise.resolve()));
})();
