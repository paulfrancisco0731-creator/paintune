import { AudioEngine } from './audio.js';
import { WatercolorEngine, COLOR_PALETTE } from './watercolor.js';

// DOM Elements
const introScreen = document.getElementById('intro-screen');
const startBtn = document.getElementById('start-btn');
const appHeader = document.getElementById('app-header');
const appFooter = document.getElementById('app-footer');
const clearBtn = document.getElementById('clear-btn');
const saveBtn = document.getElementById('save-btn');
const toggleStatsBtn = document.getElementById('toggle-stats-btn');
const statusPanel = document.getElementById('status-panel');
const canvas = document.getElementById('watercolor-canvas');

// Stats Display Elements
const statusText = document.getElementById('status-text');
const metricNote = document.getElementById('metric-note');
const metricPitch = document.getElementById('metric-pitch');
const metricVolume = document.getElementById('metric-volume');
const metricClarity = document.getElementById('metric-clarity');

let audioEngine = null;
let watercolorEngine = null;
let isRunning = false;

// Initialization
function init() {
  watercolorEngine = new WatercolorEngine(canvas);
  
  // Event Listeners
  startBtn.addEventListener('click', startApp);
  clearBtn.addEventListener('click', () => watercolorEngine.clear());
  saveBtn.addEventListener('click', exportPNG);
  
  toggleStatsBtn.addEventListener('click', () => {
    statusPanel.classList.toggle('collapsed');
  });

  window.addEventListener('resize', () => {
    if (watercolorEngine) {
      watercolorEngine.resize();
    }
  });

  // Start visual loop immediately (to render clear canvas or moving drift)
  requestAnimationFrame(loop);
}

async function startApp() {
  try {
    startBtn.disabled = true;
    startBtn.innerText = "Initializing Mic...";
    
    audioEngine = new AudioEngine();
    await audioEngine.start();
    
    // Smooth transition between intro screen and paint canvas
    introScreen.classList.add('hidden');
    appHeader.classList.remove('hidden');
    appFooter.classList.remove('hidden');
    
    isRunning = true;
    statusText.innerText = "Listening...";
  } catch (err) {
    console.error("Audio Initialization Error:", err);
    alert("Could not start microphone. " + err.message);
    startBtn.disabled = false;
    startBtn.innerText = "Start Painting";
  }
}

// Application Loop
function loop() {
  if (watercolorEngine) {
    if (isRunning && audioEngine) {
      audioEngine.update();

      // Get stats
      const pitch = audioEngine.pitch;
      const clarity = audioEngine.clarity;
      const volume = audioEngine.volume;
      const note = audioEngine.noteName;
      const centroid = audioEngine.getSpectralCentroid();

      // Update UI Stats
      metricNote.innerText = note;
      metricPitch.innerText = pitch > 0 ? `${Math.round(pitch)} Hz` : '0 Hz';
      metricVolume.innerText = `${Math.round(volume * 100)}%`;
      metricClarity.innerText = `${Math.round(clarity * 100)}%`;

      // Determine palette label color to match the note visually in UI
      const pigment = COLOR_PALETTE[note];
      if (pigment && clarity > 0.8) {
        metricNote.style.color = `rgb(${pigment.r}, ${pigment.g}, ${pigment.b})`;
      } else {
        metricNote.style.color = '';
      }

      // Check if note triggered or onset occurred
      // Trigger strokes on onset (plucking/strumming) or sustained loud play
      if (audioEngine.isOnset && volume > 0.02) {
        watercolorEngine.spawnStroke(note, volume, clarity, centroid);
      } else if (volume > 0.08 && Math.random() < 0.25) {
        // Sustained play spawns occasional continuous wet drips/blobs
        watercolorEngine.spawnStroke(note, volume * 0.7, clarity, centroid);
      }
    }

    watercolorEngine.tick();
  }
  requestAnimationFrame(loop);
}

function exportPNG() {
  if (!watercolorEngine) return;
  
  // We want to export the compiled dry canvas + current wet canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = watercolorEngine.width;
  exportCanvas.height = watercolorEngine.height;
  const exportCtx = exportCanvas.getContext('2d');

  // Draw background & dried layer
  exportCtx.drawImage(watercolorEngine.dryCanvas, 0, 0);
  // Draw wet strokes
  for (let blob of watercolorEngine.blobs) {
    blob.draw(exportCtx);
  }

  // Convert to image download
  const link = document.createElement('a');
  link.download = `Watercolor-Performance-${Date.now()}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

// Kick off initialization
document.addEventListener('DOMContentLoaded', init);
// Fallback if DOMContentLoaded already fired
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  init();
}
