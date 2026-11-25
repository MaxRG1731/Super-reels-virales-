// Vista "Biblioteca": proyectos, historial y papelera.

import { CATEGORIES, PLATFORMS, byId } from '../data.js';
import { toMarkdown, toSRT, toText, totalSecs } from '../generator.js';
import {
  duplicateProject, emptyTrash, exportAll, getState, importAll, listProjects, listTrash, purgeProject, restoreProject, toggleFavorite, trashProject,
} from '../store.js';
import { S, go } from './state.js';
import { ask, closeSheet, copyText, downloadBlob, esc, fmtDate, fmtTime, icon, openSheet, pickFile, toast } from './util.js';

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reel';

function card(p) {
  const cat = byId(CATEGORIES, p.categories[0]);
  const cats = p.categories.map((c) => byId(CATEGORIES, c)?.name).filter(Boolean).join(' + ');
  return `<article class="proj" style="--c:${cat?.color || '#888'}">
    <button class="proj-main" data-act="open" data-id="${p.id}">
      <span class="proj-ic">${cat?.emoji || '🎬'}</span>
      <span class="proj-txt"><b>${esc(p.title)}</b><span class="muted small">${esc(cats)}</span><span class="muted small">${fmtTime(totalSecs(p))} · ${esc(byId(PLATFORMS, p.platform)?.short || '')} · ${fmtDate(p.updatedAt)}${p.series ? ` · Ep. ${p.series.ep}/${p.series.total}` : ''}</span></span>
    </button>
    <div class="proj-act">
      <button class="icon-btn${p.favorite ? ' on-fav' : ''}" data-act="fav" data-id="${p.id}" aria-label="Favorito" aria-pressed="${!!p.favorite}">${icon('star', 20, !!p.favorite)}</button>
      <button class="icon-btn" data-act="dup" data-id="${p.id}" aria-label="Duplicar">${icon('clone', 20)}</button>
      <button class="icon-btn" data-act="exp-sheet" data-id="${p.id}" aria-label="Exportar">${icon('download', 20)}</button>
      <button class="icon-btn danger-text" data-act="trash" data-id="${p.id}" aria-label="Enviar a la papelera">${icon('trash', 20)}</button>
    </div>
  </article>`;
}

