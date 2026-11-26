/* Product page: the camera turns 360° on its own; scrolling stops it and takes it
   apart along the lens axis with labelled parts; further down it turns slowly
   beside the story. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILDERS, makeProLens, makeClipLens, buildCadMini, CAD_MODELS } from './models.js?v=85';
import { Exploder, Labels } from './explode.js?v=59';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) document.body.classList.add('is-reduced');
const phone = () => window.innerWidth <= 760;
const { TYPES, PRODUCTS } = window.HM_DATA;

/* ---------- content for this product ---------- */
const id = new URLSearchParams(location.search).get('id') || 'm20w';
const p = PRODUCTS[id] || PRODUCTS.m20w;
const cadUrl = CAD_MODELS[p.id];
const choice = (() => { try { return JSON.parse(localStorage.getItem('hm-choice')) || {}; } catch { return {}; } })();
const business = choice.buyer !== 'private';
const $ = (s) => document.querySelector(s);

document.title = `HIKMICRO ${p.name} – HIKMICRO Online Shop by SENSOR GmbH`;
$('[data-pd-name]').textContent = p.name;
$('[data-pd-lead]').textContent = p.lead || p.use;
$('[data-pd-caption]').textContent = `Inside the ${p.name}`;
if (cadUrl) document.querySelector('.credits').textContent = 'Specifications from the HIKMICRO datasheet. The 3D camera is built from HIKMICRO’s own CAD data; colours are approximate and the parts inside are illustrated.';
else if (p.datasheet) document.querySelector('.credits').textContent = 'Specifications from the HIKMICRO datasheet. The 3D camera shows where the parts sit; it is an illustration, not the exact construction.';
$('[data-pd-keyspecs]').textContent = [p.res, p.range, p.detection && `Detection up to ${p.detection}`, (p.link || p.features || '').split(',')[0]].filter(Boolean).join(' · ') || p.typeLabel || TYPES[p.type];
const buyer = business ? 'business' : 'private';
{
  const IC = {
    invoice: '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z M10 8h4 M10 12h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    pay: '<rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.5"/>',
    ship: '<path d="M3 7h11v9H3z M14 10h4l3 3v3h-7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="1.6" fill="currentColor"/><circle cx="17" cy="17.5" r="1.6" fill="currentColor"/>',
    service: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  };
  const chip = (ic, t) => `<li><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${IC[ic]}</svg>${t}</li>`;
  $('[data-pd-terms]').innerHTML = (business
    ? [chip('invoice', 'Pay on invoice'), chip('ship', 'In stock: 2–3 days'), chip('service', 'Service by SENSOR')]
    : [chip('pay', 'PayPal or prepayment'), chip('ship', 'In stock: 2–3 days'), chip('service', 'Service by SENSOR')]).join('');
}
// ----- price, lens variant and what goes in the cart -----
const money = (v) => window.HM_PRICE(v, buyer);
const variants = p.variants && p.variants.length > 1 ? p.variants : null;
let variant = variants ? (variants.find((v) => v.best) || variants[0]) : (p.variants ? p.variants[0] : null);
const star = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2.6l2.8 6 6.6.7-4.9 4.4 1.4 6.5L12 16.9l-5.9 3.3 1.4-6.5L2.6 9.3l6.6-.7z" fill="currentColor"/></svg>';
if (p.best) { const b = $('[data-pd-best]'); b.hidden = false; b.innerHTML = `${star} Bestseller`; }
if (p.sample) { const b = $('[data-pd-best]'); b.hidden = false; b.classList.add('is-demo'); b.innerHTML = '<span class="demo-tag">Demo</span> Outdoor range coming soon · sample price'; }

// G series: wide-angle and telephoto add-on lenses that clip onto the fixed lens
const addOns = p.series === 'g'
  ? Object.entries(window.HM_DATA.ACCESSORIES).map(([aid, a]) => ({ ...a, id: aid }))
    .filter((a) => a.fits && a.fits.includes('g') && /lens/i.test(a.name) && a.price != null && new RegExp(`\\b${p.name}\\b`).test(a.desc))
  : [];
const picked = new Set();

function renderBuy() {
  const base = variants ? variant.price : p.price;
  const extra = addOns.filter((a) => picked.has(a.id)).reduce((t, a) => t + a.price, 0);
  document.querySelectorAll('[data-pd-price]').forEach((el) => {
    el.innerHTML = p.quoteOnly ? 'Price on request' : `${money(base + extra)} <span>${window.HM_VATNOTE(buyer)}</span>`;
  });
  document.querySelectorAll('[data-main-cart]').forEach((el) => {
    el.dataset.addCart = variants ? `${id}:${variant.code}` : id;
    el.dataset.addOns = [...picked].map((x) => `acc:${x}`).join(',');
    el.hidden = !!p.quoteOnly;
  });
  if (variants) { renderLensSet(); renderSpecs(); }
}

