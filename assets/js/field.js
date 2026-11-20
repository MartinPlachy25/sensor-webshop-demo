/* Field bands on the camera wall: real SENSOR pictures that move with the scroll.
   - hand / wide: parallax inside the frame, floating thumbnails, tilt and glare under the pointer
   - scan: a scan line sweeps the photo into the thermal view as the band passes; buttons switch by hand
   - reel: a film strip of a winter survey that runs sideways while you scroll down
   - video: the clip grows from a framed picture to the full width
   Without GSAP or with reduced motion everything is shown still and the buttons still work. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const animate = hasGsap && !reduce;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let ctx = null;

  // thermal reading counts up to the real maximum once the thermal view is in
  function countUp(b) {
    const max = Number(b.dataset.max);
    if (!animate) { b.textContent = max.toFixed(1); return; }
    const o = { v: max * 0.45 };
    gsap.to(o, { v: max, duration: 1.1, ease: 'expo.out', onUpdate: () => { b.textContent = o.v.toFixed(1); } });
  }

  function setupScan(band) {
    const frame = band.querySelector('[data-scan]');
    const read = band.querySelector('[data-max]');
    const btns = $$('.fb-switch button', band);
    let manual = false; let shown = null;
    const show = (p) => {
      frame.style.setProperty('--scan', `${(p * 100).toFixed(2)}%`);
      frame.style.setProperty('--line-o', p < 0.01 || p > 0.985 ? '0' : '1');
      const heat = p > 0.5;
      if (heat !== shown) {
        shown = heat;
        frame.classList.toggle('is-heat', heat);
        band.classList.toggle('is-heat', heat);
        btns.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.view === 'heat') === heat)));
        if (heat) countUp(read); else read.textContent = '––.–';
      }
    };
    btns.forEach((b) => b.addEventListener('click', () => {
      manual = true;
      const to = b.dataset.view === 'heat' ? 1 : 0;
      if (!animate) { show(to); return; }
      const o = { p: parseFloat(frame.style.getPropertyValue('--scan') || '0') / 100 };
      gsap.to(o, { p: to, duration: 0.9, ease: 'power3.inOut', onUpdate: () => show(o.p) });
    }));
    if (!animate) { show(1); return; }
    show(0);
    ScrollTrigger.create({
      trigger: frame, start: 'top 72%', end: 'center 42%', scrub: 0.6,
      onUpdate: (st) => { if (!manual) show(st.progress); },
    });
  }

  function setupTilt(el) {
    if (!fine || !animate) return;
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    gsap.set(el, { transformPerspective: 1100 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
      rx((0.5 - y) * 7); ry((x - 0.5) * 9);
      el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }

  function setup() {
    if (ctx) ctx.revert();
    const bands = $$('.fb');
    if (!bands.length) return;
    if (!animate) { $$('[data-scan]').forEach((f) => setupScan(f.closest('.fb'))); bands.forEach((b) => b.classList.add('is-in')); playVideos(true); return; }
    ctx = gsap.context(() => {
      $$('[data-scan]').forEach((f) => setupScan(f.closest('.fb')));
      bands.forEach((band) => {
        // words: kicker, then title lines, then text
        const title = band.querySelector('.fb-title');
        const split = window.SplitText ? SplitText.create(title, { type: 'lines', mask: 'lines' }) : null;
        const tl = gsap.timeline({ scrollTrigger: { trigger: band, start: 'top 78%', toggleActions: 'play none none none' }, onStart: () => band.classList.add('is-in') });
        tl.from(band.querySelector('.fb-kicker'), { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out' })
          .from(split ? split.lines : title, { yPercent: 105, duration: 1.1, stagger: 0.08, ease: 'expo.out' }, '<0.05')
          .from($$('.fb-text, .fb-switch, .fb-read, .fb-hint', band), { y: 18, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' }, '<0.2');
      });

      // picture reveals and parallax inside the frame
      $$('.fb-hand .fb-main').forEach((el) => {
        gsap.fromTo(el, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 30%', scrub: 0.8 } });
      });
      $$('.fb-wide .fb-main, .fb-frame').forEach((el) => {
        gsap.fromTo(el, { clipPath: 'inset(14% 10% 14% 10% round 40px)' }, {
          clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 45%', scrub: 0.8 },
        });
      });
      $$('.fb-par img').forEach((im) => {
        if (im.closest('.fb-wide')) return; // keep the crop fixed
        gsap.fromTo(im, { yPercent: -7, scale: 1.18 }, {
          yPercent: 7, scale: 1.1, ease: 'none',
          scrollTrigger: { trigger: im.closest('.fb-pic'), start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
      $$('.fb-float').forEach((el) => {
        const k = Number(el.dataset.speed) || 1;
        gsap.fromTo(el, { y: 70 * k }, { y: -50 * k, ease: 'none', scrollTrigger: { trigger: el.closest('.fb'), start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      // film reel: sideways while scrolling down
      $$('.fb-film').forEach((reel) => {
        const track = reel.querySelector('.fb-track');
        gsap.fromTo(track, { x: () => reel.clientWidth * 0.25 }, {
          x: () => -(track.scrollWidth - reel.clientWidth * 0.75), ease: 'none',
          scrollTrigger: { trigger: reel, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
        });
        $$('li', track).forEach((li) => {
          gsap.fromTo(li, { rotationY: -18, z: -60 }, {
            rotationY: 18, z: -60, ease: 'none', transformPerspective: 900,
            scrollTrigger: { trigger: reel, start: 'top bottom', end: 'bottom top', scrub: true },
          });
        });
      });

      // video grows to the full width
      $$('[data-grow]').forEach((stage) => {
        gsap.fromTo(stage.querySelector('.fb-overlay'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: stage, start: 'top 45%', end: 'top 10%', scrub: 0.8 } });
        gsap.fromTo(stage, { clipPath: 'inset(8% 12% 8% 12% round 36px)' }, {
          clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: stage, start: 'top 90%', end: 'top 10%', scrub: 0.8 },
        });
        gsap.fromTo(stage.querySelector('video'), { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: stage, start: 'top 90%', end: 'top 10%', scrub: 0.8 } });
      });
    });
    $$('[data-tilt]').forEach(setupTilt);
    playVideos(false);
    ScrollTrigger.refresh();
  }

  // play clips only while they are on screen
  let vio = null;
  function playVideos(still) {
    if (vio) vio.disconnect();
    if (still || !('IntersectionObserver' in window)) return;
    vio = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }), { threshold: 0.15 });
    $$('.fb video').forEach((v) => vio.observe(v));
  }

  document.addEventListener('wall:update', () => requestAnimationFrame(setup));
  if (document.readyState !== 'loading') setup(); else document.addEventListener('DOMContentLoaded', setup);
  window.addEventListener('load', () => hasGsap && ScrollTrigger.refresh());
})();
