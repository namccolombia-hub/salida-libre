import Phaser from "phaser";
import { Palette } from "../config/palette.ts";

const FADE_MS = 200;

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/** Fades the current scene out, then starts the next one — used for the
 * transitions a player actually walks through while playing (menu, level,
 * chase, game over). Dev-tool screens intentionally skip this and cut
 * instantly instead, since fast browsing matters more there. */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  const [r, g, b] = hexToRgb(Palette.bgAsphalt);
  scene.cameras.main.fadeOut(FADE_MS, r, g, b);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

/** Call at the top of a scene's create() to fade in from black/asphalt. */
export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_MS);
}
