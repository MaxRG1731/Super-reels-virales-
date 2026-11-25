// Pestañas del Estudio con medios: Narración, Imágenes, Videos, Subtítulos, Música y Montaje.

import { ROLE_LABELS, STYLES, byId } from '../data.js';
import { chunkSubtitle, cuesFor, fullNarration, imagePromptFor, toSRT, totalSecs, videoPromptFor, wordCount } from '../generator.js';
import { callImage, callSpeech, callVideo, isActive } from '../providers.js';
import { exportSupport, exportVideo, getVoices, pickSpanishVoice, speakText, unlockSpeech } from '../player.js';
import { getProject, getSettings, updateProject, updateSettings } from '../store.js';
import { mediaKey } from '../media.js';
import { S } from './state.js';
import { ask, autoGrow, copyText, downloadBlob, esc, fmtTime, icon, openSheet, closeSheet, pickFile, shareFile, toast } from './util.js';
import { audioDuration, fitSceneToAudio, hydrate, removeMedia, removeMusic, saveImage, saveMedia, saveMusic, VoiceRecorder } from './mediaui.js';
import { currentPlayer, reloadMedia } from './preview.js';

const busy = new Set(); // "kind:sid" en curso
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reel';

let recState = null; // { sid, rec, timer }

const PRESETS = [
  { id: 'natural', name: 'Natural', rate: 1, pitch: 1 },
  { id: 'tenso', name: 'Susurro tenso', rate: 0.94, pitch: 1.12 },
  { id: 'grave', name: 'Misterioso grave', rate: 0.9, pitch: 0.82 },
  { id: 'energico', name: 'Enérgico', rate: 1.12, pitch: 1.06 },
];

export const COLORS = ['#ffffff', '#ffd24d', '#ff6b6b', '#6be3ff', '#7dff9b', '#d6a3ff'];

// ---------------------------------------------------------------- utilidades
export function afterMediaChange() {
  const p = S.projectId && getProject(S.projectId);
  const pl = currentPlayer();
  if (p && pl) {
    pl.setProject(p);
    pl.draw(Math.min(pl.t, pl.total));
    pl.onTick && pl.onTick(pl.t);
  }
}

const providers = () => getSettings().providers;

function providerBanner(slot, label) {
  const on = isActive(slot, providers()[slot]);
  return on
    ? `<div class="note ok">${icon('check', 18)}<span>${label} conectado. Se usa tu proxy: ninguna clave vive en esta app.</span></div>`
    : `<div class="note">${icon('info', 18)}<span>${label} sin conectar. Conéctalo en <a href="#/ajustes">Ajustes</a> o usa las opciones manuales de abajo.</span></div>`;
}

const mediaThumb = (p, s, kind) => (s.media?.[kind] ? `data-media="${esc(mediaKey(p.id, s.id, kind))}"` : '');

// ---------------------------------------------------------------- render
export function render(tab, p) {
  switch (tab) {
    case 'narracion':
      return renderNarracion(p);
    case 'imagenes':
      return renderImagenes(p);
    case 'videos':
      return renderVideos(p);
    case 'subtitulos':
      return renderSubs(p);
    case 'musica':
      return renderMusica(p);
    case 'montaje':
      return renderMontaje(p);
    default:
      return '';
  }
}

