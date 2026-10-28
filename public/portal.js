'use strict';

/* ==========================================================================
   Kundenportal: neue Anfrage, eigene Anfragen mit Verlauf, Konto
   ========================================================================== */
const i18n = makeI18n({
  en: {
    tabNew: 'New request', tabOrders: 'My requests', logout: 'Log out',
    newEyebrow: 'New request', newTitle: 'What do you need?',
    newLead: 'Pick services, set quantities and add notes or files to each one. I\'ll get back to you right in your request.',
    step1: 'Pick services', step2: 'Add details & files', step3: 'Send, then follow it under “My requests”',
    summary: 'Your request', empty: 'Nothing selected yet.', total: 'Total', deadline: 'By when?',
    links: 'Links (VODs, clips, references)', message: 'Message', messagePh: 'Anything else I should know?',
    general: 'General files', addFiles: 'Add files', send: 'Send request',
    myEyebrow: 'Tracking', myTitle: 'My requests', noOrders: 'No requests yet. Pick what you need under “New request”.',
    all: 'All', video: 'Video', stream: 'Stream', code: 'Code', extra: 'Extras',
    per: 'per', onRequest: 'Price on request', note: 'Notes for this', notePh: 'e.g. style, colors, which moments, examples',
    fewer: 'Less', more: 'More', remove: 'Remove', partly: 'Some items are priced on request, the total follows after we talk.',
    allOpen: 'Price follows after we talk.', sending: 'Sending …',
    created: 'Sent', open: 'Open', newReply: 'New reply', items: 'What you asked for', files: 'Your files',
    thread: 'Messages', you: 'You', client: 'Client', threadEmpty: 'No messages yet. Questions or extra files? Write here.',
    composePh: 'Write a message …', attach: 'Attach files', sendMsg: 'Send',
    cancelOrder: 'Withdraw request', cancelConfirm: 'Withdraw this request? This can\'t be undone.', close: 'Close',
    sys_new: 'Request received', sys_progress: 'I\'m working on it', sys_review: 'Ready for you to review', sys_done: 'Done', sys_cancelled: 'Request withdrawn',
    status_new: 'Received', status_progress: 'In progress', status_review: 'Review', status_done: 'Done', status_cancelled: 'Withdrawn',
    account: 'Your account', username: 'Username', name: 'Name', pwTitle: 'Change password', pwCurrent: 'Current password',
    pwNew: 'New password (at least 10 characters)', pwRepeat: 'Repeat new password', save: 'Save',
    pwSaved: 'Password changed. Other devices were logged out.', pwMismatch: 'The new passwords don\'t match.',
    err_no_items: 'Pick at least one service.', err_file_type: 'One of the files has a type I can\'t accept.',
    err_file_too_large: 'A file is too large (max 25 MB).', err_too_many_files: 'Too many files.',
    err_too_many: 'Too many requests in a short time. Please wait a bit.', err_bad_deadline: 'Please check the date.',
    err_wrong_password: 'Your current password is wrong.', err_weak_password: 'The new password needs at least 10 characters.',
    err_not_cancellable: 'I\'ve already started, so this can\'t be withdrawn here. Just write me a message.',
    err_error: 'Something went wrong. Please try again.',
  },
  de: {
    tabNew: 'Neue Anfrage', tabOrders: 'Meine Anfragen', logout: 'Abmelden',
    newEyebrow: 'Neue Anfrage', newTitle: 'Was brauchst du?',
    newLead: 'Such dir Dienste aus, stell die Menge ein und häng Notizen oder Dateien an. Ich antworte dir direkt in deiner Anfrage.',
    step1: 'Dienste auswählen', step2: 'Details & Dateien dazu', step3: 'Abschicken und unter „Meine Anfragen“ verfolgen',
    summary: 'Deine Anfrage', empty: 'Noch nichts ausgewählt.', total: 'Summe', deadline: 'Bis wann?',
    links: 'Links (VODs, Clips, Beispiele)', message: 'Nachricht', messagePh: 'Was sollte ich sonst noch wissen?',
    general: 'Allgemeine Dateien', addFiles: 'Dateien hinzufügen', send: 'Anfrage abschicken',
    myEyebrow: 'Tracking', myTitle: 'Meine Anfragen', noOrders: 'Noch keine Anfragen. Unter „Neue Anfrage“ kannst du loslegen.',
    all: 'Alle', video: 'Video', stream: 'Stream', code: 'Code', extra: 'Extras',
    per: 'pro', onRequest: 'Preis nach Absprache', note: 'Notizen dazu', notePh: 'z. B. Stil, Farben, welche Momente, Beispiele',
    fewer: 'Weniger', more: 'Mehr', remove: 'Entfernen', partly: 'Ein paar Posten haben noch keinen festen Preis, die Summe klären wir dann.',
    allOpen: 'Den Preis klären wir dann zusammen.', sending: 'Wird geschickt …',
    created: 'Geschickt', open: 'Öffnen', newReply: 'Neue Antwort', items: 'Was du angefragt hast', files: 'Deine Dateien',
    thread: 'Nachrichten', you: 'Du', client: 'Kunde', threadEmpty: 'Noch keine Nachrichten. Fragen oder Dateien nachreichen? Schreib einfach hier.',
    composePh: 'Nachricht schreiben …', attach: 'Dateien anhängen', sendMsg: 'Senden',
    cancelOrder: 'Anfrage zurückziehen', cancelConfirm: 'Diese Anfrage zurückziehen? Das lässt sich nicht rückgängig machen.', close: 'Schließen',
    sys_new: 'Anfrage eingegangen', sys_progress: 'Ich arbeite dran', sys_review: 'Bereit zur Abnahme', sys_done: 'Fertig', sys_cancelled: 'Anfrage zurückgezogen',
    status_new: 'Eingegangen', status_progress: 'In Arbeit', status_review: 'Abnahme', status_done: 'Fertig', status_cancelled: 'Zurückgezogen',
    account: 'Dein Konto', username: 'Benutzername', name: 'Name', pwTitle: 'Passwort ändern', pwCurrent: 'Aktuelles Passwort',
    pwNew: 'Neues Passwort (mindestens 10 Zeichen)', pwRepeat: 'Neues Passwort wiederholen', save: 'Speichern',
    pwSaved: 'Passwort geändert. Andere Geräte wurden abgemeldet.', pwMismatch: 'Die neuen Passwörter sind nicht gleich.',
    err_no_items: 'Such dir mindestens einen Dienst aus.', err_file_type: 'Eine der Dateien hat ein Format, das ich nicht annehmen kann.',
    err_file_too_large: 'Eine Datei ist zu groß (max. 25 MB).', err_too_many_files: 'Zu viele Dateien.',
    err_too_many: 'Zu viele Anfragen in kurzer Zeit. Warte bitte kurz.', err_bad_deadline: 'Bitte das Datum prüfen.',
    err_wrong_password: 'Dein aktuelles Passwort stimmt nicht.', err_weak_password: 'Das neue Passwort braucht mindestens 10 Zeichen.',
    err_not_cancellable: 'Ich hab schon angefangen, darum geht das hier nicht mehr. Schreib mir einfach eine Nachricht.',
    err_error: 'Da ist was schiefgelaufen. Probier es nochmal.',
  },
});
const t = i18n.t;
const errText = (code) => (t(`err_${code}`) === `err_${code}` ? t('err_error') : t(`err_${code}`));
const nameOf = (s) => s.name[i18n.lang] || s.name.en;

