// Proxy mínimo para Cloudflare Workers (plan gratuito).
//
// Para qué sirve: REEL FACTORY corre en tu navegador, y un navegador NO es un lugar seguro para una
// clave de API. Este Worker guarda la clave como secreto y reenvía las peticiones de la app al
// proveedor que tú elijas (cualquier API compatible con OpenAI: texto, voz o imágenes).
//
// Secretos y variables (ver proxy/README.md):
//   UPSTREAM_BASE_URL  (variable)  p. ej. https://api.groq.com/openai/v1
//   UPSTREAM_API_KEY   (secreto)   la clave real del proveedor. Nunca sale de aquí.
//   ACCESS_TOKEN       (secreto)   token que tú inventas; la app lo envía como "Bearer".
//   ALLOWED_ORIGINS    (variable)  p. ej. https://tuusuario.github.io  (separa varios con comas)

const ROUTES = new Set(['/chat/completions', '/audio/speech', '/images/generations', '/generate']);
const MAX_BODY = 1_000_000; // 1 MB de petición: más que suficiente para guiones y prompts

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// Comparación en tiempo constante para no filtrar el token por diferencias de tiempo.
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

const json = (status, obj, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed.length) return json(500, { error: 'Falta configurar ALLOWED_ORIGINS en el Worker.' }, cors);
    if (!allowed.includes(origin)) return json(403, { error: 'Origen no permitido.' }, cors);
    if (request.method !== 'POST') return json(405, { error: 'Solo POST.' }, cors);

    if (!env.UPSTREAM_BASE_URL || !env.UPSTREAM_API_KEY) return json(500, { error: 'Falta configurar UPSTREAM_BASE_URL o UPSTREAM_API_KEY.' }, cors);
    if (env.ACCESS_TOKEN) {
      const auth = request.headers.get('Authorization') || '';
      if (!safeEqual(auth, `Bearer ${env.ACCESS_TOKEN}`)) return json(401, { error: 'Token de acceso inválido.' }, cors);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/v1(?=\/)/, '');
    if (!ROUTES.has(path)) return json(404, { error: 'Ruta no disponible.' }, cors);

    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > MAX_BODY) return json(413, { error: 'Petición demasiado grande.' }, cors);
    const body = await request.text();
    if (body.length > MAX_BODY) return json(413, { error: 'Petición demasiado grande.' }, cors);

    const upstream = await fetch(env.UPSTREAM_BASE_URL.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.UPSTREAM_API_KEY}` },
      body,
    });

    // Solo se devuelven cabeceras seguras; la respuesta del proveedor pasa tal cual.
    const headers = new Headers(cors);
    const ct = upstream.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
