/* SENSOR assistant (demo, no AI yet).
   It answers from two sources only:
   - content/assistant/knowledge.md (built into chat-knowledge.js): service, ordering, advice;
   - the SENSOR price list and HIKMICRO datasheets (data.js): every camera and its specs (no prices in replies: Heiner, 20 Nov).
   It understands English and German, small typos, two cameras to compare, follow-up questions
   about the camera just discussed, budgets ("under 1000 €"), and it can walk a visitor
   through choosing a camera. Anything else goes to a person. */
(() => {
  'use strict';
  const panel = document.querySelector('[data-chat]');
  if (!panel) return;
  const fab = document.querySelector('.chat-fab');
  const log = panel.querySelector('[data-chat-log]');
  const chips = panel.querySelector('[data-chat-chips]');
  const form = panel.querySelector('[data-chat-form]');
  const input = panel.querySelector('[data-chat-input]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DATA = window.HM_DATA || { PRODUCTS: {}, TYPES: {} };
  const P = DATA.PRODUCTS;
  const KEYS = window.HM_KEYS || {};

  /* ---------- language ---------- */
  let lang = 'en';
  const DE_WORDS = /\b(ich|ist|sind|welche[rsnm]?|wie|was|kann|koennen|kostet|kosten|preis|fuer|haben|gibt|brauche|brauchen|mein[e]?|und|nicht|bitte|hallo|guten|danke|kamera|waermebild|haus|kalibrierung|rechnung|reparatur|vergleich|unterschied|zwischen|oder|bis|unter|guenstig\w*|beste[nr]?|garantie|empfehl\w*|messbereich|aufloesung|lieferung|versand|miete|gebraucht\w*|raten)\b/;
  function detectLang(q) {
    const n = norm(q);
    if (/[äöüß]/i.test(q) || DE_WORDS.test(n)) return 'de';
    if (/\b(the|what|which|how|is|are|do|does|can|my|price|camera|hello|hi|thanks|please|need|want)\b/.test(n)) return 'en';
    return lang; // too short to tell: keep the last language
  }
  const T = (en, de) => (lang === 'de' && de ? de : en);

  /* ---------- buttons an answer can offer ---------- */
  const ACTIONS = {
    res: { label: ['Open the resolution guide', 'Auflösung vergleichen'], run: () => { const r = document.getElementById('resolution'); if (r && r.offsetParent) { close(); r.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else area('industry'); } },
    building: { label: ['Cameras for buildings', 'Kameras für Gebäude'], run: () => area('building') },
    industry: { label: ['Industrial cameras', 'Kameras für die Industrie'], run: () => area('industry') },
    outdoor: { label: ['Outdoor cameras', 'Kameras für draußen'], run: () => area('outdoor') },
    fire: { label: ['Fire service cameras', 'Kameras für die Feuerwehr'], run: () => area('fire') },
    rooms: { label: ['Try the camera in a room', 'Kamera im Raum testen'], run: () => area('building') },
    calibration: { label: ['Book a calibration', 'Kalibrierung buchen'], run: () => form_('calibration') },
    rental: { label: ['Ask about rental', 'Miete anfragen'], run: () => form_('rental') },
    repair: { label: ['Report a repair', 'Reparatur melden'], run: () => form_('repair') },
    quote: { label: ['Request a quote', 'Angebot anfragen'], run: () => form_('quote') },
    used: { label: ['Used cameras', 'Gebrauchte Kameras'], run: () => form_('used') },
    instalments: { label: ['Ask about instalments', 'Ratenzahlung anfragen'], run: () => form_('instalments') },
    academy: { label: ['SENSOR Academy', 'SENSOR Academy'], run: () => form_('academy') },
    downloads: { label: ['Write to us', 'Schreiben Sie uns'], run: () => form_('contact') },
    human: { label: ['Talk to a thermal expert', 'Mit einem Experten sprechen'], run: () => humanStart() },
    choose: { label: ['Help me choose', 'Beratung starten'], run: () => adviceStart() },
  };
  function area(a) {
    close();
    const link = document.querySelector(`[data-go-area="${a}"]`);
    if (link) link.click(); else location.href = `index.html#${a}`;
  }
  function form_(f) {
    close();
    const b = document.createElement('button'); b.type = 'button'; b.dataset.openForm = f; b.hidden = true;
    document.body.append(b); b.click(); b.remove();
  }

  /* ---------- understanding a question ---------- */
  // lower case, no accents, umlauts spelled out, "640x480" as "640 x 480"
  const norm = (t) => ` ${t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/×/g, 'x').replace(/(\d)\s*x\s*(\d)/g, '$1 x $2').replace(/[^a-z0-9€]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const STOP = new Set('a an the is are do does i my me you your we our it to for of in on at and or can could would should what which how who when where why with be have has there this that please ich ein eine einen der die das ist und oder fur fuer mit kann wie was welche welcher bei zu von den dem des mein meine sie es ihr ihre gibt man'.split(' '));
  const stem = (w) => w.replace(/(ings|ing|es|s|en|er|e)$/, '');
  const rawWords = (t) => norm(t).trim().split(' ').filter((w) => w.length > 1 && !STOP.has(w));

  const KB = window.HM_CHAT_KB || [];
  const INDEX = KB.map((e) => ({
    e,
    keys: e.keys.map((k) => norm(k)),
    words: new Set(e.ask.flatMap(rawWords).concat(e.keys.flatMap(rawWords)).map(stem)),
    keyWords: new Set(e.keys.filter((k) => !k.includes(' ')).map((k) => stem(norm(k).trim()))),
  }));
  const VOCAB = [...new Set(INDEX.flatMap((it) => [...it.words]))].filter((w) => w.length >= 4);

  // small typos: "calibartion", "warrenty", "resoluton"
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 2] + 1);
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  const KNOWN = new Set(VOCAB);
  function fix(w) {
    if (w.length < 5 || KNOWN.has(w) || /\d/.test(w)) return w;
    const max = w.length >= 8 ? 2 : 1;
    let best = w; let bd = max + 1;
    for (const v of VOCAB) { const d = lev(w, v, max); if (d < bd) { bd = d; best = v; } }
    return best;
  }
  const words = (t) => rawWords(t).map(stem).map(fix);

  function scoreAll(q) {
    const nq = norm(q); const qw = words(q);
    return INDEX.map((it) => {
      let s = 0;
      for (const k of it.keys) if (nq.includes(` ${k.trim()} `) || (k.trim().length > 4 && nq.includes(k.trim()))) s += 2 + k.trim().split(' ').length;
      for (const w of qw) { if (it.words.has(w)) s += 1; if (it.keyWords.has(w) && !nq.includes(` ${w} `)) s += 2; } // a key word, typed with a typo
      return { e: it.e, s };
    }).sort((a, b) => b.s - a.s);
  }

  /* ---------- the cameras ---------- */
  const EXTRA_ALIASES = {
    minix: ['mini x'], pockete: ['pocket e'], pocket2: ['pocket 2'], mini3: ['mini 3'],
    'mini2plus-v2': ['mini2plus', 'mini 2 plus', 'mini2 plus'], 'eco-lite': ['eco lite'],
    sp120h: ['sp120', 'sp 120'], sp100h: ['sp100', 'sp 100'],
  };
  const ALIASES = [];
  Object.values(P).forEach((p) => {
    const base = norm(p.name).trim();
    const forms = [base, ...(EXTRA_ALIASES[p.id] || [])];
    forms.forEach((f) => {
      // allow a space or none between letters and digits: "m31", "m 31"
      const pat = f.replace(/([a-z])(?=\d)/g, '$1 ?').replace(/(\d)(?=[a-z])/g, '$1 ?').replace(/ (?!\?)/g, ' ?');
      ALIASES.push({ id: p.id, len: f.length, re: new RegExp(`(?:^| )(${pat})(?= |$)`) });
    });
  });
  ALIASES.sort((a, b) => b.len - a.len);
  function findProducts(q) {
    let s = norm(q); const out = [];
    for (const a of ALIASES) {
      const m = s.match(a.re);
      if (m && !out.some((o) => o.id === a.id)) { out.push({ id: a.id, at: m.index }); s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length); }
    }
    return out.sort((a, b) => a.at - b.at).map((o) => o.id).filter((id) => P[id]); // in the order the visitor named them
  }

  const buyer = () => { try { return (JSON.parse(localStorage.getItem('hm-choice')) || {}).buyer || 'business'; } catch { return 'business'; } };
  // Heiner: the assistant names no prices, it points to the product page
  const price = () => T('Price on the product page', 'Preis auf der Produktseite');
  const pixels = (p) => { const m = (p.res || '').match(/(\d+)\s*×\s*(\d+)/); return m ? +m[1] * +m[2] : 0; };
  const mk = (p) => { const m = (p.netd || '').match(/(\d+)/); return m ? +m[1] : null; };
  const maxTemp = (p) => { const m = (p.range || '').match(/(\d[\d.,]*)\s*°C\s*$/); return m ? +m[1].replace(/[.,]/g, '') : null; };
  const label = (p) => `HIKMICRO ${p.name}`;
  const isCamera = (p) => !['monocular', 'binocular', 'scope'].includes(p.type) || p.res;

  // which detail a question asks about
  const FIELDS = [
    { k: 'price', re: /\b(price|prices|cost|costs|how much|preis|preise|kostet|kosten|teuer|euro|€)\b/ },
    { k: 'res', re: /\b(resolution|pixel|pixels|aufloesung|megapixel|sharp)\b/ },
    { k: 'netd', re: /\b(netd|sensitiv\w*|empfindlich\w*|mk)\b/ },
    { k: 'range', re: /\b(range|temperature|temperatures|temperatur\w*|messbereich|how hot|max)\b/ },
    { k: 'fov', re: /\b(fov|field of view|angle|lens|lenses|objektiv\w*|sichtfeld|winkel|focus|fokus)\b/ },
    { k: 'warranty', re: /\b(warranty|guarantee|garantie|gewaehrleistung)\b/ },
    { k: 'calibration', re: /\b(calibrat\w*|kalibr\w*)\b/ },
    { k: 'link', re: /\b(wifi|wi fi|wlan|bluetooth|app|connect\w*|usb|verbind\w*)\b/ },
    { k: 'display', re: /\b(display|screen|bildschirm)\b/ },
    { k: 'battery', re: /\b(battery|akku|batterie|runtime|laufzeit)\b/ },
    { k: 'ip', re: /\b(ip\d*|waterproof|robust|drop|wasserdicht|staub)\b/ },
    { k: 'weight', re: /\b(weight|heavy|gewicht|schwer|gram|gramm)\b/ },
  ];
  const askedField = (q) => { const n = norm(q); const f = FIELDS.find((x) => x.re.test(n)); return f && f.k; };

  function fieldAnswer(p, k) {
    const n = label(p);
    const none = T(`The price list does not say that for the ${n}. A thermal expert will tell you.`, `Das steht für die ${n} nicht in der Preisliste. Ein Experte sagt es Ihnen gern.`);
    switch (k) {
      case 'price': return T(`You find the current price of the ${n} on its product page${p.variants && p.variants.length > 1 ? ', for each lens' : ''}. For several cameras or a package, ask for a quote.`,
        `Den aktuellen Preis der ${n} finden Sie auf ihrer Produktseite${p.variants && p.variants.length > 1 ? ', für jedes Objektiv' : ''}. Für mehrere Kameras oder ein Paket fragen Sie gern ein Angebot an.`);
      case 'res': return p.res ? T(`The ${n} has ${p.res} pixels, that is ${pixels(p).toLocaleString('en-US')} measuring points.`, `Die ${n} hat ${p.res} Pixel, also ${pixels(p).toLocaleString('de-DE')} Messpunkte.`) : none;
      case 'netd': return p.netd ? T(`The ${n} shows temperature differences down to ${p.netd} (NETD). Lower is better.`, `Die ${n} zeigt Temperaturunterschiede bis ${p.netd} (NETD). Je kleiner, desto besser.`) : none;
      case 'range': return p.range ? T(`The ${n} measures from ${p.range.replace(' to ', ' to ')}.`, `Die ${n} misst von ${p.range.replace(' to ', ' bis ')}.`) : none;
      case 'fov': {
        if (p.variants && p.variants.length > 1) return T(`The ${n} takes several lenses: ${p.variants.map((v) => v.code).join(', ')}. A wide lens for close work, a narrow one for distance.`, `Die ${n} gibt es mit mehreren Objektiven: ${p.variants.map((v) => v.code).join(', ')}. Weitwinkel für nah, Tele für Entfernung.`);
        const bits = [p.fov && T(`field of view ${p.fov}`, `Sichtfeld ${p.fov}`), p.lens && T(`lens ${p.lens}`, `Objektiv ${p.lens}`), p.focus && p.focus].filter(Boolean);
        return bits.length ? T(`The ${n}: ${bits.join(', ')}.`, `Die ${n}: ${bits.join(', ')}.`) : none;
      }
      case 'warranty': {
        const w = p.warranty;
        if (!w || !w.base) return none;
        const ext = [w.plus1, w.plus2].filter((x) => x != null);
        return T(`The ${n} comes with ${w.base} warranty.${ext.length ? ' You can extend it when you order.' : ''}`, `Die ${n} hat ${w.base.replace('years', 'Jahre').replace('year', 'Jahr')} Garantie.${ext.length ? ' Sie lässt sich bei der Bestellung verlängern.' : ''}`);
      }
      case 'calibration': return T(`We calibrate the ${n} in our own lab, every two years, with a certificate. The price follows in our service price list; ask us and we tell you.`, `Wir kalibrieren die ${n} in unserem eigenen Labor, alle zwei Jahre, mit Zertifikat. Den Preis nennt unsere Service-Preisliste; fragen Sie uns gern.`);
      case 'link': return p.link ? T(`The ${n} connects by ${p.link}. Pictures go to the free HIKMICRO Viewer app and HIKMICRO Analyzer on the PC.`, `Die ${n} verbindet sich per ${p.link}. Bilder gehen in die kostenlose HIKMICRO Viewer App und HIKMICRO Analyzer am PC.`) : (p.features ? T(`The ${n}: ${p.features}.`, `Die ${n}: ${p.features}.`) : none);
      case 'display': return p.display ? T(`The ${n} has a ${p.display}.`, `Die ${n} hat einen ${p.display.replace('screen', 'Bildschirm')}.`) : none;
      case 'battery': return p.battery ? T(`The ${n}: ${p.battery}.`, `Die ${n}: ${p.battery}.`) : none;
      case 'ip': return p.ip ? T(`The ${n} is rated ${p.ip}.`, `Die ${n}: ${p.ip}.`) : none;
      case 'weight': return p.weight ? T(`The ${n} weighs ${p.weight}.`, `Die ${n} wiegt ${p.weight.replace('approx.', 'ca.')}.`) : none;
      default: return null;
    }
  }

  /* ---------- building the replies ---------- */
  function bubble(who, text, acts = []) {
    const el = document.createElement('div');
    el.className = `chat-msg chat-${who}`;
    const p = document.createElement('p'); p.textContent = text; el.append(p);
    addActs(el, acts);
    log.append(el); scroll();
    return el;
  }
  function addActs(el, acts) {
    const list = acts.map((a) => (typeof a === 'string' ? ACTIONS[a] && { label: T(...ACTIONS[a].label), run: ACTIONS[a].run } : a)).filter(Boolean);
    if (!list.length) return;
    const row = document.createElement('div'); row.className = 'chat-acts';
    list.forEach((a) => {
      const b = document.createElement(a.href ? 'a' : 'button');
      if (a.href) b.href = a.href; else b.type = 'button';
      b.className = `chat-act${a.primary ? ' is-primary' : ''}`; b.textContent = a.label;
      if (a.run) b.addEventListener('click', a.run);
      row.append(b);
    });
    el.append(row);
  }
  const scroll = () => log.scrollTo({ top: log.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  const productActs = (p, more = []) => [
    { label: T('Open the camera', 'Kamera ansehen'), href: `product.html?id=${p.id}`, primary: true },
    ...(p.price != null && !p.sample && window.HMCart ? [{ label: buyer() === 'private' ? T('Add to cart', 'In den Warenkorb') : T('Add to quote', 'Zum Angebot'), run: () => { close(); window.HMCart.add(p.id); } }] : []),
    ...more,
  ];

  // a small product card inside the chat
  function card(p, intro, more = []) {
    const el = document.createElement('div'); el.className = 'chat-msg chat-bot chat-card';
    if (intro) { const i = document.createElement('p'); i.textContent = intro; el.append(i); }
    const box = document.createElement('div'); box.className = 'chat-prod';
    const h = document.createElement('p'); h.className = 'chat-prod-name'; h.textContent = label(p);
    const sub = document.createElement('p'); sub.className = 'chat-prod-sub';
    sub.textContent = [p.typeLabel || DATA.TYPES[p.type], p.res, p.netd && `NETD ${p.netd}`].filter(Boolean).join(' · ');
    box.append(h, sub);
    const keys = KEYS[p.id];
    if (keys) { const ul = document.createElement('ul'); keys.forEach((k) => { const li = document.createElement('li'); li.textContent = k; ul.append(li); }); box.append(ul); }
    el.append(box);
    addActs(el, productActs(p, more));
    log.append(el); scroll();
  }

  // neighbours in the line-up, for "compare with the next one up"
  function nextUp(p) {
    const same = Object.values(P).filter((x) => x.series === p.series && x.price != null && x.price > p.price).sort((a, b) => a.price - b.price);
    return same[0];
  }

  function compare(a, b) {
    const [pa, pb] = [P[a], P[b]];
    const rows = [];
    const line = (en, de, va, vb) => { if (va || vb) rows.push(`${T(en, de)}: ${pa.name} ${va || '–'} · ${pb.name} ${vb || '–'}`); };
    line('Resolution', 'Auflösung', pa.res, pb.res);
    line('Sensitivity', 'Empfindlichkeit', pa.netd, pb.netd);
    line('Field of view', 'Sichtfeld', pa.fov, pb.fov);
    line('Range', 'Messbereich', pa.range, pb.range);
    const said = [];
    const xa = pixels(pa); const xb = pixels(pb);
    if (xa && xb && xa !== xb) {
      const [hi, lo, f] = xa > xb ? [pa, pb, xa / xb] : [pb, pa, xb / xa];
      said.push(T(`The ${hi.name} has ${f >= 1.95 ? `${f.toFixed(1).replace('.0', '')} times as many` : 'more'} measuring points as the ${lo.name}, so it shows small details from further away.`,
        `Die ${hi.name} hat ${f >= 1.95 ? `${f.toFixed(1).replace('.0', '').replace('.', ',')}-mal so viele` : 'mehr'} Messpunkte wie die ${lo.name} und zeigt kleine Details aus größerer Entfernung.`));
    }
    const ma = mk(pa); const mb = mk(pb);
    if (ma && mb && ma !== mb) { const s = ma < mb ? pa : pb; said.push(T(`The ${s.name} sees finer temperature differences.`, `Die ${s.name} erkennt feinere Temperaturunterschiede.`)); }
    const ta = maxTemp(pa); const tb = maxTemp(pb);
    if (ta && tb && Math.abs(ta - tb) > 100) { const s = ta > tb ? pa : pb; said.push(T(`The ${s.name} measures much hotter objects, up to ${Math.max(ta, tb)} °C.`, `Die ${s.name} misst deutlich heißere Objekte, bis ${Math.max(ta, tb)} °C.`)); }
    if (!said.length) said.push(T('On paper they are close. The choice depends on your work: tell us what you inspect.', 'Auf dem Papier liegen sie nah beieinander. Es kommt auf Ihre Arbeit an: sagen Sie uns, was Sie prüfen.'));
    const el = bubble('bot', `${rows.join('\n')}\n\n${said.join(' ')}`, [
      { label: T(`Open ${pa.name}`, `${pa.name} ansehen`), href: `product.html?id=${pa.id}` },
      { label: T(`Open ${pb.name}`, `${pb.name} ansehen`), href: `product.html?id=${pb.id}` },
      'human',
    ]);
    el.classList.add('chat-compare');
  }

  // cheapest, best, highest resolution, "under 1000 €"
  function superlative(q) {
    const n = norm(q);
    const cams = Object.values(P).filter((p) => p.price != null && !p.sample && p.res && !['ai', 'ad', 'y'].includes(p.series));
    const budget = n.match(/\b(?:under|below|less than|max|maximum|up to|bis|unter|hoechstens|budget)\s*(?:€|eur|euro)?\s*(\d[\d.]*)(?!\s*(?:°|c\b|grad|mk|m\b))/);
    if (budget) {
      const max = +budget[1].replace(/\./g, '');
      const net = buyer() === 'private' ? max / (1 + DATA.VAT) : max;
      const fit = cams.filter((p) => p.price <= net).sort((a, b) => pixels(b) - pixels(a) || a.price - b.price);
      if (!fit.length) { bubble('bot', T('None of our new cameras fits that budget. Ask us about used cameras, rental or leasing.', 'In diesem Budget passt keine neue Kamera. Fragen Sie gern nach gebrauchten Kameras, Miete oder Leasing.'), ['used', 'rental', 'instalments']); return true; }
      const best = fit[0];
      card(best, T(`Up to € ${max.toLocaleString('de-DE')}, the ${best.name} gives you the most measuring points (${best.res}).`, `Bis ${max.toLocaleString('de-DE')} € bekommen Sie mit der ${best.name} die meisten Messpunkte (${best.res}).`), fit[1] ? [{ label: T(`Compare with ${fit[1].name}`, `Mit ${fit[1].name} vergleichen`), run: () => compare(best.id, fit[1].id) }] : []);
      return true;
    }
    if (/\b(cheapest|cheap|lowest price|budget|guenstigste\w*|billigste\w*|guenstig)\b/.test(n)) {
      const c = cams.sort((a, b) => a.price - b.price)[0];
      card(c, T(`The most affordable camera is the ${c.name}, good for quick checks at home. For reports, choose at least 256 × 192.`, `Die günstigste Kamera ist die ${c.name}, gut für schnelle Checks zu Hause. Für Berichte nehmen Sie mindestens 256 × 192.`), ['choose']);
      return true;
    }
    if (/\b(best|highest|top|most expensive|flagship|beste\w*|hoechste\w*|teuerste\w*)\b/.test(n) && !/\bfor\b|\bfuer\b/.test(n)) {
      const c = P.sp120h;
      if (c) { card(c, T('The top of the range is the SP120H: 1280 × 1024 pixels, measuring up to 2200 °C, for R&D and long distances.', 'Das Spitzenmodell ist die SP120H: 1280 × 1024 Pixel, misst bis 2200 °C, für Forschung und große Entfernungen.'), ['choose']); return true; }
    }
    return false;
  }

  /* ---------- guided advice ----------
     Heiner's consultation, 20 Nov 2026 (heiner/ANTWORTEN-HEINER-2026-11-20.md): one question at a
     time, answers as buttons or typed freely, several answers where it makes sense, technical
     questions always with "not known yet", then a summary, an orientation and the hand-over to the
     SENSOR team. Nothing is confirmed as sent: in the demo the summary goes into the contact form. */
  const OPEN = ['Not known yet – I would like advice', 'Noch nicht bekannt – ich wünsche Beratung'];
  let adv = null; // { a: answers, wait: handler for typed text }
  const txt = (o) => T(o[0], o[1]);
  // one question with answer buttons; typed text is always accepted as the answer
  function q({ en, de, opts = [], multi = false, free = false, key, next }) {
    const el = bubble('bot', T(en, de));
    const row = document.createElement('div'); row.className = 'chat-acts chat-opts';
    const picked = new Set();
    const finish = (value, idx) => {
      row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      row.classList.add('is-done');
      adv.wait = null;
      adv.a[key] = { v: value, i: idx };
      typing(() => next(adv.a[key]));
    };
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chat-act'; b.textContent = txt(o);
      b.addEventListener('click', () => {
        if (multi) { b.classList.toggle('is-on'); if (picked.has(i)) picked.delete(i); else picked.add(i); go.disabled = !picked.size; return; }
        bubble('me', txt(o)); finish(txt(o), [i]);
      });
      row.append(b);
    });
    let go = null;
    if (multi) {
      go = document.createElement('button'); go.type = 'button'; go.className = 'chat-act is-primary'; go.textContent = T('Continue', 'Weiter'); go.disabled = true;
      go.addEventListener('click', () => { const idx = [...picked].sort((x, y) => x - y); const v = idx.map((i) => txt(opts[i])).join(', '); bubble('me', v); finish(v, idx); });
      row.append(go);
    }
    if (opts.length) el.append(row);
    adv.wait = (t) => finish(t, []);
    if (adv.pending) { const t = adv.pending; adv.pending = null; setTimeout(() => adv && adv.wait && adv.wait(t), 0); }
    if (free && !opts.length) input.placeholder = T('Type your answer…', 'Ihre Antwort…');
    scroll();
  }
  const has = (k, i) => adv.a[k] && adv.a[k].i.includes(i);
  const val = (k) => (adv.a[k] ? adv.a[k].v : null);

  function adviceStart() {
    adv = { a: {} };
    chips.hidden = true;
    bubble('bot', T('Welcome to SENSOR! I am happy to help you choose the right thermal camera. I will ask you a few questions about your application and your wishes. You do not need any technical knowledge.',
      'Willkommen bei SENSOR GmbH! Gerne unterstütze ich Sie bei der Auswahl einer passenden Wärmebildkamera. Dazu stelle ich Ihnen einige Fragen zu Ihrer Anwendung und Ihren Wünschen. Technische Vorkenntnisse benötigen Sie dafür nicht.'));
    typing(stepExperience);
  }
  // 1. experience
  function stepExperience() {
    q({ en: 'Do you already have experience with thermography?', de: 'Haben Sie bereits Erfahrung mit Thermografie?', key: 'exp',
      opts: [['No, I am new to the topic', 'Nein, ich steige neu in das Thema ein'], ['I have some first experience', 'Ich habe erste Erfahrungen gesammelt'], ['I already work with thermal cameras regularly', 'Ich arbeite bereits regelmäßig mit Wärmebildkameras']],
      next: (r) => (r.i[0] === 0 ? stepApps() : q({ en: 'Do you already use a thermal camera? If so, which model?', de: 'Setzen Sie bereits eine Wärmebildkamera ein? Wenn ja, welches Modell?', key: 'cam', free: true,
        opts: [['No', 'Nein']],
        next: (c) => (c.i[0] === 0 ? stepApps() : q({ en: 'What would you like to improve or add compared with your current camera?', de: 'Was möchten Sie gegenüber Ihrem bisherigen Gerät verbessern oder zusätzlich ermöglichen?', key: 'improve', free: true, opts: [['Nothing specific', 'Nichts Bestimmtes']], next: stepApps })) })) });
  }
  // 2. applications
  const APPS = [['Electrical cabinets and installations', 'Elektroschaltschränke und elektrische Anlagen'], ['Buildings, insulation and thermal bridges', 'Gebäude, Dämmung und Wärmebrücken'], ['Plumbing and heating, e.g. underfloor heating or leaks', 'Sanitär- und Heizungsinstallationen, z. B. Fußbodenheizung oder Leckstellen'], ['Electronic components and circuit boards', 'Elektronische Bauteile und Leiterplatten'], ['Machines and plants, e.g. motors or bearings', 'Maschinen und Anlagen, z. B. Motoren oder Lager'], ['Animals, veterinary use', 'Tiere bzw. Veterinärmedizin'], ['Medical use on people', 'Medizinische Anwendungen am Menschen'], ['Another application', 'Eine andere Anwendung']];
  function stepApps() {
    q({ en: 'What would you like to inspect or measure with the camera? You can choose several.', de: 'Was möchten Sie mit der Wärmebildkamera untersuchen oder messen? Mehrfachauswahl ist möglich.', key: 'apps', multi: true, opts: APPS,
      next: (r) => {
        const main = () => {
          const chosen = r.i.filter((i) => i !== 7);
          if (chosen.length > 1) q({ en: 'Which of these is the most important for you?', de: 'Welche dieser Anwendungen ist für Sie am wichtigsten?', key: 'main', opts: chosen.map((i) => APPS[i]), next: stepUse });
          else stepUse();
        };
        if (r.i.includes(7) || !r.i.length) q({ en: 'Please describe briefly what problem you want to examine or what change you want to detect.', de: 'Beschreiben Sie bitte kurz, welches Problem Sie untersuchen oder welche Veränderung Sie erkennen möchten.', key: 'other', free: true, next: main });
        else main();
      } });
  }
  // 3. how and how often
  function stepUse() {
    q({ en: 'In what setting will you use the camera?', de: 'In welchem Rahmen möchten Sie die Wärmebildkamera einsetzen?', key: 'use',
      opts: [['Privately', 'Für private Anwendungen'], ['For checks in my own company', 'Für Prüfungen und Kontrollen im eigenen Betrieb'], ['I want to offer thermography as a service', 'Ich möchte Thermografie künftig als Dienstleistung anbieten'], ['I already offer thermography as a service', 'Ich biete Thermografie bereits als Dienstleistung an']],
      next: () => q({ en: 'How often will you probably use the camera?', de: 'Wie häufig werden Sie die Kamera voraussichtlich nutzen?', key: 'freq',
        opts: [['Occasionally, when needed', 'Gelegentlich bei Bedarf'], ['Regularly, several times a month', 'Regelmäßig, mehrmals im Monat'], ['Several times a week', 'Mehrmals pro Woche'], ['Daily', 'Täglich'], ['Not decided yet', 'Das steht noch nicht fest']], next: stepTech }) });
  }
  // 4. technical requirements, then only the follow-ups that matter for the application
  function stepTech() {
    q({ en: 'Are there already technical requirements the camera has to meet? You can choose several.', de: 'Gibt es bereits technische Vorgaben, die die Wärmebildkamera erfüllen muss? Mehrfachauswahl ist möglich.', key: 'tech', multi: true,
      opts: [['A certain resolution, e.g. at least 320 × 240 pixels', 'Eine bestimmte Infrarotauflösung, etwa mindestens 320 × 240 Pixel'], ['Temperatures above 650 °C', 'Temperaturen über 650 °C'], ['A certain lens or field of view', 'Ein vorgegebenes Objektiv oder ein bestimmter Bildausschnitt'], ['Close-ups or small components', 'Nahaufnahmen oder kleine Bauteile'], ['No fixed requirements yet', 'Noch keine festen Vorgaben'], OPEN],
      next: () => {
        const steps = [];
        if (has('tech', 1) || has('apps', 4) || has('apps', 0)) steps.push((n) => q({ en: 'What are the lowest and highest temperatures you want to measure?', de: 'Welche niedrigsten und höchsten Temperaturen möchten Sie messen?', key: 'temps', free: true, opts: [OPEN], next: n }));
        if (!(adv.a.apps && adv.a.apps.i.length === 1 && has('apps', 3))) steps.push((n) => q({ en: 'From what distance do you usually inspect the objects?', de: 'Aus welcher Entfernung werden Sie die Messobjekte normalerweise untersuchen?', key: 'dist', free: true, opts: [['Close, under 1 m', 'Nah, unter 1 m'], ['1 to 5 m', '1 bis 5 m'], ['More than 5 m', 'Mehr als 5 m'], OPEN], next: n }));
        if (has('apps', 3) || has('tech', 3)) steps.push((n) => q({ en: 'How big is the smallest spot or component whose temperature you want to judge?', de: 'Wie groß ist die kleinste Stelle oder das kleinste Bauteil, dessen Temperatur Sie beurteilen möchten?', key: 'small', free: true, opts: [OPEN], next: n }));
        else steps.push((n) => q({ en: 'Do you want to see a large area at a glance, or examine single small details?', de: 'Möchten Sie einen großen Bereich im Überblick erfassen oder einzelne kleine Details untersuchen?', key: 'view', opts: [['A large area at a glance', 'Einen großen Bereich im Überblick'], ['Single small details', 'Einzelne kleine Details'], ['Both', 'Beides'], OPEN], next: n }));
        const run = (i) => (i < steps.length ? steps[i](() => run(i + 1)) : stepSave());
        run(0);
      } });
  }
  // 5. live or saved pictures, 6. software
  function stepSave() {
    q({ en: 'Do you only want to watch the thermal image live and read temperatures, or also save pictures?', de: 'Möchten Sie die Wärmebilder ausschließlich live betrachten und Temperaturen ablesen, oder möchten Sie Aufnahmen speichern?', key: 'save',
      opts: [['Live viewing and temperatures are enough', 'Die Live-Betrachtung und Temperaturanzeige reichen mir aus'], ['I want to save single pictures', 'Ich möchte einzelne Wärmebilder speichern'], ['I need both', 'Ich benötige beides'], ['I am not sure yet', 'Ich bin noch unsicher']],
      next: (r) => {
        if (r.i[0] === 1 || r.i[0] === 2) q({ en: 'Should the saved pictures mainly be for viewing, or do you want to read more temperature values from them later?', de: 'Sollen die gespeicherten Bilder hauptsächlich zur Ansicht dienen, oder möchten Sie später weitere Temperaturwerte daraus auslesen?', key: 'saveUse', opts: [['Mainly for viewing', 'Hauptsächlich zur Ansicht'], ['Read temperature values later', 'Später Temperaturwerte auslesen'], OPEN], next: stepSoftware });
        else if (r.i[0] === 3) stepSoftware();
        else stepSeq();
      } });
  }
  function stepSoftware() {
    q({ en: 'Would you like to examine your saved pictures on the computer, for example read temperatures at other spots or compare pictures?', de: 'Möchten Sie Ihre gespeicherten Wärmebilder am Computer genauer untersuchen und beispielsweise an weiteren Stellen Temperaturen ablesen oder verschiedene Aufnahmen vergleichen?', key: 'soft',
      opts: [['Yes, a simple analysis is enough', 'Ja, eine einfache Auswertung genügt'], ['Yes, I need extensive analysis and comparison', 'Ja, ich benötige umfangreiche Analyse- und Vergleichsmöglichkeiten'], ['No, the camera display is enough', 'Nein, die Anzeige auf der Kamera reicht aus'], ['Please explain the options', 'Bitte erläutern Sie mir die Möglichkeiten']],
      next: (r) => {
        if (r.i[0] === 3) bubble('bot', T('In short: HIKMICRO cameras save radiometric pictures, so every pixel keeps its temperature. On the PC, HIKMICRO Analyzer lets you set new measuring points, areas and lines, compare pictures and make reports.', 'Kurz gesagt: HIKMICRO-Kameras speichern radiometrische Bilder, jeder Bildpunkt behält seine Temperatur. Am PC setzen Sie mit HIKMICRO Analyzer neue Messpunkte, Flächen und Linien, vergleichen Aufnahmen und erstellen Berichte.'));
        if (r.i[0] === 0 || r.i[0] === 1) q({ en: 'Which operating system do you use?', de: 'Welches Betriebssystem verwenden Sie?', key: 'os', opts: [['Windows', 'Windows'], ['macOS', 'macOS'], ['Both', 'Beides'], OPEN], next: stepSeq });
        else stepSeq();
      } });
  }
  // 7. sequences
  function stepSeq() {
    q({ en: 'Do you want to follow temperature changes over time, for example while a part warms up or cools down?', de: 'Möchten Sie Temperaturveränderungen über einen bestimmten Zeitraum verfolgen, beispielsweise beim Aufwärmen oder Abkühlen eines Bauteils?', key: 'seq',
      opts: [['No, single measurements or pictures are enough', 'Nein, einzelne Messungen oder Bilder reichen aus'], ['Yes, save pictures automatically at fixed intervals', 'Ja, automatisch Bilder in festen Zeitabständen speichern'], ['Yes, record a continuous video sequence', 'Ja, eine durchgehende Videosequenz aufnehmen'], ['Yes, I need both', 'Ja, ich benötige beide Möglichkeiten'], ['I would like advice on this', 'Ich wünsche dazu Beratung']],
      next: (r) => {
        const steps = [];
        if (r.i[0] === 1 || r.i[0] === 3) {
          steps.push((n) => q({ en: 'How often should a picture be saved?', de: 'In welchen Abständen soll ein Bild gespeichert werden?', key: 'interval', free: true, opts: [['Every 30 seconds', 'Alle 30 Sekunden'], ['Every minute', 'Jede Minute'], ['Every 5 minutes', 'Alle 5 Minuten'], OPEN], next: n }));
          steps.push((n) => q({ en: 'Over what total time do you want to record?', de: 'Über welchen Gesamtzeitraum möchten Sie aufzeichnen?', key: 'duration', free: true, opts: [['About an hour', 'Etwa eine Stunde'], ['A whole day', 'Einen ganzen Tag'], ['Several days', 'Mehrere Tage'], OPEN], next: n }));
        }
        if (r.i[0] === 2 || r.i[0] === 3) steps.push((n) => q({ en: 'Do you only want to watch the video, or also analyse temperature values over time?', de: 'Möchten Sie den Ablauf nur als Video ansehen oder später auch Temperaturwerte über die Zeit auswerten?', key: 'video', opts: [['Only watch it', 'Nur ansehen'], ['Analyse temperatures over time', 'Temperaturwerte über die Zeit auswerten'], OPEN], next: n }));
        const run = (i) => (i < steps.length ? steps[i](() => run(i + 1)) : stepReports());
        run(0);
      } });
  }
  // 8. reports
  function stepReports() {
    q({ en: 'Would you like to create reports or inspection records from the pictures?', de: 'Möchten Sie aus den Aufnahmen Berichte oder Prüfprotokolle erstellen?', key: 'reports',
      opts: [['No, storing the pictures is enough', 'Nein, eine Bildablage reicht aus'], ['Yes, for our internal records', 'Ja, für unsere interne Dokumentation'], ['Yes, for our customers', 'Ja, für unsere Kunden'], ['Yes, for both', 'Ja, für interne Zwecke und für Kunden']],
      next: (r) => (r.i[0] > 0 ? q({ en: 'Is there already a report template, or contents that must be included? For example your logo, object data, thermal and normal photos, readings, comments or before-and-after comparisons.', de: 'Gibt es bereits eine Berichtsvorlage oder bestimmte Inhalte, die enthalten sein müssen? Zum Beispiel Firmenlogo, Objekt- oder Anlagendaten, Wärmebilder und normale Fotos, Messwerte, Kommentare oder Vorher-Nachher-Vergleiche.', key: 'template', free: true, opts: [['No template yet', 'Noch keine Vorlage']], next: stepSupport }) : stepSupport()) });
  }
  // 9. introduction and training
  function stepSupport() {
    q({ en: 'What support would you like to get started or for your work? You can choose several.', de: 'Welche Unterstützung wünschen Sie sich beim Einstieg oder bei der Anwendung? Mehrfachauswahl ist möglich.', key: 'support', multi: true,
      opts: [['An online introduction to the camera', 'Eine Online-Einweisung in die Kamera'], ['An introduction to the analysis software', 'Eine Einführung in die Auswertesoftware'], ['Hands-on thermography training at the Academy', 'Eine praxisorientierte Thermografie-Schulung in der Akademie'], ['Help with a specific measuring task', 'Unterstützung bei einer konkreten Messaufgabe'], ['I need no extra introduction for now', 'Aktuell benötige ich keine zusätzliche Einweisung']],
      next: (r) => {
        const then = () => { bubble('bot', T('We are happy to put together an individual package of thermal camera, matching accessories and the introduction or training you want.', 'Gerne stellen wir Ihnen ein individuelles Paket aus Wärmebildkamera, passendem Zubehör und der gewünschten Einweisung oder Schulung zusammen.')); typing(stepBudget); };
        if (r.i.some((i) => i < 4)) q({ en: 'How many people will work with the camera or take part in the introduction or training?', de: 'Wie viele Personen sollen mit der Kamera arbeiten beziehungsweise an der Einweisung oder Schulung teilnehmen?', key: 'people', free: true, opts: [['1', '1'], ['2 – 4', '2 – 4'], ['5 – 10', '5 – 10'], ['More than 10', 'Mehr als 10']], next: then });
        else then();
      } });
  }
  // 10. budget and purchase
  function stepBudget() {
    q({ en: 'Have you already planned a budget for the whole package?', de: 'Haben Sie bereits einen Budgetrahmen für das gesamte Paket vorgesehen?', key: 'budget',
      opts: [['Yes, roughly …', 'Ja, ungefähr …'], ['There is a fixed upper limit …', 'Es gibt eine feste Obergrenze …'], ['I would like to compare options first', 'Ich möchte zunächst passende Möglichkeiten vergleichen'], ['The budget is not fixed yet', 'Das Budget steht noch nicht fest']],
      next: (r) => {
        const finance = () => q({ en: 'Besides buying outright, we offer hire purchase or leasing with our partner MMV Leasing. Which option interests you?', de: 'Neben dem direkten Kauf bieten wir auch Mietkauf oder Leasing über unseren Partner MMV Leasing an. Welche Möglichkeit ist für Sie interessant?', key: 'buy',
          opts: [['Buying outright', 'Direkter Kauf'], ['Hire purchase', 'Mietkauf'], ['Leasing', 'Leasing'], ['I would like to compare the options', 'Ich möchte die Möglichkeiten vergleichen'], ['Still open', 'Das ist noch offen']],
          next: () => q({ en: 'When would you like to be able to use the camera?', de: 'Zu welchem Zeitpunkt möchten Sie die Kamera einsetzen können?', key: 'when', free: true, opts: [['As soon as possible', 'So bald wie möglich'], ['In the next 3 months', 'In den nächsten 3 Monaten'], ['Later this year', 'Später im Jahr'], ['Not fixed yet', 'Noch offen']], next: stepNext }) });
        if (r.i[0] === 0 || r.i[0] === 1) {
          q({ en: 'What amount, roughly?', de: 'Welcher Betrag ungefähr?', key: 'amount', free: true,
            next: () => q({ en: 'Is your budget for the camera alone or for the whole package including accessories, software and training?', de: 'Bezieht sich Ihr Budget auf die Kamera allein oder auf das gesamte Paket einschließlich Zubehör, Software und Schulung?', key: 'amountFor', opts: [['The camera alone', 'Die Kamera allein'], ['The whole package', 'Das gesamte Paket']], next: finance }) });
        } else finance();
      } });
  }
  // 11. next step
  function stepNext() {
    q({ en: 'How would you like to continue? You can choose several.', de: 'Wie möchten Sie als Nächstes vorgehen? Mehrfachauswahl ist möglich.', key: 'next', multi: true,
      opts: [['I would like an individual offer', 'Ich wünsche ein individuelles Angebot'], ['I would like to test a suitable camera', 'Ich möchte ein geeignetes Gerät testen'], ['I would like an appointment with your field service', 'Ich wünsche einen Termin mit dem Außendienst'], ['I would like advice by phone or online first', 'Ich möchte zunächst telefonisch oder online beraten werden'], ['I only want to get informed for now', 'Ich möchte mich vorerst nur informieren']],
      next: (r) => {
        if (r.i.includes(1) || r.i.includes(2)) {
          q({ en: 'Which specific application would you like to check together with us?', de: 'Welche konkrete Anwendung möchten Sie gemeinsam mit uns prüfen?', key: 'testWhat', free: true,
            next: () => q({ en: 'At which location or postcode should the appointment take place?', de: 'An welchem Standort beziehungsweise in welcher Postleitzahl soll der Termin stattfinden?', key: 'zip', free: true, next: summary }) });
        } else summary();
      } });
  }
  // summary: only what the visitor said, open points marked
  function summaryLines() {
    const open = T('open', 'offen');
    const j = (...k) => k.map(val).filter(Boolean).join('; ') || open;
    return [
      [T('Application', 'Anwendung'), [val('apps'), val('other'), val('main') && `${T('most important', 'am wichtigsten')}: ${val('main')}`].filter(Boolean).join('; ') || open],
      [T('Experience and current camera', 'Erfahrung und bisherige Kamera'), j('exp', 'cam', 'improve')],
      [T('Use', 'Nutzung'), j('use', 'freq')],
      [T('Measuring requirements', 'Messanforderungen'), j('tech', 'temps', 'dist', 'small', 'view')],
      [T('Pictures and analysis', 'Aufnahmen und Auswertung'), j('save', 'saveUse', 'soft', 'os', 'seq', 'interval', 'duration', 'video')],
      [T('Documentation', 'Dokumentation'), j('reports', 'template')],
      [T('Introduction or training', 'Einweisung oder Schulung'), j('support', 'people')],
      [T('Budget and purchase', 'Budget und Anschaffung'), j('budget', 'amount', 'amountFor', 'buy', 'when')],
      [T('Next step', 'Gewünschter nächster Schritt'), j('next', 'testWhat', 'zip')],
    ];
  }
  function summary() {
    const lines = summaryLines().map(([k, v]) => `• ${k}: ${v}`).join('\n');
    const el = bubble('bot', `${T('Thank you! I have summarised your requirements as follows:', 'Vielen Dank! Ich habe Ihre Anforderungen wie folgt zusammengefasst:')}\n\n${lines}`);
    el.classList.add('chat-summary');
    q({ en: 'Have I got your wishes right, or would you like to add something?', de: 'Habe ich Ihre Wünsche richtig erfasst, oder möchten Sie etwas ergänzen?', key: 'ok', free: true,
      opts: [['Yes, that is right', 'Ja, das passt'], ['I would like to add something', 'Ich möchte etwas ergänzen']],
      next: (r) => {
        if (r.i[0] === 1) q({ en: 'Please type what you would like to add.', de: 'Bitte schreiben Sie, was Sie ergänzen möchten.', key: 'note', free: true, next: orientation });
        else { if (!r.i.length) adv.a.note = { v: r.v, i: [] }; orientation(); }
      } });
  }
  // orientation from Heiner's recommendations; the team checks it
  function orientation() {
    const said = [val('other'), val('note'), val('improve')].filter(Boolean).join(' ').toLowerCase();
    if (has('apps', 5) || has('apps', 6)) {
      bubble('bot', T('For medical and veterinary questions we plan a specialist consultation: our team looks at your question personally. The choice of an application says nothing about a diagnostic suitability or approval of a camera.', 'Für medizinische und veterinärmedizinische Fragen sehen wir eine Fachberatung vor: Unser Team schaut sich Ihre Fragestellung persönlich an. Aus der gewählten Anwendung lässt sich keine diagnostische Eignung oder Zulassung einer Kamera ableiten.'));
      return typing(contact);
    }
    const service = has('use', 2) || has('use', 3) || has('freq', 3);
    const occasional = has('use', 0) || has('freq', 0);
    let ids; let en; let de;
    if (/forsch|research|entwicklung|r ?& ?d|labor|lab\b/.test(said)) { ids = ['sp60', 'sp120h']; en = 'For research and development, our experts usually look at the SP60 and SP120 series.'; de = 'Für Forschung und Entwicklung schauen unsere Experten meist auf die SP60- und SP120-Serie.'; }
    else if (has('tech', 1)) { ids = ['g61h', 'sp40h', 'sp60h']; en = 'For temperatures above 650 °C you need an H model, measuring up to 2000 or 2200 °C: for example the G61H, SP40H or SP60H.'; de = 'Für Temperaturen über 650 °C brauchen Sie ein H-Modell, das bis 2000 bzw. 2200 °C misst: zum Beispiel G61H, SP40H oder SP60H.'; }
    else if (has('apps', 3)) { ids = occasional ? ['pocket2', 'm31'] : service ? ['m60', 'm31'] : ['m31', 'm60']; en = 'For electronics and circuit boards we recommend a camera on a desk bracket with a macro lens. As packages: Pocket2, M31 or M60, each with macro lens and bracket.'; de = 'Für Elektronik und Leiterplatten empfehlen wir eine Kamera auf einem Tischstativ mit Makrolinse. Als Paket: Pocket2, M31 oder M60, jeweils mit Makrolinse und Stativ.'; }
    else if (service) { ids = ['g61', 'sp40', 'sp60']; en = 'When thermography is a big part of your service, our experts recommend the G61 with a wide lens, or the SP40 and SP60 series.'; de = 'Wenn Thermografie ein großer Teil Ihrer Dienstleistung ist, empfehlen unsere Experten die G61 mit Weitwinkelobjektiv oder die SP40- und SP60-Serie.'; }
    else if (occasional) { ids = ['pocket2', 'm20w', 'minix']; en = 'For occasional checks, the Pocket2, B20S, M20W, MiniX or Mini2Plus V2 are enough.'; de = 'Für gelegentliche Kontrollen reichen Pocket2, B20S, M20W, MiniX oder Mini2Plus V2.'; }
    else { ids = ['m31', 'm60', 'g31']; en = 'For a camera you use as a tool now and then, but not daily, our experts recommend the M31, M60 or G31.'; de = 'Für eine Kamera, die Sie als Werkzeug immer mal wieder, aber nicht täglich nutzen, empfehlen unsere Experten M31, M60 oder G31.'; }
    if (has('apps', 2)) { en += ' For leak detection in plumbing and heating we add the AD22P-I water leak detector.'; de += ' Für die Leckageortung in Sanitär und Heizung kommt der Wasserleck-Detektor AD22P-I dazu.'; }
    bubble('bot', `${T(en, de)} ${T('This is a first orientation: our team checks it against your answers and puts together the package.', 'Das ist eine erste Orientierung: Unser Team prüft sie anhand Ihrer Angaben und stellt das Paket zusammen.')}`);
    ids.map((id) => P[id]).filter(Boolean).forEach((p) => card(p, ''));
    typing(contact);
  }
  // hand-over: only the details needed, nothing confirmed as sent
  function contact() {
    if (has('next', 4) && ![0, 1, 2, 3].some((i) => has('next', i))) {
      bubble('bot', T('Thank you. Take your time to look around; if you have questions later, I am here, or a thermal expert answers within one working day.', 'Vielen Dank. Schauen Sie sich in Ruhe um; bei Fragen bin ich da, oder ein Experte antwortet innerhalb eines Werktags.'), ['human']);
      adv = null; return;
    }
    q({ en: 'So that our advisory team can take up your request: how may we address you?', de: 'Damit unser Beratungsteam Ihre Anfrage aufgreifen kann: Wie dürfen wir Sie ansprechen?', key: 'name', free: true,
      next: () => q({ en: 'Your company, if any?', de: 'Ihre Firma, falls vorhanden?', key: 'company', free: true, opts: [['Private customer', 'Privatkunde']],
        next: () => q({ en: 'How can we best reach you? Please give your email address or phone number.', de: 'Über welchen Kontaktweg erreichen wir Sie am besten? Bitte nennen Sie E-Mail-Adresse oder Telefonnummer.', key: 'reach', free: true, next: handover }) }) });
  }
  function handover() {
    const a = adv.a;
    const lines = summaryLines().map(([k, v]) => `${k}: ${v}`);
    if (a.note) lines.push(`${T('Added', 'Ergänzung')}: ${a.note.v}`);
    const message = `${T('Request from the SENSOR assistant', 'Anfrage über den SENSOR-Assistenten')}\n\n${lines.join('\n')}`;
    const reach = (val('reach') || '').trim();
    const name = val('name');
    const company = val('company') && !has('company', 0) ? `\n${T('Company', 'Firma')}: ${val('company')}` : '';
    const prefill = () => {
      form_('contact');
      const f = document.querySelector('[data-drawer-form]'); if (!f) return;
      const set = (n, v) => { const el = f.querySelector(`[name="${n}"]`); if (el && v) el.value = v; };
      set('name', name);
      if (/@/.test(reach)) set('email', reach); else set('phone', reach);
      set('message', message + company);
    };
    bubble('bot', T('Thank you! Your summary is ready. Send it to the SENSOR team with one click: in the finished shop it goes to info@sensorgmbh.de, and someone gets back to you shortly.', 'Vielen Dank! Ihre Zusammenfassung ist fertig. Senden Sie sie mit einem Klick an das SENSOR-Team: Im fertigen Shop geht sie an info@sensorgmbh.de, und es meldet sich kurzfristig jemand bei Ihnen.'),
      [{ label: T('Send to the SENSOR team', 'An das SENSOR-Team senden'), run: prefill, primary: true }]);
    adv = null;
  }

  /* ---------- talk to a person: subject and phone for a call back ---------- */
  function humanStart() {
    adv = { a: {} };
    chips.hidden = true;
    q({ en: 'Gladly. What is it about? A short subject is enough.', de: 'Gern. Worum geht es? Ein kurzer Betreff genügt.', key: 'subject', free: true,
      next: () => q({ en: 'Under which phone number can we call you back?', de: 'Unter welcher Telefonnummer dürfen wir Sie zurückrufen?', key: 'phone', free: true,
        next: () => {
          const s = val('subject'); const ph = val('phone');
          bubble('bot', T('Thank you. Send your request to us with one click: in the finished shop it goes to info@sensorgmbh.de and someone calls you back shortly.', 'Danke. Senden Sie Ihre Anfrage mit einem Klick: Im fertigen Shop geht sie an info@sensorgmbh.de, und es ruft Sie kurzfristig jemand zurück.'),
            [{ label: T('Request a call back', 'Rückruf anfordern'), primary: true, run: () => {
              form_('contact');
              const f = document.querySelector('[data-drawer-form]'); if (!f) return;
              const ph_ = f.querySelector('[name="phone"]'); if (ph_) ph_.value = ph;
              const m = f.querySelector('[name="message"]'); if (m) m.value = `${T('Call back please', 'Bitte um Rückruf')}: ${s}`;
            } }, { label: T('Call +49 2161 477 39 73', 'Anrufen: +49 2161 477 39 73'), href: 'tel:+4921614773973' }]);
          adv = null;
        } }) });
  }

  /* ---------- the conversation ---------- */
  let lastProduct = null;
  function answer(q) {
    const n = norm(q);
    const ids = findProducts(q);
    const field = askedField(q);
    const scored = scoreAll(q);
    const top = scored[0];

    if (ids.length >= 2) { compare(ids[0], ids[1]); lastProduct = P[ids[1]]; return; }
    if (ids.length === 1) {
      const p = P[ids[0]]; lastProduct = p;
      if (field) { bubble('bot', fieldAnswer(p, field), productActs(p, field === 'calibration' ? ['calibration'] : [])); return; }
      // a general topic that happens to name a camera ("can the M31 see through glass?")
      if (top && top.s >= 5 && !['price', 'compare', 'resolution'].includes(top.e.id)) { reply(top.e); return; }
      const up = nextUp(p);
      card(p, lang === 'de' ? '' : (p.use || ''), up ? [{ label: T(`Compare with ${up.name}`, `Mit ${up.name} vergleichen`), run: () => compare(p.id, up.id) }] : []);
      return;
    }
    // "which camera measures 1500 °C?": the most affordable camera that reaches it
    const hot = n.match(/\b(\d{3,4}) ?(?:°|grad|c\b)/);
    if (hot && /\b(which|what|welche\w*|need|brauche\w*|measure\w*|mess\w*)\b/.test(n)) {
      const t = +hot[1];
      const fit = Object.values(P).filter((p) => p.price != null && !p.sample && (maxTemp(p) || 0) >= t).sort((a, b) => a.price - b.price);
      if (fit.length) { const c = fit[0]; lastProduct = c; card(c, T(`The most affordable camera that measures ${t} °C is the ${c.name}, up to ${maxTemp(c)} °C.`, `Die günstigste Kamera, die ${t} °C misst, ist die ${c.name}, bis ${maxTemp(c)} °C.`), fit[1] ? [{ label: T(`Compare with ${fit[1].name}`, `Mit ${fit[1].name} vergleichen`), run: () => compare(c.id, fit[1].id) }] : []); }
      else bubble('bot', T(`None of our cameras measures ${t} °C. Our hottest models reach 2200 °C; ask an expert about your application.`, `Keine unserer Kameras misst ${t} °C. Die heißesten Modelle schaffen 2200 °C; fragen Sie einen Experten.`), ['human']);
      return;
    }
    // a follow-up about the camera we just talked about: "and the price?", "how hot can it measure?"
    if (lastProduct && field && !/\b(under|below|less than|unter|bis|hoechstens|budget|max)\b/.test(n) && (n.split(' ').length <= 9 || /\b(it|its|this one|that one|es|sie|die|der|diese\w*)\b/.test(n))) {
      bubble('bot', fieldAnswer(lastProduct, field), productActs(lastProduct)); return;
    }
    if (superlative(q)) return;
    if (/\b(help me choose|which camera|what camera|recommend\w*|suggest\w*|welche kamera|empfehl\w*|beraten|beratung|which one should|not sure)\b/.test(n) && (!top || top.s < 5)) { adviceStart(); return; }
    if (top && top.s >= 2) { reply(top.e); return; }

    // not understood: offer the closest topics instead of a dead end
    const near = scored.filter((x) => x.s > 0).slice(0, 3);
    bubble('bot', T('I am not sure I understood. Did you mean one of these? Or ask a thermal expert, who answers within one working day.', 'Das habe ich nicht ganz verstanden. Meinten Sie eines davon? Oder fragen Sie einen Experten, Antwort innerhalb eines Werktags.'),
      [...(near.length ? near : scored.slice(0, 3)).map((x) => ({ label: x.e.ask[lang === 'de' ? x.e.ask.length - 1 : 0], run: () => ask(x.e.ask[lang === 'de' ? x.e.ask.length - 1 : 0]) })), 'human']);
  }
  function reply(e) {
    if (e.id === 'human') { humanStart(); return; }
    const text = lang === 'de' && e.text_de ? e.text_de : e.text;
    const acts = [...e.act];
    if (['house', 'industry', 'solar', 'compare'].includes(e.id) && !acts.includes('choose')) acts.unshift('choose');
    bubble('bot', text, acts);
  }

  function typing(fn) {
    const t = document.createElement('div'); t.className = 'chat-msg chat-bot chat-typing'; t.innerHTML = '<span></span><span></span><span></span>';
    log.append(t); log.scrollTop = log.scrollHeight;
    setTimeout(() => { t.remove(); fn(); }, reduceMotion ? 0 : 550);
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    if (adv && !adv.wait) { bubble('me', q); adv.pending = q; return; }
    if (adv && adv.wait) { const w = adv.wait; bubble('me', q); chips.hidden = true; input.placeholder = T('Ask about cameras, resolution, service…', 'Fragen zu Kameras, Auflösung, Service…'); w(q); return; }
    lang = detectLang(q);
    bubble('me', q);
    chips.hidden = true;
    typing(() => answer(q));
  }

  const CHIPS = [
    ['Help me choose a camera', 'Hilf mir bei der Wahl'],
    ['What does resolution mean?', 'Was bedeutet Auflösung?'],
    ['Compare M31 and M60', 'M31 und M60 vergleichen'],
    ['Can a camera see through glass?', 'Sieht die Kamera durch Glas?'],
    ['Can my company pay on invoice?', 'Kann meine Firma auf Rechnung zahlen?'],
  ];
  let started = false;
  function open() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); document.body.classList.add('chat-open');
    if (!started) {
      started = true;
      const site = window.HM_LANG ? window.HM_LANG() : '';
      lang = site === 'de' || (!site && /^de\b/i.test(navigator.language || '')) ? 'de' : 'en'; // the chat speaks German or English; Dutch and French pages translate its fixed texts
      bubble('bot', T('Hi, I am the SENSOR assistant. I know every HIKMICRO camera we sell, and how service and ordering work. Ask me in English or German.', 'Hallo, ich bin der SENSOR-Assistent. Ich kenne jede HIKMICRO-Kamera, die wir verkaufen, und weiß, wie Service und Bestellung laufen. Fragen Sie auf Deutsch oder Englisch.'));
      chips.innerHTML = '';
      CHIPS.forEach(([en, dt], i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chat-chip'; b.textContent = T(en, dt);
        b.addEventListener('click', () => { if (i === 0) { bubble('me', b.textContent); adviceStart(); } else ask(b.textContent); });
        chips.append(b);
      });
    }
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }
  function close() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); document.body.classList.remove('chat-open'); }
  document.querySelectorAll('[data-chat-open]').forEach((b) => b.addEventListener('click', () => (panel.hidden ? open() : close())));
  panel.querySelector('[data-chat-close]').addEventListener('click', () => { close(); fab.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); fab.focus(); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
  window.HM_CHAT = { ask, open }; // for testing
})();
