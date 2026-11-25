# REEL FACTORY

Tu estudio personal para crear Reels y Shorts desde el iPhone. Convierte una idea en una historia lista para producir: guion, escenas, narración, imágenes, subtítulos, música y montaje final en video vertical 9:16.

**100 % gratis, sin registro, sin suscripción y sin servidor.** Es una PWA (se instala como app) que guarda todo en tu dispositivo.

---

## Qué hace

| Área | Qué incluye |
|---|---|
| **Crear** | 24 categorías (terror, suspenso, misterio, crimen, comedia, humor negro, romance, drama, acción, ciencia ficción, fantasía, mitología, deportes, motivación…), combinables hasta 3. Idea propia, modo **Sorpréndeme**, historias por **episodios** (el siguiente episodio conserva al protagonista y recapitula), categorías favoritas y memoria de historias ya usadas para **no repetir**. |
| **Generador** | Título viral, gancho de 3 s, guion, narración, diálogos, escenas con descripción visual, cámara, música y efectos sugeridos, subtítulos, llamada a la acción, descripción para publicar y hashtags. Duraciones 15/30/45/60/90 s; TikTok, Reels y Shorts; 10 estilos visuales. |
| **Estudio** | Línea de tiempo visual, vista previa vertical y 8 pestañas: Guion, Escenas, Narración, Imágenes, Videos, Subtítulos, Música y Montaje. Cada escena se edita, regenera, mueve, añade o elimina. |
| **Montaje** | Exporta un **MP4 vertical real** (540×960, H.264) desde el navegador, con imágenes o clips, subtítulos con palabra resaltada, voz y música. |
| **Biblioteca** | Guardar, editar, duplicar, favoritos, búsqueda, orden por categoría, historial, papelera con recuperación, exportar guion (`.txt`, `.md`, `.srt`, `.json`) y copia de seguridad completa. |
| **Ajustes** | Conectar proveedores de IA (texto, voz, imágenes, video) con prueba de conexión real, instalar la app, proteger datos. |

---

## Qué es real y qué no (leer esto)

Esta app **no simula nada**. Estado honesto de cada pieza:

| Pieza | Estado |
|---|---|
| Guion y escenas **sin IA** | Funciona sin conexión con un **motor local de plantillas**. Produce historias coherentes y variadas, pero **no es un modelo de IA**: para tramas realmente originales, conecta un modelo de texto. |
| Guion con **modelo de texto** | Listo para cualquier API compatible con OpenAI (`/chat/completions`) mediante tu proxy. Probado contra un servidor simulado, **no contra un proveedor real**. |
| **Voz del dispositivo** | Gratis y sin conexión; suena en la vista previa. **El navegador no permite grabarla dentro del video.** Para un MP4 con voz: graba tu voz en la app, sube tus audios o conecta un servicio de voz (`/audio/speech`). |
| **Imágenes** | Sube las tuyas o conecta un generador (`/images/generations`). También hay un adaptador a Pollinations (sin clave): **envía tus descripciones a un servicio público externo** y su disponibilidad no está garantizada, así que pruébalo con el botón antes de confiar en él. |
| **Video generado por IA** | **No hay un servicio gratuito integrado de fábrica** (cambian sus condiciones con frecuencia y no quise simular uno). Puedes subir tus propios clips o conectar un servicio con el contrato `POST /generate` descrito abajo. |
| **Música** | La app no la genera: sube una pista libre de derechos (p. ej. biblioteca de audio de YouTube Studio, Pixabay Music) y revisa su licencia. |
| **Exportación a MP4** | Se graba **en tiempo real** (un video de 30 s tarda 30 s) y la pantalla debe seguir encendida. |

Un proveedor solo aparece como «Conexión verificada» si respondió a una prueba real.

---

## Probar en local

```bash
npm start            # o: python3 -m http.server 8080
# abre http://localhost:8080
npm test             # pruebas del generador y del proxy (sin dependencias)
```

No hay paso de compilación: son archivos estáticos (HTML + CSS + módulos ES).

## Publicar gratis en GitHub Pages

1. Sube este repositorio a GitHub (rama `main`).
2. En **Settings → Pages**, elige **Source: GitHub Actions**.
3. Cada `push` a `main` ejecuta `.github/workflows/pages.yml`: corre las pruebas y publica en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Todas las rutas son relativas, así que funciona en subdirectorios. Alternativas igual de gratuitas: Cloudflare Pages o Netlify (publica la carpeta raíz, sin comando de build).

## Instalar en el iPhone

1. Abre la URL publicada en **Safari**.
2. Toca **Compartir → Añadir a pantalla de inicio**.
3. Ábrela desde el icono: pantalla completa y sin conexión.

