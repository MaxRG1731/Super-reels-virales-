// Pruebas del motor de generación y las utilidades puras. Sin dependencias: `node tests/generator.test.mjs`
import assert from 'node:assert/strict';
import { generateProject, regenerateScene, toSRT, toText, toMarkdown, nextEpisodeOptions, totalSecs, chunkSubtitle, paceOf, projectFromAI } from '../js/generator.js';
import { CATEGORIES, DURATIONS } from '../js/data.js';
import { looksLikeSecret, validateProviderConfig, extractJSON } from '../js/providers.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('hay 24 categorías', () => assert.equal(CATEGORIES.length, 24));

t('todas las categorías × duraciones generan historias completas, sin marcadores sin resolver', () => {
  for (const c of CATEGORIES) for (const d of DURATIONS) {
    const p = generateProject({ categories: [c.id], duration: d, platform: 'tiktok', style: 'cinematico' });
    assert.ok(p.title && p.hook && p.cta && p.description && p.hashtags.length >= 4, `${c.id}/${d}`);
    assert.ok(Math.abs(totalSecs(p) - d) <= d * 0.15, `duración ${c.id}/${d}: ${totalSecs(p)}`);
    for (const s of p.scenes) {
      assert.ok(s.narration.length > 5 && s.visual && s.camera && s.music && s.sfx && s.subtitle && s.imagePrompt, `${c.id}/${d} escena incompleta`);
      assert.ok(!/[{}]|undefined|NaN/.test(s.narration + s.visual + s.dialogue), `${c.id}/${d} marcador sin resolver: ${s.narration}`);
    }
  }
});

t('combinar tres categorías funciona', () => {
  const p = generateProject({ categories: ['terror', 'humor_negro', 'romance'], duration: 60, platform: 'reels', style: 'oscuro' });
  assert.equal(p.categories.length, 3);
  assert.ok(p.scenes.length >= 6);
});

t('la idea propia se usa como gancho', () => {
  const p = generateProject({ categories: ['comedia'], duration: 30, platform: 'tiktok', style: 'comico', idea: 'Un gato que gestiona la caja del súper' });
  assert.match(p.hook, /gato que gestiona la caja/i);
});

t('no repite historias (200 generaciones, misma configuración)', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = generateProject({ categories: ['misterio'], duration: 30, platform: 'tiktok', style: 'cinematico', hasSignature: (s) => seen.has(s) });
    assert.ok(!seen.has(p.sig), 'firma repetida');
    seen.add(p.sig);
  }
});

t('series: el episodio 2 conserva protagonista y recapitula', () => {
  const e1 = generateProject({ categories: ['suspenso'], duration: 30, platform: 'tiktok', style: 'cinematico', series: { ep: 1, total: 3 } });
  const o = nextEpisodeOptions(e1);
  const e2 = generateProject(o);
  assert.equal(e2.series.ep, 2);
  assert.equal(e2.bible.hero.name, e1.bible.hero.name);
  assert.match(e2.scenes[1].narration, /Antes:/);
  assert.equal(nextEpisodeOptions(generateProject({ ...o, series: { id: e1.series.id, ep: 3, total: 3 } })), null);
});

t('regenerar una escena conserva id y cambia el texto', () => {
  const p = generateProject({ categories: ['terror'], duration: 60, platform: 'tiktok', style: 'cinematico' });
  const s = p.scenes[3]; const id = s.id; const before = s.narration;
  let changed = false;
  for (let i = 0; i < 10 && !changed; i++) { regenerateScene(p, id); changed = p.scenes[3].narration !== before; }
  assert.equal(p.scenes[3].id, id);
  assert.ok(changed);
});

t('subtítulos: SRT bien formado y tiempos crecientes', () => {
  const p = generateProject({ categories: ['drama'], duration: 45, platform: 'shorts', style: 'emocional' });
  const srt = toSRT(p);
  const times = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})/g)].map((m) => [m.slice(1, 5), m.slice(5, 9)].map((a) => (+a[0] * 3600 + +a[1] * 60 + +a[2]) * 1000 + +a[3]));
  assert.ok(times.length > 8);
  times.forEach(([a, b], i) => { assert.ok(b > a); if (i) assert.ok(a >= times[i - 1][0]); });
});

t('chunkSubtitle parte en líneas cortas', () => {
  const lines = chunkSubtitle('Esta es una frase bastante larga para dividir en varias líneas de subtítulo.').split('\n');
  assert.ok(lines.length >= 3 && lines.every((l) => l.split(' ').length <= 5));
});

t('exportaciones de texto incluyen todas las secciones', () => {
  const p = generateProject({ categories: ['accion'], duration: 30, platform: 'reels', style: 'epico' });
  for (const out of [toText(p), toMarkdown(p)]) for (const k of [p.title.slice(0, 10), 'Cámara', 'Música', 'Efectos']) assert.ok(out.toLowerCase().includes(k.toLowerCase()), k);
  assert.ok(paceOf(p.scenes[0]) > 0);
});

t('claves secretas se detectan y se rechazan', () => {
  for (const k of ['sk-abc123def456ghi789', 'gsk_abcdefghijklmnop', 'AIzaSyA1234567890', 'hf_abcdefghijk', 'github_pat_11ABC']) assert.ok(looksLikeSecret(k), k);
  assert.ok(!looksLikeSecret('mi-token-propio'));
  assert.match(validateProviderConfig({ baseUrl: 'https://x.workers.dev/v1', token: 'sk-abcdefghijkl' }), /clave secreta/);
  assert.match(validateProviderConfig({ baseUrl: 'https://api.openai.com/v1', token: 'mi-token' }), /proxy/);
  assert.match(validateProviderConfig({ baseUrl: 'http://example.com' }), /https/);
  assert.equal(validateProviderConfig({ baseUrl: 'https://x.workers.dev/v1', token: 'mi-token' }), null);
});

t('respuestas de modelos: extrae JSON y construye un proyecto', () => {
  const raw = extractJSON('```json\n{"title":"T","hook":"H","scenes":[{"narration":"Uno."},{"narration":"Dos."},{"narration":"Tres."}],"cta":"C","hashtags":["a","b"]}\n```');
  const p = projectFromAI(raw, { categories: ['terror'], duration: 15, platform: 'tiktok', style: 'cinematico' });
  assert.equal(p.engine, 'ia');
  assert.equal(p.scenes.length, 3);
  assert.deepEqual(p.hashtags, ['#a', '#b']);
  assert.throws(() => projectFromAI({ scenes: [{ narration: 'x' }] }, { categories: ['terror'], duration: 15 }), /escenas/);
  assert.throws(() => extractJSON('sin json'), /JSON/);
});

console.log(`\n${n} pruebas OK`);