/* ---------- SP series: lens configurator ----------
   The variants are lens sets (SP60-L12/25/50). Each number is roughly the horizontal
   field of view, so the set is shown as lenses to tick; we look up the matching set. */
const lensSet = (v) => v.code.slice(v.code.lastIndexOf('-L') + 2).split('/').map(Number);
const hfov = (txt) => parseFloat(txt);
let lenses = [];
let lastLens = null; // the lens clicked last is the one mounted on the 3D camera
if (variants) {
  const all = [...new Set(variants.flatMap(lensSet))].sort((x, y) => y - x);
  lenses = all.map((n) => {
    // the field of view of this lens: the segment of any set whose angle is nearest to the number
    const segs = variants.flatMap((v) => (v.fov || '').split(' / ')).filter(Boolean);
    const fov = segs.sort((x, y) => Math.abs(hfov(x) - n) - Math.abs(hfov(y) - n))[0] || `${n}°`;
    const deg = hfov(fov) || n;
    const name = deg >= 34 ? 'Wide angle' : deg >= 17 ? 'Standard' : deg >= 9 ? 'Telephoto' : 'Super telephoto';
    return { n, fov, deg, name };
  });
  const wedge = (deg) => {
    const a = Math.min(deg, 60) / 2 * Math.PI / 180; const r = 15;
    const x = 4 + r * Math.cos(a); const y = r * Math.sin(a);
    return `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 12 L${x.toFixed(2)} ${(12 - y).toFixed(2)} A${r} ${r} 0 0 1 ${x.toFixed(2)} ${(12 + y).toFixed(2)} Z" fill="currentColor" opacity="0.22"/><path d="M4 12 L${x.toFixed(2)} ${(12 - y).toFixed(2)} M4 12 L${x.toFixed(2)} ${(12 + y).toFixed(2)}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="4" cy="12" r="1.8" fill="currentColor"/></svg>`;
  };
  const box = $('[data-pd-variants]');
  box.hidden = false;
  $('[data-pd-intro]').classList.add('has-variants');
  const popular = variants.filter((v) => v.best);
  box.innerHTML = `
    <div class="lens-head"><p class="lens-q" id="lens-q">Choose your lenses</p><p class="lens-help">Fitted and calibrated at the factory. Pick one or more.</p></div>
    <div class="lens-grid" role="group" aria-labelledby="lens-q">${lenses.map((l) => `
      <button type="button" class="lens-chip" data-lens="${l.n}" aria-pressed="false">
        ${wedge(l.deg)}<b>${l.fov.split(' × ')[0]}</b><span>${l.name}</span>
      </button>`).join('')}</div>
    <p class="lens-result" aria-live="polite"><span data-lens-code></span><span data-lens-note></span></p>
    ${popular.length ? `<p class="lens-popular"><span>${star} Popular:</span>${popular.map((v) => `<button type="button" data-set="${v.code}">${v.code.replace(`${p.name}-`, '')}</button>`).join('')}</p>` : ''}`;

  const same = (x, y) => x.length === y.length && x.every((n) => y.includes(n));
  const choose = (want, must) => {
    // the exact set if HIKMICRO offers it, otherwise the closest set that keeps the lens just clicked
    const exact = variants.find((v) => same(lensSet(v), want));
    if (exact) return exact;
    const score = (v) => { const s = lensSet(v); return s.filter((n) => want.includes(n)).length * 10 - s.filter((n) => !want.includes(n)).length; };
    return variants.filter((v) => must(lensSet(v))).sort((x, y) => score(y) - score(x) || x.price - y.price)[0];
  };
  box.addEventListener('click', (e) => {
    const set = e.target.closest('[data-set]');
    if (set) { variant = variants.find((v) => v.code === set.dataset.set); renderBuy(); return; }
    const chip = e.target.closest('[data-lens]');
    if (!chip) return;
    const n = Number(chip.dataset.lens);
    const cur = lensSet(variant);
    const on = cur.includes(n);
    const want = on ? cur.filter((x) => x !== n) : [...cur, n];
    if (!want.length) return; // at least one lens
    const next = choose(want, (s) => (on ? !s.includes(n) : s.includes(n)));
    lastLens = on ? null : n;
    if (next) { variant = next; renderBuy(); }
  });
}
// which lens of the chosen set is on the camera: the one clicked last, else the standard lens
function mainLens() {
  const set = variant ? lensSet(variant) : [];
  if (lastLens && set.includes(lastLens)) return lastLens;
  const deg = (n) => (lenses.find((l) => l.n === n) || { deg: n }).deg;
  return set.find((n) => deg(n) >= 17 && deg(n) < 34) ?? set[0];
}
const LENS_USE = {
  'Wide angle': 'Close-up work: switch cabinets, rooms and building interiors. The whole scene from a short distance.',
  Standard: 'The all-rounder for most inspections: machines, electrical systems and facades.',
  Telephoto: 'Distant targets: overhead lines, substations, roofs and machines behind barriers.',
  'Super telephoto': 'Very far targets from the ground: high-voltage lines, chimneys and towers.',
};
const mm = (v) => `${String(Math.round(v * 10) / 10).replace(/\.0$/, '')} mm`;
function renderLensInfo() {
  const box = $('[data-lens-info]');
  if (!box || !variants) return;
  const n = mainLens();
  const l = lenses.find((x) => x.n === n);
  const sp = p.lensSpecs && p.lensSpecs[n];
  if (!l) return;
  box.hidden = false;
  box.innerHTML = `
    <p class="lens-info-kicker">Lens on the camera</p>
    <p class="lens-info-title"><b>${l.fov.split(' × ')[0]}</b> ${l.name}</p>
    <p class="lens-info-use">${LENS_USE[l.name]}</p>
    ${sp ? `<dl class="lens-info-stats">
      <div><dt>Focal length</dt><dd>${mm(sp.f)}</dd></div>
      <div><dt>Detail at 10 m</dt><dd>${mm(sp.ifov * 10)}</dd></div>
      <div><dt>Closest focus</dt><dd>${sp.min}</dd></div>
    </dl>` : ''}`;
  if (window.gsap && !reduceMotion) gsap.fromTo(box.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
}
function renderLensSet() {
  const cur = lensSet(variant);
  document.querySelectorAll('.lens-chip').forEach((c) => c.setAttribute('aria-pressed', String(cur.includes(Number(c.dataset.lens)))));
  document.querySelectorAll('.lens-popular [data-set]').forEach((b) => b.classList.toggle('is-on', b.dataset.set === variant.code));
  const codeEl = $('[data-lens-code]');
  if (!codeEl) return;
  codeEl.textContent = variant.code;
  const k = cur.length;
  $('[data-lens-note]').textContent = `${k} ${k === 1 ? 'lens' : 'lenses'}${variant.best ? ' · popular set' : ''}`;
  renderLensInfo();
  document.dispatchEvent(new CustomEvent('lens:change'));
}

/* ---------- G series: add-on lens ---------- */
if (addOns.length) {
  const box = document.createElement('div');
  box.className = 'addon';
  box.innerHTML = `<div class="lens-head"><p class="lens-q" id="addon-q">Add a lens</p><p class="lens-help">Clips onto the built-in lens. Optional.</p></div>
    <div class="addon-list" role="group" aria-labelledby="addon-q">${addOns.map((a) => `
      <button type="button" class="addon-chip" data-addon="${a.id}" aria-pressed="false">
        <span class="addon-tick" aria-hidden="true"></span><b>${a.name.replace(/ angle lens| lens/i, '')}</b><span>+ ${money(a.price)}</span>
      </button>`).join('')}</div>`;
  $('[data-pd-variants]').after(box);
  $('[data-pd-intro]').classList.add('has-addons');
  box.addEventListener('click', (e) => {
    const c = e.target.closest('[data-addon]');
    if (!c) return;
    const on = !picked.has(c.dataset.addon);
    if (on) picked.add(c.dataset.addon); else picked.delete(c.dataset.addon);
    c.setAttribute('aria-pressed', String(on));
    renderBuy();
    document.dispatchEvent(new CustomEvent('addon:change', { detail: { id: c.dataset.addon, on } }));
  });
  // the camera goes in the cart through cart.js; the chosen add-on lenses go in with it
  document.querySelectorAll('[data-main-cart]').forEach((btn) => btn.addEventListener('click', () => {
    (btn.dataset.addOns || '').split(',').filter(Boolean).forEach((k) => window.HMCart && window.HMCart.add(k));
  }));
}
$('[data-pd-cta-terms]').textContent = business
  ? 'Prices excl. VAT. Businesses pay on invoice after we check the order. Shipped from Germany: 2–3 days in stock, otherwise 4–5 days.'
  : 'Prices incl. VAT. Pay with PayPal or prepayment. Shipped from Germany: 2–3 days in stock, otherwise 4–5 days.';
$('#cta-title').textContent = `Get the ${p.name} from SENSOR.`;
// the story section names this camera, not the template one
document.querySelectorAll('.pd-about-text p').forEach((el) => { el.textContent = el.textContent.replace(/M20W/g, p.name); });
// fire service cameras get their own story: smoke and darkness, not fuse boxes
if (p.series === 'fb' || p.series === 'fp' || p.series === 'ft') {
  $('#about-title').textContent = 'Made for the moment it gets dark and smoky.';
  const first = document.querySelector('.pd-about-text p');
  if (first) first.textContent = `In smoke and darkness the ${p.name} shows where people are, where the fire sits and where embers still glow. Large, simple buttons and a clear screen keep it easy to use when every second counts.`;
}
{ const tt = document.querySelector('[data-pd-turntable]'); if (tt) tt.setAttribute('aria-label', `The ${p.name} turning slowly`); }
// gallery: HIKMICRO product renders (M20W) plus pictures of the camera in use from SENSOR
{
  // product shots live in the photo section above when HIKMICRO photos exist; this gallery keeps the pictures in use
  const studio = ((window.HM_PHOTOS || {})[p.id] || []).length > 0;
  const inUse = (window.HM_PRODUCT_PICS ? window.HM_PRODUCT_PICS(p) : []).filter((x) => !(studio && x.product));
  const grid = $('.pd-gallery-grid');
  if (!p.photos || studio) grid.innerHTML = '';
  grid.insertAdjacentHTML('beforeend', inUse.map((x) => `<figure class="${x.product ? 'is-product' : 'is-field'}${x.w / x.h > 1.6 ? ' is-wide' : ''}" style="aspect-ratio:${x.w / x.h > 1.6 ? '8 / 3' : x.w >= x.h ? '4 / 3' : '3 / 4'}"><img src="${x.src}" width="${x.w}" height="${x.h}" alt="${x.alt}" loading="lazy" decoding="async">${x.label ? `<figcaption>${x.label}</figcaption>` : ''}</figure>`).join(''));
  grid.classList.toggle('has-field', inUse.some((x) => !x.product));
  if (!grid.children.length) $('[data-pd-gallery]').hidden = true;
  else if ((!p.photos || studio) && !inUse.some((x) => x.product)) $('#gallery-title').textContent = 'In use';
}

// ----- specifications: datasheet detail where we have it, otherwise the price list values -----
const buyerKey = buyer;
function renderSpecs() {
  const v = variant || {};
  const cal = p.calibration;
  const war = p.warranty;
  const rows = [
    ['Type', p.typeLabel || TYPES[p.type]],
    ['Model', variants ? v.code : null],
    ['Thermal resolution', p.res],
    ['Sensitivity (NETD)', p.netd],
    ['Detector pitch', p.pitch],
    ['Lens', variants ? null : p.lens],
    ['Field of view', variants ? (v.fov || '').split(' / ').join(' + ') : p.fov],
    ['Focal length', variants && p.lensSpecs ? lensSet(v).map((n) => `${v.code.includes('/') ? `L${n}: ` : ''}${mm(p.lensSpecs[n].f)}`).join(' · ') : null],
    ['Spatial resolution (IFOV)', variants && p.lensSpecs ? lensSet(v).map((n) => `${v.code.includes('/') ? `L${n}: ` : ''}${p.lensSpecs[n].ifov} mrad`).join(' · ') : null],
    ['Closest focus', variants && p.lensSpecs ? lensSet(v).map((n) => `${v.code.includes('/') ? `L${n}: ` : ''}${p.lensSpecs[n].min}`).join(' · ') : null],
    ['Focus', p.focus],
    ['Temperature range', p.range],
    ['Detection range', p.detection],
    ['Display', p.display],
    ['Visual camera', p.visual],
    ['Storage', p.storage],
    ['Connectivity', p.link],
    ['Laser and light', p.laser],
    ['Positioning', p.gps],
    ['Features', p.link ? null : p.features],
    ['Battery', p.battery],
    ['Protection', p.ip],
    ['Weight', p.weight],
    ['Working in heat', p.heatWork],
    ['In the box', p.box],
    ['Warranty', war ? `${war.base}${war.plus1 ? ` · extend by 1 year ${money(war.plus1)}, by 2 years ${money(war.plus2)} (detector and battery not included)` : ''}` : null],
    ['Calibration by SENSOR', cal ? `${money(cal.price)}${cal.extraLens ? `, each extra lens ${money(cal.extraLens)}` : ''} · ${cal.note}` : null],
    ['Part number', v.part],
    ['EAN', v.ean],
    ['Price', p.quoteOnly ? 'On request' : `${money(variants ? v.price : p.price)} ${window.HM_VATNOTE(buyerKey)}`],
  ].filter(([, val]) => val);
  if (!p.datasheet && !p.variants) rows.splice(1, 0, ['Specifications', 'Datasheet to follow from HIKMICRO']);
  // the four numbers people compare first, as tiles above the table
  const tiles = [['Resolution', p.res], ['Sensitivity', p.netd], ['Temperature range', p.range], ['Field of view', variants ? (v.fov || '').split(' / ')[0] : p.fov], ['Display', p.display]]
    .filter(([, val]) => val).slice(0, 4);
  $('[data-pd-keytiles]').innerHTML = tiles.map(([k, val]) => `<li class="glass"><span>${k}</span><b>${val}</b></li>`).join('');
  $('[data-pd-table]').innerHTML = `<tbody>${rows.map(([k, val]) => `<tr><th scope="row">${k}</th><td>${val}</td></tr>`).join('')}</tbody>`;
}
renderSpecs();
renderBuy();
const dl = document.querySelector('.pd-dl');
if (p.datasheet) { dl.href = p.datasheet; dl.target = '_blank'; dl.rel = 'noopener'; dl.querySelector('.pd-dl-text span').textContent = 'PDF by HIKMICRO'; }
else { dl.removeAttribute('href'); dl.setAttribute('aria-disabled', 'true'); dl.querySelector('.pd-dl-text span').textContent = 'Follows from HIKMICRO'; }

// ----- accessories of the series (batteries, lenses, brackets …), from the price list -----
const accs = window.HM_ACCESSORIES_FOR ? window.HM_ACCESSORIES_FOR(id) : [];
if (accs.length) {
  const sec = $('[data-pd-acc]');
  sec.hidden = false;
  const sname = (window.HM_DATA.SERIES.find((x) => x.id === p.series) || {}).name || 'this camera';
  $('[data-acc-title]').textContent = 'Accessories';
  $('[data-acc-sub]').textContent = `Batteries, lenses and more that fit every camera of the ${sname}.`;
  $('[data-acc-list]').innerHTML = accs.map((a) => `
    <li class="pd-acc-item">
      <div>
        <h3 class="pd-acc-name">${a.name}</h3>
        <p class="pd-acc-desc">${a.desc}</p>
        ${a.note ? `<p class="pd-acc-note">${a.note}</p>` : ''}
      </div>
      <div class="pd-acc-buy">
        <p class="pd-acc-price">${a.price != null ? `${money(a.price)} <span>${window.HM_VATNOTE(buyer)}</span>` : 'Price on request'}</p>
        ${a.price != null ? `<button class="btn btn-glass btn-small" type="button" data-add-cart="acc:${a.id}" aria-label="Add ${a.name} to cart"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>Add</span></button>` : ''}
      </div>
    </li>`).join('');
}
// ----- product photos from HIKMICRO, packing shot included: one large studio picture, thumbnails beside -----
{
  const shots = (window.HM_PHOTOS || {})[p.id] || [];
  const sec = $('[data-pd-shots]');
  if (shots.length) {
    sec.hidden = false;
    $('[data-shots-title]').textContent = `Every side of the ${p.name}.`;
    $('[data-shots-total]').textContent = String(shots.length).padStart(2, '0');
    const alt = (s, i) => (s.box ? (p.series === 'm' ? 'What comes in the box with an M series camera' : `What comes in the box with the ${p.name}`) : `HIKMICRO ${p.name}, photo ${i + 1} of ${shots.length}`);
    const thumbs = $('[data-shots-thumbs]');
    thumbs.innerHTML = shots.map((s, i) => `<li><button type="button" class="${s.box ? 'is-box' : ''}" aria-label="${s.box ? 'In the box' : `Photo ${i + 1}`}"><img src="${s.src}" width="${s.w}" height="${s.h}" alt="" loading="lazy" decoding="async">${s.box ? '<span>In the box</span>' : ''}</button></li>`).join('');
    thumbs.classList.toggle('is-many', shots.length > 12);
    const btns = [...thumbs.querySelectorAll('button')];
    const imgs = [$('[data-shots-a]'), $('[data-shots-b]')];
    const stage = $('[data-shots-stage]');
    const tag = $('[data-shots-tag]');
    let cur = -1; let front = 0;
    const show = (i) => {
      i = (i + shots.length) % shots.length;
      if (i === cur) return;
      const dir = cur < 0 ? 0 : (i > cur ? 1 : -1);
      cur = i;
      const s = shots[i];
      const next = imgs[1 - front]; const prev = imgs[front];
      next.classList.toggle('is-box', !!s.box);
      next.onload = null;
      const swap = () => {
        next.style.setProperty('--from', `${dir * 4}%`);
        next.classList.remove('is-on'); void next.offsetWidth; next.classList.add('is-on');
        prev.classList.remove('is-on');
        front = 1 - front;
      };
      next.width = s.w; next.height = s.h; next.alt = alt(s, i);
      if (next.getAttribute('src') === s.src && next.complete) swap();
      else { next.onload = swap; next.src = s.src; }
      tag.hidden = !s.box;
      stage.classList.toggle('is-box', !!s.box);
      $('[data-shots-n]').textContent = String(i + 1).padStart(2, '0');
      btns.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
      const b = btns[i];
      if (b && thumbs.scrollWidth > thumbs.clientWidth + 2) thumbs.scrollTo({ left: b.parentElement.offsetLeft - thumbs.clientWidth / 2 + b.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    btns.forEach((b, k) => b.addEventListener('click', () => show(k)));
    $('[data-shots-prev]').addEventListener('click', () => show(cur - 1));
    $('[data-shots-next]').addEventListener('click', () => show(cur + 1));
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
    });
    // swipe on phones
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); });
    // the first picture loads only when the section comes near
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); show(0); } }, { rootMargin: '600px 0px' });
    io.observe(sec);
  }
}
if (p.variants && !p.datasheet) document.querySelector('.credits').textContent = 'Specifications and prices (MSRP) from the SENSOR price list. The 3D camera is an illustration, not the exact construction.';

