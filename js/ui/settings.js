// Vista "Ajustes": proveedores de IA, voz, instalación, datos.

import { SLOTS, SUGGESTED, adapterOf, isActive, testProvider, validateProviderConfig } from '../providers.js';
import { clearSignatures, exportAll, getSettings, getState, requestPersistence, resetEverything, updateSettings } from '../store.js';
import { S } from './state.js';
import { ask, downloadBlob, esc, icon, toast } from './util.js';

const verified = {}; // slot -> {ok, message}

function slotCard(slot) {
  const def = SLOTS[slot];
  const cfg = getSettings().providers[slot];
  const a = adapterOf(slot, cfg.adapter);
  const active = isActive(slot, cfg);
  const v = verified[slot];
  const fixed = ['none', 'browser', 'local'].includes(a.id);
  let badge;
  if (a.id === 'none') badge = '<span class="tag">No conectado</span>';
  else if (fixed) badge = '<span class="tag ok">Disponible</span>';
  else if (v && v.ok) badge = '<span class="tag ok">Conexión verificada</span>';
  else if (v && !v.ok) badge = '<span class="tag bad">Falló la prueba</span>';
  else badge = `<span class="tag warn">${active ? 'Configurado, sin verificar' : 'Incompleto'}</span>`;
  const sug = (SUGGESTED[slot] || []).filter((x) => x.url);
  return `<div class="card prov" data-slot="${slot}">
    <div class="sec-head tight"><h3>${def.icon} ${esc(def.label)}</h3>${badge}</div>
    <p class="muted small">${esc(def.help)}</p>
    <label class="lbl" for="ad-${slot}">Adaptador</label>
    <select id="ad-${slot}" class="field" data-in="prov" data-slot="${slot}" data-f="adapter">${def.adapters.map((x) => `<option value="${x.id}"${x.id === cfg.adapter ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
    ${
      a.needsUrl
        ? `<label class="lbl" for="url-${slot}">URL base de tu proxy</label>
           <input id="url-${slot}" class="field" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://mi-proxy.workers.dev/v1" value="${esc(cfg.baseUrl)}" data-in="prov" data-slot="${slot}" data-f="baseUrl">
           ${a.needsModel ? `<label class="lbl" for="mod-${slot}">Modelo</label><input id="mod-${slot}" class="field" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="nombre-del-modelo" value="${esc(cfg.model)}" data-in="prov" data-slot="${slot}" data-f="model">` : ''}
           ${a.needsVoice ? `<label class="lbl" for="vo-${slot}">Nombre de la voz</label><input id="vo-${slot}" class="field" autocapitalize="off" placeholder="alloy" value="${esc(cfg.voice || '')}" data-in="prov" data-slot="${slot}" data-f="voice">` : ''}
           <label class="lbl" for="tk-${slot}">Token de acceso a TU proxy (opcional)</label>
           <input id="tk-${slot}" class="field" type="password" autocomplete="off" autocapitalize="off" placeholder="Un token que tú inventes, no la clave del proveedor" value="${esc(cfg.token)}" data-in="prov" data-slot="${slot}" data-f="token">
           <p class="hint">${icon('lock', 14)} La clave real del proveedor nunca se escribe aquí: vive como secreto en tu proxy. Esta app rechaza claves que reconoce como secretas.</p>
           ${sug.length && slot === 'text' ? `<details class="more"><summary>Opciones gratuitas o económicas conocidas</summary>${sug.map((x) => `<p class="small"><b>${esc(x.name)}</b> · <code>${esc(x.url)}</code><br><span class="muted">${esc(x.note)}</span></p>`).join('')}<p class="hint">Los planes gratuitos cambian: confirma límites y condiciones en el sitio de cada servicio. Tu proxy apunta a uno de ellos.</p></details>` : ''}`
        : ''
    }
    ${a.id === 'pollinations' ? '<p class="hint">Las descripciones de tus escenas se envían a un servicio público externo para generar imágenes. No lo uses con ideas que quieras mantener privadas.</p>' : ''}
    ${!['none', 'local'].includes(a.id) ? `<div class="row-actions"><button class="btn ghost" data-act="test" data-slot="${slot}" ${S.busy === 'test:' + slot ? 'disabled' : ''}>${S.busy === 'test:' + slot ? '<span class="spinner sm"></span>' : icon('zap', 16)}<span>Probar conexión</span></button></div>` : ''}
    ${v ? `<p class="test-res ${v.ok ? 'ok' : 'bad'}">${icon(v.ok ? 'check' : 'x', 16)} ${esc(v.message)}</p>` : ''}
  </div>`;
}

export function render() {
  const set = getSettings();
  const st = getState();
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<section class="enter">
    <div class="hero compact"><div class="hero-kicker">Configuración</div><h1 class="hero-title">Ajustes</h1></div>

    <div class="card">
      <div class="sec-head tight"><h3>${icon('download', 18)} Instalar en el iPhone</h3>${standalone ? '<span class="tag ok">Instalada</span>' : ''}</div>
      ${
        standalone
          ? '<p class="muted">Ya estás usando REEL FACTORY como app instalada.</p>'
          : S.installPrompt
            ? `<p class="muted">Instálala para abrirla a pantalla completa y sin conexión.</p><button class="btn primary" data-act="install">${icon('download', 18)}<span>Instalar app</span></button>`
            : ios
              ? '<ol class="steps"><li>Abre esta página en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (cuadrado con flecha).</li><li>Elige <b>Añadir a pantalla de inicio</b>.</li></ol>'
              : '<p class="muted">En Chrome o Edge, usa el icono de instalar en la barra de direcciones. En iPhone, desde Safari: Compartir › Añadir a pantalla de inicio.</p>'
      }
    </div>

    <div class="sec-head"><h2>Inteligencia artificial</h2></div>
    <div class="note">${icon('lock', 18)}<span><b>Nada está simulado.</b> Un servicio solo aparece como verificado si respondió a una prueba real. Esta app no incluye claves; para conectar un servicio con clave, usa tu propio proxy gratuito (<code>proxy/worker.js</code>, explicado en el README) para que la clave quede en el servidor.</span></div>
    ${['text', 'voice', 'image', 'video', 'edit'].map(slotCard).join('')}

    <div class="sec-head"><h2>Voz del dispositivo</h2></div>
    <div class="card"><p class="muted small">La voz, velocidad y tono se eligen por proyecto en Estudio › Narración.</p>
      <div class="switch-row"><div><div class="lbl">Leer la llamada a la acción</div><div class="muted small">Se dice al final de la vista previa.</div></div><button class="switch${set.includeCta ? ' on' : ''}" role="switch" aria-checked="${set.includeCta}" data-act="cta-voice" aria-label="Leer la llamada a la acción"><span></span></button></div>
    </div>

    <div class="sec-head"><h2>Datos</h2></div>
    <div class="card">
      <div class="stat-row"><span>Proyectos guardados</span><b>${Object.keys(st.projects).length}</b></div>
      <div class="stat-row"><span>Historias recordadas (para no repetir)</span><b>${st.sigs.length}</b></div>
      <div class="stat-row"><span>Categorías favoritas</span><b>${st.favCats.length}</b></div>
      <div id="storage-line" class="muted small"></div>
      <div class="grid2">
        <button class="btn ghost" data-act="persist">${icon('lock', 18)}<span>Proteger datos</span></button>
        <button class="btn ghost" data-act="clear-sigs">${icon('refresh', 18)}<span>Olvidar historias usadas</span></button>
        <button class="btn ghost" data-act="backup-all">${icon('download', 18)}<span>Copia de seguridad</span></button>
        <button class="btn ghost danger-text" data-act="reset">${icon('trash', 18)}<span>Borrar todo</span></button>
      </div>
      <p class="hint">Todo se guarda solo en este dispositivo. Safari puede borrar datos de sitios que no usas en varias semanas: instala la app y haz copias de seguridad.</p>
    </div>

    <div class="about"><b>REEL FACTORY</b> · v1.0<br><span class="muted small">Estudio personal de Reels y Shorts. Sin registro, sin suscripción, sin servidor.</span></div>
  </section>`;
}

export async function afterRender() {
  const line = document.getElementById('storage-line');
  if (line && navigator.storage && navigator.storage.estimate) {
    try {
      const e = await navigator.storage.estimate();
      const mb = (n) => (n / 1048576).toFixed(1);
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      line.textContent = `Espacio usado: ${mb(e.usage || 0)} MB de ${mb(e.quota || 0)} MB · almacenamiento ${persisted ? 'protegido' : 'no protegido'}`;
    } catch {
      /* ignorado */
    }
  }
}

export async function click(act, el, rerender) {
  switch (act) {
    case 'test': {
      const slot = el.dataset.slot;
      S.busy = 'test:' + slot;
      rerender();
      const res = await testProvider(slot, getSettings().providers[slot]);
      verified[slot] = res;
      S.busy = null;
      rerender();
      return;
    }
    case 'cta-voice':
      return updateSettings((s) => (s.includeCta = !s.includeCta));
    case 'install':
      if (S.installPrompt) {
        S.installPrompt.prompt();
        await S.installPrompt.userChoice.catch(() => {});
        S.installPrompt = null;
        rerender();
      }
      return;
    case 'persist':
      return toast((await requestPersistence()) ? 'Almacenamiento protegido.' : 'El navegador no concedió protección (instala la app para mejorarlo).', 'info', 4000);
    case 'clear-sigs':
      clearSignatures();
      return toast('Listo: ya puede repetir historias.', 'ok');
    case 'backup-all':
      downloadBlob(new Blob([exportAll()], { type: 'application/json' }), `reel-factory-copia-${new Date().toISOString().slice(0, 10)}.json`);
      return toast('Copia descargada.', 'ok');
    case 'reset':
      if (await ask({ title: '¿Borrar todos los datos?', text: 'Se eliminarán proyectos, imágenes, audios y ajustes de este dispositivo. No se puede deshacer.', ok: 'Borrar todo', danger: true })) {
        resetEverything();
        Object.keys(verified).forEach((k) => delete verified[k]);
        toast('Datos borrados.');
      }
      return;
    default:
      return false;
  }
}

export function input(el, rerender) {
  if (el.dataset.in !== 'prov') return;
  const slot = el.dataset.slot;
  const f = el.dataset.f;
  const value = el.value.trim();
  if (f === 'adapter') {
    updateSettings((s) => (s.providers[slot].adapter = value));
    delete verified[slot];
    return rerender();
  }
  const trial = { ...getSettings().providers[slot], [f]: value };
  if (f === 'token' || f === 'baseUrl') {
    const bad = validateProviderConfig(trial);
    if (bad) {
      toast(bad, 'error', 5500);
      el.value = '';
      return;
    }
  }
  updateSettings((s) => (s.providers[slot][f] = value), { silent: true });
  delete verified[slot];
  const tag = document.querySelector(`.prov[data-slot="${slot}"] .tag`);
  if (tag && !tag.classList.contains('ok')) rerender();
}