export function render() {
  const L = S.lib;
  const all = listProjects();
  const st = getState();
  const pane = (id, label, n) => `<button class="seg-btn${L.pane === id ? ' on' : ''}" data-act="pane" data-v="${id}"><span>${label}${n ? ` · ${n}` : ''}</span></button>`;
  const head = `
  <div class="hero compact"><div class="hero-kicker">Tu archivo</div><h1 class="hero-title">Biblioteca</h1></div>
  <div class="seg">${pane('proyectos', 'Proyectos', all.length)}${pane('historial', 'Historial', '')}${pane('papelera', 'Papelera', listTrash().length)}</div>`;

  if (L.pane === 'historial') {
    const log = st.log;
    return `<section class="enter">${head}
      ${
        log.length
          ? `<div class="list">${log
              .slice(0, 80)
              .map((x) => `<div class="row-card static"><div><b>${esc(x.action)}</b><div class="muted small">${esc(x.title || '')}</div></div><span class="muted small">${fmtDate(x.t)}</span></div>`)
              .join('')}</div>`
          : '<p class="muted center pad">Todavía no hay actividad.</p>'
      }</section>`;
  }

  if (L.pane === 'papelera') {
    const tr = listTrash();
    return `<section class="enter">${head}
      ${
        tr.length
          ? `<div class="list">${tr
              .map((p) => `<div class="row-card static"><div><b>${esc(p.title)}</b><div class="muted small">Eliminado ${fmtDate(p.deletedAt)}</div></div><div class="row-actions"><button class="btn small ghost" data-act="restore" data-id="${p.id}">${icon('restore', 16)}<span>Recuperar</span></button><button class="icon-btn danger-text" data-act="purge" data-id="${p.id}" aria-label="Eliminar definitivamente">${icon('trash', 18)}</button></div></div>`)
              .join('')}</div>
            <button class="btn ghost danger-text wide" data-act="empty-trash">Vaciar papelera</button>`
          : '<p class="muted center pad">La papelera está vacía.</p>'
      }</section>`;
  }

  // proyectos
  let list = all.slice();
  const q = L.q.trim().toLowerCase();
  if (q) list = list.filter((p) => (p.title + ' ' + p.hook + ' ' + p.scenes.map((s) => s.narration).join(' ')).toLowerCase().includes(q));
  if (L.cat) list = list.filter((p) => p.categories.includes(L.cat));
  if (L.fav) list = list.filter((p) => p.favorite);
  if (L.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  const usedCats = [...new Set(all.flatMap((p) => p.categories))].map((id) => byId(CATEGORIES, id)).filter(Boolean);

  let body;
  if (L.sort === 'cat') {
    const groups = {};
    list.forEach((p) => (groups[p.categories[0]] = groups[p.categories[0]] || []).push(p));
    body = Object.keys(groups)
      .map((id) => {
        const c = byId(CATEGORIES, id);
        return `<div class="sec-head"><h2>${c?.emoji || ''} ${esc(c?.name || id)}</h2><span class="muted">${groups[id].length}</span></div><div class="list">${groups[id].map(card).join('')}</div>`;
      })
      .join('');
  } else body = `<div class="list">${list.map(card).join('')}</div>`;

  return `<section class="enter">${head}
    ${
      all.length
        ? `<div class="search">${icon('list', 18)}<input id="q" class="field" type="search" placeholder="Buscar por título o texto…" value="${esc(L.q)}" data-in="libq"></div>
           <div class="chips scroll pad-x">
             <button class="chip${L.fav ? ' on' : ''}" data-act="lib-fav">${icon('star', 14, L.fav)} Favoritos</button>
             <button class="chip${L.sort === 'recent' ? ' on' : ''}" data-act="sort" data-v="recent">Recientes</button>
             <button class="chip${L.sort === 'title' ? ' on' : ''}" data-act="sort" data-v="title">A–Z</button>
             <button class="chip${L.sort === 'cat' ? ' on' : ''}" data-act="sort" data-v="cat">Por categoría</button>
             ${usedCats.map((c) => `<button class="chip${L.cat === c.id ? ' on' : ''}" data-act="lib-cat" data-v="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}
           </div>
           ${list.length ? body : '<p class="muted center pad">Ningún proyecto coincide con el filtro.</p>'}`
        : `<div class="empty"><div class="empty-ic">📚</div><h2>Aquí vivirán tus historias</h2><p class="muted">Aún no tienes proyectos guardados. Todo lo que generes se guarda automáticamente en este dispositivo.</p><a class="btn primary big glow" href="#/crear">${icon('zap', 20)}<span>Crear mi primera historia</span></a></div>`
    }
    <div class="card"><div class="sec-head tight"><h3>Copia de seguridad</h3></div>
      <p class="muted small">Descarga todos tus proyectos en un archivo para pasarlos a otro dispositivo o guardarlos. Las imágenes, voces y clips no se incluyen: viven en este dispositivo.</p>
      <div class="grid2"><button class="btn ghost" data-act="backup">${icon('download', 18)}<span>Exportar todo</span></button><button class="btn ghost" data-act="restore-file">${icon('upload', 18)}<span>Importar</span></button></div>
    </div></section>`;
}

function exportSheet(id) {
  const p = getState().projects[id];
  if (!p) return;
  const w = openSheet(`<h3 class="sheet-title">Exportar «${esc(p.title)}»</h3>
    <div class="grid1">
      <button class="btn ghost" data-x="copy">${icon('copy', 18)}<span>Copiar guion completo</span></button>
      <button class="btn ghost" data-x="txt">${icon('file', 18)}<span>Descargar .txt</span></button>
      <button class="btn ghost" data-x="md">${icon('file', 18)}<span>Descargar Markdown</span></button>
      <button class="btn ghost" data-x="srt">${icon('type', 18)}<span>Descargar subtítulos .srt</span></button>
      <button class="btn ghost" data-x="json">${icon('download', 18)}<span>Descargar proyecto .json</span></button>
    </div>`);
  w.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const x = b.dataset.x;
    const base = slug(p.title);
    if (x === 'copy') toast((await copyText(toText(p))) ? 'Guion copiado.' : 'No se pudo copiar.', 'ok');
    if (x === 'txt') downloadBlob(new Blob([toText(p)], { type: 'text/plain;charset=utf-8' }), base + '.txt');
    if (x === 'md') downloadBlob(new Blob([toMarkdown(p)], { type: 'text/markdown;charset=utf-8' }), base + '.md');
    if (x === 'srt') downloadBlob(new Blob([toSRT(p)], { type: 'application/x-subrip;charset=utf-8' }), base + '.srt');
    if (x === 'json') downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), base + '.json');
    closeSheet();
  });
}

export async function click(act, el, rerender) {
  const id = el.dataset.id;
  switch (act) {
    case 'pane':
      S.lib.pane = el.dataset.v;
      return rerender();
    case 'open':
      return go('#/estudio/' + id);
    case 'fav':
      return toggleFavorite(id);
    case 'dup': {
      const c = duplicateProject(id);
      toast('Proyecto duplicado.', 'ok');
      return c;
    }
    case 'trash':
      trashProject(id);
      return toast('Enviado a la papelera.');
    case 'exp-sheet':
      return exportSheet(id);
    case 'restore':
      restoreProject(id);
      return toast('Proyecto recuperado.', 'ok');
    case 'purge':
      if (await ask({ title: '¿Eliminar para siempre?', text: 'No se podrá recuperar.', ok: 'Eliminar', danger: true })) purgeProject(id);
      return;
    case 'empty-trash':
      if (await ask({ title: '¿Vaciar la papelera?', text: 'Se eliminarán todos sus proyectos para siempre.', ok: 'Vaciar', danger: true })) emptyTrash();
      return;
    case 'lib-fav':
      S.lib.fav = !S.lib.fav;
      return rerender();
    case 'lib-cat':
      S.lib.cat = S.lib.cat === el.dataset.v ? '' : el.dataset.v;
      return rerender();
    case 'sort':
      S.lib.sort = el.dataset.v;
      return rerender();
    case 'backup':
      downloadBlob(new Blob([exportAll()], { type: 'application/json' }), `reel-factory-copia-${new Date().toISOString().slice(0, 10)}.json`);
      return toast('Copia descargada.', 'ok');
    case 'restore-file': {
      const f = await pickFile('application/json,.json');
      if (!f) return;
      try {
        const n = importAll(await f.text());
        toast(`Importados ${n} proyectos nuevos.`, 'ok');
      } catch (e) {
        toast('No se pudo importar: ' + e.message, 'error', 4500);
      }
      return;
    }
    default:
      return false;
  }
}

export function input(el, rerender) {
  if (el.dataset.in === 'libq') {
    S.lib.q = el.value;
    clearTimeout(input._t);
    input._t = setTimeout(() => {
      rerender();
      const q = document.getElementById('q');
      if (q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 220);
  }
}
