// Vista "Crear": elegir categorías, idea, configuración y generar.

import { CATEGORIES, DURATIONS, PLATFORMS, STYLES, byId } from '../data.js';
import { generateProject, surpriseOptions } from '../generator.js';
import { generateWithAI, isActive } from '../providers.js';
import { getSettings, getState, hasSignature, addSignature, saveProject, setCurrent, listProjects, toggleFavCat } from '../store.js';
import { S, go } from './state.js';
import { esc, icon, toast, ask, openSheet, closeSheet, fmtDate } from './util.js';

export function render() {
  const c = S.create;
  const st = getState();
  const favs = st.favCats;
  const ordered = [...CATEGORIES].sort((a, b) => (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0));
  const textCfg = getSettings().providers.text;
  const aiReady = isActive('text', textCfg);
  const recent = listProjects().slice(0, 3);

  const catGrid = `
    <div class="cat-grid" id="cat-grid">
      ${ordered
        .map((k) => {
          const idx = c.cats.indexOf(k.id);
          const on = idx >= 0;
          return `<div class="cat-wrap">
            <button class="cat${on ? ' on' : ''}" style="--c:${k.color}" data-act="cat" data-id="${k.id}" aria-pressed="${on}">
              <span class="cat-emoji">${k.emoji}</span>
              <span class="cat-name">${esc(k.name)}</span>
              <span class="cat-blurb">${esc(k.blurb)}</span>
              ${on ? `<span class="cat-order">${idx + 1}</span>` : ''}
            </button>
            <button class="cat-fav${favs.includes(k.id) ? ' on' : ''}" data-act="favcat" data-id="${k.id}" aria-label="Marcar ${esc(k.name)} como favorita">${icon('star', 16, favs.includes(k.id))}</button>
          </div>`;
        })
        .join('')}
    </div>`;

  const seg = (mode, label, ic) => `<button class="seg-btn${c.mode === mode ? ' on' : ''}" data-act="mode" data-mode="${mode}">${icon(ic, 18)}<span>${label}</span></button>`;

  const summary = c.cats.length ? c.cats.map((id) => byId(CATEGORIES, id).name).join(' + ') : 'Sin categoría';

  return `
  <section class="view-create enter">
    <div class="hero">
      <div class="hero-kicker">Nueva historia</div>
      <h1 class="hero-title">¿Qué vamos a contar hoy?</h1>
      <p class="hero-sub">Elige el tono, escribe tu idea o deja que la fábrica te sorprenda.</p>
    </div>

    <div class="seg" role="tablist">${seg('categoria', 'Categorías', 'layers')}${seg('idea', 'Mi idea', 'edit')}${seg('sorprende', 'Sorpréndeme', 'dice')}</div>

    ${
      c.mode === 'sorprende'
        ? `<div class="card surprise">
            <div class="dice">🎲</div>
            <h3>Modo sorpresa</h3>
            <p class="muted">Elegimos de 1 a 3 categorías y una duración al azar, y creamos la historia al instante. Usa tu plataforma y estilo de abajo.</p>
          </div>`
        : `${
            c.mode === 'idea'
              ? `<div class="card">
                  <label class="lbl" for="idea">Tu idea</label>
                  <textarea id="idea" class="field" rows="3" maxlength="180" placeholder="Ej: Una enfermera descubre que su paciente nunca duerme…" data-in="idea">${esc(c.idea)}</textarea>
                  <p class="hint">${aiReady && c.useAI ? 'El modelo conectado construirá la trama alrededor de tu idea.' : 'El motor local usa tu idea como gancho de la historia. Para que toda la trama gire en torno a ella, conecta un modelo de texto en Ajustes.'}</p>
                </div>`
              : ''
          }
          <div class="sec-head"><h2>${c.mode === 'idea' ? 'Tono de la historia' : 'Categorías'}</h2><span class="muted">${c.cats.length}/3 elegidas</span></div>
          ${catGrid}`
    }

    <div class="sec-head"><h2>Formato</h2></div>
    <div class="card cfg">
      <div class="cfg-row"><span class="lbl">Duración</span><div class="chips">${DURATIONS.map((d) => `<button class="chip${c.dur === d ? ' on' : ''}" data-act="dur" data-v="${d}">${d} s</button>`).join('')}</div></div>
      <div class="cfg-row"><span class="lbl">Plataforma</span><div class="chips">${PLATFORMS.map((p) => `<button class="chip${c.plat === p.id ? ' on' : ''}" data-act="plat" data-v="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>
      <div class="cfg-row"><span class="lbl">Estilo visual</span><div class="chips scroll">${STYLES.map((s) => `<button class="chip${c.style === s.id ? ' on' : ''}" data-act="style" data-v="${s.id}">${esc(s.name)}</button>`).join('')}</div></div>
      <div class="cfg-row"><span class="lbl">Vertical 9:16</span><span class="muted small">Todas las historias se componen en formato vertical.</span></div>
    </div>

    <div class="card cfg">
      <div class="switch-row">
        <div><div class="lbl">Historia por episodios</div><div class="muted small">Cada episodio retoma al protagonista y termina con un cliffhanger.</div></div>
        <button class="switch${c.series ? ' on' : ''}" role="switch" aria-checked="${c.series}" data-act="series" aria-label="Historia por episodios"><span></span></button>
      </div>
      ${c.series ? `<div class="stepper"><span class="lbl">Episodios</span><div><button class="step-btn" data-act="eps" data-v="-1" aria-label="Menos">−</button><b>${c.episodes}</b><button class="step-btn" data-act="eps" data-v="1" aria-label="Más">+</button></div></div>` : ''}
      ${
        aiReady
          ? `<div class="switch-row"><div><div class="lbl">Escribir con IA</div><div class="muted small">Modelo conectado: ${esc(textCfg.model || 'sin nombre')}. Si lo apagas, se usa el motor local.</div></div><button class="switch${c.useAI ? ' on' : ''}" role="switch" aria-checked="${c.useAI}" data-act="useai" aria-label="Escribir con IA"><span></span></button></div>`
          : `<div class="note">${icon('info', 18)}<span>Motor local activo (plantillas, sin conexión). Conecta un modelo de texto en <a href="#/ajustes">Ajustes</a> para historias escritas por IA.</span></div>`
      }
    </div>

    ${
      recent.length
        ? `<div class="sec-head"><h2>Continuar</h2><a class="link" href="#/biblioteca">Ver biblioteca</a></div>
           <div class="recent">${recent
             .map((p) => {
               const cat = byId(CATEGORIES, p.categories[0]);
               return `<button class="recent-card" style="--c:${cat?.color || '#888'}" data-act="open" data-id="${p.id}"><span class="rc-emoji">${cat?.emoji || '🎬'}</span><span class="rc-t">${esc(p.title)}</span><span class="rc-m">${p.duration} s · ${fmtDate(p.updatedAt)}</span></button>`;
             })
             .join('')}</div>`
        : ''
    }
    <div class="gen-spacer"></div>
  </section>

  <div class="gen-bar">
    <div class="gen-sum"><b>${c.mode === 'sorprende' ? 'Sorpresa total' : esc(summary)}</b><span>${c.dur} s · ${esc(byId(PLATFORMS, c.plat).short)}${c.series ? ` · ${c.episodes} episodios` : ''}</span></div>
    <button class="btn primary big glow" data-act="generate">${icon(c.mode === 'sorprende' ? 'dice' : 'zap', 20)}<span>${c.mode === 'sorprende' ? 'Sorpréndeme' : 'Generar historia'}</span></button>
  </div>`;
}

export async function click(act, el, rerender) {
  const c = S.create;
  switch (act) {
    case 'mode':
      c.mode = el.dataset.mode;
      return rerender();
    case 'cat': {
      const id = el.dataset.id;
      const i = c.cats.indexOf(id);
      if (i >= 0) c.cats.splice(i, 1);
      else if (c.cats.length >= 3) return toast('Puedes combinar hasta 3 categorías.', 'warn');
      else c.cats.push(id);
      return rerender();
    }
    case 'favcat':
      toggleFavCat(el.dataset.id);
      return rerender();
    case 'dur':
      c.dur = Number(el.dataset.v);
      return rerender();
    case 'plat':
      c.plat = el.dataset.v;
      return rerender();
    case 'style':
      c.style = el.dataset.v;
      return rerender();
    case 'series':
      c.series = !c.series;
      return rerender();
    case 'eps':
      c.episodes = Math.min(8, Math.max(2, c.episodes + Number(el.dataset.v)));
      return rerender();
    case 'useai':
      c.useAI = !c.useAI;
      return rerender();
    case 'open':
      return go('#/estudio/' + el.dataset.id);
    case 'generate':
      return generate();
    default:
      return false;
  }
}

export function input(el) {
  if (el.dataset.in === 'idea') S.create.idea = el.value;
}

let busy = false;

function showBusy(msg) {
  openSheet(`<div class="busy"><div class="spinner"></div><h3 class="sheet-title">${esc(msg)}</h3><p class="sheet-text">Esto puede tardar unos segundos.</p></div>`);
}

export async function generate() {
  if (busy) return;
  const c = S.create;
  let cats = c.cats.slice();
  let dur = c.dur;
  if (c.mode === 'sorprende') {
    const s = surpriseOptions();
    cats = s.categories;
    dur = s.duration;
  }
  if (!cats.length) return toast('Elige al menos una categoría.', 'warn');
  if (c.mode === 'idea' && !c.idea.trim()) return toast('Escribe tu idea primero.', 'warn');

  const opts = {
    categories: cats,
    duration: dur,
    platform: c.plat,
    style: c.style,
    idea: c.mode === 'idea' ? c.idea : '',
    mode: c.mode === 'sorprende' ? 'sorprende' : c.mode,
    series: c.series ? { ep: 1, total: c.episodes } : null,
    hasSignature,
  };
  const textCfg = getSettings().providers.text;
  busy = true;
  try {
    let project = null;
    if (c.useAI && isActive('text', textCfg)) {
      showBusy('Escribiendo con tu modelo…');
      try {
        project = await generateWithAI(textCfg, opts);
        closeSheet();
      } catch (e) {
        closeSheet();
        await new Promise((r) => setTimeout(r, 260));
        const useLocal = await ask({ title: 'El modelo no pudo escribir la historia', text: `${e.message} ¿Quieres generarla con el motor local?`, ok: 'Usar motor local', cancel: 'Cancelar' });
        if (!useLocal) return;
      }
    }
    if (!project) project = generateProject(opts);
    if (project.sig) addSignature(project.sig);
    saveProject(project, { log: 'Creado' });
    setCurrent(project.id);
    S.tab = 'guion';
    go('#/estudio/' + project.id);
    if (c.mode === 'sorprende') toast(`Sorpresa: ${cats.map((id) => byId(CATEGORIES, id).name).join(' + ')} · ${dur} s`, 'ok', 3500);
  } catch (e) {
    console.error(e);
    toast('No se pudo crear la historia: ' + e.message, 'error', 4500);
  } finally {
    busy = false;
  }
}
