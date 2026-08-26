import Phaser from "phaser";
import { GameConfig, Palette } from "../config/palette.ts";
import { loadSeenTutorials, saveSeenTutorial } from "../state/Persistence.ts";
import { TUTORIAL_ICONS, type TutorialId } from "./tutorialContent.ts";
import { createButton } from "./Button.ts";
import { strings, format } from "../i18n/index.ts";

/**
 * Shows any not-yet-seen tutorials from `ids`, one at a time, each blocking
 * input until dismissed. Calls `onAllDone` once the queue is empty — either
 * immediately (nothing new to show, the common case) or after the last
 * panel is acknowledged. Scene-agnostic so both ParkingScene and ChaseScene
 * can reuse the exact same queue/overlay logic.
 */
export function showTutorialQueue(scene: Phaser.Scene, ids: string[], onAllDone: () => void): void {
  const seen = loadSeenTutorials();
  const queue = ids.filter((id) => !seen.has(id) && id in TUTORIAL_ICONS) as TutorialId[];
  if (queue.length === 0) {
    onAllDone();
    return;
  }
  showNext(scene, queue, 0, onAllDone);
}

function showNext(scene: Phaser.Scene, queue: TutorialId[], index: number, onAllDone: () => void): void {
  if (index >= queue.length) {
    onAllDone();
    return;
  }
  showPage(scene, queue, index, 1, onAllDone);
}

// Split "identify" and "resolve" onto separate full screens instead of
// stacking both (at tiny 13px text) onto one panel — real feedback was that
// the old single-panel text was too small to read comfortably. Two pages at
// a much bigger size is worth the extra tap.
const TOTAL_PAGES = 2;

function showPage(scene: Phaser.Scene, queue: TutorialId[], index: number, page: 1 | 2, onAllDone: () => void): void {
  const id = queue[index];
  const entry = strings().tutorial[id];
  const centerX = GameConfig.width / 2;
  const centerY = GameConfig.height / 2;
  const panelWidth = 420;
  const textWidth = panelWidth - 60;

  const overlay = scene.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x000000, 0.75).setOrigin(0).setDepth(60);
  const panel = scene.add.rectangle(centerX, centerY, panelWidth, 700, Palette.bgAsphaltLight, 1).setDepth(61);
  panel.setStrokeStyle(2, Palette.wallSolid, 1);

  const layer: Phaser.GameObjects.GameObject[] = [overlay, panel];

  const icon = scene.add.text(centerX, centerY - 320, TUTORIAL_ICONS[id], { fontSize: "44px" }).setOrigin(0.5).setDepth(62);
  layer.push(icon);

  const title = scene.add
    .text(centerX, centerY - 258, entry.title, {
      fontFamily: Palette.displayFont,
      fontSize: "24px",
      color: Palette.textGold,
      align: "center",
      wordWrap: { width: textWidth },
    })
    .setOrigin(0.5, 0)
    .setDepth(62);
  layer.push(title);

  const bodyY = centerY - 172;
  if (page === 1) {
    const label = scene.add
      .text(centerX, bodyY, strings().tutorialUi.identifyLabel, {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "17px",
        color: "#4fd1ff",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(62);
    const body = scene.add
      .text(centerX, bodyY + 32, entry.identify, {
        fontFamily: Palette.bodyFont,
        fontSize: "17px",
        color: Palette.textLight,
        align: "center",
        wordWrap: { width: textWidth },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(62);
    layer.push(label, body);
  } else {
    const label = scene.add
      .text(centerX, bodyY, strings().tutorialUi.resolveLabel, {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "17px",
        color: "#51cf66",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(62);
    const body = scene.add
      .text(centerX, bodyY + 32, entry.resolve, {
        fontFamily: Palette.bodyFont,
        fontSize: "17px",
        color: Palette.textLight,
        align: "center",
        wordWrap: { width: textWidth },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(62);
    layer.push(label, body);
  }

  const pageIndicator = scene.add
    .text(centerX, centerY + 280, format(strings().tutorialUi.page, { page, total: TOTAL_PAGES }), {
      fontFamily: Palette.bodyFont,
      fontSize: "13px",
      color: "#8a909c",
    })
    .setOrigin(0.5)
    .setDepth(62);
  layer.push(pageIndicator);

  const isLastPage = page === TOTAL_PAGES;
  const button = createButton(scene, centerX, centerY + 320, 220, 52, isLastPage ? strings().tutorialUi.gotIt : strings().tutorialUi.next, { fontSize: "17px" });
  button.container.setDepth(62);
  layer.push(button.container);

  button.on("pointerup", () => {
    layer.forEach((o) => o.destroy());
    if (isLastPage) {
      saveSeenTutorial(id);
      showNext(scene, queue, index + 1, onAllDone);
    } else {
      showPage(scene, queue, index, 2, onAllDone);
    }
  });
}
