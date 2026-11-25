// Arranque, enrutador y delegación de eventos.

import { getProject, getState, subscribe, getSaveError } from './store.js';
import { S, go } from './ui/state.js';
import { $, closeSheet, icon, toast } from './ui/util.js';
import * as create from './ui/create.js';
import * as studio from './ui/studio.js';
import * as studioMedia from './ui/studio-media.js';
import * as library from './ui/library.js';
import * as settings from './ui/settings.js';
import { closeFull, disposePreview } from './ui/preview.js';

const VIEWS = { crear: create, estudio: studio, biblioteca: library, ajustes: settings };
const NAV = [
  ['crear', 'Crear', 'zap'],
  ['estudio', 'Estudio', 'film'],
  ['biblioteca', 'Biblioteca', 'library'],
  ['ajustes', 'Ajustes', 'settings'],
];

const app = $('#app');
let view = 'crear';
let lastView = null;
let lastProject = null;

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [v, id] = h.split('/');
  return { v: VIEWS[v] ? v : 'crear', id };
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = NAV.map(([id, label, ic]) => `<a href="#/${id}" class="nav-item${view === id ? ' on' : ''}" aria-current="${view === id ? 'page' : 'false'}">${icon(ic, 24)}<span>${label}</span></a>`).join('');
}

function resolveProject(id) {
  const st = getState();
  if (id && st.projects[id]) S.projectId = id;
  else if (!S.projectId || !st.projects[S.projectId]) S.projectId = st.currentId && st.projects[st.currentId] ? st.currentId : null;
}

export async function render(opts = {}) {
  const { v, id } = parseHash();
  view = v;
  if (v === 'estudio') resolveProject(id);
  const changedView = lastView !== v || (v === 'estudio' && lastProject !== S.projectId);
  if (lastView === 'estudio' && (v !== 'estudio' || lastProject !== S.projectId)) {
    studioMedia.leaveStudio();
    closeFull();
    disposePreview();
  }
  const y = window.scrollY;
  const mod = VIEWS[v];
  app.innerHTML = mod.render();
  app.dataset.view = v;
  renderNav();
  lastView = v;
  lastProject = S.projectId;
  if (v === 'estudio') {
    studio.mountPreview();
    studioMedia.afterRender(app);
    app.querySelectorAll('textarea.auto').forEach((t) => {
      t.style.height = 'auto';
      t.style.height = Math.min(t.scrollHeight + 2, 420) + 'px';
    });
  }
  if (v === 'ajustes') settings.afterRender();
  if ((changedView && !opts.keepScroll) || S.resetScroll) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
  S.resetScroll = false;
}

let queued = false;
function rerender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render({ keepScroll: true });
  });
}

// ---------------------------------------------------------------- eventos
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !app.contains(el)) return;
  const act = el.dataset.act;
  try {
    await VIEWS[view].click(act, el, rerender);
  } catch (err) {
    console.error(err);
    toast('Algo salió mal: ' + (err.message || err), 'error', 4500);
  }
});

app.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.in || el.dataset.in === 'prov' || el.tagName === 'SELECT') return;
  try {
    VIEWS[view].input && VIEWS[view].input(el, rerender);
  } catch (err) {
    console.error(err);
  }
});

app.addEventListener('change', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.in) return;
  if (el.dataset.in !== 'prov' && el.tagName !== 'SELECT') return;
  try {
    VIEWS[view].input && VIEWS[view].input(el, rerender);
  } catch (err) {
    console.error(err);
  }
});

document.addEventListener(
  'toggle',
  (e) => {
    const d = e.target;
    if (d.tagName === 'DETAILS' && d.dataset && d.dataset.sid) {
      d.open ? S.openMore.add(d.dataset.sid) : S.openMore.delete(d.dataset.sid);
    }
  },
  true,
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSheet();
    closeFull();
  }
});

window.addEventListener('hashchange', () => render());

subscribe((type) => {
  if (type === 'error') return toast('No se pudo guardar: el almacenamiento está lleno. Exporta una copia y libera espacio.', 'error', 6000);
  rerender();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  S.installPrompt = e;
  if (view === 'ajustes') rerender();
});
window.addEventListener('appinstalled', () => {
  S.installPrompt = null;
  toast('REEL FACTORY instalada.', 'ok');
  if (view === 'ajustes') rerender();
});

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    if ((view === 'estudio' && S.tab === 'narracion') || view === 'ajustes') rerender();
  };
}

window.addEventListener('error', (e) => console.error(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error(e.reason));

// ---------------------------------------------------------------- PWA
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw &&
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva. Se aplicará al reabrir la app.', 'info', 4500);
            });
        });
      })
      .catch((e) => console.warn('Service worker no registrado', e));
  });
}

// ---------------------------------------------------------------- inicio
if (!location.hash) history.replaceState(null, '', '#/crear');
render().then(() => {
  document.body.classList.add('ready');
  $('#boot')?.remove();
  if (getSaveError()) toast('El almacenamiento local no está disponible: tus proyectos no se guardarán.', 'error', 6000);
});

export { getProject, go };
