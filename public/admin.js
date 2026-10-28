'use strict';

/* ==========================================================================
   Admin: Übersicht, Aufträge mit Verlauf, Website-Anfragen, Kunden, Preise
   ========================================================================== */
document.documentElement.lang = 'de';

const STATUS = { new: 'Neu', progress: 'In Arbeit', review: 'Zur Abnahme', done: 'Fertig', cancelled: 'Abgebrochen' };
const SYS = { new: 'Neu', progress: 'Status: In Arbeit', review: 'Status: Zur Abnahme', done: 'Status: Fertig', cancelled: 'Status: Abgebrochen' };
const ERR = {
  bad_username: 'Benutzername: 3–32 Zeichen, nur Buchstaben, Zahlen und _ . -',
  username_taken: 'Den Benutzernamen gibt es schon.',
  bad_name: 'Bitte einen Anzeigenamen eintragen.',
  invalid_price: 'Ein Preis ist ungültig (0 bis 100.000 €).',
  self: 'Das geht nicht mit diesem Konto.',
  file_type: 'Dateityp nicht erlaubt.',
  file_too_large: 'Datei zu groß (max. 25 MB).',
  too_many_files: 'Zu viele Dateien (max. 10).',
  wrong_password: 'Aktuelles Passwort stimmt nicht.',
  weak_password: 'Neues Passwort braucht mindestens 10 Zeichen.',
};
const errText = (code) => ERR[code] || 'Da ist was schiefgelaufen.';
const priceIn = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));
const today = () => new Date().toISOString().slice(0, 10);

let me = null;
let catalog = [];
let userFilter = null; // { id, name } wenn Aufträge eines Kunden gezeigt werden
let openOrderId = null;

const serviceName = (id) => catalog.find((s) => s.id === id)?.name.de || id;
const itemsText = (o) => o.items.map((it) => `${it.qty}× ${serviceName(it.service_id)}`).join(', ');

/* ---------- Tabs ---------- */
function showTab(name) {
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  ({ home: loadDashboard, orders: loadOrders, contacts: loadContacts, users: loadUsers, prices: loadDefaultPrices })[name]();
  scrollTo({ top: 0 });
}

/* ---------- Übersicht ---------- */
function renderStats(s) {
  const tiles = [
    ['new', 'Neu', s.new_count || 0, 'message'],
    ['progress', 'In Arbeit', s.progress_count || 0, 'pencil'],
    ['review', 'Zur Abnahme', s.review_count || 0, 'eye'],
    ['done', 'Fertig diesen Monat', s.done_month || 0, 'check'],
    ['money', 'Umsatz diesen Monat', euro(s.revenue_month_cents || 0), 'trend'],
  ];
  $('[data-stats]').innerHTML = tiles.map(([k, label, v, ic]) => `
    <div class="kpi kpi--${k}"><span class="kpi__i">${icon(ic)}</span><dt>${esc(v)}</dt><dd>${esc(label)}</dd></div>`).join('');
  const setCount = (sel, n) => { const el = $(sel); el.textContent = n || ''; el.hidden = !n; };
  setCount('[data-contacts-count]', s.contacts_open);
  setCount('[data-orders-count]', s.new_count);
}

function orderRow(o) {
  const late = o.deadline && o.deadline < today() && !['done', 'cancelled'].includes(o.status);
  return `
    <button type="button" class="ord-row card${o.unread ? ' is-unread' : ''}" data-open="${o.id}" data-status="${esc(o.status)}">
      <span class="ord__id">#${o.id}</span>
      <span class="ord-row__main">
        <b>${esc(o.display_name)}</b>
        <small>${esc(itemsText(o))}</small>
      </span>
      ${o.unread ? '<span class="dot-new">Neu</span>' : ''}
      <span class="ord-row__date${late ? ' is-late' : ''}">${o.deadline ? `${late ? 'überfällig · ' : 'bis '}${esc(fmtDate(o.deadline))}` : 'ohne Deadline'}</span>
      <span class="badge badge--${esc(o.status)}">${esc(STATUS[o.status])}</span>
      <span class="ord__total">${o.total_cents != null ? esc(euro(o.total_cents)) : ''}</span>
      ${icon('arrow', 'ord-row__go')}
    </button>`;
}

