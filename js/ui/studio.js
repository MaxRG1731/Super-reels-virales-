// Vista "Estudio": marco, línea de tiempo, pestañas, y las pestañas Guion y Escenas.

import { CATEGORIES, PLATFORMS, STYLES, ROLE_LABELS, ROLE_COLORS, byId } from '../data.js';
import {
  buildDescription, chunkSubtitle, fullNarration, generateProject, imagePromptFor, newBlankScene, nextEpisodeOptions,
  paceOf, regenerateCta, regenerateScene, regenerateTitle, toMarkdown, toSRT, toText, totalSecs, wordCount,
} from '../generator.js';
import { generateWithAI, isActive, regenerateSceneWithAI } from '../providers.js';
import { deleteMediaByPrefix } from '../media.js';
import { getProject, getSettings, hasSignature, addSignature, listProjects, saveProject, setCurrent, toggleFavorite, updateProject } from '../store.js';
import { S, go } from './state.js';
import { ask, autoGrow, copyText, downloadBlob, esc, fmtTime, icon, toast, shareFile } from './util.js';
import { getPreview, openFull, seekToScene } from './preview.js';
import * as media from './studio-media.js';

export const TABS = [
  ['guion', 'Guion', 'file'],
  ['escenas', 'Escenas', 'layers'],
  ['narracion', 'Narración', 'mic'],
  ['imagenes', 'Imágenes', 'image'],
  ['videos', 'Videos', 'video'],
  ['subtitulos', 'Subtítulos', 'type'],
  ['musica', 'Música', 'music'],
  ['montaje', 'Montaje', 'scissors'],
];

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reel';

export function currentProject() {
  return S.projectId ? getProject(S.projectId) : null;
}

// ---------------------------------------------------------------- render
export function render() {
  const p = currentProject();
  if (!p) return renderEmpty();
  const tabBar = `<div class="tabs" role="tablist">${TABS.map(([id, label, ic]) => `<button class="tab${S.tab === id ? ' on' : ''}" role="tab" aria-selected="${S.tab === id}" data-act="tab" data-v="${id}">${icon(ic, 17)}<span>${label}</span></button>`).join('')}</div>`;
  const cat = byId(CATEGORIES, p.categories[0]);
  const total = totalSecs(p);
  const body = renderTab(p);
  return `
  <section class="studio enter" data-tab="${S.tab}">
    <div class="studio-main">
      <header class="st-head">
        <div class="st-title">
          <span class="st-emoji" style="--c:${cat?.color || '#888'}">${cat?.emoji || '🎬'}</span>
          <div><h1>${esc(p.title)}</h1><p class="muted small">${p.categories.map((c) => esc(byId(CATEGORIES, c)?.name || c)).join(' + ')} · ${fmtTime(total)} · ${esc(byId(PLATFORMS, p.platform)?.short || '')} · ${esc(byId(STYLES, p.style)?.name || '')}${p.engine === 'ia' ? ' · escrito con IA' : ''}</p></div>
        </div>
        <button class="icon-btn${p.favorite ? ' on-fav' : ''}" data-act="fav" aria-label="Favorito" aria-pressed="${!!p.favorite}">${icon('star', 22, !!p.favorite)}</button>
      </header>
      ${renderTimeline(p)}
      ${tabBar}
      <div class="tab-body" id="tab-body">${body}</div>
    </div>
    <aside class="pv-col"><div id="pv-slot"></div></aside>
    <button class="fab" data-act="pv-open">${icon('play', 20, true)}<span>Vista previa</span></button>
  </section>`;
}

function renderEmpty() {
  const list = listProjects().slice(0, 6);
  return `<section class="empty enter">
    <div class="empty-ic">🎬</div>
    <h2>Tu estudio está vacío</h2>
    <p class="muted">Crea una historia para empezar a producirla aquí: guion, escenas, voz, imágenes, subtítulos y montaje.</p>
    <a class="btn primary big glow" href="#/crear">${icon('zap', 20)}<span>Crear una historia</span></a>
    ${list.length ? `<div class="sec-head"><h2>Abrir reciente</h2></div><div class="list">${list.map((p) => `<button class="row-card" data-act="open" data-id="${p.id}"><b>${esc(p.title)}</b><span class="muted small">${p.duration} s</span></button>`).join('')}</div>` : ''}
  </section>`;
}

