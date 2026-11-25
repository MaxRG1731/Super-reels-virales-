// Reproductor vertical 9:16 y montaje final en el navegador (Canvas + MediaRecorder).
// La misma rutina de dibujo sirve para la vista previa y para exportar el video.

import { cuesFor, totalSecs } from './generator.js';
import { CATEGORIES, STYLES, ROLE_LABELS, ROLE_COLORS, byId } from './data.js';
import { getMedia, mediaKey } from './media.js';

export const W = 540;
export const H = 960;

const SUB_SIZES = { s: 40, m: 52, l: 64 };
const SUB_POS = { top: 0.28, mid: 0.56, bottom: 0.7 };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function unlockSpeech() {
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch (e) {
    /* ignorado */
  }
}

export function getVoices() {
  return 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
}

export function pickSpanishVoice(voiceURI) {
  const voices = getVoices();
  if (voiceURI) {
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  return voices.find((v) => /^es[-_]MX/i.test(v.lang)) || voices.find((v) => /^es[-_]US/i.test(v.lang)) || voices.find((v) => /^es/i.test(v.lang)) || null;
}

export class ReelPlayer {
  constructor(canvas, project, opts = {}) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.overlay = opts.overlay !== false;
    this.settings = opts.settings || { rate: 1, pitch: 1, voiceURI: '', includeCta: true };
    this.t = 0;
    this.playing = false;
    this.speak = true;
    this.onTick = null;
    this.onEnd = null;
    this.images = {};
    this.audios = {};
    this.videos = {};
    this.videoUrls = [];
    this.exporting = false;
    this.musicUrl = null;
    this.musicEl = null;
    this.curAudio = null;
    this._lastScene = -1;
    this._raf = 0;
    this.setProject(project);
  }

  setProject(p) {
    this.p = p;
    this.cues = cuesFor(p);
    this.total = totalSecs(p);
    this.starts = [];
    let t = 0;
    p.scenes.forEach((s) => {
      this.starts.push(t);
      t += Number(s.secs) || 0;
    });
    this.ctaStart = Math.max(0, this.total - 2.5);
  }

  async load() {
    this.images = {};
    const old = this.audios;
    Object.values(old).forEach((u) => URL.revokeObjectURL(u));
    this.audios = {};
    this.videoUrls.forEach((u) => URL.revokeObjectURL(u));
    Object.values(this.videos).forEach((v) => v.pause());
    this.videos = {};
    this.videoUrls = [];
    if (this.musicUrl) URL.revokeObjectURL(this.musicUrl);
    this.musicUrl = null;
    await Promise.all(
      this.p.scenes.map(async (s) => {
        try {
          if (s.media?.image) {
            const b = await getMedia(mediaKey(this.p.id, s.id, 'image'));
            if (b) this.images[s.id] = await createImageBitmap(b);
          }
          if (s.media?.audio) {
            const b = await getMedia(mediaKey(this.p.id, s.id, 'audio'));
            if (b) this.audios[s.id] = URL.createObjectURL(b);
          }
          if (s.media?.clip) {
            const b = await getMedia(mediaKey(this.p.id, s.id, 'clip'));
            if (b) {
              const url = URL.createObjectURL(b);
              this.videoUrls.push(url);
              const v = document.createElement('video');
              v.muted = true;
              v.playsInline = true;
              v.loop = true;
              v.preload = 'auto';
              v.onseeked = () => !this.playing && !this.exporting && this.draw(this.t);
              v.src = url;
              await new Promise((res) => {
                v.onloadeddata = res;
                v.onerror = res;
                setTimeout(res, 5000);
              });
              this.videos[s.id] = v;
            }
          }
        } catch (e) {
          console.warn('No se pudo cargar medio de la escena', s.id, e);
        }
      }),
    );
    try {
      if (this.p.music?.hasTrack) {
        const b = await getMedia(mediaKey(this.p.id, 'music', 'track'));
        if (b) this.musicUrl = URL.createObjectURL(b);
      }
    } catch (e) {
      console.warn(e);
    }
    this.draw(this.t);
  }

  sceneIndexAt(t) {
    for (let i = this.p.scenes.length - 1; i >= 0; i--) if (t >= this.starts[i]) return i;
    return 0;
  }

  syncVideos(t) {
    const idx = this.sceneIndexAt(t);
    const sc = this.p.scenes[idx];
    if (!sc) return;
    const active = this.playing || this.exporting;
    for (const [id, v] of Object.entries(this.videos)) if (id !== sc.id && !v.paused) v.pause();
    const v = this.videos[sc.id];
    if (!v) return;
    const local = t - this.starts[idx];
    const dur = v.duration && isFinite(v.duration) ? v.duration : 0;
    if (active) {
      if (v.paused) {
        v.currentTime = dur ? local % dur : 0;
        v.play().catch(() => {});
      }
    } else {
      if (!v.paused) v.pause();
      const target = dur ? local % dur : 0;
      if (Math.abs(v.currentTime - target) > 0.08) v.currentTime = target;
    }
  }

  // ------------------------------------------------------------ dibujo
  draw(t) {
    const { ctx, p } = this;
    const idx = this.sceneIndexAt(t);
    const scene = p.scenes[idx];
    this.syncVideos(t);
    ctx.clearRect(0, 0, W, H);
    if (!scene) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const local = t - this.starts[idx];
    const u = Math.min(1, Math.max(0, local / (scene.secs || 1)));
    this.drawBackground(scene, idx, t, u);
    // viñeta
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // aparición desde negro
    if (local < 0.3) {
      ctx.fillStyle = `rgba(0,0,0,${0.85 * (1 - local / 0.3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (t > this.total - 0.4) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - (this.total - 0.4)) / 0.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawSubtitle(t);
    if (t >= this.ctaStart && p.cta) this.drawCta(t);
    if (this.overlay) this.drawOverlay(scene, idx, t);
  }

  drawBackground(scene, idx, t, u) {
    const { ctx, p } = this;
    const vid = this.videos[scene.id];
    if (vid && vid.readyState >= 2 && vid.videoWidth) {
      const sc = Math.max(W / vid.videoWidth, H / vid.videoHeight);
      const dw = vid.videoWidth * sc;
      const dh = vid.videoHeight * sc;
      ctx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh);
      return;
    }
    const bmp = this.images[scene.id];
    if (bmp) {
      const zoomIn = idx % 2 === 0;
      const scale = (zoomIn ? 1.04 + 0.1 * u : 1.14 - 0.1 * u) * Math.max(W / bmp.width, H / bmp.height);
      const dw = bmp.width * scale;
      const dh = bmp.height * scale;
      const px = (hash(scene.id) - 0.5) * 30 * u;
      ctx.drawImage(bmp, (W - dw) / 2 + px, (H - dh) / 2 - 10 * u, dw, dh);
      return;
    }
    const st = byId(STYLES, p.style) || STYLES[0];
    const cat = byId(CATEGORIES, p.categories[0]) || CATEGORIES[0];
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, st.grad[0]);
    g.addColorStop(1, st.grad[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const seed = hash(scene.id);
    const gx = W * (0.3 + 0.4 * Math.sin(seed * 6 + t * 0.2));
    const gy = H * (0.35 + 0.12 * Math.cos(seed * 9 + t * 0.15));
    const rg = ctx.createRadialGradient(gx, gy, 10, gx, gy, W * 0.95);
    rg.addColorStop(0, hexA(cat.color, 0.34));
    rg.addColorStop(1, hexA(cat.color, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      const r = 20 + hash(scene.id + 'r' + i) * 60;
      const x = hash(scene.id + 'x' + i) * W;
      const y = (((hash(scene.id + 'y' + i) * H - t * (6 + i * 3)) % (H + 2 * r)) + (H + 2 * r)) % (H + 2 * r) - r;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexA('#ffffff', 0.035 + 0.02 * (i % 3));
      ctx.fill();
    }
    ctx.font = '280px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.1;
    ctx.fillText(cat.emoji, W / 2 + Math.sin(t * 0.4) * 8, H * 0.4);
    ctx.globalAlpha = 1;
  }

  drawSubtitle(t) {
    const { ctx, p } = this;
    const cue = this.cues.find((c) => t >= c.start && t < c.end);
    if (!cue) return;
    const ss = p.subStyle || {};
    const size = SUB_SIZES[ss.size] || SUB_SIZES.m;
    const words = cue.text.split(/\s+/);
    ctx.font = `800 ${size}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const maxW = W * 0.86;
    const space = ctx.measureText(' ').width;
    const lines = [];
    let cur = [];
    let curW = 0;
    words.forEach((w, i) => {
      const ww = ctx.measureText(w).width;
      if (cur.length && curW + space + ww > maxW) {
        lines.push({ ws: cur, w: curW });
        cur = [];
        curW = 0;
      }
      cur.push({ w, ww, i });
      curW += (cur.length > 1 ? space : 0) + ww;
    });
    if (cur.length) lines.push({ ws: cur, w: curW });
    const prog = (t - cue.start) / Math.max(0.05, cue.end - cue.start);
    const hiIdx = Math.min(words.length - 1, Math.floor(prog * words.length));
    const lineH = size * 1.18;
    const top = H * (SUB_POS[ss.pos] ?? SUB_POS.mid) - (lines.length * lineH) / 2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.92)';
    lines.forEach((ln, li) => {
      let x = (W - ln.w) / 2;
      const y = top + li * lineH + size;
      ln.ws.forEach((wd, k) => {
        ctx.strokeText(wd.w, x, y);
        ctx.fillStyle = wd.i === hiIdx ? ss.hi || '#ffd24d' : ss.color || '#fff';
        ctx.fillText(wd.w, x, y);
        x += wd.ww + space;
      });
    });
  }

  drawCta(t) {
    const { ctx, p } = this;
    const a = Math.min(1, (t - this.ctaStart) / 0.4);
    const text = p.cta;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 30px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    words.forEach((w) => {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > W * 0.72 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    });
    if (cur) lines.push(cur);
    const h = lines.length * 38 + 36;
    const y = H * 0.18;
    ctx.fillStyle = 'rgba(10,10,16,0.78)';
    const x0 = W * 0.08;
    const w0 = W * 0.84;
    ctx.beginPath();
    ctx.roundRect(x0, y - h / 2, w0, h, 28);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y - h / 2 + 18 + 19 + i * 38));
    ctx.restore();
  }

  drawOverlay(scene, idx, t) {
    const { ctx, p } = this;
    // barra de progreso segmentada
    const gap = 4;
    const n = p.scenes.length;
    const segW = (W - 24 - gap * (n - 1)) / n;
    p.scenes.forEach((s, i) => {
      const x = 12 + i * (segW + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, 14, segW, 4);
      const f = t >= this.starts[i] + s.secs ? 1 : t <= this.starts[i] ? 0 : (t - this.starts[i]) / s.secs;
      ctx.fillStyle = i === idx ? ROLE_COLORS[s.role] || '#fff' : '#fff';
      ctx.fillRect(x, 14, segW * f, 4);
    });
    // etiqueta de escena
    const label = `${idx + 1}/${n} · ${(ROLE_LABELS[scene.role] || '').toUpperCase()}`;
    ctx.font = '700 22px -apple-system, "SF Pro Display", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(12, 30, w, 36, 18);
    ctx.fill();
    ctx.fillStyle = ROLE_COLORS[scene.role] || '#fff';
    ctx.fillText(label, 26, 49);
    if (!this.images[scene.id] && !this.videos[scene.id]) {
      ctx.font = 'italic 500 22px -apple-system, "SF Pro Display", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      const words = ('Sin imagen: ' + scene.visual).split(' ');
      const lines = [];
      let cur = '';
      words.forEach((wd) => {
        const test = cur ? cur + ' ' + wd : wd;
        if (ctx.measureText(test).width > W * 0.78 && cur) {
          lines.push(cur);
          cur = wd;
        } else cur = test;
      });
      if (cur) lines.push(cur);
      lines.slice(0, 5).forEach((l, i) => ctx.fillText(l, W / 2, H * 0.22 + i * 28));
    }
  }

  // ------------------------------------------------------------ reproducción
  play() {
    if (this.playing) return;
    if (this.t >= this.total - 0.05) this.t = 0;
    this.playing = true;
    this._last = performance.now();
    this._lastScene = -1;
    unlockSpeech();
    this.startMusic();
    const loop = (now) => {
      if (!this.playing) return;
      this.t += (now - this._last) / 1000;
      this._last = now;
      if (this.t >= this.total) {
        this.t = this.total;
        this.draw(this.t);
        this.pause();
        this.onTick && this.onTick(this.t);
        this.onEnd && this.onEnd();
        return;
      }
      const idx = this.sceneIndexAt(this.t);
      if (idx !== this._lastScene) {
        this._lastScene = idx;
        this.narrate(idx);
      }
      this.draw(this.t);
      this.onTick && this.onTick(this.t);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this._raf);
    this.stopVoices();
    Object.values(this.videos).forEach((v) => v.pause());
    if (this.musicEl) this.musicEl.pause();
  }

  toggle() {
    this.playing ? this.pause() : this.play();
    return this.playing;
  }

  seek(t) {
    this.t = Math.max(0, Math.min(this.total, t));
    if (this.playing) {
      this.stopVoices();
      this._lastScene = -1;
    }
    this.draw(this.t);
    this.onTick && this.onTick(this.t);
  }

  seekScene(i) {
    this.seek(this.starts[i] ?? 0);
  }

  stopVoices() {
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (e) {
      /* ignorado */
    }
    if (this.curAudio) {
      this.curAudio.pause();
      this.curAudio = null;
    }
  }

  startMusic() {
    if (!this.musicUrl) return;
    if (!this.musicEl) {
      this.musicEl = new Audio(this.musicUrl);
      this.musicEl.loop = true;
    }
    this.musicEl.volume = Math.min(1, Math.max(0, this.p.music?.volume ?? 0.35));
    this.musicEl.currentTime = this.t % (this.musicEl.duration || 1e9);
    this.musicEl.play().catch(() => {});
  }

  narrate(idx) {
    this.stopVoices();
    if (!this.speak) return;
    const s = this.p.scenes[idx];
    if (!s) return;
    if (this.audios[s.id]) {
      this.curAudio = new Audio(this.audios[s.id]);
      this.curAudio.play().catch(() => {});
      return;
    }
    speakText(s.narration, this.settings);
    // la llamada a la acción se encola justo después de la última escena
    if (idx === this.p.scenes.length - 1 && this.settings.includeCta && this.p.cta) speakText(this.p.cta, this.settings);
  }

  destroy() {
    this.pause();
    Object.values(this.audios).forEach((u) => URL.revokeObjectURL(u));
    this.videoUrls.forEach((u) => URL.revokeObjectURL(u));
    this.videos = {};
    if (this.musicUrl) URL.revokeObjectURL(this.musicUrl);
    this.musicEl = null;
  }
}