const CATS = ['all', 'video', 'stream', 'code', 'extra'];
const MAX_FILES = 15;

let me = null;
let services = [];
let orders = [];
const state = new Map(); // key -> { qty, note, files: File[] }
const generalFiles = [];
let filter = 'all';
let openOrderId = null;

/* ---------- Tabs ---------- */
function showTab(name) {
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  scrollTo({ top: 0 });
}

/* ---------- Dienste ---------- */
const priceLabel = (s) => (s.price_cents == null ? t('onRequest') : `${euro(s.price_cents)} ${t('per')} ${s.unit[i18n.lang] || s.unit.en}`);

function renderFilters() {
  const cats = CATS.filter((c) => c === 'all' || services.some((s) => s.cat === c));
  $('[data-filters]').innerHTML = cats.map((c) => `
    <button type="button" class="filter" data-filter="${c}" aria-pressed="${c === filter}">
      ${icon({ all: 'board', video: 'play', stream: 'twitch', code: 'code', extra: 'sparkle' }[c])}<span>${esc(t(c))}</span>
    </button>`).join('');
}

function renderServices() {
  $('[data-services]').innerHTML = services.map((s, key) => {
    const st = state.get(key);
    const qty = st?.qty || 0;
    return `
    <article class="svc${qty ? ' is-on' : ''}" data-key="${key}" data-cat="${esc(s.cat)}"${filter !== 'all' && s.cat !== filter ? ' hidden' : ''}>
      <div class="svc__row">
        <span class="svc__icon">${icon(s.icon)}</span>
        <div class="svc__info">
          <h3>${esc(nameOf(s))}</h3>
          <p class="svc__price">${esc(priceLabel(s))}</p>
        </div>
        <div class="qty">
          <button type="button" data-dec aria-label="${esc(t('fewer'))}">−</button>
          <input type="number" min="0" max="99" inputmode="numeric" value="${qty}" data-qty aria-label="${esc(nameOf(s))}">
          <button type="button" data-inc aria-label="${esc(t('more'))}">+</button>
        </div>
      </div>
      <div class="svc__more">
        <label class="field">
          <span class="field__label">${esc(t('note'))}</span>
          <textarea rows="2" maxlength="1000" data-note placeholder="${esc(t('notePh'))}">${esc(st?.note || '')}</textarea>
        </label>
        <label class="drop">
          <input type="file" multiple data-file="${key}">
          ${icon('plus')}<span>${esc(t('addFiles'))}</span>
        </label>
        <ul class="files" data-files="${key}"></ul>
      </div>
    </article>`;
  }).join('');
  state.forEach((_, key) => renderFiles(key));
}

