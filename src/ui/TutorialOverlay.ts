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

// A real gameplay screenshot on its own page 1 (real feedback: players
// wanted to see the mechanic, not just read about it), then "identify" and
// "resolve" as separate pages — three screens total, up from the original
// single cramped panel at 13px text.
const TOTAL_PAGES = 3;
type Page = 1 | 2 | 3;

function showPage(scene: Phaser.Scene, queue: TutorialId[], index: number, page: Page, onAllDone: () => void): void {
  const id = queue[index];
  const entry = strings().tutorial[id];
  const centerX = GameConfig.width / 2;
  const centerY = GameConfig.height / 2;
  const panelWidth = 420;
  const panelHeight = 700;
  const textWidth = panelWidth - 60;

  const overlay = scene.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x000000, 0.75).setOrigin(0).setDepth(60);
  const panel = scene.add.rectangle(centerX, centerY, panelWidth, panelHeight, Palette.bgAsphaltLight, 1).setDepth(61);
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
  const screenshotKey = `tutorial-${id}`;
  const hasScreenshot = scene.textures.exists(screenshotKey);
  if (page === 1 && hasScreenshot) {
    // Fit within a fixed box, preserving the screenshot's own aspect ratio
    // (parking-board crops and chase-view crops are shaped very differently).
    const maxW = textWidth;
    const maxH = 420;
    const src = scene.textures.get(screenshotKey).getSourceImage();
    const aspect = src.width / src.height;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    const frame = scene.add.rectangle(centerX, bodyY + h / 2, w + 4, h + 4).setStrokeStyle(2, Palette.wallSolid, 1).setDepth(62);
    const shot = scene.add.image(centerX, bodyY, screenshotKey).setOrigin(0.5, 0).setDisplaySize(w, h).setDepth(62);
    const caption = scene.add
      .text(centerX, bodyY + h + 14, strings().tutorialUi.screenshotCaption, {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(62);
    layer.push(frame, shot, caption);
  } else if (page === 1 || page === 2) {
    // Falls back to the "identify" text if a screenshot is missing for this
    // id (e.g. a newly added tutorial before its screenshot is captured),
    // so a page never renders blank.
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
      showPage(scene, queue, index, (page + 1) as Page, onAllDone);
    }
  });
}