// ---- Narración
function renderNarracion(p) {
  const set = getSettings();
  const voices = getVoices();
  const es = voices.filter((v) => /^es/i.test(v.lang));
  const list = es.length ? es : voices;
  const cur = pickSpanishVoice(set.voiceURI);
  const speechOn = isActive('voice', providers().voice) && providers().voice.adapter === 'openai-speech';
  const rate = p.voice?.rate || 1;
  const pitch = p.voice?.pitch || 1;
  const withFile = p.scenes.filter((s) => s.media?.audio).length;
  return `
  <div class="card">
    <div class="sec-head tight"><h3>Voz del dispositivo</h3><button class="btn small ghost" data-act="say-all">${icon('play', 16, true)}<span>Escuchar todo</span></button></div>
    ${
      list.length
        ? `<label class="lbl" for="voice-sel">Voz</label>
           <select id="voice-sel" class="field" data-in="voiceuri">${list.map((v) => `<option value="${esc(v.voiceURI)}"${cur && cur.voiceURI === v.voiceURI ? ' selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select>
           ${!es.length ? '<p class="hint">No hay voces en español instaladas en este dispositivo. En iPhone: Ajustes › Accesibilidad › Contenido hablado › Voces.</p>' : ''}`
        : '<p class="hint">Este dispositivo todavía no ha cargado sus voces, o no soporta síntesis de voz.</p>'
    }
    <span class="lbl">Estilo de lectura</span>
    <div class="chips">${PRESETS.map((x) => `<button class="chip${Math.abs(rate - x.rate) < 0.01 && Math.abs(pitch - x.pitch) < 0.01 ? ' on' : ''}" data-act="preset" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <label class="lbl" for="rate">Velocidad · <b id="rate-v">${rate.toFixed(2)}×</b></label>
    <input id="rate" type="range" min="0.7" max="1.4" step="0.01" value="${rate}" data-in="vrate">
    <label class="lbl" for="pitch">Tono · <b id="pitch-v">${pitch.toFixed(2)}</b></label>
    <input id="pitch" type="range" min="0.6" max="1.4" step="0.01" value="${pitch}" data-in="vpitch">
    <div class="switch-row"><div><div class="lbl">Leer la llamada a la acción</div><div class="muted small">Se dice al final de la última escena.</div></div><button class="switch${set.includeCta ? ' on' : ''}" role="switch" aria-checked="${set.includeCta}" data-act="cta-voice" aria-label="Leer la llamada a la acción"><span></span></button></div>
    <div class="note warn">${icon('info', 18)}<span>La voz del dispositivo suena en la vista previa, pero el navegador <b>no permite grabarla</b> dentro del video exportado. Para un video con voz usa una voz generada, graba la tuya o sube tus audios.</span></div>
  </div>

  ${providerBanner('voice', 'Servicio de voz') .replace('Servicio de voz sin conectar', 'Servicio de voz de estudio sin conectar')}
  <div class="sec-head"><h2>Audio por escena</h2><span class="muted">${withFile}/${p.scenes.length} con archivo</span></div>
  <div class="media-list">
  ${p.scenes
    .map((s, i) => {
      const bz = busy.has('voice:' + s.id);
      const rec = recState && recState.sid === s.id;
      return `<article class="mcard">
      <header><span class="badge" style="--rc:${'var(--accent)'}">${i + 1} · ${esc(ROLE_LABELS[s.role] || '')}</span><span class="muted small">${s.secs} s · ${wordCount(s.narration)} palabras</span></header>
      <p class="mtext">${esc(s.narration)}</p>
      ${s.media?.audio ? `<audio controls preload="none" ${mediaThumb(p, s, 'audio')}></audio>` : ''}
      <div class="row-actions wrap">
        <button class="btn small ghost" data-act="say" data-sid="${s.id}">${icon('play', 16, true)}<span>Escuchar</span></button>
        ${speechOn ? `<button class="btn small" data-act="gen-voice" data-sid="${s.id}" ${bz ? 'disabled' : ''}>${bz ? '<span class="spinner sm"></span>' : icon('mic', 16)}<span>Generar voz</span></button>` : ''}
        ${VoiceRecorder.supported() ? `<button class="btn small ${rec ? 'danger rec' : 'ghost'}" data-act="rec" data-sid="${s.id}">${icon('mic', 16)}<span>${rec ? 'Detener' : 'Grabar mi voz'}</span></button>` : ''}
        <button class="btn small ghost" data-act="up-audio" data-sid="${s.id}">${icon('upload', 16)}<span>Subir audio</span></button>
        ${s.media?.audio ? `<button class="icon-btn danger-text" data-act="rm-audio" data-sid="${s.id}" aria-label="Quitar audio">${icon('trash', 18)}</button>` : ''}
      </div>
    </article>`;
    })
    .join('')}
  </div>`;
}

// ---- Imágenes
function renderImagenes(p) {
  const on = isActive('image', providers().image);
  const missing = p.scenes.filter((s) => !s.media?.image).length;
  const st = byId(STYLES, p.style);
  return `
  ${providerBanner('image', 'Generador de imágenes')}
  <div class="card tight">
    <div class="switch-row"><div><div class="lbl">Estilo aplicado a los prompts</div><div class="muted small">${esc(st?.name || '')} · se añade al final de cada descripción.</div></div>
    ${on && missing ? `<button class="btn small primary" data-act="gen-all-img">${icon('zap', 16)}<span>Generar ${missing} faltantes</span></button>` : ''}</div>
  </div>
  <div class="media-list">
  ${p.scenes
    .map((s, i) => {
      const bz = busy.has('image:' + s.id);
      return `<article class="mcard">
      <header><span class="badge">${i + 1} · ${esc(ROLE_LABELS[s.role] || '')}</span>${s.media?.image ? '<span class="tag ok">Con imagen</span>' : '<span class="tag">Sin imagen</span>'}</header>
      <div class="m-row">
        <div class="thumb">${s.media?.image ? `<img alt="Imagen de la escena ${i + 1}" ${mediaThumb(p, s, 'image')}>` : `<div class="thumb-empty">${icon('image', 26)}</div>`}${bz ? '<div class="thumb-busy"><span class="spinner"></span></div>' : ''}</div>
        <div class="m-col">
          <label class="lbl" for="ip-${s.id}">Prompt de imagen</label>
          <textarea id="ip-${s.id}" class="field auto" rows="4" data-in="prompt" data-sid="${s.id}">${esc(s.imagePrompt)}</textarea>
        </div>
      </div>
      <div class="row-actions wrap">
        ${on ? `<button class="btn small" data-act="gen-img" data-sid="${s.id}" ${bz ? 'disabled' : ''}>${icon('zap', 16)}<span>${s.media?.image ? 'Regenerar' : 'Generar'}</span></button>` : ''}
        <button class="btn small ghost" data-act="up-img" data-sid="${s.id}">${icon('upload', 16)}<span>Subir imagen</span></button>
        <button class="btn small ghost" data-act="copy-prompt" data-sid="${s.id}">${icon('copy', 16)}<span>Copiar prompt</span></button>
        <button class="btn small ghost" data-act="reset-prompt" data-sid="${s.id}">${icon('refresh', 16)}<span>Restablecer</span></button>
        ${s.media?.image ? `<button class="icon-btn danger-text" data-act="rm-img" data-sid="${s.id}" aria-label="Quitar imagen">${icon('trash', 18)}</button>` : ''}
      </div>
    </article>`;
    })
    .join('')}
  </div>`;
}

// ---- Videos
function renderVideos(p) {
  const on = isActive('video', providers().video);
  return `
  ${
    on
      ? providerBanner('video', 'Generador de video')
      : `<div class="note warn">${icon('info', 18)}<span>No hay un servicio de video gratuito integrado de fábrica (los gratuitos cambian sus condiciones con frecuencia y no quiero simular uno). Puedes <b>subir tus propios clips</b> (grabados con el iPhone o creados en otra herramienta) o conectar un servicio mediante tu proxy en <a href="#/ajustes">Ajustes</a>.</span></div>`
  }
  <div class="media-list">
  ${p.scenes
    .map((s, i) => {
      const bz = busy.has('clip:' + s.id);
      return `<article class="mcard">
      <header><span class="badge">${i + 1} · ${esc(ROLE_LABELS[s.role] || '')}</span><span class="muted small">${s.secs} s</span>${s.media?.clip ? '<span class="tag ok">Con clip</span>' : '<span class="tag">Sin clip</span>'}</header>
      ${s.media?.clip ? `<video class="clip" controls muted playsinline preload="metadata" ${mediaThumb(p, s, 'clip')}></video>` : `<div class="clip-empty">${icon('video', 28)}<span>Sin clip. La escena usará su imagen o el fondo animado.</span></div>`}
      <p class="hint">Un clip reemplaza a la imagen en el montaje; si es más corto que la escena, se repite.</p>
      <div class="row-actions wrap">
        ${on ? `<button class="btn small" data-act="gen-clip" data-sid="${s.id}" ${bz ? 'disabled' : ''}>${bz ? '<span class="spinner sm"></span>' : icon('zap', 16)}<span>Generar clip</span></button>` : ''}
        <button class="btn small ghost" data-act="up-clip" data-sid="${s.id}">${icon('upload', 16)}<span>Subir clip</span></button>
        <button class="btn small ghost" data-act="copy-vprompt" data-sid="${s.id}">${icon('copy', 16)}<span>Copiar prompt</span></button>
        ${s.media?.clip ? `<button class="icon-btn danger-text" data-act="rm-clip" data-sid="${s.id}" aria-label="Quitar clip">${icon('trash', 18)}</button>` : ''}
      </div>
    </article>`;
    })
    .join('')}
  </div>`;
}

// ---- Subtítulos
function renderSubs(p) {
  const ss = p.subStyle || {};
  const chip = (field, val, label) => `<button class="chip${ss[field] === val ? ' on' : ''}" data-act="sub-style" data-f="${field}" data-v="${val}">${label}</button>`;
  const sw = (field, c) => `<button class="swatch${ss[field] === c ? ' on' : ''}" style="background:${c}" data-act="sub-style" data-f="${field}" data-v="${c}" aria-label="Color ${c}"></button>`;
  return `
  <div class="card">
    <div class="sec-head tight"><h3>Estilo</h3></div>
    <span class="lbl">Posición</span>
    <div class="chips">${chip('pos', 'top', 'Arriba')}${chip('pos', 'mid', 'Centro')}${chip('pos', 'bottom', 'Abajo')}</div>
    <span class="lbl">Tamaño</span>
    <div class="chips">${chip('size', 's', 'Pequeño')}${chip('size', 'm', 'Mediano')}${chip('size', 'l', 'Grande')}</div>
    <span class="lbl">Color del texto</span>
    <div class="swatches">${COLORS.map((c) => sw('color', c)).join('')}</div>
    <span class="lbl">Color de la palabra activa</span>
    <div class="swatches">${COLORS.map((c) => sw('hi', c)).join('')}</div>
    <p class="hint">Reels recomienda evitar el borde inferior (lo tapa la interfaz). La posición «Centro» es la más segura.</p>
    <div class="row-actions"><button class="btn ghost" data-act="exp-srt">${icon('download', 18)}<span>Descargar .srt</span></button><button class="btn ghost" data-act="sub-all">${icon('refresh', 18)}<span>Reajustar todos</span></button></div>
  </div>
  <div class="media-list">
  ${p.scenes
    .map((s, i) => `<article class="mcard"><header><span class="badge">${i + 1} · ${esc(ROLE_LABELS[s.role] || '')}</span><span class="muted small">${s.secs} s</span></header>
      <label class="lbl" for="sb-${s.id}">Líneas de subtítulo (una por línea)</label>
      <textarea id="sb-${s.id}" class="field auto mono" rows="3" data-in="sub" data-sid="${s.id}">${esc(s.subtitle)}</textarea>
      <div class="row-actions"><button class="btn small ghost" data-act="sub-one" data-sid="${s.id}">${icon('refresh', 16)}<span>Reajustar desde la narración</span></button></div></article>`)
    .join('')}
  </div>`;
}

// ---- Música
function renderMusica(p) {
  const m = p.music;
  const st = byId(STYLES, p.style);
  return `
  <div class="card">
    <div class="sec-head tight"><h3>Pista de fondo</h3></div>
    <p class="muted">Ambiente sugerido: <b>${esc(m.mood || st?.mood || '')}</b></p>
    ${m.hasTrack ? `<div class="track">${icon('music', 20)}<div><b>${esc(m.trackName || 'Pista')}</b><audio controls preload="none" data-media="${esc(mediaKey(p.id, 'music', 'track'))}"></audio></div><button class="icon-btn danger-text" data-act="rm-music" aria-label="Quitar pista">${icon('trash', 18)}</button></div>` : `<div class="clip-empty">${icon('music', 28)}<span>Sin pista. El video saldrá sin música.</span></div>`}
    <div class="row-actions"><button class="btn primary" data-act="up-music">${icon('upload', 18)}<span>${m.hasTrack ? 'Cambiar pista' : 'Subir pista (mp3, m4a, wav)'}</span></button></div>
    <label class="lbl" for="mvol">Volumen · <b id="mvol-v">${Math.round((m.volume ?? 0.35) * 100)}%</b></label>
    <input id="mvol" type="range" min="0" max="1" step="0.01" value="${m.volume ?? 0.35}" data-in="mvol">
    <div class="note">${icon('info', 18)}<span>La app no genera música. Usa pistas libres de derechos (por ejemplo, la biblioteca de audio de YouTube Studio o Pixabay Music) y revisa su licencia antes de publicar. La pista se mezcla con tus audios de voz al exportar.</span></div>
  </div>
  <div class="sec-head"><h2>Guía por escena</h2></div>
  <div class="list">
  ${p.scenes.map((s, i) => `<div class="row-card static"><div><b>${i + 1} · ${esc(ROLE_LABELS[s.role] || '')}</b><div class="muted small">Música: ${esc(s.music)}</div><div class="muted small">Efectos: ${esc(s.sfx)}</div></div></div>`).join('')}
  </div>`;
}

// ---- Montaje
function renderMontaje(p) {
  const sup = exportSupport();
  const n = p.scenes.length;
  const img = p.scenes.filter((s) => s.media?.image).length;
  const clip = p.scenes.filter((s) => s.media?.clip).length;
  const vis = p.scenes.filter((s) => s.media?.image || s.media?.clip).length;
  const aud = p.scenes.filter((s) => s.media?.audio).length;
  const row = (ok, label, detail) => `<li class="${ok ? 'ok' : 'no'}">${icon(ok ? 'check' : 'x', 16)}<div><b>${label}</b><span class="muted small">${detail}</span></div></li>`;
  const last = S.exports[p.id];
  return `
  <div id="pv-inline" class="pv-inline"></div>
  <div class="card">
    <div class="sec-head tight"><h3>Estado del montaje</h3><span class="muted">${fmtTime(totalSecs(p))}</span></div>
    <ul class="check">
      ${row(true, 'Guion y escenas', `${n} escenas · ${wordCount(fullNarration(p))} palabras`)}
      ${row(vis === n, 'Imágenes o clips', `${vis}/${n} escenas (${img} imágenes, ${clip} clips). Las demás usan un fondo animado.`)}
      ${row(aud === n, 'Voz en archivo', aud ? `${aud}/${n} escenas` : 'Ninguna: el video saldrá sin voz (la voz del dispositivo no se puede grabar).')}
      ${row(p.music.hasTrack, 'Música', p.music.hasTrack ? esc(p.music.trackName) : 'Sin pista')}
      ${row(true, 'Subtítulos', `${cuesFor(p).length} líneas, palabra activa resaltada`)}
    </ul>
    ${!sup.ok ? `<div class="note warn">${icon('info', 18)}<span>Este navegador no puede grabar video desde Canvas. Prueba con Safari reciente en iPhone o Chrome en computadora.</span></div>` : ''}
  </div>
  <div class="card">
    <div class="sec-head tight"><h3>Exportar video</h3></div>
    <p class="muted">Vertical 9:16 · 540×960 · ${sup.mime ? esc(sup.mime.split(';')[0].replace('video/', '').toUpperCase()) : 'no disponible'}. El montaje se graba en tiempo real: <b>mantén la pantalla encendida y esta pestaña abierta</b> durante ${fmtTime(totalSecs(p))}.</p>
    <button class="btn primary big glow" data-act="export" ${sup.ok ? '' : 'disabled'}>${icon('film', 20)}<span>Exportar Reel</span></button>
    ${last ? `<div class="last-export"><video src="${last.url}" controls playsinline muted preload="metadata"></video><div class="row-actions"><button class="btn" data-act="export-share">${icon('share', 18)}<span>Compartir / guardar</span></button><button class="btn ghost" data-act="export-dl">${icon('download', 18)}<span>Descargar</span></button></div><p class="hint">Última exportación${last.withAudio ? '' : ' (sin audio)'} · ${(last.blob.size / 1048576).toFixed(1)} MB</p></div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- acciones
const sceneOf = (p, sid) => p.scenes.find((s) => s.id === sid);

function stopRec(cancel = false) {
  if (!recState) return null;
  clearTimeout(recState.timer);
  const st = recState;
  recState = null;
  if (cancel) st.rec.cancel();
  return st;
}

export async function click(act, el, p, rerender) {
  const sid = el.dataset.sid;
  const set = providers();
  switch (act) {
    // --- narración
    case 'say': {
      unlockSpeech();
      window.speechSynthesis && window.speechSynthesis.cancel();
      const s = sceneOf(p, sid);
      return speakText(s.narration, { rate: p.voice.rate, pitch: p.voice.pitch, voiceURI: getSettings().voiceURI });
    }
    case 'say-all': {
      unlockSpeech();
      if (!window.speechSynthesis) return toast('Este dispositivo no soporta síntesis de voz.', 'warn');
      window.speechSynthesis.cancel();
      const o = { rate: p.voice.rate, pitch: p.voice.pitch, voiceURI: getSettings().voiceURI };
      p.scenes.forEach((s) => speakText(s.narration, o));
      return toast('Leyendo el guion completo…');
    }
    case 'preset': {
      const x = PRESETS.find((q) => q.id === el.dataset.v);
      updateProject(p.id, (q) => (q.voice = { rate: x.rate, pitch: x.pitch }));
      return;
    }
    case 'cta-voice':
      updateSettings((s) => (s.includeCta = !s.includeCta));
      return;
    case 'gen-voice': {
      const key = 'voice:' + sid;
      busy.add(key);
      rerender();
      try {
        const blob = await callSpeech(set.voice, sceneOf(p, sid).narration, set.voice.voice);
        await saveMedia(p.id, sid, 'audio', blob);
        const ch = await fitSceneToAudio(p.id, sid, blob);
        if (ch) toast(`Duración de la escena ajustada a la voz: ${ch.from} s → ${ch.to} s.`, 'ok', 3500);
        else toast('Voz generada.', 'ok');
      } catch (e) {
        toast('No se pudo generar la voz: ' + e.message, 'error', 4500);
      }
      busy.delete(key);
      afterMediaChange();
      return rerender();
    }
    case 'rec': {
      if (recState && recState.sid === sid) {
        const st = stopRec();
        const blob = await st.rec.stop();
        if (blob && blob.size > 800) {
          await saveMedia(p.id, sid, 'audio', blob);
          const ch = await fitSceneToAudio(p.id, sid, blob);
          toast(ch ? `Voz guardada. Escena ajustada a ${ch.to} s.` : 'Voz guardada.', 'ok', 3500);
        } else toast('La grabación quedó vacía.', 'warn');
        afterMediaChange();
        return rerender();
      }
      if (recState) stopRec(true);
      try {
        const rec = new VoiceRecorder();
        await rec.start();
        recState = { sid, rec, timer: setTimeout(() => document.querySelector(`[data-act="rec"][data-sid="${sid}"]`)?.click(), 60000) };
        toast('Grabando… lee la narración y pulsa Detener.', 'info', 3500);
      } catch (e) {
        toast('No se pudo usar el micrófono: ' + (e.message || e.name), 'error', 4500);
      }
      return rerender();
    }
    case 'up-audio': {
      const f = await pickFile('audio/*');
      if (!f) return;
      await saveMedia(p.id, sid, 'audio', f);
      const ch = await fitSceneToAudio(p.id, sid, f);
      toast(ch ? `Audio guardado. Escena ajustada a ${ch.to} s.` : 'Audio guardado.', 'ok', 3500);
      afterMediaChange();
      return rerender();
    }
    case 'rm-audio':
      await removeMedia(p.id, sid, 'audio');
      return rerender();

    // --- imágenes
    case 'gen-img':
      return genImage(p, sid, rerender);
    case 'gen-all-img': {
      for (const s of p.scenes.filter((x) => !x.media?.image)) await genImage(getProject(p.id), s.id, rerender, true);
      toast('Listo: imágenes generadas.', 'ok');
      return;
    }
    case 'up-img': {
      const f = await pickFile('image/*');
      if (!f) return;
      try {
        await saveImage(p.id, sid, f);
        toast('Imagen guardada.', 'ok');
      } catch (e) {
        toast('No se pudo leer la imagen: ' + e.message, 'error');
      }
      afterMediaChange();
      return rerender();
    }
    case 'rm-img':
      await removeMedia(p.id, sid, 'image');
      return rerender();
    case 'copy-prompt':
      return toast((await copyText(sceneOf(p, sid).imagePrompt)) ? 'Prompt copiado.' : 'No se pudo copiar.', 'ok');
    case 'reset-prompt': {
      updateProject(p.id, (q) => {
        const s = sceneOf(q, sid);
        s.imagePrompt = imagePromptFor(s, q.style);
      });
      return;
    }

    // --- videos
    case 'gen-clip': {
      const key = 'clip:' + sid;
      busy.add(key);
      rerender();
      try {
        const s = sceneOf(p, sid);
        const payload = { prompt: videoPromptFor(s, p.style), duration: s.secs };
        const blob = await callVideo(set.video, payload);
        await saveMedia(p.id, sid, 'clip', blob);
        toast('Clip generado.', 'ok');
      } catch (e) {
        toast('No se pudo generar el clip: ' + e.message, 'error', 4500);
      }
      busy.delete(key);
      afterMediaChange();
      return rerender();
    }
    case 'up-clip': {
      const f = await pickFile('video/*');
      if (!f) return;
      if (f.size > 80 * 1048576) return toast('El clip pesa más de 80 MB. Recórtalo o comprímelo primero.', 'warn', 4500);
      try {
        await saveMedia(p.id, sid, 'clip', f);
        toast('Clip guardado.', 'ok');
      } catch (e) {
        toast('No se pudo guardar el clip (¿poco espacio?): ' + e.message, 'error', 4500);
      }
      afterMediaChange();
      return rerender();
    }
    case 'rm-clip':
      await removeMedia(p.id, sid, 'clip');
      return rerender();
    case 'copy-vprompt':
      return toast((await copyText(videoPromptFor(sceneOf(p, sid), p.style))) ? 'Prompt copiado.' : 'No se pudo copiar.', 'ok');

    // --- subtítulos
    case 'sub-style':
      updateProject(p.id, (q) => (q.subStyle = { ...q.subStyle, [el.dataset.f]: el.dataset.v }));
      return;
    case 'sub-one':
      updateProject(p.id, (q) => {
        const s = sceneOf(q, sid);
        s.subtitle = chunkSubtitle(s.narration);
      });
      return;
    case 'sub-all':
      updateProject(p.id, (q) => q.scenes.forEach((s) => (s.subtitle = chunkSubtitle(s.narration))));
      toast('Subtítulos reajustados.', 'ok');
      return;
    case 'exp-srt':
      downloadBlob(new Blob([toSRT(p)], { type: 'application/x-subrip;charset=utf-8' }), `${slug(p.title)}.srt`);
      return;

    // --- música
    case 'up-music': {
      const f = await pickFile('audio/*');
      if (!f) return;
      if (f.size > 40 * 1048576) return toast('La pista pesa más de 40 MB.', 'warn');
      await saveMusic(p.id, f);
      toast('Pista guardada.', 'ok');
      afterMediaChange();
      return rerender();
    }
    case 'rm-music':
      await removeMusic(p.id);
      return rerender();

    // --- montaje
    case 'export':
      return doExport(p, rerender);
    case 'export-dl': {
      const l = S.exports[p.id];
      return l && downloadBlob(l.blob, `${slug(p.title)}.${l.ext}`);
    }
    case 'export-share': {
      const l = S.exports[p.id];
      return l && shareFile(l.blob, `${slug(p.title)}.${l.ext}`, l.mime);
    }
    default:
      return false;
  }
}

async function genImage(p, sid, rerender, quiet = false) {
  const cfg = providers().image;
  const key = 'image:' + sid;
  busy.add(key);
  rerender();
  try {
    const s = sceneOf(p, sid);
    const blob = await callImage(cfg, s.imagePrompt);
    await saveImage(p.id, sid, blob);
    if (!quiet) toast('Imagen generada.', 'ok');
  } catch (e) {
    toast('No se pudo generar la imagen: ' + e.message, 'error', 4500);
  }
  busy.delete(key);
  afterMediaChange();
  rerender();
}

async function doExport(p, rerender) {
  const player = currentPlayer();
  player && player.pause();
  const ctl = new AbortController();
  const w = openSheet(
    `<h3 class="sheet-title">Montando tu Reel…</h3>
     <p class="sheet-text">Se graba en tiempo real. No cambies de pestaña ni apagues la pantalla.</p>
     <div class="progress"><div id="exp-bar"></div></div>
     <p class="muted center" id="exp-pct">0%</p>
     <div class="sheet-actions"><button class="btn ghost" id="exp-cancel">Cancelar</button></div>`,
    { onClose: () => ctl.abort() },
  );
  w.querySelector('#exp-cancel').addEventListener('click', () => closeSheet());
  try {
    const res = await exportVideo(p, {
      signal: ctl.signal,
      onProgress: (f) => {
        const bar = document.getElementById('exp-bar');
        const pct = document.getElementById('exp-pct');
        if (bar) bar.style.width = Math.round(f * 100) + '%';
        if (pct) pct.textContent = Math.round(f * 100) + '%';
      },
    });
    if (S.exports[p.id]) URL.revokeObjectURL(S.exports[p.id].url);
    S.exports[p.id] = { ...res, url: URL.createObjectURL(res.blob) };
    closeSheet();
    toast(`Reel exportado (${(res.blob.size / 1048576).toFixed(1)} MB).`, 'ok', 3500);
  } catch (e) {
    closeSheet();
    if (e.name !== 'AbortError') toast('No se pudo exportar: ' + e.message, 'error', 5000);
    else toast('Exportación cancelada.');
  }
  await reloadMedia();
  rerender();
}

// ---------------------------------------------------------------- campos
export function input(el, p) {
  const k = el.dataset.in;
  const sid = el.dataset.sid;
  if (el.classList && el.classList.contains('auto')) autoGrow(el);
  if (k === 'prompt') {
    updateProject(p.id, (q) => (sceneOf(q, sid).imagePrompt = el.value), { silent: true });
  } else if (k === 'sub') {
    updateProject(p.id, (q) => (sceneOf(q, sid).subtitle = el.value), { silent: true });
    afterMediaChange();
  } else if (k === 'vrate') {
    updateProject(p.id, (q) => (q.voice.rate = Number(el.value)), { silent: true });
    document.getElementById('rate-v').textContent = Number(el.value).toFixed(2) + '×';
    afterMediaChange();
    const pl = currentPlayer();
    if (pl) pl.settings = { ...pl.settings, rate: Number(el.value) };
  } else if (k === 'vpitch') {
    updateProject(p.id, (q) => (q.voice.pitch = Number(el.value)), { silent: true });
    document.getElementById('pitch-v').textContent = Number(el.value).toFixed(2);
    const pl = currentPlayer();
    if (pl) pl.settings = { ...pl.settings, pitch: Number(el.value) };
  } else if (k === 'voiceuri') {
    updateSettings((s) => (s.voiceURI = el.value));
    const pl = currentPlayer();
    if (pl) pl.settings = { ...pl.settings, voiceURI: el.value };
  } else if (k === 'mvol') {
    updateProject(p.id, (q) => (q.music.volume = Number(el.value)), { silent: true });
    document.getElementById('mvol-v').textContent = Math.round(Number(el.value) * 100) + '%';
    const pl = currentPlayer();
    if (pl && pl.musicEl) pl.musicEl.volume = Number(el.value);
  }
}

export async function afterRender(root) {
  await hydrate(root);
}

export function leaveStudio() {
  stopRec(true);
}
