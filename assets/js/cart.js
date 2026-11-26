/* Cart and checkout in a side drawer.
   Businesses see net prices plus VAT and may pay on invoice; private customers see
   gross prices and pay with PayPal or prepayment (pro-forma). Discount code field.
   No backend yet: placing the order shows the confirmation only. */
(() => {
  'use strict';
  const D = window.HM_DATA;
  if (!D) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = typeof window.gsap !== 'undefined' && !reduceMotion;
  const KEY = 'hm-cart';
  const CODES = { SENSOR10: 0.1 }; // demo code
  const COUNTRIES = [
    ['DE', 'Germany', '2–3 working days'], ['AT', 'Austria', '3–4 working days'], ['CH', 'Switzerland', '3–5 working days (plus customs)'],
    ['NL', 'Netherlands', '2–3 working days'], ['BE', 'Belgium', '2–3 working days'], ['FR', 'France', '3–5 working days'],
    ['LU', 'Luxembourg', '2–4 working days'], ['IT', 'Italy', '4–6 working days'], ['ES', 'Spain', '4–6 working days'],
    ['PL', 'Poland', '3–5 working days'], ['CZ', 'Czech Republic', '3–4 working days'], ['DK', 'Denmark', '3–4 working days'],
  ];

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { items: [], code: '' }; } catch { return { items: [], code: '' }; } };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* private mode */ } };
  const buyerNow = () => { try { return (JSON.parse(localStorage.getItem('hm-choice')) || {}).buyer || 'business'; } catch { return 'business'; } };
  const setBuyer = (b) => {
    try { const c = JSON.parse(localStorage.getItem('hm-choice')) || {}; c.buyer = b; localStorage.setItem('hm-choice', JSON.stringify(c)); } catch { /* private mode */ }
  };
  let cart = read();
  cart.items = (cart.items || []).filter((it) => window.HM_ITEM && window.HM_ITEM(it.id));
  let country = 'DE';
  const money = (v) => `€ ${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /* ---------- markup ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'drawer cart';
  dlg.setAttribute('aria-labelledby', 'cart-title');
  dlg.innerHTML = `
    <div class="drawer-form cart-inner">
      <div class="drawer-head">
        <h2 id="cart-title" class="drawer-title" data-cart-title>Your cart</h2>
        <button class="drawer-close" type="button" data-cart-close aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        </button>
      </div>
      <div class="cart-buyer" role="group" aria-label="I am buying as">
        <button type="button" data-cart-buyer="business">Business</button>
        <button type="button" data-cart-buyer="private">Private</button>
      </div>

      <section class="cart-view" data-cart-view="cart">
        <ul class="cart-items" data-cart-items></ul>
        <p class="cart-empty" data-cart-empty>Your cart is empty. Pick a camera from the wall and add it here.</p>
        <div class="cart-extras" data-cart-extras>
          <form class="cart-code" data-cart-code>
            <label for="cart-code-input">Discount code</label>
            <div class="cart-code-row">
              <input id="cart-code-input" name="code" type="text" autocomplete="off" aria-describedby="cart-code-msg">
              <button class="btn btn-small cart-ghost" type="submit">Apply</button>
            </div>
            <p class="cart-code-msg" id="cart-code-msg" data-cart-code-msg aria-live="polite"></p>
          </form>
          <div class="cart-country">
            <label for="cart-country">Deliver to</label>
            <select id="cart-country" data-cart-country>${COUNTRIES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select>
            <p class="cart-delivery" data-cart-delivery></p>
          </div>
          <dl class="cart-sum" data-cart-sum></dl>
          <div class="cart-actions">
            <button class="btn btn-primary" type="button" data-cart-checkout>Go to checkout</button>
            <button class="btn btn-small cart-ghost" type="button" data-cart-asquote>Send as a quote request instead</button>
          </div>
          <p class="cart-sample" data-cart-sample>Outdoor prices are samples for the demo.</p>
        </div>
      </section>

      <form class="cart-view" data-cart-view="checkout" novalidate hidden>
        <button class="cart-back" type="button" data-cart-back>← Back to cart</button>
        <fieldset class="cart-pay">
          <legend>How would you like to pay?</legend>
          <label class="pay-option" data-pay="invoice">
            <input type="radio" name="pay" value="invoice">
            <span><b>Invoice</b><span>For businesses. We check the order, then send the invoice with the goods.</span></span>
          </label>
          <label class="pay-option">
            <input type="radio" name="pay" value="paypal">
            <span><b>PayPal</b><span>Pay right away with your PayPal account or card.</span></span>
          </label>
          <label class="pay-option">
            <input type="radio" name="pay" value="proforma">
            <span><b>Prepayment</b><span>You get a pro-forma invoice with our bank details. We ship when the money is in.</span></span>
          </label>
        </fieldset>
        <div class="drawer-fields" data-cart-fields></div>
        <dl class="cart-sum" data-cart-sum2></dl>
        <div class="drawer-foot">
          <button class="btn btn-primary" type="submit" data-cart-place>Place order</button>
          <p class="drawer-note" data-cart-place-note></p>
        </div>
      </form>

      <section class="cart-view drawer-done" data-cart-view="done" hidden>
        <p data-done-text></p>
        <button class="btn btn-light" type="button" data-cart-close>Close</button>
      </section>
    </div>`;
  document.body.appendChild(dlg);

  /* ---------- totals ---------- */
  // Businesses: net prices, VAT on top. Private: the rounded gross prices they saw, VAT inside.
  function totals() {
    const rate = CODES[cart.code] || 0;
    if (buyerNow() === 'private') {
      const grossList = cart.items.reduce((s, it) => s + Math.round((window.HM_ITEM(it.id)?.price || 0) * (1 + D.VAT)) * it.qty, 0);
      const gross = grossList * (1 - rate);
      const vat = gross - gross / (1 + D.VAT);
      return { list: grossList, discount: grossList * rate, vat, gross, rate };
    }
    const net = cart.items.reduce((s, it) => s + (window.HM_ITEM(it.id)?.price || 0) * it.qty, 0);
    const discount = net * rate;
    const vat = (net - discount) * D.VAT;
    return { list: net, discount, vat, gross: net - discount + vat, rate };
  }
  function sumHTML() {
    const t = totals();
    const business = buyerNow() === 'business';
    const rows = [];
    if (business) {
      rows.push(['Subtotal, excl. VAT', money(t.list)]);
      if (t.discount) rows.push([`Discount ${cart.code}`, `− ${money(t.discount)}`]);
      rows.push(['Shipping', 'By SENSOR, quoted with the order']);
      rows.push([`VAT ${Math.round(D.VAT * 100)} %`, money(t.vat)]);
      rows.push(['Total', money(t.gross), true]);
    } else {
      rows.push(['Subtotal', money(t.list)]);
      if (t.discount) rows.push([`Discount ${cart.code}`, `− ${money(t.discount)}`]);
      rows.push(['Shipping', 'By SENSOR, quoted with the order']);
      rows.push(['Total, incl. VAT', money(t.gross), true]);
      rows.push([`of which VAT ${Math.round(D.VAT * 100)} %`, money(t.vat)]);
    }
    return rows.map(([k, v, big]) => `<div class="${big ? 'is-total' : ''}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  /* ---------- render ---------- */
  function badge() {
    const n = cart.items.reduce((s, it) => s + it.qty, 0);
    $$('.nav-cart').forEach((a) => {
      let b = a.querySelector('.nav-cart-count');
      if (!b) { b = document.createElement('span'); b.className = 'nav-cart-count'; a.appendChild(b); }
      b.textContent = n;
      b.hidden = n === 0;
      a.setAttribute('aria-label', `Cart, ${n} item${n === 1 ? '' : 's'}`);
    });
  }
  function render() {
    const buyer = buyerNow();
    $$('[data-cart-buyer]', dlg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cartBuyer === buyer)));
    const list = $('[data-cart-items]', dlg);
    list.innerHTML = cart.items.map((it) => {
      const p = window.HM_ITEM(it.id);
      if (!p) return '';
      return `<li class="cart-item" data-id="${it.id}">
        <div class="cart-item-main">
          <p class="cart-item-name">${p.name}</p>
          <p class="cart-item-type">${p.label} · ${window.HM_PRICE(p.price, buyer)} ${window.HM_VATNOTE(buyer)}</p>
        </div>
        <div class="cart-qty" role="group" aria-label="Quantity of ${p.name}">
          <button type="button" data-qty="-1" aria-label="One less">−</button>
          <span aria-live="polite">${it.qty}</span>
          <button type="button" data-qty="1" aria-label="One more">+</button>
        </div>
        <p class="cart-item-total">${window.HM_PRICE(p.price * it.qty, buyer)}</p>
        <button class="cart-remove" type="button" data-remove aria-label="Remove ${p.name}">Remove</button>
      </li>`;
    }).join('');
    const empty = cart.items.length === 0;
    $('[data-cart-empty]', dlg).hidden = !empty;
    $('[data-cart-extras]', dlg).hidden = empty;
    $('[data-cart-sum]', dlg).innerHTML = sumHTML();
    $('[data-cart-sum2]', dlg).innerHTML = sumHTML();
    $('[data-cart-sample]', dlg).hidden = !cart.items.some((it) => window.HM_ITEM(it.id)?.sample);
    const c = COUNTRIES.find((x) => x[0] === country);
    $('[data-cart-delivery]', dlg).innerHTML = `<span>Usually ${c[2]} when in stock.</span> <span>Not in stock: about 2 days longer, we confirm the date with your order.</span> <span>Packed and shipped by SENSOR.</span>`;
    $('#cart-code-input', dlg).value = cart.code || '';
    // payment options depend on who is buying
    const inv = $('[data-pay="invoice"]', dlg);
    inv.hidden = buyer !== 'business';
    const sel = $('input[name=pay]:checked', dlg);
    if (!sel || (sel.value === 'invoice' && buyer !== 'business')) $(`input[value="${buyer === 'business' ? 'invoice' : 'paypal'}"]`, dlg).checked = true;
    placeNote();
    badge();
  }
  function placeNote() {
    const v = $('input[name=pay]:checked', dlg)?.value;
    const note = { invoice: 'We confirm the order within one working day.', paypal: 'You continue to PayPal to pay.', proforma: 'The pro-forma invoice comes by email.' }[v] || '';
    $('[data-cart-place-note]', dlg).textContent = note;
    $('[data-cart-place]', dlg).textContent = v === 'paypal' ? 'Continue to PayPal' : 'Place order';
  }

  const F = (name, label, type, req, auto, half) => {
    const id = `co-${name}`;
    return `<div class="field${half ? ' field-half' : ''}"><label for="${id}">${label}${req ? '' : ' <span class="field-opt">(optional)</span>'}</label>
      <input id="${id}" name="${name}" type="${type}"${auto ? ` autocomplete="${auto}"` : ''}${req ? ' required' : ''}><p class="field-error" aria-live="polite"></p></div>`;
  };
  function checkoutFields() {
    const business = buyerNow() === 'business';
    $('[data-cart-fields]', dlg).innerHTML = [
      business ? F('company', 'Company', 'text', true, 'organization') : '',
      business ? F('vat', 'VAT ID', 'text', false, 'off') : '',
      F('name', 'Full name', 'text', true, 'name'),
      F('email', 'Email', 'email', true, 'email'),
      F('phone', 'Phone', 'tel', false, 'tel'),
      F('street', 'Street and number', 'text', true, 'street-address'),
      F('zip', 'Postcode', 'text', true, 'postal-code', true),
      F('city', 'City', 'text', true, 'address-level2', true),
    ].join('');
  }

  function show(view) {
    $$('.cart-view', dlg).forEach((v) => { v.hidden = v.dataset.cartView !== view; });
    $('[data-cart-title]', dlg).textContent = { cart: 'Your cart', checkout: 'Checkout', done: 'Thank you.' }[view];
    $('.cart-buyer', dlg).hidden = view === 'done';
    if (animate) gsap.from($(`[data-cart-view="${view}"]`, dlg).children, { y: 14, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out', clearProps: 'all' });
  }
  function open(view = 'cart') {
    render();
    show(view);
    if (!dlg.open) {
      dlg.showModal();
      document.documentElement.classList.add('has-drawer');
      if (animate) gsap.fromTo($('.cart-inner', dlg), { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out' });
    }
  }
  function close() {
    if (!dlg.open) return;
    const done = () => { dlg.close(); document.documentElement.classList.remove('has-drawer'); };
    if (animate) gsap.to($('.cart-inner', dlg), { x: 60, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { gsap.set($('.cart-inner', dlg), { clearProps: 'all' }); done(); } });
    else done();
  }

  /* ---------- public: add to cart ---------- */
  function add(id, qty = 1) {
    const item = window.HM_ITEM(id);
    if (!item || item.price == null) return;
    const it = cart.items.find((x) => x.id === id);
    if (it) it.qty += qty; else cart.items.push({ id, qty });
    write();
    badge();
    const b = $('.nav-cart-count');
    if (b && animate) gsap.fromTo(b, { scale: 1.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    open('cart');
  }
  // a set: every part goes into the cart, then the cart opens once
  function addMany(ids) {
    ids.forEach((id) => {
      const item = window.HM_ITEM(id);
      if (!item || item.price == null) return;
      const it = cart.items.find((x) => x.id === id);
      if (it) it.qty += 1; else cart.items.push({ id, qty: 1 });
    });
    write(); badge(); open('cart');
  }
  window.HMCart = { add, addMany, open };

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-cart]');
    if (addBtn) { e.preventDefault(); add(addBtn.dataset.addCart); return; }
    const setBtn = e.target.closest('[data-add-set]');
    if (setBtn) { e.preventDefault(); addMany(setBtn.dataset.addSet.split(',')); return; }
    if (e.target.closest('.nav-cart')) { e.preventDefault(); open('cart'); }
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-cart-close]')) { close(); return; }
    const item = e.target.closest('.cart-item');
    if (item && e.target.closest('[data-qty]')) {
      const it = cart.items.find((x) => x.id === item.dataset.id);
      it.qty = Math.max(1, Math.min(99, it.qty + Number(e.target.closest('[data-qty]').dataset.qty)));
      write(); render(); return;
    }
    if (item && e.target.closest('[data-remove]')) {
      cart.items = cart.items.filter((x) => x.id !== item.dataset.id);
      write(); render(); return;
    }
    const by = e.target.closest('[data-cart-buyer]');
    if (by) { setBuyer(by.dataset.cartBuyer); render(); if (!$('[data-cart-view="checkout"]', dlg).hidden) checkoutFields(); return; }
    if (e.target.closest('[data-cart-checkout]')) { checkoutFields(); show('checkout'); $('#co-company, #co-name', dlg)?.focus(); return; }
    if (e.target.closest('[data-cart-back]')) { show('cart'); return; }
    if (e.target.closest('[data-cart-asquote]')) {
      close();
      const names = cart.items.map((it) => `${it.qty} × ${window.HM_ITEM(it.id)?.name || it.id}`).join(', ');
      setTimeout(() => {
        const btn = document.createElement('button');
        btn.dataset.openForm = 'quote';
        btn.hidden = true;
        document.body.appendChild(btn);
        btn.click();
        btn.remove();
        const msg = document.querySelector('[data-drawer] textarea[name="message"]');
        if (msg) msg.value = `Please send me a quote for: ${names}.`;
      }, 380);
    }
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('change', (e) => {
    if (e.target.matches('[data-cart-country]')) { country = e.target.value; render(); }
    if (e.target.name === 'pay') placeNote();
  });
  $('[data-cart-code]', dlg).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#cart-code-input', dlg).value.trim().toUpperCase();
    const msg = $('[data-cart-code-msg]', dlg);
    if (!v) { cart.code = ''; msg.textContent = ''; }
    else if (CODES[v]) { cart.code = v; msg.textContent = `${Math.round(CODES[v] * 100)} % off applied.`; }
    else { cart.code = ''; msg.textContent = 'This code is not valid.'; }
    write(); render();
    $('[data-cart-code-msg]', dlg).textContent = msg.textContent;
  });

  function check(input) {
    const box = input.closest('.field');
    const err = box && box.querySelector('.field-error');
    let m = '';
    if (input.validity.valueMissing) m = 'Please fill this in.';
    else if (input.validity.typeMismatch && input.type === 'email') m = 'This does not look like an email address.';
    if (box) box.classList.toggle('is-invalid', !!m);
    input.setAttribute('aria-invalid', m ? 'true' : 'false');
    if (err) err.textContent = m;
    return !m;
  }
  $('[data-cart-view="checkout"]', dlg).addEventListener('focusout', (e) => { if (e.target.matches('[data-cart-fields] input') && e.target.value) check(e.target); });
  $('[data-cart-view="checkout"]', dlg).addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = $$('[data-cart-fields] input', dlg).filter((i) => !check(i));
    if (bad.length) { bad[0].focus(); return; }
    const pay = $('input[name=pay]:checked', dlg).value;
    const t = totals();
    $('[data-done-text]', dlg).textContent = {
      invoice: `We check your order (${money(t.gross)}) and confirm it within one working day. The invoice comes with the goods.`,
      paypal: `In the finished shop you would now pay ${money(t.gross)} with PayPal.`,
      proforma: `Your pro-forma invoice for ${money(t.gross)} with our bank details is on its way by email. We ship once the payment is in.`,
    }[pay];
    cart = { items: [], code: '' };
    write();
    badge();
    show('done');
  });

  badge();
})();
