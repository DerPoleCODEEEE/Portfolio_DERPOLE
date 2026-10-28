/* ==========================================================================
   Gemeinsame Helfer für Login, Kundenportal und Admin-Bereich
   ========================================================================== */
'use strict';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Alles, was aus Eingaben kommt, wird vor dem Einsetzen in HTML maskiert
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="/icons.svg#i-${id}"/></svg>`;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* blockiert */ } },
};

const locale = () => (document.documentElement.lang === 'de' ? 'de-DE' : 'en-US');
const euro = (cents) => (cents == null ? null : (cents / 100).toLocaleString(locale(), { style: 'currency', currency: 'EUR' }));
const fmtDate = (iso) => {
  if (!iso) return '–';
  const d = iso.length > 10 ? new Date(`${iso.replace(' ', 'T')}Z`) : new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* Alle Anfragen an den Server laufen hierüber (mit Schutz-Header gegen fremde Seiten) */
async function api(url, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Requested-With': 'derpole' };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  let data = {};
  try { data = await res.json(); } catch { /* leere Antwort */ }
  if (res.status === 401 && !url.startsWith('/api/auth/')) { location.href = '/login'; throw new Error('unauthorized'); }
  if (!res.ok) { const err = new Error(data.error || 'error'); err.code = data.error || 'error'; err.status = res.status; throw err; }
  return data;
}

/* Kleine Übersetzungshilfe: data-t="key" (Text), data-t-ph="key" (Platzhalter) */
function makeI18n(dict, fallback = 'en') {
  let lang = store.get('lang') === 'de' ? 'de' : fallback;
  const t = (key) => dict[lang]?.[key] ?? dict.en?.[key] ?? key;
  const apply = () => {
    document.documentElement.lang = lang;
    $$('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    $$('[data-t-ph]').forEach((el) => { el.placeholder = t(el.dataset.tPh); });
    $$('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
    $$('.lang__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  };
  const set = (l) => { lang = l === 'de' ? 'de' : 'en'; store.set('lang', lang); apply(); };
  $$('.lang__btn').forEach((b) => b.addEventListener('click', () => { set(b.dataset.lang); document.dispatchEvent(new Event('langchange')); }));
  return { t, apply, set, get lang() { return lang; } };
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } finally { location.href = '/login'; }
}

const fmtDateTime = (iso) => {
  if (!iso) return '–';
  const d = new Date(`${iso.replace(' ', 'T')}Z`);
  return d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/* ---------- Dateien (gleiche Regeln wie auf dem Server) ---------- */
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'psd', 'ai', 'pdf', 'txt', 'md', 'pgn', 'mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'zip', '7z', 'ttf', 'otf', 'woff2'];
const MAX_FILE = 25 * 1024 * 1024;
const fileOk = (f) => ALLOWED_EXT.includes(f.name.split('.').pop().toLowerCase()) ? (f.size <= MAX_FILE ? null : 'file_too_large') : 'file_type';
const fileLink = (a) => `<a class="file-link" href="/api/files/${a.id}" download>${icon('box')}<span>${esc(a.original_name)}</span> <small>${fmtSize(a.size)}</small></a>`;

/* ---------- Fortschritt eines Auftrags (wie Züge auf dem Brett) ---------- */
const STATUS_FLOW = ['new', 'progress', 'review', 'done'];
function statusTrack(status, label) {
  if (status === 'cancelled') return `<div class="track track--cancelled">${icon('x')}<span>${esc(label('cancelled'))}</span></div>`;
  const idx = STATUS_FLOW.indexOf(status);
  return `<ol class="track">${STATUS_FLOW.map((s, i) => `
    <li class="${i < idx ? 'is-done' : ''}${i === idx ? ' is-on' : ''}">
      <span class="track__dot">${i < idx ? icon('check') : i + 1}</span><span class="track__label">${esc(label(s))}</span>
    </li>`).join('')}</ol>`;
}

/* ---------- Nachrichtenverlauf ---------- */
// t: { you, client, empty, system(status) }
function threadHtml(messages, viewer, t) {
  if (!messages.length) return `<li class="thread__empty">${esc(t.empty)}</li>`;
  return messages.map((m) => {
    if (m.author_role === 'system') {
      return `<li class="msg msg--system">${icon('board')}<span>${esc(t.system(String(m.body || '').replace('status:', '')))} · ${esc(fmtDateTime(m.created_at))}</span></li>`;
    }
    const mine = m.author_role === viewer;
    const who = mine ? t.you : m.author_role === 'admin' ? 'DerPole' : (m.author_name || t.client);
    return `<li class="msg msg--${m.author_role}${mine ? ' msg--mine' : ''}">
      <div class="msg__meta">${esc(who)} · ${esc(fmtDateTime(m.created_at))}</div>
      ${m.body ? `<p class="msg__body">${esc(m.body)}</p>` : ''}
      ${m.attachments.length ? `<div class="msg__files">${m.attachments.map(fileLink).join('')}</div>` : ''}
    </li>`;
  }).join('');
}

// Eingabefeld für Nachrichten mit Dateien; t: { placeholder, attach, send, sending, err(code) }
function composerHtml(t) {
  return `
  <form class="composer" data-composer novalidate>
    <textarea name="body" rows="3" maxlength="4000" placeholder="${esc(t.placeholder)}"></textarea>
    <ul class="files" data-composer-files></ul>
    <div class="composer__row">
      <label class="drop">${icon('plus')}<span>${esc(t.attach)}</span><input type="file" multiple data-composer-input></label>
      <button type="submit" class="btn btn--accent btn--sm">${esc(t.send)}${icon('arrow')}</button>
    </div>
    <p class="form__status" role="status" aria-live="polite" data-composer-status></p>
  </form>`;
}

function bindComposer(root, url, t, onSent) {
  const form = $('[data-composer]', root);
  const list = $('[data-composer-files]', root);
  const status = $('[data-composer-status]', root);
  const picked = [];
  const say = (msg, kind = '') => { status.textContent = msg; status.className = `form__status${kind ? ` is-${kind}` : ''}`; };
  const render = () => {
    list.innerHTML = picked.map((f, i) => `<li><span class="files__name">${esc(f.name)}</span><span class="files__size">${fmtSize(f.size)}</span><button type="button" class="files__x" data-i="${i}" aria-label="x">${icon('x')}</button></li>`).join('');
  };
  $('[data-composer-input]', root).addEventListener('change', (e) => {
    for (const f of e.target.files) {
      const err = fileOk(f);
      if (err) { say(t.err(err), 'error'); continue; }
      if (picked.length >= 10) { say(t.err('too_many_files'), 'error'); break; }
      picked.push(f);
    }
    e.target.value = '';
    render();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) { picked.splice(Number(b.dataset.i), 1); render(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body && !picked.length) return;
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    say(t.sending);
    const fd = new FormData();
    fd.append('body', body);
    picked.forEach((f) => fd.append('file', f, f.name));
    try {
      const { messages } = await api(url, { method: 'POST', form: fd });
      form.reset();
      picked.length = 0;
      render();
      say('');
      onSent(messages);
    } catch (err) {
      say(t.err(err.code), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function copyText(text, btn) {
  navigator.clipboard?.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = old; }, 1200);
  });
}
