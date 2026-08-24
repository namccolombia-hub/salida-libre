import Phaser from "phaser";
import { GameConfig, Palette } from "../config/palette.ts";
import { loadSeenTutorials, saveSeenTutorial } from "../state/Persistence.ts";
import { TUTORIAL_CONTENT } from "./tutorialContent.ts";
import { createButton } from "./Button.ts";

/**
 * Shows any not-yet-seen tutorials from `ids`, one at a time, each blocking
 * input until dismissed. Calls `onAllDone` once the queue is empty — either
 * immediately (nothing new to show, the common case) or after the last
 * panel is acknowledged. Scene-agnostic so both ParkingScene and ChaseScene
 * can reuse the exact same queue/overlay logic.
 */
export function showTutorialQueue(scene: Phaser.Scene, ids: string[], onAllDone: () => void): void {
  const seen = loadSeenTutorials();
  const queue = ids.filter((id) => !seen.has(id) && TUTORIAL_CONTENT[id]);
  if (queue.length === 0) {
    onAllDone();
    return;
  }
  showNext(scene, queue, 0, onAllDone);
}

function showNext(scene: Phaser.Scene, queue: string[], index: number, onAllDone: () => void): void {
  if (index >= queue.length) {
    onAllDone();
    return;
  }
  const entry = TUTORIAL_CONTENT[queue[index]];
  const centerX = GameConfig.width / 2;
  const centerY = GameConfig.height / 2;

  const overlay = scene.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x000000, 0.7).setOrigin(0).setDepth(60);
  const panel = scene.add.rectangle(centerX, centerY, 340, 420, Palette.bgAsphaltLight, 1).setDepth(61);
  panel.setStrokeStyle(2, Palette.wallSolid, 1);

  const icon = scene.add.text(centerX, centerY - 175, entry.icon, { fontSize: "40px" }).setOrigin(0.5).setDepth(62);

  const title = scene.add
    .text(centerX, centerY - 120, entry.title, {
      fontFamily: Palette.displayFont,
      fontSize: "20px",
      color: Palette.textGold,
      align: "center",
      wordWrap: { width: 300 },
    })
    .setOrigin(0.5, 0)
    .setDepth(62);

  const identifyLabel = scene.add
    .text(centerX - 150, centerY - 70, "Cómo identificarlo", {
      fontFamily: Palette.displayFont,
      fontSize: "13px",
      color: "#4fd1ff",
    })
    .setOrigin(0, 0)
    .setDepth(62);
  const identifyText = scene.add
    .text(centerX - 150, centerY - 48, entry.identify, {
      fontFamily: Palette.bodyFont,
      fontSize: "13px",
      color: Palette.textLight,
      wordWrap: { width: 300 },
      lineSpacing: 3,
    })
    .setOrigin(0, 0)
    .setDepth(62);

  const resolveLabelY = centerY - 48 + identifyText.height + 16;
  const resolveLabel = scene.add
    .text(centerX - 150, resolveLabelY, "Cómo resolverlo", {
      fontFamily: Palette.displayFont,
      fontSize: "13px",
      color: "#51cf66",
    })
    .setOrigin(0, 0)
    .setDepth(62);
  const resolveText = scene.add
    .text(centerX - 150, resolveLabelY + 22, entry.resolve, {
      fontFamily: Palette.bodyFont,
      fontSize: "13px",
      color: Palette.textLight,
      wordWrap: { width: 300 },
      lineSpacing: 3,
    })
    .setOrigin(0, 0)
    .setDepth(62);

  const button = createButton(scene, centerX, centerY + 175, 200, 48, "¡ENTENDIDO!", { fontSize: "15px" });
  button.container.setDepth(62);

  const layer = [overlay, panel, icon, title, identifyLabel, identifyText, resolveLabel, resolveText, button.container];

  button.on("pointerup", () => {
    saveSeenTutorial(queue[index]);
    layer.forEach((o) => o.destroy());
    showNext(scene, queue, index + 1, onAllDone);
  });
}
