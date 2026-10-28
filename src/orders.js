'use strict';

const repo = require('./repo');
const { SERVICES } = require('./catalog');

// Preis pro Dienst für einen Kunden: eigener Preis > Standardpreis > null (= nach Absprache)
async function priceTable(userId) {
  const defaults = await repo.getDefaultPrices();
  const own = userId ? await repo.getUserPrices(userId) : new Map();
  return SERVICES.map((s) => {
    const o = own.get(s.id);
    const custom = !!o && o.price_cents != null;
    return {
      ...s,
      price_cents: custom ? o.price_cents : (defaults.get(s.id) ?? null),
      default_cents: defaults.get(s.id) ?? null,
      custom,
      hidden: !!o?.hidden,
    };
  });
}

const stripFile = ({ stored_name, ...a }) => a;
const newer = (a, b) => !!a && (!b || a > b);

// Was ein Kunde von seinem Auftrag sehen darf
function clientView(o) {
  return {
    id: o.id,
    status: o.status,
    deadline: o.deadline,
    message: o.message,
    links: o.links,
    total_cents: o.total_cents,
    created_at: o.created_at,
    updated_at: o.updated_at,
    items: o.items,
    attachments: o.attachments.map(stripFile),
    message_count: o.message_count || 0,
    unread: newer(o.last_admin_msg_at, o.client_seen_at),
  };
}

function adminView(o) {
  const { discord_channel, discord_message, ...rest } = o;
  return {
    ...rest,
    attachments: o.attachments.map(stripFile),
    unread: !o.admin_seen_at || newer(o.last_client_msg_at, o.admin_seen_at),
  };
}

function messageView(m) {
  return {
    id: m.id,
    author_role: m.author_role,
    author_name: m.author_role === 'system' ? null : m.author_name,
    body: m.body,
    created_at: m.created_at,
    attachments: (m.attachments || []).map(stripFile),
  };
}

const euro = (cents) => (cents == null ? null : (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }));

module.exports = { priceTable, clientView, adminView, messageView, euro };
