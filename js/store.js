// Persistencia local: proyectos, papelera, historial y ajustes en localStorage.
// Los archivos pesados (imágenes, audio, clips) viven en IndexedDB (media.js).

import { deleteMediaByPrefix, copyMediaPrefix } from './media.js';

const KEY = 'reelfactory:v1';
const MAX_SIGS = 600;
const MAX_LOG = 150;

const DEFAULT_SETTINGS = {
  providers: {
    text: { adapter: 'none', baseUrl: '', token: '', model: '' },
    voice: { adapter: 'browser', baseUrl: '', token: '', model: '' },
    image: { adapter: 'none', baseUrl: '', token: '', model: '' },
    video: { adapter: 'none', baseUrl: '', token: '', model: '' },
    edit: { adapter: 'local', baseUrl: '', token: '', model: '' },
  },
  voiceURI: '',
  rate: 1,
  pitch: 1,
  includeCta: true,
};

let state = load();
const listeners = new Set();
let lastSaveError = null;

function blank() {
  return { v: 1, projects: {}, trash: {}, sigs: [], log: [], favCats: [], settings: structuredCloneSafe(DEFAULT_SETTINGS), currentId: null };
}

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    const base = blank();
    const merged = { ...base, ...parsed };
    merged.settings = { ...base.settings, ...(parsed.settings || {}) };
    merged.settings.providers = { ...base.settings.providers, ...((parsed.settings || {}).providers || {}) };
    return merged;
  } catch (e) {
    console.warn('No se pudo leer el almacenamiento local', e);
    return blank();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    lastSaveError = null;
  } catch (e) {
    lastSaveError = e;
    console.warn('No se pudo guardar', e);
    emit('error');
  }
}

function emit(type = 'change') {
  listeners.forEach((fn) => fn(type));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getState = () => state;
export const getSaveError = () => lastSaveError;
export const uid = (p = 'p') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

// ---------- Proyectos ----------
export const getProject = (id) => state.projects[id] || null;
export const listProjects = () => Object.values(state.projects).sort((a, b) => b.updatedAt - a.updatedAt);
export const listTrash = () => Object.values(state.trash).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

export function addLog(action, project) {
  state.log.unshift({ t: Date.now(), action, id: project?.id || null, title: project?.title || '' });
  if (state.log.length > MAX_LOG) state.log.length = MAX_LOG;
}

export function saveProject(p, { silent = false, log } = {}) {
  p.updatedAt = Date.now();
  state.projects[p.id] = p;
  if (log) addLog(log, p);
  persist();
  if (!silent) emit();
  return p;
}

// Aplica un cambio y guarda. silent evita volver a renderizar (útil mientras se escribe).
export function updateProject(id, mutator, opts = {}) {
  const p = state.projects[id];
  if (!p) return null;
  mutator(p);
  return saveProject(p, opts);
}

export function setCurrent(id) {
  state.currentId = id;
  persist();
}

export function duplicateProject(id) {
  const src = state.projects[id];
  if (!src) return null;
  const copy = structuredCloneSafe(src);
  copy.id = uid('p');
  copy.title = src.title + ' (copia)';
  copy.createdAt = Date.now();
  copy.favorite = false;
  copyMediaPrefix(src.id + ':', copy.id + ':').catch((e) => console.warn(e));
  saveProject(copy, { log: 'Duplicado' });
  return copy;
}

export function trashProject(id) {
  const p = state.projects[id];
  if (!p) return;
  delete state.projects[id];
  p.deletedAt = Date.now();
  state.trash[id] = p;
  addLog('Enviado a papelera', p);
  if (state.currentId === id) state.currentId = null;
  persist();
  emit();
}

export function restoreProject(id) {
  const p = state.trash[id];
  if (!p) return;
  delete state.trash[id];
  delete p.deletedAt;
  state.projects[id] = p;
  addLog('Recuperado', p);
  persist();
  emit();
}

export function purgeProject(id) {
  const p = state.trash[id];
  if (!p) return;
  delete state.trash[id];
  deleteMediaByPrefix(id + ':').catch(() => {});
  addLog('Eliminado definitivamente', p);
  persist();
  emit();
}

export function emptyTrash() {
  Object.keys(state.trash).forEach((id) => {
    deleteMediaByPrefix(id + ':').catch(() => {});
  });
  state.trash = {};
  persist();
  emit();
}

export function toggleFavorite(id) {
  const p = state.projects[id];
  if (!p) return;
  p.favorite = !p.favorite;
  saveProject(p, { log: p.favorite ? 'Marcado favorito' : 'Favorito quitado' });
}

// ---------- Favoritos de categoría ----------
export function toggleFavCat(id) {
  const i = state.favCats.indexOf(id);
  if (i >= 0) state.favCats.splice(i, 1);
  else state.favCats.push(id);
  persist();
  emit();
}

// ---------- Historias ya usadas (para no repetir) ----------
export const hasSignature = (s) => state.sigs.includes(s);
export function addSignature(s) {
  if (!state.sigs.includes(s)) state.sigs.push(s);
  if (state.sigs.length > MAX_SIGS) state.sigs.splice(0, state.sigs.length - MAX_SIGS);
  persist();
}
export function clearSignatures() {
  state.sigs = [];
  persist();
  emit();
}

// ---------- Ajustes ----------
export const getSettings = () => state.settings;
export function updateSettings(mutator, { silent = false } = {}) {
  mutator(state.settings);
  persist();
  if (!silent) emit();
}

// ---------- Copia de seguridad ----------
export function exportAll() {
  return JSON.stringify(
    { app: 'reel-factory', version: 1, exportedAt: new Date().toISOString(), projects: state.projects, trash: state.trash, favCats: state.favCats, sigs: state.sigs, log: state.log, settings: stripSecrets(state.settings) },
    null,
    2,
  );
}

function stripSecrets(s) {
  const c = structuredCloneSafe(s);
  Object.values(c.providers).forEach((p) => {
    p.token = '';
  });
  return c;
}

export function importAll(text) {
  const data = JSON.parse(text);
  if (data.app !== 'reel-factory' || typeof data.projects !== 'object') throw new Error('El archivo no es una copia de REEL FACTORY.');
  let added = 0;
  Object.values(data.projects).forEach((p) => {
    if (!p || !p.id || !Array.isArray(p.scenes)) return;
    if (!state.projects[p.id]) added++;
    // Los medios no viajan en la copia JSON: se limpian las marcas.
    p.scenes.forEach((s) => (s.media = { image: false, audio: false, clip: false }));
    if (p.music) p.music.hasTrack = false;
    state.projects[p.id] = p;
  });
  if (Array.isArray(data.favCats)) data.favCats.forEach((c) => !state.favCats.includes(c) && state.favCats.push(c));
  if (Array.isArray(data.sigs)) data.sigs.forEach((s) => !state.sigs.includes(s) && state.sigs.push(s));
  addLog(`Importados ${added} proyectos`, null);
  persist();
  emit();
  return added;
}

export function resetEverything() {
  Object.keys(state.projects).concat(Object.keys(state.trash)).forEach((id) => deleteMediaByPrefix(id + ':').catch(() => {}));
  state = blank();
  persist();
  emit();
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) {
    /* ignorado */
  }
  return false;
}
