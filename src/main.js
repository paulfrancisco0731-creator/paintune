import './index.css';
import { AudioEngine }          from './audio.js';
import { WatercolorEngine, COLOR_PALETTE } from './watercolor.js';

/* ── DOM refs ─────────────────────────────────────────────────────── */
const startBtn      = document.getElementById('start-btn');
const clearBtn      = document.getElementById('clear-btn');
const saveBtn       = document.getElementById('save-btn');
const canvas        = document.getElementById('watercolor-canvas');

const statusText    = document.getElementById('status-text');
const metricPitch   = document.getElementById('metric-pitch');
const metricVolume  = document.getElementById('metric-volume');
const metricClarity = document.getElementById('metric-clarity');
const metricStrokes = document.getElementById('metric-strokes');

const badgeNote     = document.getElementById('badge-note');
const badgePigment  = document.getElementById('badge-pigment');
const badgeSwatch   = document.getElementById('badge-swatch');

const pigmentDots   = document.querySelectorAll('.pigment-dot[data-note]');

/* ── State ────────────────────────────────────────────────────────── */
let audioEngine      = null;
let watercolorEngine = null;
let isRunning        = false;
let lastNote         = null;

/* ── Boot ─────────────────────────────────────────────────────────── */
function init() {
  watercolorEngine = new WatercolorEngine(canvas);

  startBtn.addEventListener('click', startApp);
  clearBtn.addEventListener('click', () => {
    if (watercolorEngine) {
      watercolorEngine.clear();
      metricStrokes.textContent = '0';
    }
  });
  saveBtn.addEventListener('click', exportPNG);

  window.addEventListener('resize', () => {
    if (watercolorEngine) watercolorEngine.resize();
  });

  requestAnimationFrame(loop);
}

/* ── Start listening ──────────────────────────────────────────────── */
async function startApp() {
  try {
    startBtn.disabled     = true;
    startBtn.textContent  = 'Initializing…';

    audioEngine = new AudioEngine();
    await audioEngine.start();

    document.getElementById('start-options').classList.add('hidden');
    document.getElementById('listening-state').classList.remove('hidden');

    isRunning = true;
    if (statusText) statusText.textContent = 'Listening…';
  } catch (err) {
    console.error('Audio Initialization Error:', err);
    alert('Could not access microphone.\n' + err.message);
    startBtn.disabled    = false;
    startBtn.textContent = 'Start Listening';
  }
}

/* ── Highlight the active pigment dot in the palette ─────────────── */
function highlightNote(note) {
  if (note === lastNote) return;
  lastNote = note;

  pigmentDots.forEach(dot => dot.classList.remove('active'));
  if (note) {
    const dot = document.querySelector(`.pigment-dot[data-note="${note}"]`);
    if (dot) dot.classList.add('active');
  }
}

/* ── Update active note badge ─────────────────────────────────────── */
function updateBadge(note, volume) {
  const pigment = note ? COLOR_PALETTE[note] : null;

  if (pigment && volume > 0.02) {
    badgeNote.textContent    = note;
    badgePigment.textContent = pigment.name;
    badgeSwatch.style.background  = `rgb(${pigment.r},${pigment.g},${pigment.b})`;
    badgeSwatch.style.boxShadow   = `0 0 14px rgba(${pigment.r},${pigment.g},${pigment.b},0.5)`;
    highlightNote(note);
  } else {
    badgeNote.textContent    = '—';
    badgePigment.textContent = 'No signal';
    badgeSwatch.style.background = '#3c474d';
    badgeSwatch.style.boxShadow  = 'none';
    highlightNote(null);
  }
}

/* ── Animation loop ───────────────────────────────────────────────── */
function loop() {
  if (watercolorEngine) {
    if (isRunning && audioEngine) {
      audioEngine.update();

      const pitch    = audioEngine.pitch;
      const clarity  = audioEngine.clarity;
      const volume   = audioEngine.volume;
      const note     = audioEngine.noteName;
      const centroid = audioEngine.getSpectralCentroid();

      /* Update metrics display */
      metricPitch.textContent   = pitch > 0 ? `${Math.round(pitch)} Hz` : '— Hz';
      metricVolume.textContent  = `${Math.round(volume * 100)}%`;
      metricClarity.textContent = `${Math.round(clarity * 100)}%`;
      metricStrokes.textContent = watercolorEngine.strokeCount;

      /* Update note badge & pigment palette highlight */
      updateBadge(note, volume);

      /* Trigger paint strokes */
      if (audioEngine.isOnset && volume > 0.015) {
        // Onset = new note attack (guitar pluck / strum)
        watercolorEngine.spawnStroke(note, volume, clarity, centroid);
      } else if (volume > 0.06 && Math.random() < 0.3) {
        // Sustained sound → continuous drip while holding
        watercolorEngine.spawnStroke(note, volume * 0.65, clarity, centroid);
      }
    }

    watercolorEngine.tick();
  }
  requestAnimationFrame(loop);
}

/* ── Export ───────────────────────────────────────────────────────── */
function exportPNG() {
  if (!watercolorEngine) return;

  const exp    = document.createElement('canvas');
  exp.width    = watercolorEngine.width;
  exp.height   = watercolorEngine.height;
  const expCtx = exp.getContext('2d');

  expCtx.drawImage(watercolorEngine.dryCanvas, 0, 0);
  for (const blob of watercolorEngine.blobs) blob.draw(expCtx);
  for (const path of watercolorEngine.paths) path.draw(expCtx);

  const link    = document.createElement('a');
  link.download = `Paintune-${Date.now()}.png`;
  link.href     = exp.toDataURL('image/png');
  link.click();
}

/* ── Kick off (supports both load orders) ─────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