async function loadDashboard() {
  const { stats, next, recent } = await api('/api/admin/dashboard');
  renderStats(stats);
  $('[data-next]').innerHTML = next.length ? next.map(orderRow).join('') : `<p class="empty">${icon('king')}<span>Nichts offen. Zeit für eine Partie.</span></p>`;
  $('[data-recent]').innerHTML = recent.length ? recent.map((m) => `
    <button type="button" class="note-row" data-open="${m.order_id}">
      <span class="note-row__head"><b>${esc(m.display_name)}</b> · #${m.order_id} · ${esc(fmtDateTime(m.created_at))}</span>
      <span class="note-row__body">${esc((m.body || '📎 Datei').slice(0, 160))}</span>
    </button>`).join('') : `<p class="empty">${icon('chat')}<span>Noch keine Nachrichten.</span></p>`;
}

/* ---------- Aufträge ---------- */
let searchTimer = 0;
async function loadOrders() {
  const params = new URLSearchParams({ status: $('[data-order-filter]').value, q: $('[data-order-search]').value.trim() });
  if (userFilter) params.set('user', userFilter.id);
  const chip = $('[data-user-filter]');
  chip.hidden = !userFilter;
  if (userFilter) chip.innerHTML = `Nur Aufträge von <b>${esc(userFilter.name)}</b> <button type="button" class="icon-btn" data-clear-user aria-label="Filter entfernen">${icon('x')}</button>`;
  const { orders } = await api(`/api/admin/orders?${params}`);
  $('[data-orders]').innerHTML = orders.length ? orders.map(orderRow).join('') : `<p class="empty">${icon('pawn')}<span>Keine Aufträge in dieser Ansicht.</span></p>`;
}

async function openOrder(id) {
  openOrderId = id;
  const { order, messages } = await api(`/api/admin/orders/${id}`);
  const body = $('[data-order-body]');
  const files = (itemId) => order.attachments.filter((a) => a.item_id === itemId).map(fileLink).join('');
  body.innerHTML = `
    <header class="detail__head">
      <h2><span class="ord__id">#${order.id}</span> ${esc(order.display_name)}</h2>
      <select class="status-select badge--${esc(order.status)}" data-status-select aria-label="Status">
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === order.status ? ' selected' : ''}>${v}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
    </header>
    <p class="muted">Eingegangen ${esc(fmtDateTime(order.created_at))}${order.deadline ? ` · bis <b>${esc(fmtDate(order.deadline))}</b>` : ''} · ${esc(order.username)}${order.user_discord ? ` · Discord: ${esc(order.user_discord)}` : ''}</p>
    ${statusTrack(order.status, (s) => STATUS[s])}
    <h3 class="modal__sub">Positionen</h3>
    <ul class="ord__items">
      ${order.items.map((it) => `
        <li><div class="ord__line"><span><b>${it.qty}×</b> ${esc(serviceName(it.service_id))}</span>
          <span class="muted">${it.unit_price_cents != null ? `${esc(euro(it.unit_price_cents))} × ${it.qty} = <b>${esc(euro(it.unit_price_cents * it.qty))}</b>` : 'Preis offen'}</span></div>
          ${it.note ? `<p class="ord__note">${esc(it.note)}</p>` : ''}${files(it.id)}</li>`).join('')}
    </ul>
    ${order.message ? `<p class="ord__msg">${esc(order.message)}</p>` : ''}
    ${order.links ? `<p class="ord__links">${esc(order.links)}</p>` : ''}
    ${order.attachments.some((a) => !a.item_id) ? `<div class="ord__files">${files(null)}</div>` : ''}

    <h3 class="modal__sub">Verlauf mit ${esc(order.display_name)}</h3>
    <ul class="thread" data-thread></ul>
    ${composerHtml({ placeholder: 'Antwort schreiben oder fertige Dateien liefern …', attach: 'Dateien liefern', send: 'Senden' })}

    <h3 class="modal__sub">Intern</h3>
    <div class="ord__admin">
      <label class="field"><span class="field__label">Notiz (sieht nur du)</span><textarea rows="2" maxlength="4000" data-note>${esc(order.admin_note || '')}</textarea></label>
      <label class="field"><span class="field__label">Summe (€)</span><input inputmode="decimal" data-total value="${esc(priceIn(order.total_cents))}" placeholder="offen"></label>
      <button type="button" class="btn btn--ghost btn--sm" data-order-save>Speichern</button>
      <span class="form__status" data-order-status></span>
    </div>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost btn--sm btn--danger" data-order-delete>Auftrag löschen</button>
      <span class="spacer"></span>
      <button type="button" class="btn btn--ghost btn--sm" data-close>Schließen</button>
    </div>`;
  const renderThread = (msgs) => {
    const ul = $('[data-thread]', body);
    ul.innerHTML = threadHtml(msgs, 'admin', { you: 'Du', client: order.display_name, empty: 'Noch keine Nachrichten.', system: (s) => SYS[s] || s });
    ul.scrollTop = ul.scrollHeight;
  };
  renderThread(messages);
  bindComposer(body, `/api/admin/orders/${id}/messages`, { sending: 'Wird gesendet …', err: errText }, renderThread);
  const dlg = $('[data-order-dialog]');
  if (!dlg.open) dlg.showModal();
  refreshCounts();
}

