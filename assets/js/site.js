/* Things every page shares: the cookie choice and the language switch. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'hm-cookies';
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };
  const animate = typeof window.gsap !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- cookies ---------- */
  const box = $('[data-cookie]');
  function show() {
    if (!box) return;
    box.hidden = false;
    if (animate) gsap.fromTo(box, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', delay: 0.6 });
  }
  function hide() {
    if (!box) return;
    if (animate) gsap.to(box, { y: 30, opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => { box.hidden = true; gsap.set(box, { clearProps: 'all' }); } });
    else box.hidden = true;
  }
  if (box) {
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cookie-choice]');
      if (!b) return;
      set(b.dataset.cookieChoice); // 'necessary' or 'all'; analytics would only start on 'all'
      hide();
    });
    if (!get()) show();
  }
  document.querySelectorAll('[data-cookie-settings]').forEach((b) => b.addEventListener('click', show));

  /* language: switched by i18n.js, which also marks the buttons */

  /* ---------- phone and tablet menu ---------- */
  const navEnd = document.querySelector('.nav-end');
  const links = document.querySelector('.nav-links');
  if (navEnd && links) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-menu';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.textContent = 'Menu';
    navEnd.appendChild(btn);
    const menu = document.createElement('dialog');
    menu.className = 'menu';
    menu.setAttribute('aria-label', 'Menu');
    menu.innerHTML = `<div class="menu-inner">
        <div class="menu-head"><span class="menu-brand"><img src="assets/brand/hikmicro-logo.svg" width="150" height="35" alt="HIKMICRO"><span class="logo-sub" data-no-i18n>Online Shop · powered by SENSOR GmbH</span></span>
          <button type="button" class="drawer-close" data-menu-close aria-label="Close menu"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button></div>
        <ul class="menu-links">${[...links.querySelectorAll('a')].map((a) => `<li><a href="${a.getAttribute('href')}"${a.dataset.goArea ? ` data-go-area="${a.dataset.goArea}"` : ''}${a.dataset.openForm ? ` data-open-form="${a.dataset.openForm}"` : ''}>${a.textContent}</a></li>`).join('')}
          <li><a href="./#contact">Contact</a></li></ul>
        <div class="menu-lang" role="group" aria-label="Language">${['en', 'de', 'nl', 'fr'].map((l) => `<button type="button" data-lang="${l}">${{ en: 'English', de: 'Deutsch', nl: 'Nederlands', fr: 'Français' }[l]}</button>`).join('')}</div>
        <button class="btn btn-primary" type="button" data-open-form="quote">Request a quote</button>
      </div>`;
    document.body.appendChild(menu);
    const closeMenu = () => { menu.close(); document.documentElement.classList.remove('has-drawer'); };
    btn.addEventListener('click', () => {
      menu.showModal();
      document.documentElement.classList.add('has-drawer');
      if (animate) gsap.from(menu.querySelectorAll('.menu-links li, .menu-inner > .btn'), { y: 18, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out', clearProps: 'all' });
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('[data-menu-close]') || e.target.closest('a') || e.target.closest('[data-open-form]') || e.target.closest('[data-lang]')) closeMenu();
    });
    menu.addEventListener('cancel', (e) => { e.preventDefault(); closeMenu(); });
    // links that switch the area on the start page reuse the main menu's behaviour
    menu.querySelectorAll('[data-go-area]').forEach((a) => a.addEventListener('click', (e) => {
      const twin = links.querySelector(`[data-go-area="${a.dataset.goArea}"]`);
      if (twin && document.querySelector('[data-chooser]')) { e.preventDefault(); twin.click(); }
    }));
  }

  /* ---------- floating bar: gliding bubble, hot spot, hide on scroll ---------- */
  const nav = document.querySelector('.nav');
  const navInner = nav && nav.querySelector('nav');
  const glide = nav && nav.querySelector('.nav-glide');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (nav && navInner && glide) {
    const items = [...navInner.querySelectorAll('.nav-links a')];
    const moveTo = (a, instant) => {
      const r = a.getBoundingClientRect();
      const base = navInner.getBoundingClientRect();
      if (instant) glide.style.transition = 'none';
      glide.style.width = `${r.width}px`;
      glide.style.transform = `translateX(${r.left - base.left}px)`;
      if (instant) { glide.getBoundingClientRect(); glide.style.transition = ''; }
    };
    if (fine) {
      items.forEach((a) => {
        a.addEventListener('pointerenter', () => {
          const first = !navInner.classList.contains('is-gliding');
          moveTo(a, first); // appears in place the first time, then glides between bubbles
          navInner.classList.add('is-gliding');
        });
        a.addEventListener('focus', () => { moveTo(a, !navInner.classList.contains('is-gliding')); navInner.classList.add('is-gliding'); });
        a.addEventListener('blur', () => navInner.classList.remove('is-gliding'));
      });
      navInner.addEventListener('pointerleave', () => navInner.classList.remove('is-gliding'));
    }

    // the area the visitor chose gets the hot spot
    const markCurrent = () => {
      let area = null;
      try { area = (JSON.parse(localStorage.getItem('hm-choice')) || {}).area || null; } catch { /* private mode */ }
      const onWall = document.querySelector('[data-areasection]:not([hidden])') || document.body.classList.contains('pd');
      items.forEach((a) => {
        if (a.getAttribute('aria-current') === 'page') return; // a page of its own, like the Academy
        const own = a.dataset.goArea || (a.getAttribute('href') || '').replace('./#', '');
        a.setAttribute('aria-current', String(!!onWall && own === area));
      });
    };
    markCurrent();
    document.addEventListener('wall:update', markCurrent);
    document.addEventListener('wall:clear', markCurrent);

    // hide while reading down, come back on the way up or near the top
    let lastY = window.scrollY;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY + 4;
        const goingUp = y < lastY - 4;
        if (y < 80 || goingUp) nav.classList.remove('is-away');
        else if (goingDown && !document.documentElement.classList.contains('has-drawer')) nav.classList.add('is-away');
        if (goingDown || goingUp) lastY = y;
        ticking = false;
      });
    }, { passive: true });

    // bubbles arrive one after another, sharpening from a soft blur
    if (animate && !reduce) {
      const bubbles = [nav.querySelector('.logo'), ...items, ...nav.querySelectorAll('.nav-end > *')].filter(Boolean);
      gsap.fromTo(bubbles, { y: -14, opacity: 0, filter: 'blur(6px)' }, {
        y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, stagger: 0.045, ease: 'expo.out', delay: 0.1, clearProps: 'transform,opacity,filter',
      });
    }
  }
})();