export function mountPreview() {
  const p = currentProject();
  if (!p) return;
  const desktop = window.matchMedia('(min-width: 980px)').matches;
  const inline = !desktop && S.tab === 'montaje' ? document.getElementById('pv-inline') : null;
  const slot = inline || document.getElementById('pv-slot');
  if (!slot) return;
  const el = getPreview(p);
  el.classList.toggle('inline', !!inline);
  slot.appendChild(el);
}

function renderTimeline(p) {
  const total = totalSecs(p) || 1;
  return `<div class="timeline" role="list" aria-label="Línea de tiempo">
    ${p.scenes
      .map((s, i) => {
        const has = s.media?.image || s.media?.clip;
        return `<button class="tl-seg${S.sel === s.id ? ' sel' : ''}" role="listitem" style="flex:${s.secs};--rc:${ROLE_COLORS[s.role] || '#888'}" data-act="tl" data-i="${i}" data-sid="${s.id}" aria-label="Escena ${i + 1}, ${s.secs} segundos">
          <span class="tl-n">${i + 1}</span>
          <span class="tl-dots">${has ? '<i class="d img"></i>' : ''}${s.media?.audio ? '<i class="d aud"></i>' : ''}</span>
          <span class="tl-s">${s.secs}s</span>
        </button>`;
      })
      .join('')}
  </div>
  <div class="tl-meta muted small"><span>${p.scenes.length} escenas</span><span>${fmtTime(total)} total</span><span>${wordCount(fullNarration(p))} palabras</span></div>`;
}

function renderTab(p) {
  switch (S.tab) {
    case 'guion':
      return renderGuion(p);
    case 'escenas':
      return renderEscenas(p);
    default:
      return media.render(S.tab, p);
  }
}

