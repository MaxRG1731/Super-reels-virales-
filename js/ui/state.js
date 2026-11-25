// Estado de interfaz (no persistente) compartido entre vistas.

export const S = {
  view: 'crear',
  projectId: null,
  tab: 'guion',
  player: null,
  create: { mode: 'categoria', cats: [], dur: 30, plat: 'tiktok', style: 'cinematico', series: false, episodes: 3, idea: '', useAI: true },
  lib: { q: '', cat: '', fav: false, sort: 'recent', pane: 'proyectos' },
  urls: {}, // caché de URLs de objeto para miniaturas
  exports: {}, // último video exportado por proyecto
  busy: null,
  sel: null,
  openMore: new Set(),
  installPrompt: null,
};

export const go = (hash) => {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
};