$('[data-pd-code]').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  let msg = form.querySelector('.pd-code-msg');
  if (!msg) { msg = document.createElement('p'); msg.className = 'pd-code-msg'; msg.setAttribute('role', 'status'); form.appendChild(msg); }
  const v = form.code.value.trim();
  msg.textContent = v ? 'Thanks. In the finished shop this unlocks the manual and software for your camera.' : 'Please enter the code from your camera box.';
});

/* ---------- shared 3D setup ---------- */
function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.1;
  return r;
}
function lightScene(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff1ea, 2.6); key.position.set(-4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xc4d0ff, 1.6); rim.position.set(4, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(3, -1, 4); scene.add(fill);
}
function sizeTo(renderer, camera, el) {
  const w = el.clientWidth; const h = el.clientHeight;
  if (!w || !h) return;
  const c = renderer.domElement;
  if (c.width !== Math.floor(w * renderer.getPixelRatio()) || c.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

/* ---------- the stage ---------- */
const stage = $('[data-pd-stage]');
const canvas = $('[data-pd-canvas]');
const renderer = makeRenderer(canvas);
const scene = new THREE.Scene();
lightScene(scene, renderer);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

const handheld = true; // every camera now comes apart
const built = cadUrl ? await buildCadMini(cadUrl) : (BUILDERS[p.type] || BUILDERS.pistol)(p.name);
const assembly = built.root;
// centre the model on its own middle so it turns in place
const box = new THREE.Box3().setFromObject(assembly);
const centre = box.getCenter(new THREE.Vector3());
assembly.position.sub(centre);
const turn = new THREE.Group();
turn.add(assembly);
scene.add(turn);
const size = box.getSize(new THREE.Vector3());

const exploder = handheld ? new Exploder(assembly, { parts: built.parts }) : null;

/* ---------- the lens on the 3D camera follows the configurator ----------
   SP: the mounted lens unscrews and slides off, the new one slides on. G: the clip-on
   lens is pushed onto the fixed lens. The camera turns its lens towards the viewer. */
const lensDeg = (n) => (lenses.find((l) => l.n === n) || { deg: n }).deg;
const mountedLens = mainLens;
let lensSwap = null;
let holdSpinUntil = 0;
function showLensSide(faceAngle) {
  // turn the shortest way to a three-quarter view of the lens, hold it there for a moment
  if (reduceMotion || state.scroll > 0.001 || !window.gsap) return;
  const TAU = Math.PI * 2;
  const target = state.spin + ((((faceAngle - state.spin) % TAU) + TAU + Math.PI) % TAU - Math.PI);
  holdSpinUntil = performance.now() + 2600;
  gsap.to(state, { spin: target, duration: 0.9, ease: 'power3.inOut', overwrite: true });
}
function swapIn(holder, make, dir) {
  // dir: +1 when the lens points to +z (SP), -1 when it points to −z (G clip-on)
  const old = holder.children.slice();
  const fresh = make();
  if (reduceMotion || !window.gsap) { old.forEach((o) => holder.remove(o)); if (fresh) holder.add(fresh); return; }
  if (lensSwap) lensSwap.progress(1);
  const tl = gsap.timeline({ onComplete: () => { lensSwap = null; } });
  old.forEach((o) => {
    tl.to(o.position, { z: dir * 1.4, duration: 0.45, ease: 'power2.in' }, 0)
      .to(o.rotation, { z: dir * -Math.PI * 1.2, duration: 0.45, ease: 'power2.in' }, 0)
      .to(o.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 0.45, ease: 'power2.in' }, 0)
      .add(() => holder.remove(o));
  });
  if (fresh) {
    fresh.position.z = dir * 1.6; fresh.rotation.z = dir * Math.PI * 1.2; fresh.scale.setScalar(0.6);
    tl.add(() => holder.add(fresh), old.length ? 0.4 : 0)
      .to(fresh.position, { z: 0, duration: 0.6, ease: 'back.out(1.6)' }, '>')
      .to(fresh.rotation, { z: 0, duration: 0.6, ease: 'power3.out' }, '<')
      .to(fresh.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'power3.out' }, '<');
  }
  lensSwap = tl;
}
if (built.lensHolder && variants) {
  let shown = null;
  const apply = (animate) => {
    const n = mountedLens();
    if (n === shown) return;
    shown = n;
    if (!animate) { built.lensHolder.clear(); built.lensHolder.add(makeProLens(lensDeg(n))); return; }
    swapIn(built.lensHolder, () => makeProLens(lensDeg(n)), 1);
    showLensSide(-0.95);
  };
  apply(false);
  document.addEventListener('lens:change', () => apply(true));
}
if (addOns.length) {
  const lensPart = built.parts.find((x) => x.name === 'lens');
  if (lensPart) {
    const clip = new THREE.Group(); clip.position.z = -0.05; lensPart.add(clip);
    document.addEventListener('addon:change', (e) => {
      // the add-on ticked last sits on the lens; with none ticked the lens is bare
      const on = [...picked];
      const id = e.detail.on ? e.detail.id : on[on.length - 1];
      const a = id && addOns.find((x) => x.id === id);
      swapIn(clip, () => (a ? makeClipLens(a.name) : null), -1);
      if (a || e.detail.on === false) showLensSide(Math.PI - 0.95);
    });
  }
}
const labels = handheld ? new Labels($('[data-pd-labels]'), camera, canvas, { margin: 32, gap: 10 }) : null;
// Part names and notes come from this product's datasheet values; without data, only the name shows.
const join = (...a) => a.filter(Boolean).join(' · ');
const LABELS = {
  cover: () => ['Lens cover', 'Flips up to protect the lens'],
  lens: () => ['Thermal lens', join(p.lens, p.fov && `FOV ${p.fov}`, p.focus) || 'Germanium optics for long-wave infrared'],
  focus: () => ['Focus ring', p.focus && p.focus !== 'Focus ring' ? p.focus : 'Sharpens the image for the distance'],
  visual: () => ['Visual camera', p.visual || (p.type === 'binocular' ? 'Day camera' : 'Daylight image for fusion')],
  front: () => ['Housing', join(p.ip, p.laser) || 'Rugged housing'],
  detector: () => ['Thermal detector', p.res ? join(`${p.res} uncooled`, p.pitch, p.netd && `NETD ${p.netd}`) : 'Uncooled thermal detector'],
  board: () => ['Main board', join('Image processing', p.link, p.gps) || 'Image processing'],
  display: () => ['Display', p.display || 'Shows the thermal image'],
  keypad: () => [p.type === 'pistol' ? 'Keypad' : 'Controls', p.type === 'pistol' ? 'One-hand control' : p.type === 'pro' ? 'Buttons and dial beside the screen' : 'Buttons on top'],
  grip: () => ['Grip', 'Ribbed grip'],
  trigger: () => ['Trigger', 'Takes the picture'],
  battery: () => ['Battery', p.battery || 'Rechargeable Li-ion battery'],
  eyepiece: () => ['Eyepiece', p.eyepiece || 'Adjustable eyepiece'],
  viewfinder: () => ['OLED viewfinder', 'Sharp image in bright sun'],
  clip: () => ['Clip and bracket', 'Clips onto a phone or tablet, mounts on a wall or tripod'],
  mount: () => ['Mount', 'Fixes the scope to the rifle'],
};
const labelOf = (part) => {
  const l = part.userData.label;
  if (!l) return null;
  const [title, note] = (LABELS[l.key] || (() => [l.title, l.note]))();
  return { title, note, anchor: l.anchor };
};
if (labels) {
  for (const part of built.parts) {
    const l = labelOf(part);
    if (l) labels.add(part, l.title, { note: l.note, anchor: l.anchor });
  }
  $('[data-pd-parts]').innerHTML = built.parts.map(labelOf).filter(Boolean)
    .map((l) => `<li><b>${l.title}</b><span>${l.note}</span></li>`).join('');
}