// ---------------------------------------------------------------- pestaña Guion
function renderGuion(p) {
  const sibs = p.series ? listProjects().filter((x) => x.series && x.series.id === p.series.id).sort((a, b) => a.series.ep - b.series.ep) : [];
  const hasNext = p.series && p.series.ep < p.series.total;
  const nextExists = hasNext && sibs.some((x) => x.series.ep === p.series.ep + 1);
  return `
  ${
    p.series
      ? `<div class="card series"><div class="sec-head tight"><h3>Serie · episodio ${p.series.ep} de ${p.series.total}</h3></div>
          <div class="chips">${sibs.map((x) => `<button class="chip${x.id === p.id ? ' on' : ''}" data-act="open" data-id="${x.id}">Ep. ${x.series.ep}</button>`).join('')}</div>
          ${hasNext && !nextExists ? `<button class="btn primary" data-act="next-ep">${icon('plus', 18)}<span>Generar episodio ${p.series.ep + 1}</span></button>` : ''}
          ${hasNext && nextExists ? '<p class="hint">El siguiente episodio ya existe en tu biblioteca.</p>' : ''}
        </div>`
      : ''
  }
  <div class="card">
    <label class="lbl" for="f-title">Título viral</label>
    <div class="inline"><input id="f-title" class="field" value="${esc(p.title)}" data-in="proj" data-f="title"><button class="icon-btn" data-act="regen-title" aria-label="Otro título">${icon('refresh', 20)}</button></div>
    <label class="lbl" for="f-hook">Gancho · primeros 3 segundos</label>
    <textarea id="f-hook" class="field auto" rows="2" data-in="proj" data-f="hook">${esc(p.hook)}</textarea>
    <p class="hint">Se lee en ${Math.round(wordCount(p.hook) / 2.6 * 10) / 10} s a ritmo natural${wordCount(p.hook) / 2.6 > 4 ? ' · es largo para un gancho de 3 s' : ''}.</p>
  </div>

  <div class="card">
    <div class="sec-head tight"><h3>Guion completo</h3><button class="btn small ghost" data-act="copy-script">${icon('copy', 16)}<span>Copiar</span></button></div>
    <p class="script">${esc(fullNarration(p))}</p>
    <p class="hint">Edítalo escena por escena en la pestaña Escenas.</p>
  </div>

  <div class="card">
    <label class="lbl" for="f-cta">Llamada a la acción final</label>
    <div class="inline"><input id="f-cta" class="field" value="${esc(p.cta)}" data-in="proj" data-f="cta"><button class="icon-btn" data-act="regen-cta" aria-label="Otra llamada a la acción">${icon('refresh', 20)}</button></div>
    <label class="lbl" for="f-tags">Hashtags</label>
    <input id="f-tags" class="field" value="${esc((p.hashtags || []).join(' '))}" data-in="proj" data-f="hashtags">
    <label class="lbl" for="f-desc">Descripción para publicar</label>
    <textarea id="f-desc" class="field auto" rows="6" data-in="proj" data-f="description">${esc(p.description)}</textarea>
    <div class="row-actions"><button class="btn ghost small" data-act="copy-desc">${icon('copy', 16)}<span>Copiar descripción</span></button></div>
    ${(p.notes || []).length ? `<p class="hint">${icon('info', 14)} ${esc(p.notes.join(' '))}</p>` : ''}
  </div>

  <div class="card">
    <div class="sec-head tight"><h3>Exportar guion</h3></div>
    <div class="grid2">
      <button class="btn ghost" data-act="exp" data-v="txt">${icon('file', 18)}<span>Texto .txt</span></button>
      <button class="btn ghost" data-act="exp" data-v="md">${icon('file', 18)}<span>Markdown .md</span></button>
      <button class="btn ghost" data-act="exp" data-v="srt">${icon('type', 18)}<span>Subtítulos .srt</span></button>
      <button class="btn ghost" data-act="exp" data-v="json">${icon('download', 18)}<span>Proyecto .json</span></button>
    </div>
  </div>

  <div class="card danger-zone">
    <button class="btn ghost" data-act="dup">${icon('clone', 18)}<span>Duplicar proyecto</span></button>
    <button class="btn ghost danger-text" data-act="del">${icon('trash', 18)}<span>Enviar a la papelera</span></button>
  </div>`;
}

// ---------------------------------------------------------------- pestaña Escenas
function paceInfo(s) {
  const r = paceOf(s);
  if (!s.narration.trim()) return { cls: 'warn', text: 'Sin narración' };
  if (r > 3.3) return { cls: 'bad', text: `${r.toFixed(1)} pal/s · muy rápido: sube la duración o recorta` };
  if (r > 2.9) return { cls: 'warn', text: `${r.toFixed(1)} pal/s · algo rápido` };
  if (r < 1.3) return { cls: 'warn', text: `${r.toFixed(1)} pal/s · muy lento: baja la duración o añade texto` };
  return { cls: 'ok', text: `${r.toFixed(1)} pal/s · ritmo natural` };
}

