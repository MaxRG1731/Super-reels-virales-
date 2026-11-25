// Capa modular de proveedores externos de IA.
//
// Principios:
//  - Nada se simula: un proveedor figura como "conectado" solo si la prueba de conexión respondió bien.
//  - Las claves secretas NO se guardan aquí. La app habla con TU proxy (ver /proxy/worker.js) y la
//    clave real vive en los secretos del proxy. Si alguien pega una clave conocida, se rechaza.
//  - Cada "slot" (texto, voz, imagen, video, edición) tiene adaptadores intercambiables.

import { CATEGORIES, PLATFORMS, STYLES, byId } from './data.js';
import { projectFromAI, sceneRoles, cleanIdea } from './generator.js';

export const SLOTS = {
  text: {
    label: 'Modelo de texto',
    icon: '✍️',
    help: 'Escribe la historia completa con un modelo real. Sin esto se usa el motor local por plantillas.',
    adapters: [
      { id: 'none', label: 'Sin conectar (motor local)' },
      { id: 'openai-chat', label: 'API compatible con OpenAI · /chat/completions', needsUrl: true, needsModel: true, path: '/chat/completions' },
    ],
  },
  voice: {
    label: 'Voz / narración',
    icon: '🎙️',
    help: 'La voz del dispositivo funciona sin conexión. Para voces de estudio, conecta un servicio de voz.',
    adapters: [
      { id: 'browser', label: 'Voz del dispositivo (gratis, local)' },
      { id: 'openai-speech', label: 'API compatible con OpenAI · /audio/speech', needsUrl: true, needsModel: true, needsVoice: true, path: '/audio/speech' },
    ],
  },
  image: {
    label: 'Imágenes',
    icon: '🖼️',
    help: 'Genera una imagen por escena a partir de su descripción visual.',
    adapters: [
      { id: 'none', label: 'Sin conectar (subir imágenes propias)' },
      { id: 'pollinations', label: 'Pollinations (sin clave, directo)', direct: true },
      { id: 'openai-images', label: 'API compatible con OpenAI · /images/generations', needsUrl: true, needsModel: true, path: '/images/generations' },
    ],
  },
  video: {
    label: 'Video',
    icon: '🎞️',
    help: 'No hay un servicio de video gratuito integrado de fábrica. Se conecta mediante un contrato propio con tu proxy.',
    adapters: [
      { id: 'none', label: 'Sin conectar (subir clips propios)' },
      { id: 'custom-video', label: 'Contrato propio · POST /generate', needsUrl: true, path: '/generate' },
    ],
  },
  edit: {
    label: 'Edición automática',
    icon: '✂️',
    help: 'El montaje se hace en tu dispositivo con Canvas: imágenes, subtítulos, voz y música.',
    adapters: [{ id: 'local', label: 'Montaje local en el navegador (siempre disponible)' }],
  },
};