// where the model faces: turning freely at first, then a three-quarter view for the explode
const VIEW = { pistol: { y: -2.25, x: 0.18 }, pro: { y: -2.0, x: 0.22 }, pocket: { y: -0.9, x: 0.15 }, phone: { y: -0.75, x: 0.2 }, monocular: { y: -1.25, x: 0.2 }, binocular: { y: -0.95, x: 0.25 }, scope: { y: -1.35, x: 0.15 } }[p.type] || { y: -2.25, x: 0.18 };
const state = { spin: 0, scroll: 0, mx: 0, my: 0 };

function frameCamera(e) {
  // pull back as the parts spread
  const fit = Math.max(size.y, size.x * 1.6, size.z * (p.type === 'scope' ? 0.78 : 1.15)) * (phone() ? 1.5 : 1.42);
  const dist = fit / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (1 + e * (phone() ? 0.75 : 0.32));
  const shift = phone() ? 0 : THREE.MathUtils.lerp(size.x * 0.55, 0, Math.min(1, state.scroll * 6));
  camera.position.set(-shift, 0.15 + e * 0.1, dist);
  camera.lookAt(-shift, 0, 0);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const clock = new THREE.Clock();

function renderStage() {
  sizeTo(renderer, camera, canvas);
  const dt = Math.min(clock.getDelta(), 0.05);
  const p0 = state.scroll;
  if (!reduceMotion && p0 < 0.001 && performance.now() > holdSpinUntil) state.spin += dt * 0.55;

  // blend from the free turn to the explode view in the first part of the scroll
  const k = handheld ? smooth(clamp01(p0 / 0.14)) : 0;
  const spinY = state.spin + state.mx * 0.25;
  const targetY = VIEW.y;
  // take the short way round to the target angle
  const base = spinY - Math.round((spinY - targetY) / (Math.PI * 2)) * Math.PI * 2;
  turn.rotation.y = THREE.MathUtils.lerp(spinY, targetY + (spinY - base), k);
  turn.rotation.x = THREE.MathUtils.lerp(0.08 + state.my * 0.08, VIEW.x, k);

  const e = handheld ? smooth(clamp01((p0 - 0.14) / 0.42)) : 0;
  if (exploder) exploder.set(e);
  frameCamera(e);
  renderer.render(scene, camera);

  if (labels && !phone() && !reduceMotion) {
    const show = clamp01((p0 - 0.44) / 0.12) * (1 - clamp01((p0 - 0.9) / 0.08));
    $('[data-pd-labels]').style.opacity = show;
    $('[data-pd-caption]').style.opacity = show;
    if (show > 0) labels.update();
  }
  const intro = 1 - clamp01(p0 / 0.1);
  const keepIntro = phone() || reduceMotion;
  $('[data-pd-intro]').style.opacity = keepIntro ? 1 : intro;
  $('[data-pd-intro]').style.pointerEvents = intro < 0.2 && !keepIntro ? 'none' : '';
  $('[data-pd-hint]').style.opacity = 1 - clamp01(p0 / 0.05);
  { const li = document.querySelector('[data-lens-info]'); if (li && !keepIntro) { li.style.opacity = intro; li.style.visibility = intro < 0.05 ? 'hidden' : ''; } }
  // the exploded camera disappears before the details scroll in
  const out = phone() ? 1 : 1 - clamp01((p0 - 0.9) / 0.1);
  canvas.style.opacity = out;
  document.querySelector('.pd-controls').style.opacity = out;
}

// a little parallax with the pointer while it turns
stage.addEventListener('pointermove', (e) => {
  const r = stage.getBoundingClientRect();
  state.mx = (e.clientX - r.left) / r.width - 0.5;
  state.my = (e.clientY - r.top) / r.height - 0.5;
});

/* ---------- scroll ---------- */
if (window.gsap && window.ScrollTrigger && handheld && !reduceMotion && !phone()) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: '[data-pd-hero]',
    start: 'top top',
    end: '+=200%',
    pin: true,
    scrub: 0.8,
    onUpdate: (self) => { state.scroll = self.progress; },
  });
  $('[data-pd-skip]').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: $('#specs').getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
  });
  // entrance of the intro
  gsap.from(['.pd-back', '.pd-title', '.pd-lead', '.pd-keyspecs', '.pd-buy'], { y: 20, opacity: 0, duration: 0.7, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity' });
} else if (handheld && (reduceMotion || phone())) {
  // phones and reduced motion: show the camera apart once it scrolls into view, no pinning
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    if (reduceMotion) return; // stays assembled; the parts are listed below
    const o = { v: 0 };
    const step = () => { o.v = Math.min(0.6, o.v + 0.006); state.scroll = o.v; if (o.v < 0.6) requestAnimationFrame(step); };
    setTimeout(step, 1200);
  }, { threshold: 0.6 });
  io.observe(canvas);
}

