// Real licensed music tracks (CC-BY 3.0, OpenGameArt.org — see CREDITS in
// the repo) played through Phaser's own Sound Manager, replacing the
// earlier synthesized step-sequencer. Each mood has a pool of tracks;
// play() picks one at random and crossfades into it, so repeat visits to
// the same scene don't always hear the exact same loop.
import Phaser from "phaser";
import { loadMusicEnabled } from "../state/Persistence.ts";

export type Mood = "menu" | "parking" | "chase";

const TRACK_POOLS: Record<Mood, string[]> = {
  menu: ["music-menu-tropics"],
  parking: ["music-grid-puzzle-1a", "music-grid-puzzle-1b", "music-grid-su-turno", "music-grid-chill-jungle"],
  chase: ["music-chase-bouncing-baal", "music-chase-at-last", "music-chase-space-chase"],
};

const TARGET_VOLUME = 0.35;
const FADE_MS = 500;

let currentMood: Mood | null = null;
let currentSound: Phaser.Sound.WebAudioSound | null = null;

// Scene-independent fade (plain timer, not a scene tween) so a fade never
// gets cut short by the scene that started it shutting down mid-fade.
function fade(sound: Phaser.Sound.WebAudioSound, from: number, to: number, ms: number, onDone?: () => void): void {
  const steps = 20;
  const stepMs = ms / steps;
  let i = 0;
  const id = setInterval(() => {
    i++;
    sound.setVolume(Math.max(0, from + (to - from) * (i / steps)));
    if (i >= steps) {
      clearInterval(id);
      onDone?.();
    }
  }, stepMs);
}

// Starts (or crossfades into, if already playing) a random track from this
// mood's pool. Safe to call every time a scene starts — a no-op if that
// mood is already playing (keeps whatever track is currently going, rather
// than restarting/reshuffling on every scene revisit).
export function play(scene: Phaser.Scene, mood: Mood): void {
  if (mood === currentMood) return;
  currentMood = mood;

  const pool = TRACK_POOLS[mood];
  const key = pool[Math.floor(Math.random() * pool.length)];
  const enabled = loadMusicEnabled();

  const oldSound = currentSound;
  const newSound = scene.sound.add(key, { loop: true, volume: 0 }) as Phaser.Sound.WebAudioSound;
  newSound.play();
  fade(newSound, 0, enabled ? TARGET_VOLUME : 0, FADE_MS);
  currentSound = newSound;

  if (oldSound) {
    fade(oldSound, oldSound.volume, 0, FADE_MS, () => oldSound.destroy());
  }
}

// Called by SettingsScene right after flipping the "Música" toggle, so the
// change is heard immediately instead of waiting for the next scene switch.
export function setEnabled(enabled: boolean): void {
  if (!currentSound) return;
  fade(currentSound, currentSound.volume, enabled ? TARGET_VOLUME : 0, FADE_MS);
}
