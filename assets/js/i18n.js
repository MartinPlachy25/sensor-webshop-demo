/* Languages: English (the source), German, Dutch, French.
   The pages are written in English. When another language is chosen, every text on the page,
   also the texts the scripts add later (camera cards, findings, forms, cart), is swapped for its
   translation from assets/js/i18n/<lang>.js (built from content/i18n/*.tsv by tools/build-i18n.py).
   Texts with numbers (prices, "3 of 6 found") are translated by patterns.
   In the Shopify theme the same translations become the theme's locale files. */
(() => {
  'use strict';
  const LANGS = { en: 'English', de: 'Deutsch', nl: 'Nederlands', fr: 'Français' };
  const KEY = 'hm-lang';
  const ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  const ver = (document.currentScript && document.currentScript.src.match(/\?v=\d+/)) || [''];
  const base = document.currentScript ? document.currentScript.src.replace(/i18n\.js.*$/, 'i18n/') : 'assets/js/i18n/';

  function initial() {
    try { const s = localStorage.getItem(KEY); if (LANGS[s]) return s; } catch { /* private mode */ }
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS[nav] ? nav : 'en';
  }
  let lang = initial();
  let dict = {}; let pats = []; let frags = [];
  const orig = new WeakMap(); // text node -> its English text
  const shown = new WeakMap(); // text node -> what we last wrote into it
  const origAttr = new WeakMap(); // element -> { attr: English }

  const norm = (s) => s.replace(/\u2060/g, '').replace(/\s+/g, ' ').trim();
  function tr(en) {
    const k = norm(en);
    if (!k || lang === 'en') return null;
    if (dict[k] != null) return dict[k];
    for (const [re, fn] of pats) { const m = k.match(re); if (m) { const v = fn(m, tr); if (v != null) return v; } }
    // spec lines like "3.5″ touch screen, 640 × 480": swap the known words, keep the numbers
    if (/\d|·/.test(k) && frags.length) {
      let out = k; let hit = false;
      for (const [re, to] of frags) { const nx = out.replace(re, to); if (nx !== out) { out = nx; hit = true; } }
      if (hit) return out;
    }
    return null;
  }
  window.HM_T = (en) => tr(en) ?? en;

  function doText(n) {
    const cur = n.nodeValue;
    if (!/[A-Za-z]/.test(cur)) return;
    if (shown.get(n) !== cur) orig.set(n, cur); // the page changed it: this is new English
    const en = orig.get(n);
    const t = tr(en);
    const next = t == null ? en : en.replace(norm(en), t); // keep the spaces around the text
    if (next !== cur) { shown.set(n, next); n.nodeValue = next; } else shown.set(n, cur);
  }
  function doAttrs(el) {
    let o = origAttr.get(el);
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null) continue;
      if (!o) { o = {}; origAttr.set(el, o); }
      if (o[a] == null || (o['_' + a] !== v)) o[a] = v; // set by the page, not by us
      const t = tr(o[a]);
      const next = t == null ? o[a] : t;
      o['_' + a] = next;
      if (next !== v) el.setAttribute(a, next);
    }
  }
  const skip = (el) => el && el.closest && el.closest('script,style,svg,noscript,[data-no-i18n]');
  function walk(root) {
    if (root.nodeType === 3) { if (!skip(root.parentElement)) doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    if (root.hasAttribute && ATTRS.some((a) => root.hasAttribute(a))) doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && skip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else if (ATTRS.some((a) => n.hasAttribute(a))) doAttrs(n); }
  }
  let titleEn = null; let descEn = null;
  function translateAll() {
    document.documentElement.lang = lang;
    walk(document.body);
    if (titleEn == null || (document.title !== shownTitle)) titleEn = document.title;
    const tt = tr(titleEn); shownTitle = tt == null ? titleEn : tt; document.title = shownTitle;
    const md = document.querySelector('meta[name="description"]');
    if (md) { if (descEn == null) descEn = md.content; md.content = tr(descEn) ?? descEn; }
  }
  let shownTitle = null;

  // texts the scripts add later
  let busy = false;
  const mo = new MutationObserver((list) => {
    if (busy || lang === 'en') return;
    busy = true;
    for (const m of list) {
      if (m.type === 'characterData') { if (!skip(m.target.parentElement)) doText(m.target); }
      else if (m.type === 'attributes') { if (!skip(m.target)) doAttrs(m.target); }
      else m.addedNodes.forEach(walk);
    }
    if (document.title !== shownTitle) { titleEn = document.title; const tt = tr(titleEn); shownTitle = tt == null ? titleEn : tt; document.title = shownTitle; }
    mo.takeRecords();
    busy = false;
  });
  function observe() { mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }

  const loaded = {};
  function load(l) {
    if (l === 'en') return Promise.resolve();
    return (loaded[l] ||= new Promise((res) => {
      const s = document.createElement('script');
      s.src = `${base}${l}.js${ver[0]}`;
      s.onload = () => res(); s.onerror = () => res();
      document.head.append(s);
    }));
  }
  async function set(l, save = true) {
    if (!LANGS[l]) return;
    lang = l;
    if (save) { try { localStorage.setItem(KEY, l); } catch { /* private mode */ } }
    await load(l);
    const pack = (window.HM_I18N || {})[l] || {};
    dict = pack.dict || {}; pats = pack.patterns || []; frags = pack.fragments || [];
    mo.disconnect();
    if (l === 'en') { // put the English back
      document.documentElement.lang = 'en';
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { const o = orig.get(n); if (o != null && shown.get(n) === n.nodeValue) { n.nodeValue = o; shown.set(n, o); } }
      document.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach((el) => {
        const o = origAttr.get(el); if (!o) return;
        ATTRS.forEach((a) => { if (o[a] != null && el.getAttribute(a) === o['_' + a]) { el.setAttribute(a, o[a]); o['_' + a] = o[a]; } });
      });
      if (titleEn) document.title = titleEn;
      const md = document.querySelector('meta[name="description"]'); if (md && descEn) md.content = descEn;
    } else translateAll();
    observe();
    paint();
    document.dispatchEvent(new CustomEvent('lang:change', { detail: l }));
  }
  window.HM_LANG = () => lang;
  window.HM_SET_LANG = set;

  /* the switcher: a dark pill like the main links, a menu with the four languages */
  function paint() {
    document.querySelectorAll('[data-lang-current]').forEach((e) => { e.textContent = lang.toUpperCase(); });
    document.querySelectorAll('[data-lang]').forEach((a) => {
      const on = a.dataset.lang === lang;
      a.classList.toggle('is-on', on);
      if (a.tagName === 'BUTTON') a.setAttribute('aria-pressed', String(on));
      else if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  function wire() {
    const sw = document.querySelector('[data-lang-switch]');
    if (sw) {
      const btn = sw.querySelector('[data-lang-btn]'); const menu = sw.querySelector('[data-lang-menu]');
      const open = (v) => { menu.hidden = !v; btn.setAttribute('aria-expanded', String(v)); sw.classList.toggle('is-open', v); };
      btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden); if (!menu.hidden) (menu.querySelector('.is-on') || menu.querySelector('a')).focus(); });
      document.addEventListener('click', (e) => { if (!sw.contains(e.target)) open(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
      menu.addEventListener('keydown', (e) => {
        const items = [...menu.querySelectorAll('a')]; const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      });
      sw.addEventListener('click', (e) => { const a = e.target.closest('[data-lang]'); if (a) { e.preventDefault(); open(false); set(a.dataset.lang); } });
    }
    // other places with language links (menu on phones, footer)
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lang]');
      if (a && !(sw && sw.contains(a))) { e.preventDefault(); set(a.dataset.lang); }
    });
  }
  function start() { wire(); paint(); if (lang !== 'en') set(lang, false); else observe(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
