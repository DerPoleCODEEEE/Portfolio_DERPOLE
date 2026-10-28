'use strict';

const {
  Client, Events, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  AttachmentBuilder, SlashCommandBuilder, REST, Routes, MessageFlags, PermissionFlagsBits, escapeMarkdown,
} = require('discord.js');
const { byId, STATUS_LABEL } = require('./catalog');
const { euro } = require('./orders');
const { openStream } = require('./files');

const TOKEN = process.env.DISCORD_TOKEN || '';
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
// Nur diese Discord-Nutzer dürfen Buttons und Befehle verwenden
const ADMIN_IDS = new Set((process.env.DISCORD_ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));
const MAX_FILE_BYTES = (Number(process.env.DISCORD_MAX_FILE_MB) || 10) * 1024 * 1024;

const COLORS = { new: 0x8dbf9f, progress: 0x8fb4e3, review: 0xe2b46a, done: 0x5bbfae, cancelled: 0x6b7370 };
const NO_MENTIONS = { parse: [] };

let client = null;
let handlers = {};

const enabled = () => Boolean(TOKEN && CHANNEL_ID);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const safe = (s) => escapeMarkdown(String(s ?? ''));
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');

/* ---------- Nachrichten bauen ---------- */
function orderEmbed(o) {
  const lines = o.items.map((it) => {
    const s = byId(it.service_id);
    const name = s ? s.name.de : it.service_id;
    const price = it.unit_price_cents != null
      ? ` · ${euro(it.unit_price_cents)} = **${euro(it.unit_price_cents * it.qty)}**`
      : ' · Preis offen';
    let line = `**${it.qty}×** ${name}${price}`;
    if (it.note) line += `\n> ${clip(safe(it.note).replace(/\n+/g, ' '), 180)}`;
    const files = o.attachments.filter((a) => a.item_id === it.id).length;
    if (files) line += `\n> 📎 ${files} ${files === 1 ? 'Datei' : 'Dateien'}`;
    return line;
  });

  const embed = new EmbedBuilder()
    .setTitle(`#${o.id} · ${clip(safe(o.display_name), 200)}`)
    .setColor(COLORS[o.status] ?? COLORS.new)
    .addFields(
      { name: 'Positionen', value: clip(lines.join('\n') || '–', 1024) },
      { name: 'Summe', value: o.total_cents != null ? euro(o.total_cents) : 'nach Absprache', inline: true },
      { name: 'Deadline', value: fmtDate(o.deadline), inline: true },
      { name: 'Status', value: STATUS_LABEL[o.status]?.de || o.status, inline: true },
    )
    .setFooter({ text: clip(`${o.username}${o.user_discord ? ` · Discord: ${o.user_discord}` : ''}`, 200) })
    .setTimestamp(new Date(`${o.created_at.replace(' ', 'T')}Z`));
  if (o.message) embed.setDescription(clip(safe(o.message), 2000));
  if (o.links) embed.addFields({ name: 'Links', value: clip(safe(o.links), 1024) });
  const general = o.attachments.filter((a) => !a.item_id).length;
  if (general) embed.addFields({ name: 'Allgemeine Anhänge', value: `📎 ${general}` });
  return embed;
}

function statusRow(o) {
  const btn = (status, style) => new ButtonBuilder()
    .setCustomId(`dp:status:${o.id}:${status}`)
    .setLabel(STATUS_LABEL[status].de)
    .setStyle(style)
    .setDisabled(o.status === status);
  return new ActionRowBuilder().addComponents(
    btn('progress', ButtonStyle.Primary),
    btn('review', ButtonStyle.Secondary),
    btn('done', ButtonStyle.Success),
    btn('cancelled', ButtonStyle.Danger),
  );
}

function fileAttachments(o) {
  const files = [];
  let skipped = 0;
  for (const a of o.attachments) {
    if (files.length >= 10 || a.size > MAX_FILE_BYTES) { skipped++; continue; }
    files.push(new AttachmentBuilder(openStream(o.id, a.stored_name), { name: a.original_name.replace(/[^\w.\-]+/g, '_').slice(-80) }));
  }
  return { files, skipped };
}

async function channel() {
  const ch = await client.channels.fetch(CHANNEL_ID);
  if (!ch || !ch.isTextBased()) throw new Error('DISCORD_CHANNEL_ID ist kein Text-Kanal');
  return ch;
}

/* ---------- Öffentliche Funktionen ---------- */
async function sendOrder(o) {
  if (!client?.isReady()) return null;
  try {
    const { files, skipped } = fileAttachments(o);
    const ch = await channel();
    const msg = await ch.send({
      content: skipped ? `⚠️ ${skipped} Anhang/Anhänge zu groß für Discord, liegen im Admin-Bereich.` : undefined,
      embeds: [orderEmbed(o)],
      components: [statusRow(o)],
      files,
      allowedMentions: NO_MENTIONS,
    });
    return { channelId: ch.id, messageId: msg.id };
  } catch (err) {
    console.error('Discord: Auftrag konnte nicht gesendet werden:', err.message);
    return null;
  }
}

