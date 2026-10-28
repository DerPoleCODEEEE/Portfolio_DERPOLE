'use strict';

// Alle Dienste, die Kunden im Portal anfragen können. Die IDs passen zu den Paketen auf der Startseite.
const SERVICES = [
  { id: 'short', cat: 'video', icon: 'knight', name: { de: 'Schach-Short', en: 'Chess short' }, unit: { de: 'Video', en: 'video' } },
  { id: 'youtube', cat: 'video', icon: 'youtube', name: { de: 'YouTube-Video', en: 'YouTube video' }, unit: { de: 'Video', en: 'video' } },
  { id: 'emotes', cat: 'stream', icon: 'smile', name: { de: 'Emotes', en: 'Emotes' }, unit: { de: 'Emote', en: 'emote' } },
  { id: 'badges', cat: 'stream', icon: 'badge', name: { de: 'Sub-Badges', en: 'Sub badges' }, unit: { de: 'Stufe', en: 'tier' } },
  { id: 'overlay', cat: 'stream', icon: 'layers', name: { de: 'Stream-Overlay', en: 'Stream overlay' }, unit: { de: 'Overlay', en: 'overlay' } },
  { id: 'panels', cat: 'stream', icon: 'panel', name: { de: 'Panels & Banner', en: 'Panels & banner' }, unit: { de: 'Grafik', en: 'graphic' } },
  { id: 'website', cat: 'code', icon: 'globe', name: { de: 'Custom Website', en: 'Custom website' }, unit: { de: 'Projekt', en: 'project' } },
  { id: 'chessmode', cat: 'code', icon: 'knight', name: { de: 'Schach-Modus', en: 'Chess mode' }, unit: { de: 'Projekt', en: 'project' } },
  { id: 'tools', cat: 'code', icon: 'tool', name: { de: 'Stream-Tool', en: 'Stream tool' }, unit: { de: 'Tool', en: 'tool' } },
  { id: 'thumbnail', cat: 'extra', icon: 'image', name: { de: 'Thumbnail', en: 'Thumbnail' }, unit: { de: 'Thumbnail', en: 'thumbnail' } },
  { id: 'clips', cat: 'extra', icon: 'scissors', name: { de: 'Clip aus Stream', en: 'Clip from stream' }, unit: { de: 'Clip', en: 'clip' } },
  { id: 'subtitles', cat: 'extra', icon: 'cc', name: { de: 'Untertitel', en: 'Subtitles' }, unit: { de: 'Video', en: 'video' } },
  { id: 'seo', cat: 'extra', icon: 'hash', name: { de: 'Titel & Hashtags', en: 'Titles & hashtags' }, unit: { de: 'Video', en: 'video' } },
  { id: 'script', cat: 'extra', icon: 'script', name: { de: 'Partieanalyse & Skript', en: 'Game analysis & script' }, unit: { de: 'Partie', en: 'game' } },
];

const SERVICE_IDS = new Set(SERVICES.map((s) => s.id));
const byId = (id) => SERVICES.find((s) => s.id === id);

// Status eines Auftrags, in dieser Reihenfolge
const STATUSES = ['new', 'progress', 'review', 'done', 'cancelled'];
const STATUS_LABEL = {
  new: { de: 'Neu', en: 'New' },
  progress: { de: 'In Arbeit', en: 'In progress' },
  review: { de: 'Zur Abnahme', en: 'Ready for review' },
  done: { de: 'Fertig', en: 'Done' },
  cancelled: { de: 'Abgebrochen', en: 'Cancelled' },
};
const OPEN_STATUSES = ['new', 'progress', 'review'];

module.exports = { SERVICES, SERVICE_IDS, byId, STATUSES, STATUS_LABEL, OPEN_STATUSES };
