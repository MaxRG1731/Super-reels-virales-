// Vista previa vertical persistente (un solo canvas y un solo reproductor por proyecto).

import { ReelPlayer } from '../player.js';
import { getSettings } from '../store.js';
import { icon, fmtTime, $ } from './util.js';

let pv = null; // { el, player, pid }

export function playerSettings(p) {
  const s = getSettings();
  return { rate: p.voice?.rate || 1, pitch: p.voice?.pitch || 1, voiceURI: s.voiceURI, includeCta: s.includeCta };
}

function build() {
  const el = document.createElement('div');
  el.className = 'pv';
  el.innerHTML = `
    <div class="pv-frame"><canvas aria-label="Vista previa vertical del Reel"></canvas><button class="pv-big" aria-label="Reproducir">${icon('play', 34, true)}</button></div>
    <div class="pv-ctl">
      <button class="pv-play icon-btn" aria-label="Reproducir o pausar">${icon('play', 22, true)}</button>
      <input class="pv-seek" type="range" min="0" max="1000" value="0" aria-label="Posición">
      <span class="pv-time">0:00</span>
      <button class="pv-voice icon-btn on" aria-label="Narración del dispositivo" aria-pressed="true">${icon('mic', 20)}</button>
      <button class="pv-close icon-btn" aria-label="Cerrar vista previa">${icon('x', 20)}</button>
    </div>`;
  return el;
}

function wire(entry) {
  const { el, player } = entry;
  const play = $('.pv-play', el);
  const big = $('.pv-big', el);
  const seek = $('.pv-seek', el);
  const time = $('.pv-time', el);
  const voice = $('.pv-voice', el);
  let dragging = false;
  const setPlayIcon = () => {
    const html = icon(player.playing ? 'pause' : 'play', 22, true);
    play.innerHTML = html;
    big.style.display = player.playing ? 'none' : '';
  };
  const upd = () => {
    if (!dragging) seek.value = player.total ? Math.round((player.t / player.total) * 1000) : 0;
    time.textContent = `${fmtTime(player.t)} / ${fmtTime(player.total)}`;
  };
  player.onTick = upd;
  player.onEnd = setPlayIcon;
  const toggle = () => {
    player.toggle();
    setPlayIcon();
  };
  play.addEventListener('click', toggle);
  big.addEventListener('click', toggle);
  $('canvas', el).addEventListener('click', toggle);
  seek.addEventListener('input', () => {
    dragging = true;
    player.seek((Number(seek.value) / 1000) * player.total);
  });
  seek.addEventListener('change', () => (dragging = false));
  voice.addEventListener('click', () => {
    player.speak = !player.speak;
    voice.classList.toggle('on', player.speak);
    voice.setAttribute('aria-pressed', String(player.speak));
    if (!player.speak) player.stopVoices();
  });
  $('.pv-close', el).addEventListener('click', () => closeFull());
  entry.refreshUi = () => {
    upd();
    setPlayIcon();
  };
}

// Devuelve el elemento persistente para colocarlo en la vista del estudio.
export function getPreview(project) {
  if (!pv || pv.pid !== project.id) {
    disposePreview();
    const el = build();
    const player = new ReelPlayer($('canvas', el), project, { settings: playerSettings(project) });
    pv = { el, player, pid: project.id };
    wire(pv);
    player.load().then(() => pv && pv.refreshUi());
  } else {
    pv.player.setProject(project);
    pv.player.settings = playerSettings(project);
    pv.player.draw(Math.min(pv.player.t, pv.player.total));
  }
  pv.refreshUi();
  return pv.el;
}

export const currentPlayer = () => (pv ? pv.player : null);

export async function reloadMedia() {
  if (!pv) return;
  const was = pv.player.playing;
  pv.player.pause();
  await pv.player.load();
  pv.refreshUi();
  if (was) pv.player.play();
}

export function seekToScene(i) {
  if (!pv) return;
  pv.player.seekScene(i);
}

export function openFull() {
  if (!pv) return;
  pv.el.classList.add('full');
  document.body.classList.add('noscroll');
}

export function closeFull() {
  if (!pv) return;
  pv.el.classList.remove('full');
  document.body.classList.remove('noscroll');
  pv.player.pause();
  pv.refreshUi();
}

export function disposePreview() {
  if (pv) {
    pv.player.destroy();
    pv.el.remove();
    document.body.classList.remove('noscroll');
    pv = null;
  }
}