function renderFiles(key) {
  const list = key === 'general' ? generalFiles : state.get(key)?.files || [];
  const ul = $(`[data-files="${key}"]`);
  if (!ul) return;
  ul.innerHTML = list.map((f, i) => `
    <li><span class="files__name">${esc(f.name)}</span><span class="files__size">${fmtSize(f.size)}</span>
    <button type="button" class="files__x" data-remove="${key}:${i}" aria-label="${esc(t('remove'))}">${icon('x')}</button></li>`).join('');
}

const entry = (key) => state.get(key) || state.set(key, { qty: 0, note: '', files: [] }).get(key);

function setQty(key, qty) {
  const st = entry(key);
  st.qty = Math.max(0, Math.min(99, Number.isFinite(qty) ? Math.round(qty) : 0));
  const card = $(`.svc[data-key="${key}"]`);
  card.classList.toggle('is-on', st.qty > 0);
  $('[data-qty]', card).value = st.qty;
  renderSummary();
}

const chosen = () => [...state.entries()].filter(([, st]) => st.qty > 0).map(([key, st]) => ({ key, st, s: services[key] }));

function renderSummary() {
  const items = chosen();
  $('[data-summary]').innerHTML = items.map(({ st, s }) => `
    <li><span><b>${st.qty}×</b> ${esc(nameOf(s))}</span><span>${s.price_cents == null ? '–' : esc(euro(s.price_cents * st.qty))}</span></li>`).join('');
  $('[data-sum-empty]').hidden = items.length > 0;
  const priced = items.filter(({ s }) => s.price_cents != null);
  const sum = priced.reduce((a, { st, s }) => a + s.price_cents * st.qty, 0);
  $('[data-total]').textContent = priced.length ? euro(sum) + (priced.length < items.length ? ' +' : '') : '–';
  $('[data-hint]').textContent = !items.length || priced.length === items.length ? '' : priced.length ? t('partly') : t('allOpen');
}

function addFiles(key, fileList) {
  const list = key === 'general' ? generalFiles : entry(key).files;
  let room = MAX_FILES - generalFiles.length - [...state.values()].reduce((a, st) => a + st.files.length, 0);
  for (const f of fileList) {
    const err = fileOk(f);
    if (err) { showStatus(errText(err), 'error'); continue; }
    if (room <= 0) { showStatus(errText('too_many_files'), 'error'); break; }
    list.push(f);
    room--;
  }
  renderFiles(key);
}

function showStatus(msg, kind = '') {
  const el = $('[data-status]');
  el.textContent = msg;
  el.className = `form__status${kind ? ` is-${kind}` : ''}`;
}