Después, en **Ajustes → Proteger datos** pide al navegador que no borre tu información. Safari puede limpiar datos de sitios que no usas durante semanas: la app instalada lo evita en gran parte, pero haz **copias de seguridad** (Biblioteca → Exportar todo) de lo importante.

---

## Conectar IA de forma segura

**Regla:** una clave de API nunca debe vivir en el navegador. Cualquiera que abra las herramientas de desarrollador podría leerla. Por eso REEL FACTORY **no tiene campo para claves de proveedor** y rechaza las que reconoce (`sk-…`, `gsk_…`, `AIza…`, `hf_…`, etc.).

En su lugar usas un **proxy propio** (incluido en `proxy/`) que guarda la clave como secreto y reenvía las peticiones. La app solo conoce la URL del proxy y un token que tú inventas.

```
Tu iPhone (app)  ──token tuyo──▶  Tu proxy (Cloudflare Worker, gratis)  ──clave real──▶  Proveedor de IA
```

### Pasos (≈10 minutos, plan gratuito de Cloudflare)

1. Crea una cuenta gratuita en Cloudflare e instala Wrangler: `npm i -g wrangler` y `wrangler login`.
2. Elige un proveedor compatible con OpenAI y crea tu clave allí. Ejemplos con capa gratuita o económica **al momento de escribir esto** (confirma límites vigentes en cada sitio):
   - **Groq** — `https://api.groq.com/openai/v1`
   - **Google AI Studio (Gemini)** — `https://generativelanguage.googleapis.com/v1beta/openai`
   - **OpenRouter** — `https://openrouter.ai/api/v1` (modelos con sufijo `:free`)
3. Edita `proxy/wrangler.toml`: pon tu `UPSTREAM_BASE_URL` y tu `ALLOWED_ORIGINS` (`https://TU-USUARIO.github.io`).
4. Desde `proxy/`:
   ```bash
   wrangler secret put UPSTREAM_API_KEY   # pega la clave del proveedor
   wrangler secret put ACCESS_TOKEN       # inventa un token largo y aleatorio
   wrangler deploy
   ```
5. En la app: **Ajustes → Modelo de texto → «API compatible con OpenAI»**. Pega la URL del Worker terminada en `/v1`, el nombre del modelo y tu `ACCESS_TOKEN`. Pulsa **Probar conexión**.

Repite con otro Worker (o el mismo, si el proveedor lo permite) para voz e imágenes. El proxy solo acepta tu origen, exige tu token, limita el tamaño y solo reenvía `/chat/completions`, `/audio/speech`, `/images/generations` y `/generate`. Tiene pruebas en `tests/proxy.test.mjs`.

### Contrato para video (opcional)

`POST {url}/generate` con `{ "prompt": "...", "duration": 6, "aspect": "9:16" }` debe responder un `video/*` o `{ "url": "https://…" }`. Con `{ "dry_run": true }` debe responder 200 sin generar nada (lo usa «Probar conexión»).

---

## Estructura

```
index.html · manifest.webmanifest · sw.js     PWA
css/styles.css                                 tema cinematográfico
js/data.js                                     categorías, duraciones, plataformas, estilos
js/generator.js                                motor local, derivados (SRT/TXT/MD), parseo de IA
js/providers.js                                adaptadores de IA + validación de claves + pruebas
js/store.js · js/media.js                      localStorage (datos) e IndexedDB (imágenes/audio/clips)
js/player.js                                   reproductor 9:16 y exportación a MP4 (Canvas + MediaRecorder)
js/ui/*                                        vistas: crear, estudio (+medios), biblioteca, ajustes
proxy/                                         Worker de Cloudflare para ocultar claves
tests/                                         pruebas sin dependencias
```

Para añadir otro proveedor: agrega un adaptador en `SLOTS` y su rama en `callText/callImage/callSpeech/callVideo/testProvider` dentro de `js/providers.js`.

## Privacidad

Sin cuentas ni analítica. Proyectos y medios se quedan en tu dispositivo. Solo salen datos cuando **tú** conectas un proveedor (a tu proxy) o usas Pollinations. Los tokens no se incluyen en las copias de seguridad.

## Limitaciones conocidas

- Cada proyecto exportado se graba en tiempo real y requiere mantener la app en primer plano.
- La copia de seguridad JSON no incluye imágenes, voces ni clips (viven en IndexedDB).
- La calidad de la voz del dispositivo depende de las voces instaladas (iPhone: Ajustes → Accesibilidad → Contenido hablado → Voces).
- El motor local tiene un repertorio finito; evita repetir mientras queden combinaciones, y la variedad real llega al conectar un modelo de texto.
