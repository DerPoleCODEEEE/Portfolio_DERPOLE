/* ==========================================================================
   DerPole – Portfolio · Vanilla JS
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Einstellungen: hier anpassen ---------- */
  const CONFIG = {
    discordUrl: '',            // z. B. 'https://discord.gg/xxxx' oder 'https://discord.com/users/<ID>'
    discordHandle: '@derpole_', // angezeigter Discord-Name
    formEndpoint: '/api/contact', // eigener Server (server.js) schickt die Anfrage an Discord. Leer = nur Vorschau.
  };

  /* ---------- Daten für die Diagramme (öffentlich, Stand 25.10.2026) ---------- */
  // TikTok @the_cager: [Upload-Datum (aus der Video-ID), Aufrufe]
  const TIKTOK = [
    ['2026-08-14', 1582], ['2026-08-25', 3770], ['2026-08-28', 310], ['2026-08-29', 1164],
    ['2026-08-30', 64100], ['2026-08-31', 6602], ['2026-08-31', 2942], ['2026-09-01', 1595],
    ['2026-09-01', 267], ['2026-09-02', 1809], ['2026-09-03', 663], ['2026-09-06', 1872],
    ['2026-09-06', 9002], ['2026-09-08', 3973], ['2026-09-09', 2439], ['2026-09-11', 1169],
    ['2026-09-11', 2657], ['2026-09-13', 806],
  ];
  // YouTube Shorts @thecager: Aufrufe, älteste zuerst
  const SHORTS = [
    2441, 1494, 1350, 1527, 1186, 2732, 1502, 9334, 1395, 1966, 1412, 1132, 1326, 1374, 3993, 1048, 1490, 6127,
    4777, 2054, 3181, 8134, 2787, 26957, 28007, 1443, 1266, 4143, 1301, 11612, 1510, 1633, 1700, 2945, 1608,
  ];
  // Ab wann ich mitgearbeitet habe: erstes TikTok (Datum) und erster Short (Nummer, 1 = ältester)
  const JOINED = { tiktok: '2026-08-30', short: 15 };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const doc = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* privat / blockiert */ } },
  };
  const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  /* ======================================================================
     Übersetzungen. Deutsch steht im HTML, hier nur Englisch.
     ====================================================================== */
  const EN = {
    'a11y.skip': 'Skip to content',
    'nav.editor': 'Editor', 'nav.services': 'Services', 'nav.showcase': 'Work', 'nav.pricing': 'Packages',
    'nav.faq': 'FAQ', 'nav.login': 'Login', 'nav.cta': 'Message me', 'nav.menu': 'Menu',

    'hero.kicker': 'Open for new work',
    'hero.title': 'Hey, I’m <mark>DerPole</mark>.',
    'hero.lead': 'I edit chess videos, draw emotes and badges for Twitch and code chess games for streams.',
    'hero.cta1': 'Message me', 'hero.cta2': 'See my work',
    'hero.wall': 'Emotes and badges for TheCager',

    'editor.eyebrow': 'Editor', 'editor.title': 'My chess editor',
    'editor.text': 'I wrote it myself. In a stream clip I mark the facecam and the board, and it turns that into a vertical video. The editor knows every square, so arrows and highlights land exactly where they should. It also reads PGN files.',
    'editor.mockLabel': 'Demo: facecam and board are picked from a stream clip and arranged as a vertical Short',
    'editor.board': 'Board ✓', 'editor.fx': 'Effects', 'editor.squares': '64/64 squares detected',
    'editor.c1': 'Square', 'editor.c2': 'Arrow', 'editor.views': 'views',
    'editor.s1': 'Select', 'editor.s2': 'Vertical', 'editor.s3': 'Squares', 'editor.s4': 'Effects',

    'services.eyebrow': 'Services', 'services.title': 'What I do',
    's1.title': 'Chess videos', 's1.text': 'Shorts and TikToks from your stream clips. Longer YouTube videos too.',
    's2.title': 'Twitch graphics', 's2.text': 'Emotes, sub badges, overlays, panels and banners.',
    's3.title': 'Code', 's3.text': 'Websites and chess modes for streams, for example the <a href="#hub">Cagers Game Hub</a>.',
    'more.title': 'Also:', 'more.text': 'Thumbnails, clips from VODs, subtitles, titles and hashtags, game reviews.',

    'show.eyebrow': 'Work', 'show.title': 'For TheCager',
    'show.story': 'I’ve worked with TheCager since he started streaming. His channel has grown from 0 to over 1,000 followers since then, and he’s now a Chess.com streamer.',
    'show.tt.title': 'TikToks',
    'show.tt.note': 'Videos only load when you click them. That sends data to TikTok.',
    'show.tt.all': 'Load all', 'show.tt.views': 'views', 'show.tt.load': 'Play', 'show.tt.open': 'Open on TikTok ↗',
    'carousel.prev': 'Previous videos', 'carousel.next': 'Next videos',
    'show.an.title': 'Views', 'show.an.meta': 'TikTok and YouTube Shorts, as of Oct 25, 2026',
    'show.c1.title': 'TikTok, total', 'show.c1.label': 'Line chart: views on TikTok',
    'show.c2.title': 'Shorts, per video', 'show.c2.meta': 'oldest on the left', 'show.c2.label': 'Bar chart: views per Short',
    'show.table': 'Show as table',
    'show.tw.title': 'Twitch graphics', 'show.tw.badges': 'Sub badges', 'show.tw.panels': 'Panels',
    'b.1': '1 month', 'b.2': '2 months', 'b.3': '3 months', 'b.6': '6 months', 'b.9': '9 months', 'b.12': '1 year', 'b.18': '1.5 years',
    'show.hub.open': 'View live',
    'show.hub.text': 'A games site for TheCager’s community, with Twitch login, chat and its own chess modes.',
    'show.hub.m0': 'Home', 'show.hub.m0t': 'Login, chat, leaderboard',
    'show.hub.m1t': 'Real time with cooldowns', 'show.hub.m2t': 'Pieces merge', 'show.hub.m3t': 'Bot in TheCager’s style', 'show.hub.m4t': 'Predict moves',

    'price.eyebrow': 'Packages', 'price.title': 'What do you need?',
    'price.lead': 'Click what you’re interested in, your picks end up in the form below. We agree on the price afterwards, small channels included.',
    'price.filter': 'Filter packages',
    'cat.all': 'All', 'cat.video': 'Video', 'cat.stream': 'Twitch', 'cat.code': 'Code', 'cat.extra': 'Extras',
    'pick.add': 'Select', 'pick.added': 'Selected', 'pick.bar': 'selected', 'pick.go': 'Continue',
    'k1.name': 'Chess short', 'k1.desc': 'Short or TikTok, up to 60 seconds',
    'k2.name': 'YouTube video', 'k2.desc': 'Longer video with thumbnail',
    'k3.desc': 'Static or animated',
    'k4.name': 'Sub badges', 'k4.desc': 'For every sub tier',
    'k5.name': 'Stream overlay', 'k5.desc': 'Facecam frame, alerts, scenes',
    'k6.name': 'Panels &amp; banner', 'k6.desc': 'For your channel page',
    'k12.name': 'Custom website', 'k12.desc': 'Portfolio, link page or more',
    'k13.name': 'Chess mode', 'k13.desc': 'Your own rules, playable in the browser',
    'k14.name': 'Stream tools', 'k14.desc': 'Chat commands, overlays with live data',
    'k7.desc': 'For YouTube, 1920 × 1080',
    'k8.name': 'Clips from streams', 'k8.desc': 'Short clips from your VODs',
    'k9.name': 'Subtitles', 'k9.desc': 'German or English',
    'k10.name': 'Titles &amp; hashtags', 'k10.desc': 'For YouTube, TikTok and Twitch',
    'k11.name': 'Game review', 'k11.desc': 'The interesting moments of your game, with a script if you want',

    'faq.eyebrow': 'FAQ', 'faq.title': 'Common questions',
    'faq.q1': 'What does it cost?', 'faq.a1': 'Depends. Tell me what you need and you get a fixed price up front.',
    'faq.q2': 'How long does it take?', 'faq.a2': 'A short usually takes 1 to 3 days, emotes and badges about a week.',
    'faq.q3': 'How do I get a client account?', 'faq.a3': 'Message me. After a quick chat I send you your login. In the portal you send requests and see how far along I am.',
    'faq.q4': 'Do you work in English?', 'faq.a4': 'Yes, German and English.',

    'contact.eyebrow': 'Contact', 'contact.title': 'Message me', 'contact.login': 'Already a client? Log in',
    'f.name': 'Name / channel', 'f.namePh': 'e.g. TheCager', 'f.email': 'Email',
    'f.err.required': 'Still missing.', 'f.err.email': 'That email doesn’t look right.',
    'f.service': 'What do you need? (pick several)', 'f.err.choice': 'Pick at least one.',
    'f.budget': 'Budget (rough, optional)', 'f.b0': 'Not sure yet', 'f.deadline': 'By when?',
    'f.message': 'Message', 'f.messagePh': 'What do you need? A link to your channel helps.',
    'f.privacy': 'I’ve read the <a href="datenschutz.html">privacy policy</a> and agree that my details are stored for this request.',
    'f.submit': 'Send',

    'footer.imprint': 'Imprint', 'footer.privacy': 'Privacy',
  };

  const TEXT = {
    de: {
      locale: 'de-DE',
      title: 'DerPole · Schachvideos & Twitch-Grafiken',
      marquee: [['Schach-Video-Editing', 'knight'], ['Emotes', 'smile'], ['Sub-Badges', 'badge'], ['Overlays', 'layers'], ['Websites', 'globe'], ['Schach-Modi', 'board'], ['Stream-Tools', 'tool'], ['Thumbnails', 'image'], ['Shorts & Clips', 'scissors'], ['Untertitel', 'cc']],
      other: 'Was anderes',
      formInvalid: 'Da fehlt noch was, schau mal bei den markierten Feldern.',
      formSending: 'Wird geschickt …',
      formOk: 'Danke, ist angekommen! Ich meld mich.',
      formFail: 'Hat nicht geklappt. Probier’s später nochmal oder schreib mir auf Discord.',
      formPreview: 'Das Formular ist noch nicht angeschlossen. Schreib mir solange einfach auf Discord.',
      ttTitle: 'TikTok-Video von @the_cager',
      chart: { date: 'Datum', views: 'Aufrufe', video: 'Video', total: 'Gesamt', short: 'Short', of: 'von', newVideo: 'neues Video', mark: 'ab hier mit mir →' },
      capTT: (b, a) => `Jeder Punkt ist ein Video. Durchschnitt pro Video: vorher ${b}, ab dem Marker ${a} Aufrufe.`,
      capSh: (b, a) => `Durchschnitt pro Short: vorher ${b}, ab dem Marker ${a} Aufrufe.`,
    },
    en: {
      locale: 'en-US',
      title: 'DerPole · Chess Videos & Twitch Graphics',
      marquee: [['Chess video editing', 'knight'], ['Emotes', 'smile'], ['Sub badges', 'badge'], ['Overlays', 'layers'], ['Websites', 'globe'], ['Chess modes', 'board'], ['Stream tools', 'tool'], ['Thumbnails', 'image'], ['Shorts & clips', 'scissors'], ['Subtitles', 'cc']],
      other: 'Something else',
      formInvalid: 'Something’s missing, check the highlighted fields.',
      formSending: 'Sending …',
      formOk: 'Thanks, got it! I’ll get back to you.',
      formFail: 'That didn’t work. Try again later or message me on Discord.',
      formPreview: 'The form isn’t connected yet. Just message me on Discord in the meantime.',
      ttTitle: 'TikTok video by @the_cager',
      chart: { date: 'Date', views: 'Views', video: 'Video', total: 'Total', short: 'Short', of: 'of', newVideo: 'new video', mark: 'I joined here →' },
      capTT: (b, a) => `Each dot is one video. Average per video: ${b} before, ${a} views from the marker on.`,
      capSh: (b, a) => `Average per short: ${b} before, ${a} views from the marker on.`,
    },
  };

  /* Deutsche Originaltexte aus dem HTML einsammeln */
  const DE = {};
  const i18nEls = $$('[data-i18n]');
  i18nEls.forEach((el) => { if (!(el.dataset.i18n in DE)) DE[el.dataset.i18n] = el.innerHTML.trim(); });
  const attrEls = $$('[data-i18n-attr]').map((el) => ({
    el,
    pairs: el.dataset.i18nAttr.split(';').map((p) => {
      const [attr, key] = p.split(':').map((s) => s.trim());
      if (!(key in DE)) DE[key] = el.getAttribute(attr) || '';
      return { attr, key };
    }),
  }));

  let lang = 'de';
  const t = (key) => (lang === 'en' && key in EN ? EN[key] : DE[key]);
  const L = () => TEXT[lang];
  const langListeners = [];

  function applyLang(next, first = false) {
    lang = next === 'en' ? 'en' : 'de';
    doc.lang = lang;
    document.title = L().title;

    i18nEls.forEach((el) => {
      const val = t(el.dataset.i18n);
      if (val == null) return;
      if (el.hasAttribute('data-split')) {
        el.innerHTML = val;
        splitWords(el);
        if (!first) el.classList.add('is-in');
      } else if (el.innerHTML.trim() !== val) {
        el.innerHTML = val;
      }
    });
    attrEls.forEach(({ el, pairs }) => pairs.forEach(({ attr, key }) => {
      const val = t(key);
      if (val != null) el.setAttribute(attr, val);
    }));
    $$('.lang__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    buildMarquee();
    $$('[data-count]').forEach((el) => { if (el.dataset.done) el.textContent = formatNum(+el.dataset.count, +(el.dataset.decimals || 0)); });
    $$('.tt iframe').forEach((f) => { f.title = L().ttTitle; });
    langListeners.forEach((fn) => fn());
    store.set('lang', lang);
  }
  $$('.lang__btn').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

  /* ---------- Wörter für die Headline-Animation aufteilen ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            const inner = document.createElement('span');
            w.className = 'w';
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.append(inner);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          walk(n);
        }
      });
    };
    walk(el);
    el.classList.add('is-split');
  }

  /* ---------- Laufband ---------- */
  const marquee = $('[data-marquee]');
  function buildMarquee() {
    if (!marquee) return;
    const html = L().marquee.map(([s, ic]) => `<span class="marquee__item">${s.replace(/&/g, '&amp;')}${icon(ic)}</span>`).join('');
    marquee.innerHTML = html + html;
  }

  /* ---------- Zahlen ---------- */
  function formatNum(n, decimals = 0) {
    return n.toLocaleString(L().locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function fmtK(n) {
    if (n < 1000) return formatNum(n);
    const k = Math.round(n / 100) / 10;
    return `${formatNum(k, Number.isInteger(k) ? 0 : 1)}K`;
  }
  function countUp(el) {
    const target = +el.dataset.count;
    const decimals = +(el.dataset.decimals || 0);
    if (reduceMotion) { el.dataset.done = '1'; el.textContent = formatNum(target, decimals); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1800);
      const e = 1 - Math.pow(2, -10 * p);
      el.textContent = formatNum(p === 1 ? target : target * e, decimals);
      if (p < 1) requestAnimationFrame(tick); else el.dataset.done = '1';
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, idx) => {
      const el = e.target;
      el.style.setProperty('--d', `${idx * 80}ms`);
      el.classList.add('is-in');
      $$('[data-count]', el).forEach(countUp);
      revealIO.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  /* ---------- Navigation ---------- */
  const nav = $('[data-nav]');
  const burger = $('.nav__burger');
  burger?.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => {
    burger?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { burger.click(); burger.focus(); }
  });

  // Navigation oben und Zugliste am Rand markieren beide den aktuellen Abschnitt
  const navLinks = new Map();
  $$('.nav__links a, .movelist a').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    navLinks.set(id, [...(navLinks.get(id) || []), a]);
  });
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const links = navLinks.get(e.target.id);
      if (links && e.isIntersecting) {
        navLinks.forEach((ls) => ls.forEach((l) => l.classList.remove('is-active')));
        links.forEach((l) => l.classList.add('is-active'));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((_, id) => { const s = document.getElementById(id); if (s) sectionIO.observe(s); });

  /* ---------- Scroll: Fortschritt, Nav, Hero-Parallax, schwebende Figuren ---------- */
  const progress = $('.progress');
  const movelist = $('.movelist');
  const heroInner = $('.hero__inner');
  const decos = $$('.deco__p[data-speed]');
  let scrollTick = false;
  function onScroll() {
    const y = scrollY;
    const max = doc.scrollHeight - innerHeight;
    progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    nav.classList.toggle('is-scrolled', y > 12);
    movelist?.classList.toggle('is-visible', y > innerHeight * 0.6);
    if (!reduceMotion) {
      if (heroInner && y < innerHeight * 1.2) {
        heroInner.style.transform = `translate3d(0, ${y * 0.22}px, 0)`;
        heroInner.style.opacity = String(Math.max(0, 1 - y / (innerHeight * 0.85)));
      }
      decos.forEach((d) => {
        const r = d.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        d.style.setProperty('--py', `${(r.top * -+d.dataset.speed).toFixed(1)}px`);
      });
    }
    scrollTick = false;
  }
  addEventListener('scroll', () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- Maus-Effekte ---------- */
  function initPointerFx() {
    const cursor = $('.cursor') || document.createElement('div'); // Cursor-Ring ist optional
    let tx = -100, ty = -100, cx = -100, cy = -100;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('pointerover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, input, select, textarea, summary, [data-tilt]'));
    });
    const loop = () => {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.setProperty('--cx', `${cx}px`);
      cursor.style.setProperty('--cy', `${cy}px`);
      requestAnimationFrame(loop);
    };
    loop();

    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * 0.22}px, ${(e.clientY - (r.top + r.height / 2)) * 0.32}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 600);
      });
    });

    $$('[data-spotlight]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });

    const hero = $('.hero');
    const grid = $('.hero__grid');
    if (hero && grid) {
      hero.addEventListener('pointermove', (e) => {
        const r = grid.getBoundingClientRect();
        grid.style.setProperty('--mx', `${e.clientX - r.left}px`);
        grid.style.setProperty('--my', `${e.clientY - r.top}px`);
        grid.style.setProperty('--spot', 1);
      });
      hero.addEventListener('pointerleave', () => grid.style.setProperty('--spot', 0));
    }

    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', `${(0.5 - y) * 22}deg`);
        el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`);
        el.style.setProperty('--gx', `${x * 100}%`);
        el.style.setProperty('--gy', `${y * 100}%`);
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });

    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=<>/';
    $$('[data-scramble]').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointerenter', () => {
        cancelAnimationFrame(raf);
        const final = el.textContent && t(el.dataset.i18n) ? t(el.dataset.i18n) : el.textContent;
        let frame = 0;
        const run = () => {
          const reveal = frame / 2.2;
          el.textContent = [...final].map((ch, i) => (i < reveal || ch === ' ' ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join('');
          frame++;
          if (reveal < final.length) raf = requestAnimationFrame(run); else el.textContent = final;
        };
        run();
      });
    });
  }

  /* ---------- Dekorative Wellenform ---------- */
  function buildBars() {
    const wave = $('.wave');
    if (!wave) return;
    wave.innerHTML = Array.from({ length: 56 }, () => {
      const h = (0.15 + Math.random() * 0.5).toFixed(2);
      const h2 = (0.5 + Math.random() * 0.5).toFixed(2);
      return `<i style="--h:${h};--h2:${h2};--dl:${(-Math.random() * 1.6).toFixed(2)}s"></i>`;
    }).join('');
  }

  /* ---------- Editor-Demo: Stream-Clip -> Auswahl mit Snapping -> Hochformat -> Felder -> Effekte ---------- */
  function initEditorDemo() {
    const stage = $('[data-ed]');
    if (!stage) return;
    const mock = stage.closest('.editor-mock');
    const status = $('[data-ed-status]', mock);
    const cursor = $('.ed-cursor', stage);
    const selCam = $('[data-ed-sel="cam"]', stage);
    const selBoard = $('[data-ed-sel="board"]', stage);
    const outBoard = $('[data-ed-out]', stage);
    const chip = (k) => $(`[data-ed-chip="${k}"]`, stage);
    const exportBtn = $('[data-ed-export]', stage);

    // Stellung (Italienisch, Weiß kann gleich Lxf7+ spielen); Großbuchstaben = Weiß
    const POS = {
      g1: 'K', d1: 'Q', f1: 'R', c4: 'B', f3: 'N', e4: 'P', d3: 'P', f2: 'P', g2: 'P', h2: 'P', a2: 'P', b2: 'P',
      e8: 'k', d8: 'q', h8: 'r', c5: 'b', f6: 'n', c6: 'n', f7: 'p', e5: 'p', d6: 'p', g7: 'p', h7: 'p', a7: 'p', b7: 'p',
    };
    $$('[data-ed-board]', stage).forEach((board) => {
      const html = Object.entries(POS).map(([sq, p]) => {
        const white = p === p.toUpperCase();
        const x = 'abcdefgh'.indexOf(sq[0]) * 12.5;
        const y = (8 - +sq[1]) * 12.5;
        return `<svg class="pc pc--${white ? 'w' : 'b'}" style="left:${x}%;top:${y}%"><use href="#p-${p.toLowerCase()}"/></svg>`;
      }).join('');
      board.insertAdjacentHTML('afterbegin', html);
    });
    $('[data-ed-grid]', stage).innerHTML = Array.from({ length: 64 }, (_, i) => `<i style="--d:${(i % 8) + Math.floor(i / 8)}"></i>`).join('');

    // Positionen als Prozent der Bühne
    const rel = (el, fx = 0.5, fy = 0.5) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return [((r.left + r.width * fx) - s.left) / s.width * 100, ((r.top + r.height * fy) - s.top) / s.height * 100];
    };
    const bounds = (el) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { l: (r.left - s.left) / s.width * 100, t: (r.top - s.top) / s.height * 100, w: r.width / s.width * 100, h: r.height / s.height * 100 };
    };
    const setBox = (el, b, ms) => {
      el.style.transitionDuration = `${ms}ms`;
      Object.assign(el.style, { left: `${b.l}%`, top: `${b.t}%`, width: `${b.w}%`, height: `${b.h}%` });
    };
    const moveCursor = (x, y, ms) => {
      cursor.style.transitionDuration = `${ms}ms`;
      cursor.style.left = `${x}%`;
      cursor.style.top = `${y}%`;
    };
    const setStep = (n, label) => {
      $$('[data-ed-step]', mock).forEach((li) => {
        li.classList.toggle('is-on', +li.dataset.edStep === n);
        li.classList.toggle('is-done', +li.dataset.edStep < n);
      });
      status.textContent = label;
    };

    let token = 0;
    const sleep = (ms, tk) => new Promise((res, rej) => setTimeout(() => (tk === token ? res() : rej(new Error('stop'))), ms));
    const click = async (tk) => { cursor.classList.add('is-click'); await sleep(260, tk); cursor.classList.remove('is-click'); };

    function reset() {
      stage.classList.remove('is-out', 'is-squares', 'is-hl', 'is-arrow', 'is-badge', 'is-export', 'is-viral');
      $$('[data-ed-count]', stage).forEach((el) => { el.textContent = '0'; });
      outBoard.classList.remove('is-grid', 'is-grid-done');
      [selCam, selBoard].forEach((s) => { s.classList.remove('is-on', 'is-snapped'); s.style.transitionDuration = '0ms'; });
      $$('.ed-chip, .ed-export', stage).forEach((c) => c.classList.remove('is-on'));
      cursor.classList.remove('is-hidden', 'is-down');
      moveCursor(78, 82, 0);
    }

    // Rahmen grob aufziehen, loslassen, einrasten
    async function select(sel, target, off, tk) {
      const rough = { l: target.l - off[0], t: target.t - off[1], w: target.w + off[0] + off[2], h: target.h + off[1] + off[3] };
      moveCursor(rough.l, rough.t, 850);
      await sleep(950, tk);
      cursor.classList.add('is-down');
      setBox(sel, { l: rough.l, t: rough.t, w: 0, h: 0 }, 0);
      sel.classList.add('is-on');
      await sleep(40, tk);
      setBox(sel, rough, 900);
      moveCursor(rough.l + rough.w, rough.t + rough.h, 900);
      await sleep(1000, tk);
      cursor.classList.remove('is-down');
      setBox(sel, target, 280);
      sel.classList.add('is-snapped');
      await sleep(750, tk);
    }

    async function run(tk) {
      reset();
      await sleep(500, tk);
      setStep(1, 'SELECT');
      await select(selCam, bounds($('[data-ed-cam]', stage)), [1.8, 2.2, 2.4, 3.2], tk);
      await select(selBoard, bounds($('.ed-src__board', stage)), [2.2, 3, 3.4, 2.6], tk);
      await sleep(400, tk);

      setStep(2, '9:16');
      cursor.classList.add('is-hidden');
      stage.classList.add('is-out');
      await sleep(1500, tk);

      setStep(3, 'SQUARES');
      outBoard.classList.add('is-grid');
      await sleep(1400, tk);
      outBoard.classList.add('is-grid-done');
      stage.classList.add('is-squares');
      await sleep(500, tk);

      setStep(4, 'FX');
      const steps = [['hl', 'is-hl'], ['arrow', 'is-arrow'], ['badge', 'is-badge']];
      const [sx, sy] = rel(chip('hl'));
      moveCursor(sx + 6, sy + 14, 0);
      cursor.classList.remove('is-hidden');
      for (const [k, cls] of steps) {
        const [x, y] = rel(chip(k), 0.35, 0.6);
        moveCursor(x, y, 650);
        await sleep(750, tk);
        await click(tk);
        chip(k).classList.add('is-on');
        stage.classList.add(cls);
        await sleep(900, tk);
      }

      setStep(5, 'EXPORT');
      const [ex, ey] = rel(exportBtn, 0.4, 0.6);
      moveCursor(ex, ey, 700);
      await sleep(800, tk);
      await click(tk);
      exportBtn.classList.add('is-on');
      stage.classList.add('is-export');
      await sleep(1300, tk);

      // Hochgeladen: Aufrufe, Likes und Kommentare zählen hoch
      setStep(6, 'LIVE');
      cursor.classList.add('is-hidden');
      stage.classList.add('is-viral');
      countUp(tk);
      await sleep(4400, tk);
    }

    function countUp(tk) {
      const els = $$('[data-ed-count]', stage);
      const t0 = performance.now();
      const tick = (now) => {
        if (tk !== token) return;
        const p = Math.min(1, (now - t0) / 2800);
        const e = 1 - Math.pow(1 - p, 3);
        els.forEach((el) => { el.textContent = fmtK(Math.round(+el.dataset.edCount * e)); });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    async function loop() {
      const tk = ++token;
      try {
        while (tk === token) await run(tk);
      } catch { /* angehalten */ }
    }

    // Ohne Bewegung: direkt das fertige Ergebnis zeigen
    if (reduceMotion) {
      stage.classList.add('is-out', 'is-squares', 'is-hl', 'is-arrow', 'is-badge', 'is-viral');
      $$('[data-ed-count]', stage).forEach((el) => { el.textContent = fmtK(+el.dataset.edCount); });
      outBoard.classList.add('is-grid', 'is-grid-done');
      $$('[data-ed-chip]', stage).forEach((c) => c.classList.add('is-on'));
      cursor.classList.add('is-hidden');
      setStep(4, 'FX');
      return;
    }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) loop();
      else token++;
    }, { threshold: 0.3 }).observe(stage);
  }

  /* ======================================================================
     Diagramme (SVG, ohne Bibliothek)
     ====================================================================== */
  const niceMax = (v, steps = 4) => {
    const raw = v / steps;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = [1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) * mag;
    return n * steps;
  };
  const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(L().locale, { day: 'numeric', month: 'short' });

  function makeTip(el) {
    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    el.append(tip);
    return {
      show(x, y, html) { tip.innerHTML = html; tip.style.left = `${x}px`; tip.style.top = `${y}px`; tip.classList.add('is-on'); },
      hide() { tip.classList.remove('is-on'); },
    };
  }

  function yAxis(W, pad, h, max, ticks) {
    let s = '<g class="grid axis">';
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      const y = pad.t + h - (v / max) * h;
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 8}" y="${y + 3.5}" text-anchor="end">${v ? fmtK(v) : 0}</text>`;
    }
    return `${s}</g>`;
  }

  function lineChart(el) {
    const W = el.clientWidth, H = el.clientHeight;
    const pad = { l: 44, r: 20, t: 22, b: 26 };
    const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
    let sum = 0;
    const pts = TIKTOK.map(([d, v]) => ({ d, v, c: (sum += v), t: Date.parse(d) }));
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    // Uploads am selben Tag leicht auseinanderziehen
    const seen = {};
    pts.forEach((p) => { const k = seen[p.d] = (seen[p.d] || 0) + 1; p.t += (k - 1) * 0.35 * 864e5; });
    const max = niceMax(sum);
    const X = (tt) => pad.l + ((tt - t0) / (t1 - t0)) * w;
    const Y = (v) => pad.t + h - (v / max) * h;
    pts.forEach((p) => { p.x = X(p.t); p.y = Y(p.c); });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    const area = `${line}L${pts[pts.length - 1].x.toFixed(1)},${pad.t + h}L${pts[0].x.toFixed(1)},${pad.t + h}Z`;
    const xl = [pts[0], pts[4], pts[pts.length - 1]];
    const last = pts[pts.length - 1];
    const c = L().chart;
    // Marker: ab hier habe ich mitgearbeitet (zwischen letztem Video davor und erstem mit mir)
    const mi = Math.max(0, pts.findIndex((p) => p.d >= JOINED.tiktok));
    const mx = mi > 0 ? (pts[mi - 1].x + pts[mi].x) / 2 : pts[0].x;

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c)" stop-opacity=".25"/><stop offset="1" style="stop-color:var(--c)" stop-opacity="0"/></linearGradient></defs>
      ${yAxis(W, pad, h, max, 4)}
      <g class="axis">${xl.map((p, i) => `<text x="${p.x}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${fmtDate(p.d)}</text>`).join('')}</g>
      <rect class="mark-zone" x="${mx}" y="${pad.t}" width="${W - pad.r - mx}" height="${h}"/>
      <line class="mark" x1="${mx}" x2="${mx}" y1="${pad.t - 6}" y2="${pad.t + h}"/>
      <text class="mark-label" x="${mx - 7}" y="${pad.t + 8}" text-anchor="end">${c.mark}</text>
      <path class="area" d="${area}"/>
      <path class="line" d="${line}" pathLength="1"/>
      <line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + h}" opacity="0"/>
      ${pts.map((p, i) => `<circle class="dot" cx="${p.x}" cy="${p.y}" r="4" style="--i:${i}"/>`).join('')}
      <text class="label" x="${last.x}" y="${last.y - 12}" text-anchor="end">${fmtK(last.c)}</text>
      <rect class="hit" x="${pad.l}" y="${pad.t}" width="${w}" height="${h}"/>
    </svg>`;

    const tip = makeTip(el);
    const svg = $('svg', el);
    const cross = $('.cross', svg);
    const dots = $$('.dot', svg);
    const hit = $('.hit', svg);
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const mx = (e.clientX - r.left) * (W / r.width);
      let best = 0;
      pts.forEach((p, i) => { if (Math.abs(p.x - mx) < Math.abs(pts[best].x - mx)) best = i; });
      const p = pts[best];
      dots.forEach((d, i) => d.classList.toggle('is-active', i === best));
      cross.setAttribute('x1', p.x); cross.setAttribute('x2', p.x); cross.setAttribute('opacity', 1);
      tip.show(p.x * (r.width / W), p.y * (r.height / H),
        `<small>${fmtDate(p.d)} · ${c.newVideo}</small><b>+${formatNum(p.v)}</b> ${c.views}<small>${c.total}: ${formatNum(p.c)}</small>`);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { tip.hide(); cross.setAttribute('opacity', 0); dots.forEach((d) => d.classList.remove('is-active')); });
  }

  function barChart(el) {
    const W = el.clientWidth, H = el.clientHeight;
    const pad = { l: 40, r: 6, t: 22, b: 26 };
    const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
    const max = niceMax(Math.max(...SHORTS), 3);
    const band = w / SHORTS.length;
    const bw = Math.max(2, band - 2);
    const top = Math.max(...SHORTS);
    const bar = (x, y, bwid, bh) => {
      const r = Math.min(4, bwid / 2, bh);
      return `M${x},${y + bh}V${y + r}Q${x},${y} ${x + r},${y}H${x + bwid - r}Q${x + bwid},${y} ${x + bwid},${y + r}V${y + bh}Z`;
    };
    const c = L().chart;
    const si = JOINED.short - 1;
    const mx = pad.l + si * band;
    let bars = '', labels = '', hits = '';
    SHORTS.forEach((v, i) => {
      const x = pad.l + i * band + 1;
      const bh = (v / max) * h;
      const y = pad.t + h - bh;
      bars += `<path class="bar${i < si ? ' bar--before' : ''}" d="${bar(x, y, bw, bh)}" style="--i:${i}"/>`;
      if (v === top) labels += `<text class="label" x="${x + bw / 2}" y="${y - 7}" text-anchor="${i > SHORTS.length - 4 ? 'end' : 'middle'}">${fmtK(v)}</text>`;
      hits += `<rect class="hit" x="${pad.l + i * band}" y="${pad.t}" width="${band}" height="${h}" data-i="${i}"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      ${yAxis(W, pad, h, max, 3)}
      <g class="axis"><text x="${pad.l}" y="${H - 6}">#1</text><text x="${W - pad.r}" y="${H - 6}" text-anchor="end">#${SHORTS.length}</text></g>
      <rect class="mark-zone" x="${mx}" y="${pad.t}" width="${W - pad.r - mx}" height="${h}"/>
      <line class="mark" x1="${mx}" x2="${mx}" y1="${pad.t - 6}" y2="${pad.t + h}"/>
      <text class="mark-label" x="${mx - 7}" y="${pad.t + 8}" text-anchor="end">${c.mark}</text>
      <g class="bars">${bars}</g>${labels}${hits}
    </svg>`;

    const tip = makeTip(el);
    const svg = $('svg', el);
    const barEls = $$('.bar', svg);
    $$('.hit', svg).forEach((r) => {
      r.addEventListener('pointerenter', () => {
        const i = +r.dataset.i;
        const v = SHORTS[i];
        const rect = svg.getBoundingClientRect();
        barEls.forEach((b, j) => b.classList.toggle('is-active', j === i));
        el.classList.add('has-hover');
        const x = (pad.l + i * band + band / 2) * (rect.width / W);
        const y = (pad.t + h - (v / max) * h) * (rect.height / H);
        tip.show(x, y, `<small>${c.short} ${i + 1} ${c.of} ${SHORTS.length}</small><b>${formatNum(v)}</b> ${c.views}`);
      });
    });
    svg.addEventListener('pointerleave', () => { tip.hide(); el.classList.remove('has-hover'); barEls.forEach((b) => b.classList.remove('is-active')); });
  }

  function buildTables() {
    const c = L().chart;
    const tt = $('[data-table="tiktok"]');
    const sh = $('[data-table="shorts"]');
    let sum = 0;
    if (tt) tt.innerHTML = `<table><thead><tr><th>${c.date}</th><th>${c.views}</th><th>${c.total}</th></tr></thead><tbody>${
      TIKTOK.map(([d, v]) => `<tr><td>${fmtDate(d)}</td><td>${formatNum(v)}</td><td>${formatNum((sum += v))}</td></tr>`).join('')}</tbody></table>`;
    if (sh) sh.innerHTML = `<table><thead><tr><th>${c.short}</th><th>${c.views}</th></tr></thead><tbody>${
      SHORTS.map((v, i) => `<tr><td>#${i + 1}</td><td>${formatNum(v)}</td></tr>`).join('')}</tbody></table>`;
  }

  // Bildunterschriften: Schnitt vorher gegen nachher, direkt aus den Daten gerechnet
  function buildCaps() {
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const caps = {
      tiktok: [TIKTOK.filter(([d]) => d < JOINED.tiktok).map(([, v]) => v), TIKTOK.filter(([d]) => d >= JOINED.tiktok).map(([, v]) => v), L().capTT],
      shorts: [SHORTS.slice(0, JOINED.short - 1), SHORTS.slice(JOINED.short - 1), L().capSh],
    };
    Object.entries(caps).forEach(([key, [before, after, tpl]]) => {
      const el = $(`[data-cap="${key}"]`);
      if (!el || !before.length || !after.length) return;
      const b = avg(before), a = avg(after);
      el.textContent = tpl(fmtK(Math.round(b)), fmtK(Math.round(a)), formatNum(a / b, 1));
    });
  }

  function initCharts() {
    const charts = [[$('[data-chart="tiktok"]'), lineChart], [$('[data-chart="shorts"]'), barChart]].filter(([el]) => el);
    const draw = () => charts.forEach(([el, fn]) => fn(el));
    draw();
    buildTables();
    buildCaps();
    langListeners.push(() => { draw(); buildTables(); buildCaps(); });
    let rt = 0;
    new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(draw, 120); }).observe(charts[0][0].parentElement);
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-drawn'); io.unobserve(e.target); }
    }), { threshold: 0.35 });
    charts.forEach(([el]) => io.observe(el));
  }

  /* ---------- TikTok: erst nach Klick laden (Datenschutz) ---------- */
  function loadTikTok(card) {
    if (card.classList.contains('is-loaded')) return;
    card.classList.add('is-loaded');
    const frame = $('.tt__frame', card);
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.tiktok.com/player/v1/${card.dataset.tiktok}?music_info=0&description=0&rel=0`;
    iframe.title = L().ttTitle;
    iframe.allow = 'encrypted-media; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.classList.add('is-loading');
    iframe.addEventListener('load', () => frame.classList.remove('is-loading'));
    frame.replaceChildren(iframe);
  }

  function initTikTok() {
    const cards = $$('.tt[data-tiktok]');
    cards.forEach((card) => $('[data-tt-load]', card)?.addEventListener('click', () => loadTikTok(card)));
    const lazyIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { loadTikTok(e.target); lazyIO.unobserve(e.target); } });
    }, { rootMargin: '200px' });
    const allBtn = $('[data-tt-all]');
    const allowAll = () => { store.set('tt-consent', '1'); cards.forEach((c) => lazyIO.observe(c)); if (allBtn) allBtn.hidden = true; };
    allBtn?.addEventListener('click', allowAll);
    if (store.get('tt-consent') === '1') allowAll();

    const track = $('.tiktoks');
    const prev = $('[data-carousel="prev"]');
    const next = $('[data-carousel="next"]');
    if (!track || !prev || !next) return;
    const stepSize = () => (cards[0]?.getBoundingClientRect().width || 280) + 16;
    prev.addEventListener('click', () => track.scrollBy({ left: -stepSize(), behavior: reduceMotion ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: stepSize(), behavior: reduceMotion ? 'auto' : 'smooth' }));
    const update = () => {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4;
    };
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- Showcase Game Hub: Screenshots durchklicken, läuft sonst langsam von selbst ---------- */
  function initHub() {
    const hub = $('[data-hub]');
    if (!hub) return;
    const img = $('[data-hub-img]', hub);
    const url = $('[data-hub-url]', hub);
    const bar = $('[data-hub-progress]', hub);
    const modes = $$('.hub__mode', hub);
    const HOST = 'cagers-quick-chess.onrender.com';
    const MS = 6000;
    let idx = 0;
    let timer = 0;
    let auto = !reduceMotion;
    let visible = false;

    const restartBar = () => {
      bar.classList.remove('is-running');
      void bar.offsetWidth;
      if (auto && visible) bar.classList.add('is-running');
    };
    const schedule = () => {
      clearTimeout(timer);
      if (auto && visible) timer = setTimeout(() => show((idx + 1) % modes.length), MS);
    };

    function show(i) {
      idx = i;
      const m = modes[i];
      modes.forEach((b) => b.setAttribute('aria-pressed', String(b === m)));
      url.textContent = HOST + m.dataset.path;
      hub.style.setProperty('--hub-c', getComputedStyle(m).getPropertyValue('--c'));
      img.classList.add('is-swapping');
      setTimeout(() => {
        img.onload = () => img.classList.remove('is-swapping');
        img.src = `assets/hub/${m.dataset.shot}.png`;
        img.alt = `Screenshot: ${$('b', m).textContent}`;
        if (img.complete) img.classList.remove('is-swapping');
      }, 220);
      restartBar();
      schedule();
    }

    // Screenshots vorladen, damit der Wechsel sofort klappt
    hub.style.setProperty('--hub-ms', `${MS}ms`);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) modes.forEach((m) => { new Image().src = `assets/hub/${m.dataset.shot}.png`; });
      restartBar();
      schedule();
    }, { threshold: 0.35 }).observe(hub);

    modes.forEach((m, i) => m.addEventListener('click', () => {
      auto = false; // wer selbst klickt, behält die Kontrolle
      show(i);
    }));
  }

  /* ======================================================================
     Pakete: Filter + Auswahl, synchron mit dem Formular
     ====================================================================== */
  const selected = new Set();
  function initPackages() {
    const pkgs = $$('.pkg[data-id]');
    const choice = $('[data-choice]');
    const bar = $('[data-pickbar]');
    const count = $('[data-pick-count]');
    if (!pkgs.length || !choice) return;

    // Formular-Optionen aus den Karten bauen (eine Quelle für Namen und Icons)
    const meta = pkgs.map((p) => ({ id: p.dataset.id, el: p, cat: p.dataset.cat, icon: $('.pkg__icon use', p).getAttribute('href').slice(3) }));
    choice.innerHTML = [...meta, { id: 'other', cat: 'other', icon: 'pawn' }].map((m) =>
      `<label data-cat="${m.cat}"><input type="checkbox" name="services" value="${m.id}"><span>${icon(m.icon)}<span data-name="${m.id}"></span></span></label>`).join('');
    const syncNames = () => {
      meta.forEach((m) => { $(`[data-name="${m.id}"]`, choice).textContent = $('.pkg__name', m.el).textContent; });
      $('[data-name="other"]', choice).textContent = L().other;
    };
    syncNames();
    langListeners.push(syncNames);

    let contactVisible = false;
    const render = (bump) => {
      meta.forEach((m) => {
        const on = selected.has(m.id);
        m.el.classList.toggle('is-selected', on);
        $('.pkg__pick', m.el).setAttribute('aria-pressed', String(on));
      });
      $$('input', choice).forEach((inp) => { inp.checked = selected.has(inp.value); });
      const n = [...selected].filter((id) => id !== 'other').length;
      count.textContent = n;
      bar.hidden = n === 0 || contactVisible;
      if (bump) { bar.classList.remove('is-bump'); void bar.offsetWidth; bar.classList.add('is-bump'); }
      if (selected.size) $('.field--chips')?.classList.remove('is-invalid');
    };
    const toggle = (id) => { if (selected.has(id)) selected.delete(id); else selected.add(id); render(true); };

    meta.forEach((m) => $('.pkg__pick', m.el).addEventListener('click', () => toggle(m.id)));
    choice.addEventListener('change', (e) => { if (e.target.checked) selected.add(e.target.value); else selected.delete(e.target.value); render(false); });

    new IntersectionObserver(([e]) => { contactVisible = e.isIntersecting; render(false); }, { threshold: 0.15 }).observe($('#kontakt'));

    // Filter
    const filters = $$('[data-filter]');
    const setFilter = (cat) => {
      filters.forEach((f) => f.setAttribute('aria-pressed', String(f.dataset.filter === cat)));
      let k = 0;
      pkgs.forEach((p) => {
        const show = cat === 'all' || p.dataset.cat === cat;
        p.classList.toggle('is-hidden', !show);
        if (show) {
          p.classList.add('is-in');
          if (!reduceMotion) p.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: k++ * 45, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
        }
      });
    };
    filters.forEach((f) => f.addEventListener('click', () => setFilter(f.dataset.filter)));
    $$('[data-goto]').forEach((a) => a.addEventListener('click', () => setFilter(a.dataset.goto)));
  }

  /* ---------- Kontaktformular ---------- */
  function initForm() {
    const form = $('[data-form]');
    if (!form) return;
    const status = $('[data-form-status]');
    const setStatus = (msg, kind) => { status.textContent = msg; status.className = `form__status${kind ? ` is-${kind}` : ''}`; };
    const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    // form.elements statt form.name: form.name wäre das name-Attribut des Formulars selbst
    const f = form.elements;

    function validate() {
      const bad = [];
      const mark = (wrap, invalid) => { wrap.classList.toggle('is-invalid', invalid); if (invalid) bad.push(wrap); };
      mark(f.name.closest('.field'), !f.name.value.trim());
      mark(f.email.closest('.field'), !emailOk(f.email.value.trim()));
      mark(form.querySelector('.field--chips'), !form.querySelector('input[name="services"]:checked'));
      mark(f.message.closest('.field'), !f.message.value.trim());
      mark(f.privacy.closest('.check'), !f.privacy.checked);
      return bad;
    }

    form.addEventListener('input', (e) => {
      const wrap = e.target.closest('.field, .check');
      if (wrap?.classList.contains('is-invalid')) validate();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = validate();
      if (bad.length) {
        setStatus(L().formInvalid, 'error');
        bad[0].querySelector('input, textarea, select')?.focus();
        return;
      }
      if (!CONFIG.formEndpoint) { setStatus(L().formPreview, ''); return; }
      setStatus(L().formSending, '');
      try {
        const data = new FormData(form);
        // Lesbare Paketnamen mitschicken
        data.append('services_names', $$('input[name="services"]:checked', form).map((i) => i.nextElementSibling.textContent.trim()).join(', '));
        const res = await fetch(CONFIG.formEndpoint, { method: 'POST', body: data, headers: { Accept: 'application/json', 'X-Requested-With': 'derpole' } });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        selected.clear();
        $$('.pkg__pick').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        $$('.pkg').forEach((p) => p.classList.remove('is-selected'));
        setStatus(L().formOk, 'ok');
      } catch {
        setStatus(L().formFail, 'error');
      }
    });
  }

  /* ---------- Discord & Jahr ---------- */
  function initMisc() {
    $$('[data-discord-handle]').forEach((el) => { el.textContent = CONFIG.discordHandle; });
    const discord = $('[data-discord]');
    if (discord) {
      if (CONFIG.discordUrl) discord.href = CONFIG.discordUrl;
      else { discord.removeAttribute('href'); discord.removeAttribute('target'); discord.setAttribute('aria-disabled', 'true'); }
    }
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Start ---------- */
  // Standard ist Englisch; eine bewusst gewählte Sprache wird gemerkt
  applyLang(store.get('lang') || 'en', true);

  $$('[data-reveal]').forEach((el) => revealIO.observe(el));
  const heroTitle = $('.hero__title');
  requestAnimationFrame(() => requestAnimationFrame(() => heroTitle.classList.add('is-in')));
  if (!reduceMotion) $$('[data-count]').forEach((el) => { el.textContent = formatNum(0, +(el.dataset.decimals || 0)); });

  buildBars();
  initEditorDemo();
  initCharts();
  initTikTok();
  initHub();
  initPackages();
  initForm();
  initMisc();
  onScroll();
  if (finePointer && !reduceMotion) initPointerFx();
})();