async function updateOrder(o) {
  if (!client?.isReady() || !o.discord_message) return;
  try {
    const ch = await client.channels.fetch(o.discord_channel || CHANNEL_ID);
    const msg = await ch.messages.fetch(o.discord_message);
    await msg.edit({ embeds: [orderEmbed(o)], components: [statusRow(o)], allowedMentions: NO_MENTIONS });
  } catch (err) {
    console.error(`Discord: Nachricht zu #${o.id} konnte nicht aktualisiert werden:`, err.message);
  }
}

async function sendContact(c) {
  if (!client?.isReady()) return false;
  try {
    const embed = new EmbedBuilder()
      .setTitle('Neue Anfrage über die Website')
      .setColor(COLORS.new)
      .addFields(
        { name: 'Name / Kanal', value: clip(safe(c.name), 256), inline: true },
        { name: 'E-Mail', value: clip(safe(c.email), 256), inline: true },
        { name: 'Interesse', value: clip(safe(c.services || '–'), 1024) },
        { name: 'Budget', value: clip(safe(c.budget || '–'), 100), inline: true },
        { name: 'Bis wann', value: fmtDate(c.deadline), inline: true },
      )
      .setDescription(clip(safe(c.message), 3000))
      .setTimestamp(new Date());
    await (await channel()).send({ embeds: [embed], allowedMentions: NO_MENTIONS });
    return true;
  } catch (err) {
    console.error('Discord: Kontaktanfrage konnte nicht gesendet werden:', err.message);
    return false;
  }
}

/* ---------- Bot: Befehle und Buttons ---------- */
function todoText(orders) {
  if (!orders.length) return 'Nichts offen. 🎉';
  return clip(orders.map((o) => {
    const items = o.items.map((it) => `${it.qty}× ${byId(it.service_id)?.name.de || it.service_id}`).join(', ');
    return `**#${o.id}** · ${safe(o.display_name)} · ${items} · ${o.deadline ? `bis ${fmtDate(o.deadline)}` : 'ohne Deadline'} · *${STATUS_LABEL[o.status].de}*`;
  }).join('\n'), 3900);
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('todo').setDescription('Offene Aufträge, früheste Deadline zuerst')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('auftrag').setDescription('Einen Auftrag anzeigen')
      .addIntegerOption((opt) => opt.setName('nummer').setDescription('Auftragsnummer').setRequired(true).setMinValue(1))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map((c) => c.toJSON());
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const route = GUILD_ID ? Routes.applicationGuildCommands(client.user.id, GUILD_ID) : Routes.applicationCommands(client.user.id);
  await rest.put(route, { body: commands });
}

async function onInteraction(interaction) {
  if (!interaction.isButton() && !interaction.isChatInputCommand()) return;
  const ephemeral = { flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS };
  if (!ADMIN_IDS.has(interaction.user.id)) {
    await interaction.reply({ ...ephemeral, content: 'Dafür hast du keine Berechtigung.' });
    return;
  }

  if (interaction.isButton()) {
    const m = /^dp:status:(\d+):(\w+)$/.exec(interaction.customId);
    if (!m) return;
    const order = await handlers.setStatus(Number(m[1]), m[2], { fromDiscord: true });
    if (!order) { await interaction.reply({ ...ephemeral, content: 'Auftrag nicht gefunden.' }); return; }
    await interaction.update({ embeds: [orderEmbed(order)], components: [statusRow(order)] });
    return;
  }

  if (interaction.commandName === 'todo') {
    await interaction.reply({ ...ephemeral, content: todoText(await handlers.listOpen()) });
  } else if (interaction.commandName === 'auftrag') {
    const order = await handlers.getOrder(interaction.options.getInteger('nummer', true));
    if (!order) { await interaction.reply({ ...ephemeral, content: 'Auftrag nicht gefunden.' }); return; }
    await interaction.reply({ ...ephemeral, embeds: [orderEmbed(order)] });
  }
}

function start(h) {
  handlers = h;
  if (!enabled()) {
    console.log('Discord-Bot: aus (kein DISCORD_TOKEN in .env). Anfragen landen nur im Admin-Bereich.');
    return;
  }
  if (!ADMIN_IDS.size) console.warn('Discord: DISCORD_ADMIN_IDS ist leer, niemand kann Buttons oder Befehle benutzen.');
  client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, async (c) => {
    console.log(`Discord: eingeloggt als ${c.user.tag}`);
    try { await registerCommands(); } catch (err) { console.error('Discord: Befehle konnten nicht registriert werden:', err.message); }
  });
  client.on(Events.InteractionCreate, (i) => onInteraction(i).catch((err) => console.error('Discord:', err.message)));
  client.on(Events.Error, (err) => console.error('Discord:', err.message));
  client.login(TOKEN).catch((err) => console.error('Discord: Login fehlgeschlagen:', err.message));
}

module.exports = { start, sendOrder, updateOrder, sendContact, enabled };
