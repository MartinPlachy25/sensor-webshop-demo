/* SENSOR Academy page: thermal lens in the hero, reveal on scroll, the course builder
   with live prices, the video window and the course request.
   Texts are written as separate English pieces so i18n.js can translate each one. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const animate = typeof window.gsap !== 'undefined' && !reduce;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => '€ ' + Math.round(n).toLocaleString('en-US').replace(/,/g, '.');

  /* ---------- hero: a thermal lens that follows the pointer ---------- */
  const hero = $('[data-lens]');
  if (hero) {
    const media = $('.ac-hero-media', hero);
    const heat = $('[data-lens-heat]', hero);
    const ring = $('[data-lens-ring]', hero);
    const temp = $('[data-lens-temp]', hero);
    const photo = $('.ac-hero-photo', hero);
    // read the brightness under the lens to show a believable temperature
    let px = null; let pw = 0; let ph = 0;
    const sample = () => {
      try {
        const c = document.createElement('canvas'); pw = 450; ph = 300; c.width = pw; c.height = ph;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(photo, 0, 0, pw, ph);
        px = g.getImageData(0, 0, pw, ph).data;
      } catch { px = null; }
    };
    if (photo.complete) sample(); else photo.addEventListener('load', sample, { once: true });

    // where a screen point falls on the cover-fitted photo (object-position 62% 40%, 30% on phones)
    const toImage = (x, y, r) => {
      const iw = 1800; const ih = 1200; const s = Math.max(r.width / iw, r.height / ih);
      const posX = window.innerWidth <= 760 ? 0.3 : 0.62;
      const ox = (r.width - iw * s) * posX; const oy = (r.height - ih * s) * 0.4;
      return [((x - ox) / s) / iw, ((y - oy) / s) / ih];
    };
    const R = () => (window.innerWidth <= 760 ? 46 : 68);
    // the reading follows the spot in the middle smoothly, like a camera's spot meter
    let target = null; let shown = null; let raf = 0;
    const show = () => {
      if (target == null) return;
      shown = shown == null ? target : shown + (target - shown) * 0.35;
      temp.textContent = `${shown.toFixed(1)} °C`;
      raf = Math.abs(target - shown) > 0.05 ? requestAnimationFrame(show) : 0;
    };
    const place = (x, y) => {
      const r = media.getBoundingClientRect();
      heat.style.setProperty('--x', `${x}px`); heat.style.setProperty('--y', `${y}px`); heat.style.setProperty('--r', `${R()}px`);
      ring.style.setProperty('--r', `${R()}px`);
      ring.style.transform = `translate(${x}px, ${y}px)`;
      if (!px) return;
      const [u, v] = toImage(x, y, r);
      const cx = Math.round(u * pw); const cy = Math.round(v * ph);
      let sum = 0; let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ix = Math.min(pw - 1, Math.max(0, cx + dx)); const iy = Math.min(ph - 1, Math.max(0, cy + dy));
        const i = (iy * pw + ix) * 4; sum += 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]; n++;
      }
      // brightness to a room-temperature range: walls about 20 °C, lit parts up to about 33 °C
      const lum = sum / n / 255;
      target = 19.2 + Math.pow(lum, 1.35) * 15;
      if (!raf) raf = requestAnimationFrame(show);
    };
    heat.style.transition = 'none';
    if (fine) {
      media.addEventListener('pointermove', (e) => {
        const r = media.getBoundingClientRect();
        hero.classList.add('is-lens');
        place(e.clientX - r.left, e.clientY - r.top);
      });
      // the text sits above the photo: keep the lens moving there too
      hero.addEventListener('pointermove', (e) => {
        if (e.target.closest('.ac-hero-media')) return;
        if (e.target.closest('a, button')) return;
        const r = media.getBoundingClientRect();
        hero.classList.add('is-lens');
        place(e.clientX - r.left, e.clientY - r.top);
      });
      hero.addEventListener('pointerleave', () => {
        hero.classList.remove('is-lens');
        heat.style.transition = ''; heat.style.setProperty('--r', '0px');
        setTimeout(() => { heat.style.transition = 'none'; }, 500);
      });
    } else {
      // touch screens: the lens drifts slowly over the photo by itself
      hero.classList.add('is-lens');
      let t0 = performance.now(); let visible = true;
      const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; }); io.observe(media);
      const tick = (now) => {
        if (visible) {
          const r = media.getBoundingClientRect();
          const t = reduce ? 0 : (now - t0) / 1000;
          place(r.width * (0.58 + 0.2 * Math.sin(t * 0.35)), r.height * (0.42 + 0.16 * Math.sin(t * 0.52 + 1)));
        }
        if (!reduce) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    if (animate) {
      gsap.fromTo($$('.ac-hero-copy > *', hero), { y: 34, opacity: 0, filter: 'blur(8px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.09, ease: 'expo.out', delay: 0.25, clearProps: 'filter' });
      gsap.fromTo($$('.ac-hero-facts li', hero), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'expo.out', delay: 0.7 });
      gsap.fromTo(photo, { scale: 1.08 }, { scale: 1, duration: 2.4, ease: 'expo.out' });
    }
  }

  /* ---------- reveal on scroll ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver((en) => {
      en.forEach((x) => {
        if (!x.isIntersecting) return;
        const el = x.target;
        const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
        el.style.transitionDelay = `${Math.min(sibs.indexOf(el), 6) * 70}ms`;
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
  }

  /* ---------- course builder ---------- */
  // Example prices, excl. VAT, until SENSOR sets the real ones.
  const PRICE = {
    online: { '3h': 149, '1d': 390 }, // per person
    sensor: { '3h': 249, '1d': 590, '2d': 1090, '3d': 1490 }, // per person
    site: { '3h': 1190, '1d': 1990, '2d': 3690, '3d': 5190 }, // per group, plus travel
  };
  const GROUP = { 1: { n: 1, f: 1.6, site: 0.85 }, 4: { n: 4, f: 1, site: 1 }, 8: { n: 8, f: 0.9, site: 1.15 }, 12: { n: 12, f: 0.8, site: 1.3 } };
  const DAYS = { '3h': 0.5, '1d': 1, '2d': 2, '3d': 3 };
  const FOOD = { half: 15, day: 35 };
  const CAMS = { half: 25, day: 45 };
  const LABEL = {
    format: { online: 'Online live', sensor: 'At SENSOR', site: 'At your site' },
    length: { '3h': '3 hours', '1d': '1 day', '2d': '2 days', '3d': '3 days' },
    group: { 1: 'Just me', 4: '2 – 4 people', 8: '5 – 8 people', 12: '9 – 12 people' },
    forN: { 1: 'For 1 person:', 4: 'For 4 people:', 8: 'For 8 people:', 12: 'For 12 people:' },
  };
  const PHOTO = { online: 'online.jpg', sensor: 'classroom.jpg', site: 'field-roof.jpg' };

  const planner = $('[data-planner]');
  let current = null;
  if (planner) {
    const form = $('[data-plan-form]', planner);
    const val = (n) => (form.querySelector(`input[name="${n}"]:checked`) || {}).value;
    const box = (n) => form.querySelector(`input[name="${n}"]`);
    const span = (t) => `<span>${esc(t)}</span>`;
    const out = {
      name: $('[data-sum-name]'), who: $('[data-sum-who]'), pp: $('[data-sum-pp]'), unit: $('[data-sum-unit]'),
      total: $('[data-sum-total]'), inc: $('[data-sum-inc]'), photo: $('[data-sum-photo]'),
      lengthNote: $('[data-length-note]'), foodPrice: $('[data-food-price]'), camsPrice: $('[data-cams-price]'), foodNote: $('[data-food-note]'),
    };
    let lastPP = null;

    function update() {
      const format = val('format');
      // online: up to one day (two sessions of three hours)
      $$('input[name="length"]', form).forEach((i) => { i.disabled = format === 'online' && (i.value === '2d' || i.value === '3d'); });
      if (form.querySelector('input[name="length"]:checked').disabled) form.querySelector('input[name="length"][value="1d"]').checked = true;
      const length = val('length'); const g = GROUP[val('group')]; const days = DAYS[length];
      const half = length === '3h';
      // extras only where people are in one room
      const inRoom = format !== 'online';
      ['food', 'cams'].forEach((k) => {
        const b = box(k); b.disabled = !inRoom; if (!inRoom) b.checked = false;
        b.closest('.ac-toggle').classList.toggle('is-off', !inRoom);
      });
      const food = box('food').checked; const cams = box('cams').checked;
      const foodPP = half ? FOOD.half : FOOD.day * days; const camsPP = half ? CAMS.half : CAMS.day * days;
      out.foodPrice.innerHTML = inRoom ? `+ ${eur(foodPP)} ${span('per person')}` : span('Not online');
      out.camsPrice.innerHTML = inRoom ? `+ ${eur(camsPP)} ${span('per person')}` : span('Not online');
      out.foodNote.innerHTML = span(half ? 'Coffee, drinks and snacks' : 'Lunch, coffee and drinks all day');
      out.lengthNote.innerHTML = format === 'online' ? span('Online courses run up to one day, as two live sessions of three hours.') : (format === 'site' ? span('Up to 12 people. Travel costs are added at cost.') : '');

      let total; let pp; let perGroup = false;
      if (format === 'site') {
        perGroup = true;
        total = PRICE.site[length] * g.site + ((food ? foodPP : 0) + (cams ? camsPP : 0)) * g.n;
        pp = total / g.n;
      } else {
        pp = PRICE[format][length] * g.f + (food ? foodPP : 0) + (cams ? camsPP : 0);
        total = pp * g.n;
      }
      const main = perGroup ? total : pp;
      out.name.innerHTML = `${span(LABEL.format[format])} · ${span(LABEL.length[length])}`;
      out.who.innerHTML = span(LABEL.group[val('group')]);
      out.unit.innerHTML = span(perGroup ? 'per group, excl. VAT, plus travel' : 'per person, excl. VAT');
      out.total.innerHTML = perGroup
        ? (g.n > 1 ? `${span('That is about')} ${eur(pp)} ${span('per person')}` : span('Private training at your site'))
        : `${span(LABEL.forN[val('group')])} ${eur(total)} ${span('excl. VAT')}`;
      // count up to the new price
      if (animate && lastPP != null && lastPP !== main) {
        const o = { v: lastPP };
        gsap.to(o, { v: main, duration: 0.6, ease: 'expo.out', onUpdate: () => { out.pp.textContent = eur(o.v); } });
      } else out.pp.textContent = eur(main);
      lastPP = main;

      const inc = [];
      if (format === 'online') inc.push('Live trainer and a small group', 'Nothing to install, it runs in your browser');
      if (format === 'sensor') inc.push('Training room, test objects and coffee', 'Practice in our building and workshop');
      if (format === 'site') inc.push('Our trainer comes to you', 'Practice on your own buildings and machines');
      inc.push('Course notes for every participant', 'Certificate of attendance');
      if (food) inc.push(half ? 'Coffee, drinks and snacks' : 'Lunch, coffee and drinks');
      if (cams) inc.push('A calibrated camera for each person');
      inc.push('Your questions answered after the course');
      out.inc.innerHTML = inc.map((t) => `<li>${esc(t)}</li>`).join('');

      const src = `assets/img/academy/${PHOTO[format]}`;
      if (!out.photo.src.endsWith(PHOTO[format])) {
        out.photo.style.opacity = '0';
        setTimeout(() => { out.photo.src = src; out.photo.onload = () => { out.photo.style.opacity = '1'; }; }, reduce ? 0 : 200);
      }
      current = { format, length, group: val('group'), food, cams, main, perGroup, total, pp };
    }
    form.addEventListener('change', update);
    update();
  }

  /* ---------- course request: the drawer from services.js, with the chosen course on top ---------- */
  const bookBtn = $('[data-book]');
  if (bookBtn) {
    bookBtn.dataset.openForm = 'course';
    // runs after services.js has opened the drawer (same click, registered later)
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-open-form="course"]');
      if (!b) return;
      const intro = $('[data-drawer-intro]');
      const fields = $('[data-drawer-fields]');
      if (!intro || !fields) return;
      if (b === bookBtn && current) {
        const c = current;
        const bits = [LABEL.format[c.format], LABEL.length[c.length], LABEL.group[c.group]];
        if (c.food) bits.push('Lunch and drinks');
        if (c.cams) bits.push('Cameras for everyone');
        intro.innerHTML = `<span class="ac-req">${bits.map((t) => `<span class="ac-req-chip">${esc(t)}</span>`).join('')}</span>`
          + `<span class="ac-req-price">${eur(c.main)} <span>${esc(c.perGroup ? 'per group, excl. VAT, plus travel' : 'per person, excl. VAT')}</span></span>`
          + `<span class="ac-req-text">${esc('We confirm a date and send you a written offer. No payment now.')}</span>`;
        const hid = document.createElement('input');
        hid.type = 'hidden'; hid.name = 'course';
        hid.value = `${c.format} | ${c.length} | group ${c.group} | food ${c.food} | cameras ${c.cams} | ${Math.round(c.main)} EUR`;
        fields.append(hid);
      }
    });
  }

  /* ---------- video window ---------- */
  const player = $('[data-player]');
  if (player) {
    const open = (card) => {
      const img = card.querySelector('img');
      const title = card.querySelector('b');
      $('[data-player-img]').src = img ? img.src : 'assets/img/field/pocket-window.jpg';
      $('[data-player-title]').textContent = title ? title.textContent : (window.HM_T ? window.HM_T('All videos on YouTube') : 'All videos on YouTube');
      player.showModal();
      document.documentElement.classList.add('has-drawer');
    };
    const close = () => { player.close(); document.documentElement.classList.remove('has-drawer'); };
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-video]');
      if (!card) return;
      e.preventDefault();
      open(card);
    });
    player.addEventListener('click', (e) => { if (e.target === player || e.target.closest('[data-player-close]')) close(); });
    player.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  }
})();
