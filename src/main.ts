import Phaser from "phaser";
import { GameConfig, startTheme } from "./config/palette.ts";
import { BootScene } from "./scenes/BootScene.ts";
import { MenuScene } from "./scenes/MenuScene.ts";
import { LevelSelectScene } from "./scenes/LevelSelectScene.ts";
import { LevelPreviewScene } from "./scenes/LevelPreviewScene.ts";
import { GridPreviewScene } from "./scenes/GridPreviewScene.ts";
import { ParkingScene } from "./scenes/ParkingScene.ts";
import { ChaseScene } from "./scenes/ChaseScene.ts";
import { GameOverScene } from "./scenes/GameOverScene.ts";
import { SettingsScene } from "./scenes/SettingsScene.ts";
import { resumeIfPending } from "./audio/music.ts";

// Mobile browsers suspend AudioContext until a user gesture. sfx.ts already
// resumes it lazily on each SFX call, but the very first bit of scheduled
// music can start before any tap happens — this catches that first gesture
// once, game-wide, so pending music becomes audible right away.
document.addEventListener("pointerdown", resumeIfPending, { once: true });

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GameConfig.width,
  height: GameConfig.height,
  // Matches this session's randomly-picked warm boot/menu theme so there's
  // no black flash before BootScene draws its own gradient (in-game scenes
  // set their own dark asphalt background explicitly, unaffected by this).
  backgroundColor: `#${startTheme.bottom.toString(16).padStart(6, "0")}`,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    MenuScene,
    LevelSelectScene,
    LevelPreviewScene,
    GridPreviewScene,
    ParkingScene,
    ChaseScene,
    GameOverScene,
    SettingsScene,
  ],
});