function renderEscenas(p) {
  return `
  <div class="scene-list">
  ${p.scenes
    .map((s, i) => {
      const pc = paceInfo(s);
      return `
    <article class="scene${S.sel === s.id ? ' sel' : ''}" id="sc-${s.id}" style="--rc:${ROLE_COLORS[s.role] || '#888'}">
      <header class="sc-head">
        <span class="badge">${i + 1} · ${esc(ROLE_LABELS[s.role] || s.role)}</span>
        <div class="stepper mini"><button class="step-btn" data-act="secs" data-sid="${s.id}" data-v="-0.5" aria-label="Menos tiempo">−</button><b>${s.secs} s</b><button class="step-btn" data-act="secs" data-sid="${s.id}" data-v="0.5" aria-label="Más tiempo">+</button></div>
      </header>
      <label class="lbl" for="n-${s.id}">Narración</label>
      <textarea id="n-${s.id}" class="field auto" rows="3" data-in="scene" data-sid="${s.id}" data-f="narration">${esc(s.narration)}</textarea>
      <p class="pace ${pc.cls}" id="pace-${s.id}">${esc(pc.text)}</p>
      <label class="lbl" for="v-${s.id}">Descripción visual</label>
      <textarea id="v-${s.id}" class="field auto" rows="2" data-in="scene" data-sid="${s.id}" data-f="visual">${esc(s.visual)}</textarea>
      <details class="more" data-sid="${s.id}"${S.openMore.has(s.id) ? ' open' : ''}><summary>Diálogo, cámara, música y efectos</summary>
        <label class="lbl" for="d-${s.id}">Diálogo</label>
        <input id="d-${s.id}" class="field" value="${esc(s.dialogue)}" placeholder="Opcional" data-in="scene" data-sid="${s.id}" data-f="dialogue">
        <label class="lbl" for="c-${s.id}">Indicaciones de cámara</label>
        <input id="c-${s.id}" class="field" value="${esc(s.camera)}" data-in="scene" data-sid="${s.id}" data-f="camera">
        <label class="lbl" for="m-${s.id}">Música sugerida</label>
        <input id="m-${s.id}" class="field" value="${esc(s.music)}" data-in="scene" data-sid="${s.id}" data-f="music">
        <label class="lbl" for="e-${s.id}">Efectos de sonido</label>
        <input id="e-${s.id}" class="field" value="${esc(s.sfx)}" data-in="scene" data-sid="${s.id}" data-f="sfx">
      </details>
      <footer class="sc-foot">
        <button class="icon-btn" data-act="mv" data-sid="${s.id}" data-v="-1" aria-label="Subir escena" ${i === 0 ? 'disabled' : ''}>${icon('up', 20)}</button>
        <button class="icon-btn" data-act="mv" data-sid="${s.id}" data-v="1" aria-label="Bajar escena" ${i === p.scenes.length - 1 ? 'disabled' : ''}>${icon('down', 20)}</button>
        <button class="icon-btn" data-act="seek" data-i="${i}" aria-label="Ver esta escena">${icon('play', 20)}</button>
        <span class="spacer"></span>
        <button class="btn ghost small" data-act="regen" data-sid="${s.id}">${icon('refresh', 16)}<span>Regenerar</span></button>
        <button class="icon-btn danger-text" data-act="del-scene" data-sid="${s.id}" aria-label="Eliminar escena">${icon('trash', 20)}</button>
      </footer>
    </article>
    <button class="add-scene" data-act="add-scene" data-sid="${s.id}">${icon('plus', 16)}<span>Añadir escena aquí</span></button>`;
    })
    .join('')}
  </div>`;
}

