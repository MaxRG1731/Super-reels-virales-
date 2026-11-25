// Prueba del proxy con un "upstream" simulado: `node tests/proxy.test.mjs`
import assert from 'node:assert/strict';
import worker from '../proxy/worker.js';

const env = { UPSTREAM_BASE_URL: 'https://upstream.test/v1', UPSTREAM_API_KEY: 'SECRETO-DEL-PROVEEDOR', ACCESS_TOKEN: 'mi-token', ALLOWED_ORIGINS: 'https://yo.github.io' };
const calls = [];
globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json', 'X-Upstream-Secret': 'no-debe-pasar' } }); };
const req = (path, { origin = 'https://yo.github.io', token = 'mi-token', method = 'POST', body = '{"a":1}' } = {}) =>
  new Request('https://proxy.test' + path, { method, headers: { Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, body: method === 'POST' ? body : undefined });
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('✓', name); };

await t('reenvía con la clave del proveedor y sin exponerla', async () => {
  const r = await worker.fetch(req('/v1/chat/completions'), env);
  assert.equal(r.status, 200);
  assert.equal(calls.at(-1).url, 'https://upstream.test/v1/chat/completions');
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer SECRETO-DEL-PROVEEDOR');
  assert.ok(!JSON.stringify([...r.headers]).includes('SECRETO'));
  assert.equal(r.headers.get('x-upstream-secret'), null);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://yo.github.io');
});
await t('rechaza token incorrecto o ausente (401)', async () => {
  assert.equal((await worker.fetch(req('/v1/chat/completions', { token: 'otro' }), env)).status, 401);
  assert.equal((await worker.fetch(req('/v1/chat/completions', { token: '' }), env)).status, 401);
});
await t('rechaza orígenes no permitidos (403)', async () => {
  const r = await worker.fetch(req('/v1/chat/completions', { origin: 'https://malo.com' }), env);
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
await t('solo rutas conocidas (404) y solo POST (405)', async () => {
  assert.equal((await worker.fetch(req('/v1/models'), env)).status, 404);
  assert.equal((await worker.fetch(req('/v1/chat/completions', { method: 'GET' }), env)).status, 405);
});
await t('preflight CORS responde 204', async () => {
  const r = await worker.fetch(new Request('https://proxy.test/v1/chat/completions', { method: 'OPTIONS', headers: { Origin: 'https://yo.github.io' } }), env);
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-headers'), /Authorization/);
});
await t('sin ALLOWED_ORIGINS configurado no abre el proxy a todos', async () => {
  assert.equal((await worker.fetch(req('/v1/chat/completions'), { ...env, ALLOWED_ORIGINS: '' })).status, 500);
});
await t('límite de tamaño (413)', async () => {
  assert.equal((await worker.fetch(req('/v1/chat/completions', { body: 'x'.repeat(1_100_000) }), env)).status, 413);
});
console.log(`\n${n} pruebas OK`);
