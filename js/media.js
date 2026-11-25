// Almacén de archivos (imágenes, audio, clips) en IndexedDB.
// Clave: "<projectId>:<sceneId>:<kind>" o "<projectId>:music".

const DB = 'reelfactory-media';
const STORE = 'blobs';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const out = fn(store);
        t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const mediaKey = (pid, sid, kind) => `${pid}:${sid}:${kind}`;

export const putMedia = (key, blob) => tx('readwrite', (s) => s.put(blob, key));
export const getMedia = (key) => tx('readonly', (s) => s.get(key));
export const deleteMedia = (key) => tx('readwrite', (s) => s.delete(key));

export function deleteMediaByPrefix(prefix) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        const range = IDBKeyRange.bound(prefix, prefix + '￿');
        store.delete(range);
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      }),
  );
}

export function copyMediaPrefix(from, to) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        const range = IDBKeyRange.bound(from, from + '￿');
        const req = store.openCursor(range);
        req.onsuccess = () => {
          const c = req.result;
          if (!c) return;
          store.put(c.value, to + String(c.key).slice(from.length));
          c.continue();
        };
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      }),
  );
}

// Reduce una imagen a 9:16 (540x960, recorte centrado) y la devuelve como Blob JPEG.
export async function imageToReelBlob(fileOrBlob, w = 540, h = 960) {
  const bmp = await createImageBitmap(fileOrBlob);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const scale = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  bmp.close && bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85));
}
