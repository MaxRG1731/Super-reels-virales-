// Ayudantes de medios para la interfaz: miniaturas, guardado/borrado por escena, grabación de voz.

import { getMedia, putMedia, deleteMedia, mediaKey, imageToReelBlob } from '../media.js';
import { updateProject } from '../store.js';
import { reloadMedia } from './preview.js';

const urlCache = new Map(); // key -> {url, v}
const versions = new Map();

const ver = (k) => versions.get(k) || 0;

export async function thumbUrl(key) {
  const hit = urlCache.get(key);
  if (hit && hit.v === ver(key)) return hit.url;
  const blob = await getMedia(key);
  if (hit) URL.revokeObjectURL(hit.url);
  if (!blob) {
    urlCache.delete(key);
    return null;
  }
  const url = URL.createObjectURL(blob);
  urlCache.set(key, { url, v: ver(key) });
  return url;
}

function bump(key) {
  versions.set(key, ver(key) + 1);
}

// Rellena <img|video|audio data-media="clave"> con la URL de objeto.
export async function hydrate(root) {
  const nodes = root.querySelectorAll('[data-media]');
  await Promise.all(
    [...nodes].map(async (n) => {
      try {
        const u = await thumbUrl(n.dataset.media);
        if (u) {
          n.src = u;
          n.classList.add('ready');
        }
      } catch (e) {
        console.warn(e);
      }
    }),
  );
}

export async function saveMedia(pid, sid, kind, blob) {
  const key = mediaKey(pid, sid, kind);
  await putMedia(key, blob);
  bump(key);
  updateProject(pid, (p) => {
    const s = p.scenes.find((x) => x.id === sid);
    if (s) s.media[kind] = true;
  }, { silent: true });
  await reloadMedia();
}

export async function saveImage(pid, sid, fileOrBlob) {
  const blob = await imageToReelBlob(fileOrBlob);
  await saveMedia(pid, sid, 'image', blob);
}

export async function removeMedia(pid, sid, kind) {
  const key = mediaKey(pid, sid, kind);
  await deleteMedia(key);
  bump(key);
  updateProject(pid, (p) => {
    const s = p.scenes.find((x) => x.id === sid);
    if (s) s.media[kind] = false;
  }, { silent: true });
  await reloadMedia();
}

export async function saveMusic(pid, file) {
  const key = mediaKey(pid, 'music', 'track');
  await putMedia(key, file);
  bump(key);
  updateProject(pid, (p) => {
    p.music.hasTrack = true;
    p.music.trackName = file.name || 'pista';
  }, { silent: true });
  await reloadMedia();
}

export async function removeMusic(pid) {
  const key = mediaKey(pid, 'music', 'track');
  await deleteMedia(key);
  bump(key);
  updateProject(pid, (p) => {
    p.music.hasTrack = false;
    p.music.trackName = '';
  }, { silent: true });
  await reloadMedia();
}

export function audioDuration(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = 'metadata';
    const done = (d) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    a.onloadedmetadata = () => {
      if (a.duration === Infinity) {
        a.currentTime = 1e101;
        a.ontimeupdate = () => {
          a.ontimeupdate = null;
          done(a.duration);
        };
      } else done(a.duration);
    };
    a.onerror = () => done(0);
    a.src = url;
    setTimeout(() => done(0), 5000);
  });
}

// Tras guardar una voz, ajusta la duración de la escena si la voz no cabe o sobra mucho.
export async function fitSceneToAudio(pid, sid, blob) {
  const d = await audioDuration(blob);
  if (!d || !isFinite(d)) return null;
  const want = Math.max(2, Math.ceil((d + 0.3) * 2) / 2);
  let changed = null;
  updateProject(pid, (p) => {
    const s = p.scenes.find((x) => x.id === sid);
    if (s && Math.abs(s.secs - want) > 0.4) {
      changed = { from: s.secs, to: want };
      s.secs = want;
    }
  }, { silent: true });
  return changed;
}

// ---------------------------------------------------------------- grabación de voz propia
export class VoiceRecorder {
  constructor() {
    this.rec = null;
    this.chunks = [];
    this.stream = null;
  }

  static supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    this.rec.start(200);
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = () => {
        this.stream && this.stream.getTracks().forEach((t) => t.stop());
        const type = this.rec.mimeType || 'audio/webm';
        resolve(new Blob(this.chunks, { type }));
        this.rec = null;
      };
      try {
        this.rec.stop();
      } catch {
        resolve(null);
      }
    });
  }

  cancel() {
    try {
      this.rec && this.rec.state !== 'inactive' && this.rec.stop();
    } catch {
      /* ignorado */
    }
    this.stream && this.stream.getTracks().forEach((t) => t.stop());
    this.rec = null;
  }
}