async function patchOrder(body) {
  const status = $('[data-order-status]');
  try {
    await api(`/api/admin/orders/${openOrderId}`, { method: 'PATCH', body });
    status.className = 'form__status is-ok';
    status.textContent = 'Gespeichert';
    if ('status' in body) openOrder(openOrderId);
    refreshCounts();
  } catch (err) {
    status.className = 'form__status is-error';
    status.textContent = errText(err.code);
  }
}

async function deleteOrder() {
  if (!confirm(`Auftrag #${openOrderId} mit allen Nachrichten und Dateien endgültig löschen?`)) return;
  await api(`/api/admin/orders/${openOrderId}`, { method: 'DELETE' });
  $('[data-order-dialog]').close();
  refreshCurrent();
}

async function refreshCounts() {
  renderStats(await api('/api/admin/stats'));
}

function refreshCurrent() {
  const tab = $('[data-tab][aria-selected="true"]').dataset.tab;
  ({ home: loadDashboard, orders: loadOrders, contacts: loadContacts, users: loadUsers, prices: () => {} })[tab]();
}

/* ---------- Website-Anfragen ---------- */
let contacts = [];
const suggestUsername = (name) => name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_.-]+/g, '').slice(0, 32);

async function loadContacts() {
  ({ contacts } = await api(`/api/admin/contacts?filter=${encodeURIComponent($('[data-contact-filter]').value)}`));
  const box = $('[data-contacts]');
  if (!contacts.length) { box.innerHTML = `<p class="empty">${icon('message')}<span>Keine Anfragen in dieser Ansicht.</span></p>`; return; }
  box.innerHTML = contacts.map((c) => `
    <article class="ord card" data-contact="${c.id}">
      <header class="ord__head">
        <b class="ord__who">${esc(c.name)}</b>
        <a class="ord__meta" href="mailto:${esc(c.email)}">${esc(c.email)}</a>
        <span class="ord__meta">${esc(fmtDateTime(c.created_at))}${c.deadline ? ` · bis <b>${esc(fmtDate(c.deadline))}</b>` : ''}${c.budget ? ` · Budget ${esc(c.budget)}` : ''}</span>
        <span class="badge badge--${c.handled ? 'done' : 'new'} push">${c.handled ? 'Erledigt' : 'Offen'}</span>
      </header>
      ${c.services ? `<p class="ord__line"><span><b>Interesse:</b> ${esc(c.services)}</span></p>` : ''}
      <p class="ord__msg">${esc(c.message)}</p>
      <div class="ord__admin">
        <button type="button" class="btn btn--accent btn--sm" data-contact-account>${icon('plus')}Konto anlegen</button>
        <button type="button" class="btn btn--ghost btn--sm" data-contact-toggle>${c.handled ? 'Wieder öffnen' : 'Als erledigt markieren'}</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn--ghost btn--sm btn--danger" data-contact-delete>Löschen</button>
      </div>
    </article>`).join('');
}