// Opciones gratuitas o de bajo costo conocidas. Los planes cambian: confirma límites en el sitio de cada servicio.
export const SUGGESTED = {
  text: [
    { name: 'Groq', url: 'https://api.groq.com/openai/v1', note: 'Plan gratuito con límites de uso. Compatible con OpenAI.' },
    { name: 'Google AI Studio (Gemini)', url: 'https://generativelanguage.googleapis.com/v1beta/openai', note: 'Capa gratuita con límites. Endpoint compatible con OpenAI.' },
    { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', note: 'Incluye modelos marcados como gratuitos (sufijo :free).' },
  ],
  voice: [{ name: 'Voz del dispositivo', url: '', note: 'Ya incluida: gratis y sin conexión.' }],
  image: [{ name: 'Pollinations', url: 'https://image.pollinations.ai', note: 'Sin clave. Pruébalo con el botón antes de confiar en él.' }],
  video: [],
};

const SECRET_PATTERNS = [/^sk-/i, /^sk_/i, /^gsk_/i, /^AIza/, /^hf_/i, /^r8_/i, /^xai-/i, /^pplx-/i, /^key-/i, /^ghp_/i, /^github_pat_/i, /^eyJ[A-Za-z0-9_-]{20,}\./];
const VENDOR_HOSTS = ['api.openai.com', 'api.groq.com', 'generativelanguage.googleapis.com', 'openrouter.ai', 'api.elevenlabs.io', 'api.anthropic.com', 'api.mistral.ai', 'api.together.xyz', 'api-inference.huggingface.co', 'api.replicate.com'];

export function looksLikeSecret(token) {
  const t = String(token || '').trim();
  return !!t && SECRET_PATTERNS.some((r) => r.test(t));
}

export function validateProviderConfig(cfg) {
  if (looksLikeSecret(cfg.token)) {
    return 'Eso parece una clave secreta de un proveedor. No se guarda en el navegador: ponla como secreto en tu proxy y aquí usa solo un token propio de acceso al proxy (o déjalo vacío).';
  }
  if (cfg.baseUrl) {
    let u;
    try {
      u = new URL(cfg.baseUrl);
    } catch {
      return 'La URL no es válida.';
    }
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return 'Usa una URL https:// (o localhost para pruebas).';
    if (cfg.token && VENDOR_HOSTS.includes(u.hostname)) return 'No envíes claves directamente a ese proveedor desde la app. Usa tu propio proxy y guarda la clave allí.';
  }
  return null;
}

export const adapterOf = (slot, id) => SLOTS[slot].adapters.find((a) => a.id === id) || SLOTS[slot].adapters[0];

export function isActive(slot, cfg) {
  const a = adapterOf(slot, cfg.adapter);
  if (['none', 'browser', 'local'].includes(a.id)) return a.id !== 'none';
  if (a.direct) return true;
  return !!(cfg.baseUrl && (!a.needsModel || cfg.model));
}

const join = (base, path) => base.replace(/\/+$/, '') + path;

function headersFor(cfg, json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (cfg.token) h.Authorization = `Bearer ${cfg.token}`;
  return h;
}

async function req(url, init = {}, timeout = 90000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    if (!r.ok) {
      let detail = '';
      try {
        detail = (await r.text()).slice(0, 200);
      } catch {
        /* ignorado */
      }
      throw new Error(`HTTP ${r.status}${detail ? ' · ' + detail : ''}`);
    }
    return r;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Tiempo de espera agotado.');
    if (e instanceof TypeError) throw new Error('No se pudo conectar (¿URL, CORS o sin internet?).');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------- texto
export async function callText(cfg, messages, { maxTokens = 3500, temperature = 0.9 } = {}) {
  const a = adapterOf('text', cfg.adapter);
  if (a.id !== 'openai-chat') throw new Error('El modelo de texto no está conectado.');
  const r = await req(join(cfg.baseUrl, a.path), {
    method: 'POST',
    headers: headersFor(cfg),
    body: JSON.stringify({ model: cfg.model, messages, temperature, max_tokens: maxTokens }),
  });
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('La respuesta del modelo llegó vacía.');
  return text;
}

export function extractJSON(text) {
  const clean = String(text).replace(/```(?:json)?/gi, '');
  const a = clean.indexOf('{');
  const b = clean.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('El modelo no devolvió JSON.');
  return JSON.parse(clean.slice(a, b + 1));
}

const SCENE_SHAPE = '{"narration":"texto que se dirá en voz","dialogue":"opcional","visual":"descripción visual concreta del plano","camera":"movimiento de cámara","music":"música sugerida","sfx":"efectos de sonido"}';

export function buildStoryMessages(opts) {
  const cats = opts.categories.map((id) => byId(CATEGORIES, id)?.name).filter(Boolean).join(', ');
  const style = byId(STYLES, opts.style)?.name;
  const platform = byId(PLATFORMS, opts.platform)?.name;
  const n = sceneRoles(opts.duration).length;
  const wordsTarget = Math.round(opts.duration * 2.4);
  const series = opts.series && opts.series.total > 1 ? `Es el episodio ${opts.series.ep} de ${opts.series.total} de una serie. ${opts.series.ep < opts.series.total ? 'Termina con un cliffhanger.' : 'Es el episodio final: cierra la historia.'}${opts.recap ? ` Resumen del episodio anterior: ${opts.recap}` : ''}` : '';
  const system = 'Eres guionista de Reels y Shorts verticales en español neutro. Escribes historias originales con tensión, coherencia y finales memorables. Respondes SOLO con JSON válido, sin texto adicional.';
  const user = [
    `Escribe una historia para ${platform}, de ${opts.duration} segundos, estilo visual "${style}".`,
    `Categorías: ${cats}.`,
    opts.idea ? `Idea del autor (respétala como eje de la trama): ${cleanIdea(opts.idea)}` : 'Inventa una premisa original.',
    series,
    `Requisitos: exactamente ${n} escenas; en total unas ${wordsTarget} palabras de narración; el gancho debe impactar en los primeros 3 segundos; el último giro debe sorprender; no uses personajes ni marcas reales.`,
    `Formato JSON: {"title":"título viral","hook":"gancho de 3 segundos","scenes":[${SCENE_SHAPE}, ...],"cta":"llamada a la acción final","description":"texto para publicar","hashtags":["sin","almohadilla"]}`,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export async function generateWithAI(cfg, opts) {
  const text = await callText(cfg, buildStoryMessages(opts));
  let raw;
  try {
    raw = extractJSON(text);
  } catch (e) {
    throw new Error('No se pudo leer la respuesta del modelo como JSON. Intenta de nuevo.');
  }
  return projectFromAI(raw, opts);
}

export async function regenerateSceneWithAI(cfg, project, scene) {
  const idx = project.scenes.findIndex((s) => s.id === scene.id);
  const ctx = project.scenes.map((s, i) => `${i + 1}. [${s.role}] ${s.narration}`).join('\n');
  const messages = [
    { role: 'system', content: 'Eres guionista de Reels en español neutro. Respondes SOLO con JSON válido.' },
    {
      role: 'user',
      content: `Historia "${project.title}" (${project.duration} s). Escenas actuales:\n${ctx}\n\nReescribe SOLO la escena ${idx + 1} (rol: ${scene.role}, ${scene.secs} s, unas ${Math.round(scene.secs * 2.4)} palabras) manteniendo la coherencia con las demás. Devuelve únicamente: ${SCENE_SHAPE}`,
    },
  ];
  const raw = extractJSON(await callText(cfg, messages, { maxTokens: 800 }));
  if (!raw.narration) throw new Error('El modelo no devolvió narración.');
  return raw;
}

// ---------------------------------------------------------------- imagen
export async function callImage(cfg, prompt, { width = 576, height = 1024, seed = Math.floor(Math.random() * 1e6) } = {}) {
  const a = adapterOf('image', cfg.adapter);
  if (a.id === 'pollinations') {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
    const r = await req(url, {}, 120000);
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) throw new Error('La respuesta no fue una imagen.');
    return blob;
  }
  if (a.id === 'openai-images') {
    const r = await req(
      join(cfg.baseUrl, a.path),
      { method: 'POST', headers: headersFor(cfg), body: JSON.stringify({ model: cfg.model, prompt, n: 1, size: '1024x1792', response_format: 'b64_json' }) },
      120000,
    );
    const data = await r.json();
    const item = data?.data?.[0];
    if (item?.b64_json) return b64ToBlob(item.b64_json, 'image/png');
    if (item?.url) return (await req(item.url, {}, 120000)).blob();
    throw new Error('La respuesta no incluyó imagen.');
  }
  throw new Error('El generador de imágenes no está conectado.');
}

function b64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ---------------------------------------------------------------- voz
export async function callSpeech(cfg, text, voice) {
  const a = adapterOf('voice', cfg.adapter);
  if (a.id !== 'openai-speech') throw new Error('El servicio de voz no está conectado.');
  const r = await req(join(cfg.baseUrl, a.path), {
    method: 'POST',
    headers: headersFor(cfg),
    body: JSON.stringify({ model: cfg.model, input: text, voice: voice || cfg.voice || 'alloy', response_format: 'mp3' }),
  });
  const blob = await r.blob();
  if (!blob.type.startsWith('audio/') && blob.size < 500) throw new Error('La respuesta no fue audio.');
  return blob;
}

// ---------------------------------------------------------------- video (contrato propio)
// POST {baseUrl}/generate  { prompt, duration, aspect: "9:16", image_b64? }  →  video/* | { url }
export async function callVideo(cfg, payload) {
  const a = adapterOf('video', cfg.adapter);
  if (a.id !== 'custom-video') throw new Error('El generador de video no está conectado.');
  const r = await req(join(cfg.baseUrl, a.path), { method: 'POST', headers: headersFor(cfg), body: JSON.stringify({ aspect: '9:16', ...payload }) }, 300000);
  const type = r.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await r.json();
    if (!data.url) throw new Error('La respuesta JSON no incluye "url".');
    return (await req(data.url, {}, 300000)).blob();
  }
  return r.blob();
}

// ---------------------------------------------------------------- prueba de conexión (real)
export async function testProvider(slot, cfg) {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const bad = validateProviderConfig(cfg);
  if (bad) return { ok: false, message: bad };
  const a = adapterOf(slot, cfg.adapter);
  try {
    if (a.id === 'browser') {
      const n = window.speechSynthesis ? window.speechSynthesis.getVoices().length : 0;
      if (!('speechSynthesis' in window)) return { ok: false, message: 'Este navegador no soporta síntesis de voz.' };
      return { ok: true, message: n ? `${n} voces disponibles en el dispositivo.` : 'Síntesis disponible (las voces aún se están cargando).' };
    }
    if (a.id === 'local') return { ok: !!window.HTMLCanvasElement && 'MediaRecorder' in window, message: 'MediaRecorder' in window ? 'Canvas y grabación de video disponibles.' : 'Este navegador no soporta grabar video (MediaRecorder).' };
    if (a.id === 'none') return { ok: false, message: 'No hay adaptador seleccionado.' };
    if (a.needsUrl && !cfg.baseUrl) return { ok: false, message: 'Falta la URL de tu proxy.' };
    if (a.needsModel && !cfg.model) return { ok: false, message: 'Falta el nombre del modelo.' };
    if (a.id === 'openai-chat') {
      const r = await callText(cfg, [{ role: 'user', content: 'Responde solo: ok' }], { maxTokens: 8, temperature: 0 });
      return { ok: true, message: `Respondió en ${ms()} ms: «${r.slice(0, 30)}»` };
    }
    if (a.id === 'pollinations') {
      const b = await callImage(cfg, 'simple red circle on black background', { width: 128, height: 224 });
      return { ok: true, message: `Imagen recibida (${Math.round(b.size / 1024)} KB) en ${ms()} ms.` };
    }
    if (a.id === 'openai-images') {
      const b = await callImage(cfg, 'simple red circle on black background');
      return { ok: true, message: `Imagen recibida (${Math.round(b.size / 1024)} KB) en ${ms()} ms.` };
    }
    if (a.id === 'openai-speech') {
      const b = await callSpeech(cfg, 'Prueba.', cfg.voice);
      return { ok: true, message: `Audio recibido (${Math.round(b.size / 1024)} KB) en ${ms()} ms.` };
    }
    if (a.id === 'custom-video') {
      await req(join(cfg.baseUrl, a.path), { method: 'POST', headers: headersFor(cfg), body: JSON.stringify({ dry_run: true }) }, 20000);
      return { ok: true, message: `Tu proxy respondió a dry_run en ${ms()} ms.` };
    }
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
  return { ok: false, message: 'Adaptador desconocido.' };
}
