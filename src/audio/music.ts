// A tiny synthesized step-sequencer, same Web Audio approach as sfx.ts —
// three looping "mood" patterns (menu/parking/chase) instead of audio files.
// Uses lookahead scheduling (poll every LOOKAHEAD_MS, schedule any step
// whose time falls within SCHEDULE_AHEAD_S) so tempo doesn't drift the way
// a raw setInterval-per-note approach would.
import { getAudioContext } from "./sfx.ts";
import { loadMusicEnabled } from "../state/Persistence.ts";

export type Mood = "menu" | "parking" | "chase";

interface Pattern {
  bpm: number;
  waveform: OscillatorType;
  bassWaveform: OscillatorType;
  useKick: boolean;
  // One entry per 8th-note step; null is a rest. Patterns can be different
  // lengths — each track just loops on its own length.
  lead: (number | null)[];
  bass: (number | null)[];
}

const PATTERNS: Record<Mood, Pattern> = {
  menu: {
    bpm: 84,
    waveform: "sine",
    bassWaveform: "sine",
    useKick: false,
    lead: [523.25, null, 659.25, null, 587.33, null, 493.88, null, 440, null, 523.25, null, 493.88, null, 440, null],
    bass: [130.81, null, null, null, 146.83, null, null, null, 123.47, null, null, null, 110, null, null, null],
  },
  parking: {
    bpm: 112,
    waveform: "triangle",
    bassWaveform: "square",
    useKick: false,
    lead: [392, null, 440, 392, null, 349.23, null, 392, 440, null, 493.88, 440, null, 392, null, 349.23],
    bass: [98, null, 98, null, 87.31, null, 87.31, null, 98, null, 98, null, 110, null, 110, null],
  },
  chase: {
    bpm: 152,
    waveform: "sawtooth",
    bassWaveform: "square",
    useKick: true,
    lead: [220, 220, null, 220, 261.63, null, 220, 196, 220, 220, null, 220, 293.66, null, 261.63, 220],
    bass: [55, null, 55, null, 55, null, 55, null, 58.27, null, 58.27, null, 58.27, null, 58.27, null],
  },
};

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const TARGET_GAIN = 0.32;
const FADE_S = 0.2;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentMood: Mood | null = null;
let schedulerId: number | null = null;
let nextStepTime = 0;
let stepIndex = 0;

function ensureMasterGain(ctx: AudioContext): GainNode {
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

function playSynthNote(ctx: AudioContext, freq: number, time: number, dur: number, type: OscillatorType, peak: number): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(gain);
  gain.connect(ensureMasterGain(ctx));
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function playKick(ctx: AudioContext, time: number): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.22, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

  osc.connect(gain);
  gain.connect(ensureMasterGain(ctx));
  osc.start(time);
  osc.stop(time + 0.14);
}

function scheduleStep(ctx: AudioContext, pattern: Pattern, time: number, step: number): void {
  const stepDur = 60 / pattern.bpm / 2;
  const lead = pattern.lead[step % pattern.lead.length];
  const bass = pattern.bass[step % pattern.bass.length];
  if (lead !== null) playSynthNote(ctx, lead, time, stepDur * 0.9, pattern.waveform, 0.05);
  if (bass !== null) playSynthNote(ctx, bass, time, stepDur * 0.9, pattern.bassWaveform, 0.08);
  if (pattern.useKick && step % 4 === 0) playKick(ctx, time);
}

function tick(): void {
  if (!audioCtx || !currentMood) return;
  const pattern = PATTERNS[currentMood];
  const stepDur = 60 / pattern.bpm / 2;
  while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD_S) {
    scheduleStep(audioCtx, pattern, nextStepTime, stepIndex);
    stepIndex++;
    nextStepTime += stepDur;
  }
}

// Starts (or crossfades into, if already playing) the loop for this mood.
// Safe to call every time a scene starts — a no-op if that mood is already
// playing.
export function play(mood: Mood): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  audioCtx = ctx;
  if (mood === currentMood) return;

  const gain = ensureMasterGain(ctx);
  const now = ctx.currentTime;
  const enabled = loadMusicEnabled();

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + FADE_S);

  currentMood = mood;
  stepIndex = 0;
  nextStepTime = now + FADE_S + 0.01;

  gain.gain.setValueAtTime(0, now + FADE_S);
  if (enabled) gain.gain.linearRampToValueAtTime(TARGET_GAIN, now + FADE_S * 2);

  if (ctx.state === "suspended") void ctx.resume();
  if (schedulerId === null) {
    schedulerId = window.setInterval(tick, LOOKAHEAD_MS);
  }
}

// Called by SettingsScene right after flipping the "Música" toggle, so the
// change is heard immediately instead of waiting for the next scene switch.
export function setEnabled(enabled: boolean): void {
  if (!audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(enabled ? TARGET_GAIN : 0, now + FADE_S);
}

// Kicks a still-suspended context (mobile autoplay policy) so any pending
// music becomes audible. Called from main.ts on the first user gesture.
export function resumeIfPending(): void {
  if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
}
