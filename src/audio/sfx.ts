// Synthesized via Web Audio API (no sound files) — quick oscillator/noise
// shapes standing in for real recorded SFX. Shared AudioContext with
// src/audio/music.ts.
import { loadSfxEnabled } from "../state/Persistence.ts";

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  return ctx;
}

function readyContext(): AudioContext | null {
  if (!loadSfxEnabled()) return null;
  const audioCtx = getAudioContext();
  if (!audioCtx) return null;
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

// A single short tone — the building block for the arpeggio/sequence SFX below.
function playNote(audioCtx: AudioContext, freq: number, startOffset: number, duration: number, type: OscillatorType, peakGain: number): void {
  const start = audioCtx.currentTime + startOffset;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playCrash(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.2);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) ** 2;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(1800, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.15);

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);

  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(0.5, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(oscGain);
  oscGain.connect(audioCtx.destination);

  noise.start(now);
  noise.stop(now + 0.2);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Short upward two-note chirp for a positive pickup (repair part collected).
export function playPickup(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.setValueAtTime(880, now + 0.09);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}

// Very light tick for tapping a car or a UI button — deliberately unobtrusive
// since it can fire a lot.
export function playTap(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;
  playNote(audioCtx, 520, 0, 0.05, "square", 0.12);
}

// Short rising whoosh for a car successfully leaving the grid.
export function playExit(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(720, now + 0.16);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

// Short ascending arpeggio for the level-complete modal.
export function playLevelComplete(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => playNote(audioCtx, freq, i * 0.09, 0.22, "triangle", 0.3));
}

// A single short descending tone — the moment a life is actually lost
// (distinct from the crash noise that may or may not lead to this).
export function playLoseLife(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.34);
}

// Longer, more somber descending sequence for the game-over screen.
export function playGameOver(): void {
  const audioCtx = readyContext();
  if (!audioCtx) return;
  const notes = [392, 349.23, 293.66, 220]; // G4 F4 D4 A3
  notes.forEach((freq, i) => playNote(audioCtx, freq, i * 0.16, 0.4, "triangle", 0.28));
}