/* ---------- the slow turntable beside the story ---------- */
const ttCanvas = $('[data-pd-turntable]');
const tt = makeRenderer(ttCanvas);
const ttScene = new THREE.Scene();
lightScene(ttScene, tt);
const ttCam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
const ttModel = cadUrl ? (await buildCadMini(cadUrl)).root : (BUILDERS[p.type] || BUILDERS.pistol)(p.name).root;
const ttBox = new THREE.Box3().setFromObject(ttModel);
ttModel.position.sub(ttBox.getCenter(new THREE.Vector3()));
const ttTurn = new THREE.Group(); ttTurn.add(ttModel); ttTurn.rotation.x = 0.1; ttScene.add(ttTurn);
const ttSize = ttBox.getSize(new THREE.Vector3());
ttCam.position.set(0, 0.2, Math.max(ttSize.y, ttSize.x, ttSize.z) * 3.3);
ttCam.lookAt(0, 0, 0);
let ttVisible = false;
new IntersectionObserver(([en]) => { ttVisible = en.isIntersecting; }).observe(ttCanvas);

let stageVisible = true;
new IntersectionObserver(([en]) => { stageVisible = en.isIntersecting; }).observe(stage);

function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  if (stageVisible) renderStage();
  if (ttVisible) {
    sizeTo(tt, ttCam, ttCanvas);
    if (!reduceMotion) ttTurn.rotation.y += 0.004;
    tt.render(ttScene, ttCam);
  }
}
requestAnimationFrame(loop);