export function speakText(text, settings = {}) {
  if (!('speechSynthesis' in window) || !text) return null;
  const u = new SpeechSynthesisUtterance(text);
  const v = pickSpanishVoice(settings.voiceURI);
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else u.lang = 'es-MX';
  u.rate = settings.rate || 1;
  u.pitch = settings.pitch || 1;
  window.speechSynthesis.speak(u);
  return u;
}

// ---------------------------------------------------------------- exportación
const MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickMime() {
  if (!('MediaRecorder' in window)) return null;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

export function exportSupport() {
  const mime = pickMime();
  return { ok: !!mime && !!HTMLCanvasElement.prototype.captureStream, mime };
}

// Graba el Reel en tiempo real. Incluye audio solo si hay archivos de voz por escena o pista de música:
// la voz del dispositivo (Web Speech) no puede capturarse dentro del video.
export async function exportVideo(project, { onProgress, signal } = {}) {
  const sup = exportSupport();
  if (!sup.ok) throw new Error('Este navegador no puede grabar video desde Canvas.');
  const canvas = document.createElement('canvas');
  const player = new ReelPlayer(canvas, project, { overlay: false });
  player.exporting = true;
  await player.load();
  const stream = canvas.captureStream(30);

  let ac = null;
  const sources = [];
  const hasVoice = Object.keys(player.audios).length > 0;
  const hasMusic = !!player.musicUrl;
  if (hasVoice || hasMusic) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') await ac.resume();
    const dest = ac.createMediaStreamDestination();
    const startAt = ac.currentTime + 0.4;
    const dec = async (url) => {
      const ab = await (await fetch(url)).arrayBuffer();
      return ac.decodeAudioData(ab);
    };
    for (const s of project.scenes) {
      const url = player.audios[s.id];
      if (!url) continue;
      const buf = await dec(url);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      src.start(startAt + player.starts[project.scenes.indexOf(s)]);
      sources.push(src);
    }
    if (hasMusic) {
      const buf = await dec(player.musicUrl);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ac.createGain();
      gain.gain.value = Math.min(1, Math.max(0, project.music?.volume ?? 0.35)) * (hasVoice ? 0.6 : 1);
      src.connect(gain).connect(dest);
      src.start(startAt);
      sources.push(src);
    }
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }

  const rec = new MediaRecorder(stream, { mimeType: sup.mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const done = new Promise((res, rej) => {
    rec.onstop = res;
    rec.onerror = (e) => rej(e.error || new Error('Error al grabar'));
  });
  rec.start(250);
  const t0 = performance.now();
  const total = player.total;
  await new Promise((resolve, reject) => {
    const step = () => {
      if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
      const t = (performance.now() - t0) / 1000;
      player.draw(Math.min(t, total));
      onProgress && onProgress(Math.min(1, t / total));
      if (t >= total + 0.25) return resolve();
      requestAnimationFrame(step);
    };
    step();
  }).catch((e) => {
    try {
      rec.state !== 'inactive' && rec.stop();
    } catch (x) {
      /* ignorado */
    }
    sources.forEach((s) => {
      try {
        s.stop();
      } catch (x) {
        /* ignorado */
      }
    });
    ac && ac.close();
    player.destroy();
    throw e;
  });
  rec.stop();
  await done;
  sources.forEach((s) => {
    try {
      s.stop();
    } catch (x) {
      /* ignorado */
    }
  });
  ac && ac.close();
  player.destroy();
  const type = sup.mime.split(';')[0];
  const blob = new Blob(chunks, { type });
  return { blob, ext: type === 'video/mp4' ? 'mp4' : 'webm', mime: type, withAudio: hasVoice || hasMusic };
}