// ---------------------------------------------------------------- acciones
function exportAs(p, kind) {
  const base = slug(p.title);
  if (kind === 'txt') downloadBlob(new Blob([toText(p)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
  else if (kind === 'md') downloadBlob(new Blob([toMarkdown(p)], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
  else if (kind === 'srt') downloadBlob(new Blob([toSRT(p)], { type: 'application/x-subrip;charset=utf-8' }), `${base}.srt`);
  else if (kind === 'json') downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), `${base}.json`);
  toast('Archivo preparado.', 'ok');
}

let regenBusy = false;

export async function click(act, el, rerender) {
  const p = currentProject();
  if (!p) return false;
  const sid = el.dataset.sid;
  switch (act) {
    case 'tab':
      S.tab = el.dataset.v;
      S.resetScroll = true;
      return rerender();
    case 'fav':
      toggleFavorite(p.id);
      return;
    case 'tl': {
      S.sel = sid;
      seekToScene(Number(el.dataset.i));
      if (S.tab === 'escenas') document.getElementById('sc-' + sid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll('.tl-seg').forEach((b) => b.classList.toggle('sel', b.dataset.sid === sid));
      document.querySelectorAll('.scene').forEach((b) => b.classList.toggle('sel', b.id === 'sc-' + sid));
      return;
    }
    case 'seek':
      seekToScene(Number(el.dataset.i));
      return openFull();
    case 'pv-open':
      return openFull();
    case 'open':
      return go('#/estudio/' + el.dataset.id);
    case 'copy-script':
      return toast((await copyText(fullNarration(p))) ? 'Guion copiado.' : 'No se pudo copiar.', 'ok');
    case 'copy-desc':
      return toast((await copyText(p.description)) ? 'Descripción copiada.' : 'No se pudo copiar.', 'ok');
    case 'exp':
      return exportAs(p, el.dataset.v);
    case 'regen-title':
      updateProject(p.id, (q) => regenerateTitle(q), { log: 'Título regenerado' });
      return;
    case 'regen-cta':
      updateProject(p.id, (q) => regenerateCta(q));
      return;
    case 'dup': {
      const { duplicateProject } = await import('../store.js');
      const c = duplicateProject(p.id);
      toast('Proyecto duplicado.', 'ok');
      return go('#/estudio/' + c.id);
    }
    case 'del': {
      if (!(await ask({ title: '¿Enviar a la papelera?', text: 'Podrás recuperarlo desde la Biblioteca.', ok: 'Enviar', danger: true }))) return;
      const { trashProject } = await import('../store.js');
      trashProject(p.id);
      S.projectId = null;
      toast('Enviado a la papelera.');
      return go('#/biblioteca');
    }
    case 'next-ep':
      return nextEpisode(p);
    case 'secs': {
      updateProject(p.id, (q) => {
        const s = q.scenes.find((x) => x.id === sid);
        s.secs = Math.max(1.5, Math.min(30, Math.round((s.secs + Number(el.dataset.v)) * 2) / 2));
      });
      return;
    }
    case 'mv': {
      updateProject(p.id, (q) => {
        const i = q.scenes.findIndex((x) => x.id === sid);
        const j = i + Number(el.dataset.v);
        if (j < 0 || j >= q.scenes.length) return;
        [q.scenes[i], q.scenes[j]] = [q.scenes[j], q.scenes[i]];
      });
      return;
    }
    case 'del-scene': {
      if (p.scenes.length <= 1) return toast('Debe quedar al menos una escena.', 'warn');
      if (!(await ask({ title: '¿Eliminar esta escena?', text: 'También se borrarán sus imágenes, voz y clip.', ok: 'Eliminar', danger: true }))) return;
      await deleteMediaByPrefix(`${p.id}:${sid}:`).catch(() => {});
      updateProject(p.id, (q) => {
        q.scenes = q.scenes.filter((x) => x.id !== sid);
        const first = q.scenes[0];
        if (first && first.role === 'hook') q.hook = first.narration;
      }, { log: 'Escena eliminada' });
      media.afterMediaChange();
      return;
    }
    case 'add-scene': {
      updateProject(p.id, (q) => {
        const i = q.scenes.findIndex((x) => x.id === sid);
        q.scenes.splice(i + 1, 0, newBlankScene(q, 'extra'));
      }, { log: 'Escena añadida' });
      return;
    }
    case 'regen':
      return regenScene(p, sid, el);
    default:
      return media.click(act, el, p, rerender);
  }
}

async function regenScene(p, sid, btn) {
  if (regenBusy) return;
  regenBusy = true;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner sm"></span><span>Escribiendo…</span>`;
  try {
    const cfg = getSettings().providers.text;
    if (p.engine === 'ia' && isActive('text', cfg)) {
      const scene = p.scenes.find((x) => x.id === sid);
      const raw = await regenerateSceneWithAI(cfg, p, scene);
      updateProject(p.id, (q) => {
        const s = q.scenes.find((x) => x.id === sid);
        s.narration = String(raw.narration).trim();
        s.dialogue = String(raw.dialogue || raw.dialogo || '');
        s.visual = String(raw.visual || s.visual);
        s.camera = String(raw.camera || raw.camara || s.camera);
        s.music = String(raw.music || raw.musica || s.music);
        s.sfx = String(raw.sfx || raw.efectos || s.sfx);
        s.subtitle = chunkSubtitle(s.narration);
        s.imagePrompt = imagePromptFor(s, q.style);
      }, { log: 'Escena regenerada' });
    } else if (p.engine === 'ia') {
      toast('Este proyecto se escribió con IA. Conecta el modelo en Ajustes para regenerar escenas.', 'warn', 4500);
    } else {
      updateProject(p.id, (q) => {
        regenerateScene(q, sid);
      }, { log: 'Escena regenerada' });
    }
  } catch (e) {
    toast('No se pudo regenerar: ' + e.message, 'error', 4500);
  } finally {
    regenBusy = false;
    btn.disabled = false;
    btn.innerHTML = label;
  }
}

async function nextEpisode(p) {
  const opts = nextEpisodeOptions(p);
  if (!opts) return;
  opts.hasSignature = hasSignature;
  const cfg = getSettings().providers.text;
  try {
    let np;
    if (p.engine === 'ia') {
      if (!isActive('text', cfg)) return toast('Conecta el modelo de texto en Ajustes para continuar esta serie.', 'warn', 4500);
      toast('Escribiendo el siguiente episodio…');
      np = await generateWithAI(cfg, opts);
    } else {
      np = generateProject(opts);
    }
    if (np.sig) addSignature(np.sig);
    saveProject(np, { log: 'Episodio creado' });
    setCurrent(np.id);
    S.tab = 'guion';
    go('#/estudio/' + np.id);
  } catch (e) {
    toast('No se pudo crear el episodio: ' + e.message, 'error', 4500);
  }
}

// ---------------------------------------------------------------- edición de campos (sin re-renderizar)
export function input(el) {
  const p = currentProject();
  if (!p) return;
  const kind = el.dataset.in;
  if (el.classList.contains('auto')) autoGrow(el);
  if (kind === 'proj') {
    const f = el.dataset.f;
    const autoDesc = p.description === buildDescription(p);
    updateProject(p.id, (q) => {
      if (f === 'hashtags') {
        q.hashtags = el.value.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : '#' + t));
      } else if (f === 'hook') {
        const first = q.scenes[0];
        if (first && first.role === 'hook' && first.narration === q.hook) {
          first.narration = el.value;
          first.subtitle = chunkSubtitle(el.value);
        }
        q.hook = el.value;
      } else q[f] = el.value;
      if (autoDesc && f !== 'description') {
        q.description = buildDescription(q);
        const d = document.getElementById('f-desc');
        if (d) {
          d.value = q.description;
          autoGrow(d);
        }
      }
    }, { silent: true });
    if (f === 'title') {
      const h = document.querySelector('.st-title h1');
      if (h) h.textContent = el.value;
    }
    return;
  }
  if (kind === 'scene') {
    const sid = el.dataset.sid;
    const f = el.dataset.f;
    updateProject(p.id, (q) => {
      const s = q.scenes.find((x) => x.id === sid);
      if (!s) return;
      if (f === 'narration') {
        const wasSub = s.subtitle === chunkSubtitle(s.narration);
        const wasHook = q.scenes[0] === s && s.role === 'hook' && q.hook === s.narration;
        s.narration = el.value;
        if (wasSub) s.subtitle = chunkSubtitle(el.value);
        if (wasHook) q.hook = el.value;
      } else if (f === 'visual') {
        const wasPrompt = s.imagePrompt === imagePromptFor(s, q.style);
        s.visual = el.value;
        if (wasPrompt) s.imagePrompt = imagePromptFor(s, q.style);
      } else s[f] = el.value;
    }, { silent: true });
    if (f === 'narration') {
      const s = currentProject().scenes.find((x) => x.id === sid);
      const pc = paceInfo(s);
      const node = document.getElementById('pace-' + sid);
      if (node) {
        node.className = 'pace ' + pc.cls;
        node.textContent = pc.text;
      }
    }
    media.afterMediaChange(true);
    return;
  }
  media.input(el, p);
}

export { shareFile };
