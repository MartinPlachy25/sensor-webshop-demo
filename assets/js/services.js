/* Service section: next-calibration calculator and one drawer with a
   different form for each service. No backend yet: sending shows a thank-you. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = typeof window.gsap !== 'undefined' && !reduceMotion;
  const choice = (() => { try { return JSON.parse(localStorage.getItem('hm-choice')) || {}; } catch { return {}; } })();
  const products = window.HM_DATA ? Object.values(window.HM_DATA.PRODUCTS).map((p) => p.name) : [];

  /* ---------- calibration calculator ---------- */
  const dateInput = $('[data-calc-date]');
  let dueDate = null;
  if (dateInput) {
  const due = $('[data-calc-due]');
  const note = $('[data-calc-note]');
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  dateInput.max = new Date().toISOString().slice(0, 10);
  dateInput.addEventListener('input', () => {
    if (!dateInput.value) { due.textContent = 'Pick a date'; note.textContent = 'We will show you when it is due.'; dueDate = null; return; }
    const last = new Date(dateInput.value + 'T12:00:00');
    dueDate = new Date(last); dueDate.setFullYear(last.getFullYear() + 2);
    const days = Math.round((dueDate - new Date()) / 86400000);
    due.textContent = fmt(dueDate);
    if (days < 0) note.textContent = `Overdue by ${Math.abs(days)} days. Your readings may be off.`;
    else if (days < 90) note.textContent = `Due in ${days} days. A good time to book.`;
    else note.textContent = `Due in about ${Math.round(days / 30)} months.`;
    $('.svc-calc-result').classList.toggle('is-late', days < 90);
    if (animate) gsap.fromTo(due, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
  });
  }

  /* ---------- forms ---------- */
  const F = {
    name: { label: 'Full name', type: 'text', auto: 'name', req: true },
    company: { label: 'Company', type: 'text', auto: 'organization', req: () => choice.buyer === 'business' },
    email: { label: 'Email', type: 'email', auto: 'email', req: true },
    phone: { label: 'Phone', type: 'tel', auto: 'tel' },
    address: { label: 'Address', type: 'textarea', auto: 'street-address', req: true, rows: 2 },
    camera: { label: 'Camera model', type: 'select', req: true },
    serial: { label: 'Serial number', type: 'text', help: 'On the label inside the battery compartment.', req: true },
    code: { label: 'SENSOR camera code', type: 'text', help: 'If you have one, it speeds things up.' },
    problem: { label: 'What is the problem?', type: 'textarea', req: true, rows: 4 },
    date: { label: 'Preferred date', type: 'date' },
    from: { label: 'From', type: 'date', req: true, half: true },
    to: { label: 'Until', type: 'date', req: true, half: true },
    job: { label: 'What will you use it for?', type: 'textarea', rows: 3 },
    usedWhat: { label: 'I would like to', type: 'radio', options: ['Buy a used camera', 'Sell my camera'], req: true },
    condition: { label: 'Condition and age', type: 'textarea', rows: 3 },
    months: { label: 'Spread over', type: 'select', options: ['6 months', '12 months', '24 months', '36 months'], req: true },
    message: { label: 'Your message', type: 'textarea', rows: 4 },
    qty: { label: 'How many cameras?', type: 'select', options: ['1', '2–5', '6–20', 'More than 20'] },
    yourCam: { label: 'Your camera', type: 'select' },
    when: { label: 'Preferred dates', type: 'text', help: 'For example: a week in March, or two dates that suit you.' },
  };
  const FORMS = {
    calibration: {
      title: 'Book a calibration', intro: 'We calibrate in Mönchengladbach and send the camera back with a certificate.',
      fields: ['name', 'company', 'email', 'phone', 'camera', 'serial', 'code', 'date'], submit: 'Book calibration',
    },
    repair: {
      title: 'Repair or return', intro: 'Tell us what happened. We confirm within one working day and send a shipping label.',
      fields: ['name', 'company', 'address', 'email', 'phone', 'camera', 'serial', 'problem'], submit: 'Send repair request',
    },
    rental: {
      title: 'Rent a camera', intro: 'Calibrated, charged and packed. Mostly for business customers.',
      fields: ['company', 'name', 'email', 'phone', 'camera', 'from', 'to', 'job'], submit: 'Ask for rental',
    },
    used: {
      title: 'Used cameras', intro: 'Every used camera is checked and recalibrated before it leaves us.',
      fields: ['usedWhat', 'name', 'email', 'phone', 'camera', 'condition'], submit: 'Send',
    },
    quote: {
      title: 'Request a quote', intro: 'Tell us what you need. You get a written offer, businesses can pay on invoice.',
      fields: ['company', 'name', 'email', 'phone', 'camera', 'qty', 'message'], submit: 'Send request',
    },
    contact: {
      title: 'Write to us', intro: 'A person from SENSOR answers, in English, German or French.',
      fields: ['name', 'email', 'phone', 'message'], submit: 'Send message',
    },
    academy: {
      title: 'SENSOR Academy', intro: 'Two-day hands-on training in Mönchengladbach, plus guides and videos. Dates follow soon: leave your details and we let you know first.',
      fields: ['name', 'company', 'email', 'phone', 'message'], submit: 'Keep me posted',
    },
    course: {
      title: 'Request a course', intro: 'Tell us what you inspect and which camera you use. We suggest the right course and a date.',
      fields: ['name', 'company', 'email', 'phone', 'yourCam', 'when', 'message'], submit: 'Send request',
    },
    instalments: {
      title: 'Pay in instalments', intro: 'We send you an offer with the monthly amount. No obligation.',
      fields: ['name', 'company', 'email', 'phone', 'camera', 'months', 'message'], submit: 'Ask for an offer',
    },
  };

  const drawer = $('[data-drawer]');
  const form = $('[data-drawer-form]');
  const fieldsEl = $('[data-drawer-fields]');
  let uid = 0;

  function fieldHTML(key) {
    const f = F[key];
    const id = `f-${key}-${++uid}`;
    const req = typeof f.req === 'function' ? f.req() : !!f.req;
    const reqAttr = req ? ' required' : '';
    const help = f.help ? `<p class="field-help" id="${id}-h">${f.help}</p>` : '';
    const desc = f.help ? ` aria-describedby="${id}-h"` : '';
    const label = `${f.label}${req ? '' : ' <span class="field-opt">(optional)</span>'}`;
    let control;
    if (f.type === 'textarea') control = `<textarea id="${id}" name="${key}" rows="${f.rows || 3}"${f.auto ? ` autocomplete="${f.auto}"` : ''}${reqAttr}${desc}></textarea>`;
    else if (f.type === 'select') {
      const opts = f.options || ['Not sure yet', ...products];
      control = `<select id="${id}" name="${key}"${reqAttr}${desc}><option value="">Choose…</option>${opts.map((o) => `<option>${o}</option>`).join('')}</select>`;
    } else if (f.type === 'radio') {
      return `<fieldset class="field field-radio"><legend>${f.label}</legend>${f.options.map((o, i) => `<label><input type="radio" name="${key}" value="${o}"${i === 0 ? ' checked' : ''}> <span>${o}</span></label>`).join('')}</fieldset>`;
    } else control = `<input id="${id}" name="${key}" type="${f.type}"${f.auto ? ` autocomplete="${f.auto}"` : ''}${reqAttr}${desc}>`;
    return `<div class="field${f.half ? ' field-half' : ''}"><label for="${id}">${label}</label>${help}${control}<p class="field-error" aria-live="polite"></p></div>`;
  }

  function openForm(kind, opener) {
    const cfg = FORMS[kind];
    $('[data-drawer-title]').textContent = cfg.title;
    $('[data-drawer-intro]').textContent = cfg.intro;
    $('[data-drawer-submit]').textContent = cfg.submit;
    fieldsEl.innerHTML = cfg.fields.map(fieldHTML).join('');
    form.dataset.kind = kind;
    $('[data-drawer-done]').hidden = true;
    $$('.drawer-fields, .drawer-foot, .drawer-intro', form).forEach((el) => { el.hidden = false; });
    const cam = opener && (opener.dataset.camera || (document.body.classList.contains('pd') && document.querySelector('[data-pd-name]')?.textContent));
    const sel = form.querySelector('select[name="camera"]');
    if (cam && sel) sel.value = cam;
    if (kind === 'calibration' && dueDate) {
      const d = form.querySelector('input[name="date"]');
      if (d) d.value = (dueDate < new Date() ? new Date() : dueDate).toISOString().slice(0, 10);
    }
    drawer.showModal();
    document.documentElement.classList.add('has-drawer');
    if (animate) {
      gsap.fromTo('.drawer-form', { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out' });
      gsap.from($$('.field', form), { y: 14, opacity: 0, duration: 0.5, stagger: 0.035, delay: 0.1, ease: 'expo.out', clearProps: 'all' });
    }
    const first = form.querySelector('input:not([type=radio]), select, textarea');
    if (first) first.focus();
  }
  function closeForm() {
    if (!drawer.open) return;
    const done = () => { drawer.close(); document.documentElement.classList.remove('has-drawer'); };
    if (animate) gsap.to('.drawer-form', { x: 60, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { gsap.set('.drawer-form', { clearProps: 'all' }); done(); } });
    else done();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-form]');
    if (!b || !FORMS[b.dataset.openForm]) return;
    e.preventDefault();
    openForm(b.dataset.openForm, b);
  });
  drawer.addEventListener('click', (e) => { if (e.target === drawer || e.target.closest('[data-drawer-close]')) closeForm(); });
  drawer.addEventListener('cancel', (e) => { e.preventDefault(); closeForm(); });

  // check each field when it loses focus and on send
  function check(input) {
    const box = input.closest('.field');
    if (!box) return true;
    const err = box.querySelector('.field-error');
    let msg = '';
    if (input.validity.valueMissing) msg = 'Please fill this in.';
    else if (input.validity.typeMismatch && input.type === 'email') msg = 'This does not look like an email address.';
    box.classList.toggle('is-invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg;
    return !msg;
  }
  form.addEventListener('focusout', (e) => { if (e.target.matches('input, select, textarea') && e.target.value) check(e.target); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = $$('input:not([type=radio]), select, textarea', fieldsEl);
    const bad = inputs.filter((i) => !check(i));
    if (bad.length) { bad[0].focus(); return; }
    $$('.drawer-fields, .drawer-foot, .drawer-intro', form).forEach((el) => { el.hidden = true; });
    $('[data-drawer-done]').hidden = false;
    if (animate) gsap.from('[data-drawer-done] > *', { y: 16, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'expo.out' });
  });

  /* ---------- entrance ---------- */
  if (animate && 'IntersectionObserver' in window && $('#services')) {
    const items = ['.svc-title', '.svc-lead', '.svc-calc', ...$$('.svc-item')];
    gsap.set(items, { y: 28, opacity: 0 });
    const io = new IntersectionObserver((en) => {
      if (!en.some((x) => x.isIntersecting)) return;
      io.disconnect();
      gsap.to(items, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07, ease: 'expo.out', clearProps: 'all' });
    }, { rootMargin: '0px 0px -15% 0px' });
    io.observe($('#services'));
  }

  // the menu link scrolls to the section from anywhere on the page
  $$('a[href="#services"]').forEach((a) => a.addEventListener('click', (e) => {
    if (!$('#services')) return;
    e.preventDefault();
    $('#services').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }));
})();
