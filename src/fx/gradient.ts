import Phaser from "phaser";

// Portable vertical gradient — Phaser's Graphics.fillGradientStyle is a
// WebGL-only feature that silently no-ops on the Canvas renderer fallback
// (older devices, some WebViews), so this draws it as a stack of thin solid
// bands instead, which renders identically on every renderer.
export function drawVerticalGradient(
  scene: Phaser.Scene,
  width: number,
  height: number,
  topColor: number,
  bottomColor: number,
  depth = -1,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(depth);
  const bands = 48;
  const bandHeight = height / bands;

  const tr = (topColor >> 16) & 0xff;
  const tg = (topColor >> 8) & 0xff;
  const tb = topColor & 0xff;
  const br = (bottomColor >> 16) & 0xff;
  const bg = (bottomColor >> 8) & 0xff;
  const bb = bottomColor & 0xff;

  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = Math.round(tr + (br - tr) * t);
    const g = Math.round(tg + (bg - tg) * t);
    const b = Math.round(tb + (bb - tb) * t);
    graphics.fillStyle((r << 16) | (g << 8) | b, 1);
    // +1px overlap between bands avoids hairline seams from rounding.
    graphics.fillRect(0, i * bandHeight, width, bandHeight + 1);
  }

  return graphics;
}
