import Phaser from "phaser";
import { Palette } from "../config/palette.ts";
import { playTap } from "../audio/sfx.ts";

export interface ButtonOptions {
  fillColor?: number;
  textColor?: string;
  fontSize?: string;
  strokeColor?: number;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  on(event: "pointerup", handler: () => void): void;
}

/** A consistent rounded-rect CTA button (main menu, modal actions, HUD
 * pills) — a small Container holding a locally-drawn Graphics background
 * plus centered Text, with a pressed-state squash on pointerdown/up. */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  opts: ButtonOptions = {},
): Button {
  const fillColor = opts.fillColor ?? Palette.laneGold;
  const textColor = opts.textColor ?? "#1c1f26";
  const fontSize = opts.fontSize ?? "18px";
  const strokeColor = opts.strokeColor;

  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();
  bg.fillStyle(fillColor, 1);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 4);
  if (strokeColor !== undefined) {
    bg.lineStyle(2, strokeColor, 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 4);
  }

  const label = scene.add
    .text(0, 0, text, {
      fontFamily: Palette.displayFont,
      fontSize,
      color: textColor,
    })
    .setOrigin(0.5);

  container.add([bg, label]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  container.on("pointerdown", () => {
    playTap();
    container.setScale(0.94);
  });
  const restore = () => container.setScale(1);
  container.on("pointerup", restore);
  container.on("pointerout", restore);

  return {
    container,
    label,
    on(event, handler) {
      container.on(event, handler);
    },
  };
}
