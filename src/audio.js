import { PitchDetector } from 'pitchy';

export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.source = null;
    this.bufferLength = 2048;
    this.timeData = new Float32Array(this.bufferLength);
    this.frequencyData = new Uint8Array(this.bufferLength / 2);
    this.detector = null;
    
    // Performance state
    this.pitch = 0;
    this.clarity = 0;
    this.volume = 0;
    this.noteName = '—';
    
    // Onset detection
    this.lastVolume = 0;
    this.onsetThreshold = 0.05; // minimum volume increase to trigger onset
    this.isOnset = false;
    
    // Musical scale helper (A4 = 440Hz)
    this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  }

  async start() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone API is not supported or is blocked. Note: Browsers require HTTPS or localhost to access the microphone.");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.bufferLength;
    this.source.connect(this.analyser);
    
    this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize);
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  update() {
    if (!this.analyser) return;

    // Get time domain data for pitch detection
    this.analyser.getFloatTimeDomainData(this.timeData);
    // Get frequency domain data for spectral analysis (volume & centroid)
    this.analyser.getByteFrequencyData(this.frequencyData);

    // 1. Calculate Volume (RMS)
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      sum += this.timeData[i] * this.timeData[i];
    }
    const rms = Math.sqrt(sum / this.timeData.length);
    // Exponentially smooth volume
    this.volume = this.volume * 0.7 + rms * 0.3;

    // 2. Onset Detection (simple amplitude-based onset)
    const volumeChange = rms - this.lastVolume;
    this.isOnset = volumeChange > this.onsetThreshold && rms > 0.015;
    this.lastVolume = rms;

    // 3. Pitch Detection using Pitchy
    const [pitch, clarity] = this.detector.findPitch(this.timeData, this.audioContext.sampleRate);
    this.pitch = pitch;
    this.clarity = clarity;

    if (clarity > 0.8 && pitch > 50 && pitch < 2000) {
      this.noteName = this.getNoteFromFrequency(pitch);
    } else {
      // Don't clear immediately to avoid flashing, or handle in visualization
    }
  }

  getNoteFromFrequency(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const midiNote = Math.round(noteNum) + 69;
    const noteIndex = (midiNote % 12 + 12) % 12;
    return this.noteStrings[noteIndex];
  }

  /**
   * Calculates spectral centroid (representing brightness or texture)
   * High values = bright/harsh tone, Low values = dark/muddy tone
   */
  getSpectralCentroid() {
    if (!this.analyser) return 0.5;
    let num = 0;
    let denom = 0;
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / this.analyser.fftSize;

    for (let i = 0; i < this.frequencyData.length; i++) {
      const frequency = i * binSize;
      const amplitude = this.frequencyData[i];
      num += frequency * amplitude;
      denom += amplitude;
    }

    if (denom === 0) return 0.5;
    const centroid = num / denom;
    // Normalize to standard audio spectrum (0 to ~5000Hz mapped to 0-1)
    return Math.min(1.0, centroid / 5000);
  }
}