/* ---------- Kunden ---------- */
let users = [];
async function loadUsers() {
  ({ users } = await api('/api/admin/users'));
  renderUsers();
}

function renderUsers() {
  const q = $('[data-user-search]').value.trim().toLowerCase();
  const list = users.filter((u) => !q || u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  $('[data-users]').innerHTML = list.length ? list.map((u) => `
    <tr>
      <td><b>${esc(u.display_name)}</b>${u.role === 'admin' ? ' <span class="pill">Admin</span>' : ''}</td>
      <td class="mono">${esc(u.username)}</td>
      <td>${esc(u.discord || '–')}</td>
      <td>${u.open_count}</td>
      <td>${u.order_count}</td>
      <td>${u.active ? '<span class="pill pill--ok">aktiv</span>' : '<span class="pill">gesperrt</span>'}</td>
      <td>${u.role === 'client' ? `<button type="button" class="btn btn--ghost btn--sm" data-user-edit="${u.id}">Bearbeiten</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="muted">Keine Konten gefunden.</td></tr>';
}

let editing = null; // null = neues Konto, sonst User-ID

function priceRows(prices) {
  return prices.map((p) => `
    <tr data-svc="${esc(p.id)}">
      <td>${icon(p.icon)} ${esc(p.name.de)} <small class="muted">/ ${esc(p.unit.de)}</small></td>
      <td class="muted">${p.default_cents != null ? esc(euro(p.default_cents)) : 'Absprache'}</td>
      <td><input inputmode="decimal" data-price value="${p.custom ? esc(priceIn(p.price_cents)) : ''}" placeholder="${p.default_cents != null ? esc(priceIn(p.default_cents)) : '–'}" aria-label="Preis ${esc(p.name.de)}"></td>
      <td><label class="switch switch--sm"><input type="checkbox" data-hidden${p.hidden ? ' checked' : ''} aria-label="${esc(p.name.de)} ausblenden"><span></span></label></td>
    </tr>`).join('');
}

function collectPrices() {
  const out = {};
  $$('[data-user-prices] tr').forEach((tr) => {
    out[tr.dataset.svc] = { price: $('[data-price]', tr).value.trim() || null, hidden: $('[data-hidden]', tr).checked };
  });
  return out;
}

function showCreds({ username, password }, name) {
  const box = $('[data-creds]');
  const text = `Hey ${name}! Hier sind deine Zugangsdaten für mein Portal:\n${location.origin}/login\nBenutzername: ${username}\nPasswort: ${password}\nBitte ändere das Passwort nach dem ersten Login (oben rechts auf deinen Namen klicken).`;
  box.innerHTML = `
    <p><b>Zugangsdaten</b> · werden nur jetzt angezeigt</p>
    <p class="mono">Benutzername: ${esc(username)}<br>Passwort: ${esc(password)}</p>
    <button type="button" class="btn btn--accent btn--sm" data-copy>Nachricht kopieren</button>`;
  box.hidden = false;
  $('[data-copy]', box).addEventListener('click', (e) => copyText(text, e.currentTarget));
}

function setEditMode(id) {
  editing = id;
  const form = $('[data-user-form]');
  form.username.disabled = !!id;
  $('[data-user-title]').textContent = id ? 'Konto bearbeiten' : 'Neues Konto';
  ['[data-active-wrap]', '[data-user-reset]', '[data-user-delete]', '[data-user-orders]'].forEach((s) => { $(s).hidden = !id; });
}

async function openUser(id, prefill = null) {
  const form = $('[data-user-form]');
  form.reset();
  $('[data-creds]').hidden = true;
  $('[data-user-status]').textContent = '';
  setEditMode(id);
  if (id) {
    const { user, prices } = await api(`/api/admin/users/${id}`);
    form.username.value = user.username;
    form.display_name.value = user.display_name;
    form.discord.value = user.discord || '';
    form.notes.value = user.notes || '';
    form.active.checked = !!user.active;
    $('[data-user-prices]').innerHTML = priceRows(prices);
  } else {
    const { prices } = await api('/api/admin/prices');
    $('[data-user-prices]').innerHTML = priceRows(prices);
    if (prefill) Object.entries(prefill).forEach(([k, v]) => { form[k].value = v; });
  }
  $('[data-user-dialog]').showModal();
}

async function saveUser(e) {
  e.preventDefault();
  const form = $('[data-user-form]');
  const status = $('[data-user-status]');
  status.className = 'form__status';
  status.textContent = '';
  const base = { display_name: form.display_name.value.trim(), discord: form.discord.value.trim(), notes: form.notes.value.trim() };
  try {
    if (!editing) {
      const res = await api('/api/admin/users', { method: 'POST', body: { ...base, username: form.username.value.trim(), prices: collectPrices() } });
      showCreds(res, base.display_name);
      setEditMode(res.id);
      status.className = 'form__status is-ok';
      status.textContent = 'Konto angelegt. Schick die Zugangsdaten jetzt an den Kunden.';
    } else {
      await api(`/api/admin/users/${editing}`, { method: 'PATCH', body: { ...base, active: form.active.checked } });
      await api(`/api/admin/users/${editing}/prices`, { method: 'PUT', body: { prices: collectPrices() } });
      status.className = 'form__status is-ok';
      status.textContent = 'Gespeichert.';
    }
    loadUsers();
  } catch (err) {
    status.className = 'form__status is-error';
    status.textContent = errText(err.code);
  }
}

async function resetPassword() {
  if (!editing || !confirm('Neues Passwort erzeugen? Das alte gilt dann nicht mehr und das Konto wird überall abgemeldet.')) return;
  try {
    const res = await api(`/api/admin/users/${editing}/password`, { method: 'POST' });
    showCreds(res, $('[data-user-form]').display_name.value.trim());
  } catch (err) {
    $('[data-user-status]').textContent = errText(err.code);
  }
}

async function deleteUser() {
  const name = $('[data-user-form]').display_name.value.trim();
  if (!editing || !confirm(`Konto „${name}“ mit allen Aufträgen, Nachrichten und Dateien endgültig löschen?\nTipp: Sperren geht auch, dann bleibt alles erhalten.`)) return;
  await api(`/api/admin/users/${editing}`, { method: 'DELETE' });
  $('[data-user-dialog]').close();
  loadUsers();
  refreshCounts();
}

/* ---------- Standardpreise ---------- */
async function loadDefaultPrices() {
  const { prices } = await api('/api/admin/prices');
  $('[data-default-rows]').innerHTML = prices.map((p) => `
    <tr data-svc="${esc(p.id)}">
      <td>${icon(p.icon)} ${esc(p.name.de)}</td>
      <td class="muted">${esc(p.unit.de)}</td>
      <td><input inputmode="decimal" data-price value="${esc(priceIn(p.default_cents))}" placeholder="Absprache" aria-label="Preis ${esc(p.name.de)}"></td>
    </tr>`).join('');
}

async function saveDefaultPrices(e) {
  e.preventDefault();
  const status = $('[data-default-status]');
  const prices = {};
  $$('[data-default-rows] tr').forEach((tr) => { prices[tr.dataset.svc] = $('[data-price]', tr).value.trim() || null; });
  try {
    ({ prices: catalog } = await api('/api/admin/prices', { method: 'PUT', body: { prices } }));
    status.className = 'form__status is-ok';
    status.textContent = 'Gespeichert.';
  } catch (err) {
    status.className = 'form__status is-error';
    status.textContent = errText(err.code);
  }
}

/* ---------- Eigenes Konto ---------- */
function initAccount() {
  const dlg = $('[data-account]');
  const form = $('[data-pw-form]');
  const status = $('[data-pw-status]');
  $('[data-account-open]').addEventListener('click', () => {
    form.reset();
    status.textContent = '';
    $('[data-account-info]').innerHTML = `<dt>Name</dt><dd>${esc(me.display_name)}</dd><dt>Benutzername</dt><dd class="mono">${esc(me.username)}</dd>`;
    dlg.showModal();
  });
  $('[data-account-close]').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.next.value !== form.repeat.value) { status.className = 'form__status is-error'; status.textContent = 'Die neuen Passwörter sind nicht gleich.'; return; }
    try {
      await api('/api/me/password', { method: 'POST', body: { current: form.current.value, next: form.next.value } });
      status.className = 'form__status is-ok';
      status.textContent = 'Passwort geändert. Andere Geräte wurden abgemeldet.';
      form.reset();
    } catch (err) {
      status.className = 'form__status is-error';
      status.textContent = errText(err.code);
    }
  });
}