async function submit() {
  const items = chosen();
  if (!items.length) { showStatus(errText('no_items'), 'error'); return; }
  const btn = $('[data-submit]');
  btn.disabled = true;
  showStatus(t('sending'));
  const form = new FormData();
  form.append('payload', JSON.stringify({
    items: items.map(({ key, st, s }) => ({ key, service: s.id, qty: st.qty, note: st.note })),
    deadline: $('[data-deadline]').value || null,
    links: $('[data-links]').value,
    message: $('[data-message]').value,
  }));
  items.forEach(({ key, st }) => st.files.forEach((f) => form.append(`file_${key}`, f, f.name)));
  generalFiles.forEach((f) => form.append('file_general', f, f.name));
  try {
    const { id } = await api('/api/orders', { method: 'POST', form });
    state.clear();
    generalFiles.length = 0;
    ['[data-deadline]', '[data-links]', '[data-message]'].forEach((s) => { $(s).value = ''; });
    renderServices();
    renderFiles('general');
    renderSummary();
    showStatus('');
    await loadOrders();
    showTab('orders');
    openOrder(id);
  } catch (err) {
    showStatus(errText(err.code), 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Meine Anfragen ---------- */
const serviceName = (id) => { const s = services.find((x) => x.id === id); return s ? nameOf(s) : id; };
const statusLabel = (s) => t(`status_${s}`);

async function loadOrders() {
  ({ orders } = await api('/api/orders'));
  renderOrders();
}

function renderOrders() {
  const unread = orders.filter((o) => o.unread).length;
  const badge = $('[data-unread]');
  badge.textContent = unread;
  badge.hidden = !unread;
  const box = $('[data-orders]');
  if (!orders.length) { box.innerHTML = `<p class="empty">${icon('pawn')}<span>${esc(t('noOrders'))}</span></p>`; return; }
  box.innerHTML = orders.map((o) => `
    <button type="button" class="ord-row card${o.unread ? ' is-unread' : ''}" data-open="${o.id}" data-status="${esc(o.status)}">
      <span class="ord__id">#${o.id}</span>
      <span class="ord-row__main">
        <b>${esc(o.items.map((it) => `${it.qty}× ${serviceName(it.service_id)}`).join(', '))}</b>
        <small>${esc(t('created'))} ${esc(fmtDate(o.created_at))}${o.deadline ? ` · ${esc(t('deadline'))} ${esc(fmtDate(o.deadline))}` : ''}</small>
      </span>
      ${o.unread ? `<span class="dot-new">${esc(t('newReply'))}</span>` : ''}
      <span class="badge badge--${esc(o.status)}">${esc(statusLabel(o.status))}</span>
      <span class="ord__total">${o.total_cents != null ? esc(euro(o.total_cents)) : ''}</span>
      ${icon('arrow', 'ord-row__go')}
    </button>`).join('');
}

/* ---------- Eine Anfrage im Detail ---------- */
async function openOrder(id) {
  openOrderId = id;
  const { order, messages } = await api(`/api/orders/${id}`);
  const body = $('[data-order-body]');
  const files = (itemId) => order.attachments.filter((a) => a.item_id === itemId).map(fileLink).join('');
  body.innerHTML = `
    <header class="detail__head">
      <h2><span class="ord__id">#${order.id}</span> ${esc(statusLabel(order.status))}</h2>
      <button type="button" class="icon-btn" data-close aria-label="${esc(t('close'))}">${icon('x')}</button>
    </header>
    <p class="muted">${esc(t('created'))} ${esc(fmtDate(order.created_at))}${order.deadline ? ` · ${esc(t('deadline'))} ${esc(fmtDate(order.deadline))}` : ''}${order.total_cents != null ? ` · ${esc(t('total'))} <b>${esc(euro(order.total_cents))}</b>` : ''}</p>
    ${statusTrack(order.status, statusLabel)}
    <h3 class="modal__sub">${esc(t('items'))}</h3>
    <ul class="ord__items">
      ${order.items.map((it) => `
        <li><div class="ord__line"><span><b>${it.qty}×</b> ${esc(serviceName(it.service_id))}</span>
          ${it.unit_price_cents != null ? `<span class="muted">${esc(euro(it.unit_price_cents * it.qty))}</span>` : ''}</div>
          ${it.note ? `<p class="ord__note">${esc(it.note)}</p>` : ''}${files(it.id)}</li>`).join('')}
    </ul>
    ${order.message ? `<p class="ord__msg">${esc(order.message)}</p>` : ''}
    ${order.links ? `<p class="ord__links">${esc(order.links)}</p>` : ''}
    ${order.attachments.some((a) => !a.item_id) ? `<div class="ord__files">${files(null)}</div>` : ''}
    <h3 class="modal__sub">${esc(t('thread'))}</h3>
    <ul class="thread" data-thread></ul>
    ${order.status === 'cancelled' ? '' : composerHtml({ placeholder: t('composePh'), attach: t('attach'), send: t('sendMsg') })}
    <div class="modal__actions">
      ${order.status === 'new' ? `<button type="button" class="btn btn--ghost btn--sm btn--danger" data-cancel>${esc(t('cancelOrder'))}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn btn--ghost btn--sm" data-close>${esc(t('close'))}</button>
    </div>`;
  const renderThread = (msgs) => {
    const ul = $('[data-thread]', body);
    ul.innerHTML = threadHtml(msgs, 'client', { you: t('you'), client: t('client'), empty: t('threadEmpty'), system: (s) => t(`sys_${s}`) });
    ul.scrollTop = ul.scrollHeight;
  };
  renderThread(messages);
  if ($('[data-composer]', body)) {
    bindComposer(body, `/api/orders/${id}/messages`, { sending: t('sending'), err: errText }, renderThread);
  }
  const dlg = $('[data-order-dialog]');
  if (!dlg.open) dlg.showModal();
  loadOrders();
}

async function cancelOrder() {
  if (!openOrderId || !confirm(t('cancelConfirm'))) return;
  try {
    await api(`/api/orders/${openOrderId}/cancel`, { method: 'POST' });
    openOrder(openOrderId);
  } catch (err) {
    alert(errText(err.code));
  }
}

/* ---------- Konto ---------- */
function initAccount() {
  const dlg = $('[data-account]');
  const form = $('[data-pw-form]');
  const status = $('[data-pw-status]');
  $('[data-account-open]').addEventListener('click', () => {
    form.reset();
    status.textContent = '';
    $('[data-account-info]').innerHTML = `<dt>${esc(t('name'))}</dt><dd>${esc(me.display_name)}</dd><dt>${esc(t('username'))}</dt><dd class="mono">${esc(me.username)}</dd>`;
    dlg.showModal();
  });
  $('[data-account-close]').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.next.value !== form.repeat.value) { status.className = 'form__status is-error'; status.textContent = t('pwMismatch'); return; }
    try {
      await api('/api/me/password', { method: 'POST', body: { current: form.current.value, next: form.next.value } });
      status.className = 'form__status is-ok';
      status.textContent = t('pwSaved');
      form.reset();
    } catch (err) {
      status.className = 'form__status is-error';
      status.textContent = errText(err.code);
    }
  });
}

/* ---------- Events ---------- */
function bind() {
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('[data-goto-new]').addEventListener('click', () => showTab('new'));
  const list = $('[data-services]');
  list.addEventListener('click', (e) => {
    const card = e.target.closest('.svc');
    if (!card) return;
    const key = Number(card.dataset.key);
    const cur = state.get(key)?.qty || 0;
    if (e.target.closest('[data-inc]')) setQty(key, cur + 1);
    if (e.target.closest('[data-dec]')) setQty(key, cur - 1);
  });
  list.addEventListener('input', (e) => {
    const card = e.target.closest('.svc');
    if (!card) return;
    const key = Number(card.dataset.key);
    if (e.target.matches('[data-qty]')) setQty(key, Number(e.target.value));
    if (e.target.matches('[data-note]')) entry(key).note = e.target.value;
  });
  $('[data-panel="new"]').addEventListener('change', (e) => {
    if (!e.target.matches('[data-file]')) return;
    const k = e.target.dataset.file;
    addFiles(k === 'general' ? 'general' : Number(k), e.target.files);
    e.target.value = '';
  });
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const [k, i] = rm.dataset.remove.split(':');
      const key = k === 'general' ? 'general' : Number(k);
      (key === 'general' ? generalFiles : state.get(key).files).splice(Number(i), 1);
      renderFiles(key);
    }
    const f = e.target.closest('[data-filter]');
    if (f) {
      filter = f.dataset.filter;
      $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
      $$('.svc').forEach((c) => { c.hidden = filter !== 'all' && c.dataset.cat !== filter; });
    }
    const o = e.target.closest('[data-open]');
    if (o) openOrder(Number(o.dataset.open));
    if (e.target.closest('[data-close]')) $('[data-order-dialog]').close();
    if (e.target.closest('[data-cancel]')) cancelOrder();
  });
  $('[data-submit]').addEventListener('click', submit);
  $('[data-logout]').addEventListener('click', logout);
  document.addEventListener('langchange', () => {
    renderFilters(); renderServices(); renderSummary(); renderOrders();
    if ($('[data-order-dialog]').open && openOrderId) openOrder(openOrderId);
  });
}

/* ---------- Start ---------- */
(async () => {
  i18n.apply();
  $('[data-deadline]').min = new Date().toISOString().slice(0, 10);
  const [{ user }, catalog] = await Promise.all([api('/api/me'), api('/api/catalog')]);
  me = user;
  $('[data-me]').textContent = user.display_name;
  services = catalog.services;
  renderFilters();
  renderServices();
  renderSummary();
  bind();
  initAccount();
  await loadOrders();
  showTab(orders.length ? 'orders' : 'new');
})();