/* ---------- Events & Start ---------- */
function bind() {
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('[data-order-filter]').addEventListener('change', loadOrders);
  $('[data-order-search]').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadOrders, 250); });
  $('[data-user-search]').addEventListener('input', renderUsers);
  $('[data-contact-filter]').addEventListener('change', loadContacts);

  document.addEventListener('click', async (e) => {
    const open = e.target.closest('[data-open]');
    if (open) openOrder(Number(open.dataset.open));
    if (e.target.closest('[data-close]')) { $('[data-order-dialog]').close(); refreshCurrent(); }
    if (e.target.closest('[data-order-save]')) {
      const body = $('[data-order-body]');
      patchOrder({ admin_note: $('[data-note]', body).value, total: $('[data-total]', body).value.trim() || null });
    }
    if (e.target.closest('[data-order-delete]')) deleteOrder();
    if (e.target.closest('[data-clear-user]')) { userFilter = null; loadOrders(); }
    const edit = e.target.closest('[data-user-edit]');
    if (edit) openUser(Number(edit.dataset.userEdit));

    const card = e.target.closest('[data-contact]');
    if (card) {
      const c = contacts.find((x) => x.id === Number(card.dataset.contact));
      if (e.target.closest('[data-contact-toggle]')) {
        await api(`/api/admin/contacts/${c.id}`, { method: 'PATCH', body: { handled: !c.handled } });
        loadContacts(); refreshCounts();
      }
      if (e.target.closest('[data-contact-delete]') && confirm(`Anfrage von ${c.name} löschen?`)) {
        await api(`/api/admin/contacts/${c.id}`, { method: 'DELETE' });
        loadContacts(); refreshCounts();
      }
      if (e.target.closest('[data-contact-account]')) {
        openUser(null, {
          username: suggestUsername(c.name),
          display_name: c.name.slice(0, 60),
          notes: `Anfrage vom ${fmtDate(c.created_at)} (${c.email})${c.services ? `: ${c.services}` : ''}`,
        });
      }
    }
  });
  $('[data-order-body]').addEventListener('change', (e) => {
    if (!e.target.matches('[data-status-select]')) return;
    e.target.className = `status-select badge--${e.target.value}`;
    patchOrder({ status: e.target.value });
  });

  $('[data-user-new]').addEventListener('click', () => openUser(null));
  $('[data-user-form]').addEventListener('submit', saveUser);
  $('[data-user-close]').addEventListener('click', () => $('[data-user-dialog]').close());
  $('[data-user-reset]').addEventListener('click', resetPassword);
  $('[data-user-delete]').addEventListener('click', deleteUser);
  $('[data-user-orders]').addEventListener('click', () => {
    userFilter = { id: editing, name: $('[data-user-form]').display_name.value.trim() };
    $('[data-user-dialog]').close();
    $('[data-order-filter]').value = 'all';
    showTab('orders');
  });
  $('[data-default-prices]').addEventListener('submit', saveDefaultPrices);
  $('[data-logout]').addEventListener('click', logout);
}

(async () => {
  const [{ user }, prices] = await Promise.all([api('/api/me'), api('/api/admin/prices')]);
  me = user;
  catalog = prices.prices;
  $('[data-me]').textContent = user.display_name;
  bind();
  initAccount();
  loadDashboard();
})();
