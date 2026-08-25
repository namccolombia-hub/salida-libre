import Phaser from "phaser";
import { Capacitor } from "@capacitor/core";
import { GameConfig, Palette } from "../config/palette.ts";
import { loadHintsEnabled, saveHintsEnabled, loadMusicEnabled, saveMusicEnabled, loadSfxEnabled, saveSfxEnabled } from "../state/Persistence.ts";
import { goTo, fadeIn } from "../fx/sceneTransition.ts";
import { setEnabled as setMusicEnabled } from "../audio/music.ts";
import { createButton } from "../ui/Button.ts";
import { linkAccount, getLinkedPlayerName } from "../cloud/CloudSave.ts";
import { showPrivacyOptions } from "../ads/AdService.ts";
import { openLink } from "../util/openLink.ts";

const PRIVACY_URL = "https://namccolombia-hub.github.io/salida-libre/privacy.html";
const TERMS_URL = "https://namccolombia-hub.github.io/salida-libre/terms.html";

interface ToggleRow {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  get: () => boolean;
  set: (v: boolean) => void;
}

export class SettingsScene extends Phaser.Scene {
  private rows: ToggleRow[] = [];
  private accountStatusText?: Phaser.GameObjects.Text;
  private accountButton?: ReturnType<typeof createButton>;

  constructor() {
    super("SettingsScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.bgAsphalt);
    fadeIn(this);
    this.rows = [];

    const back = this.add
      .text(20, 24, "‹ VOLVER", {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setInteractive({ useHandCursor: true });
    back.on("pointerup", () => goTo(this, "MenuScene"));

    this.add
      .text(GameConfig.width / 2, 24, "CONFIGURACIÓN", {
        fontFamily: Palette.displayFont,
        fontSize: "20px",
        color: Palette.textGold,
      })
      .setOrigin(0.5, 0);

    this.addToggleRow(140, "Ayudas visuales", "Si te quedás sin tocar nada 15s, los autos con\nsalida libre respiran suavemente para ayudarte.", loadHintsEnabled, saveHintsEnabled);

    this.addToggleRow(230, "Música", "Melodía de fondo, distinta en el menú,\nla cuadrícula y la persecución.", loadMusicEnabled, (v) => {
      saveMusicEnabled(v);
      setMusicEnabled(v);
    });

    this.addToggleRow(320, "Sonido", "Efectos cortos: tocar un auto, chocar,\nsacarlo, perder una vida.", loadSfxEnabled, saveSfxEnabled);

    this.accountStatusText = undefined;
    this.accountButton = undefined;
    void this.addAccountSection(410);

    const creditsLink = this.add
      .text(GameConfig.width / 2, 500, "🎵 Créditos de música", {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    creditsLink.on("pointerup", () => this.showCreditsModal());

    const privacyLink = this.add
      .text(GameConfig.width / 2 - 60, 528, "Privacidad", {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    privacyLink.on("pointerup", () => void openLink(PRIVACY_URL));

    this.add
      .text(GameConfig.width / 2, 528, "·", {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5);

    const termsLink = this.add
      .text(GameConfig.width / 2 + 55, 528, "Términos", {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    termsLink.on("pointerup", () => void openLink(TERMS_URL));

    // AdMob policy requires the consent choice stay reachable after first
    // launch, not just on the initial EU/UK prompt — this is that entry
    // point. It's a no-op outside the EU/UK (nothing to show).
    const privacyOptionsLink = this.add
      .text(GameConfig.width / 2, 556, "Opciones de privacidad de anuncios", {
        fontFamily: Palette.bodyFont,
        fontSize: "12px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    privacyOptionsLink.on("pointerup", () => void showPrivacyOptions());
  }

  // CC-BY 3.0 requires crediting each author somewhere the player actually
  // sees — a repo file alone doesn't satisfy that. See CREDITS.md for the
  // same list with links.
  private showCreditsModal(): void {
    const overlay = this.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x000000, 0.75).setOrigin(0).setDepth(40);
    const panel = this.add.rectangle(GameConfig.width / 2, GameConfig.height / 2, 400, 460, Palette.bgAsphaltLight, 1).setDepth(41);
    panel.setStrokeStyle(2, Palette.wallSolid, 1);

    const title = this.add
      .text(GameConfig.width / 2, GameConfig.height / 2 - 210, "Música — OpenGameArt.org (CC-BY 3.0)", {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "13px",
        color: Palette.textGold,
        align: "center",
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5)
      .setDepth(42);

    const credits = [
      ["Jump and Run - Tropics", "bart"],
      ["Puzzle Tune 1 (a/b)", "rezoner"],
      ["MML Su Turno", "Patrick de Arteaga"],
      ["Chill Jungle Ambient", "Tausdei"],
      ["Bouncing Baal", "FoxSynergy"],
      ["At last", "Android128"],
      ["Space Chase", "Szymon Matuszewski"],
    ]
      .map(([track, author]) => `${track} — ${author}`)
      .join("\n");

    const body = this.add
      .text(GameConfig.width / 2, GameConfig.height / 2 - 40, credits, {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: Palette.textLight,
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(42);

    const closeButton = createButton(this, GameConfig.width / 2, GameConfig.height / 2 + 190, 160, 44, "CERRAR", { fontSize: "14px" });
    closeButton.container.setDepth(42);
    closeButton.on("pointerup", () => {
      [overlay, panel, title, body, closeButton.container].forEach((o) => o.destroy());
    });
  }

  // Always visible, even on web — real sign-in only works in a native build
  // (Play Games / Game Center), but a dev testing in the browser couldn't
  // find this section at all before, since it used to be hidden entirely
  // outside a native build. Now it shows where it lives and says so plainly.
  private async addAccountSection(rowY: number): Promise<void> {
    this.add
      .text(24, rowY - 14, "Cuenta", {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "17px",
        color: Palette.textLight,
      })
      .setOrigin(0, 0);

    this.accountStatusText = this.add
      .text(24, rowY + 12, "Cargando…", {
        fontFamily: Palette.bodyFont,
        fontSize: "12px",
        color: "#8a909c",
        lineSpacing: 3,
        wordWrap: { width: GameConfig.width - 180 },
      })
      .setOrigin(0, 0);

    this.accountButton = createButton(this, GameConfig.width - 90, rowY + 4, 140, 40, "🔗 Vincular", { fontSize: "13px" });

    if (!Capacitor.isNativePlatform()) {
      this.accountStatusText.setText("Vista previa: el enlace de cuenta (Google Play / Game\nCenter) solo funciona en la app instalada, no en el navegador.");
      this.accountButton.on("pointerup", () => {
        this.accountStatusText?.setText("Solo disponible en la app instalada — acá es únicamente\nuna vista previa de dónde va a aparecer.");
      });
      return;
    }

    this.accountButton.on("pointerup", () => {
      void linkAccount().then(({ signedIn, displayName }) => this.refreshAccountUI(signedIn, displayName));
    });

    const displayName = await getLinkedPlayerName();
    this.refreshAccountUI(displayName !== null, displayName);
  }

  private refreshAccountUI(signedIn: boolean, displayName: string | null): void {
    if (!this.accountStatusText) return;
    if (signedIn && displayName) {
      this.accountStatusText.setText(`✅ Conectado como ${displayName}\nTu avance se sincroniza automáticamente.`);
      this.accountButton?.container.setVisible(false);
    } else {
      this.accountStatusText.setText("Vinculá tu cuenta de Google Play / Game Center\npara no perder el avance si cambiás de teléfono.");
      this.accountButton?.container.setVisible(true);
    }
  }

  private addToggleRow(rowY: number, title: string, description: string, get: () => boolean, set: (v: boolean) => void): void {
    this.add
      .text(24, rowY - 14, title, {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "17px",
        color: Palette.textLight,
      })
      .setOrigin(0, 0);

    this.add
      .text(24, rowY + 12, description, {
        fontFamily: Palette.bodyFont,
        fontSize: "12px",
        color: "#8a909c",
        lineSpacing: 3,
      })
      .setOrigin(0, 0);

    const box = this.add
      .rectangle(GameConfig.width - 60, rowY, 72, 36, Palette.bgAsphaltLight, 1)
      .setStrokeStyle(2, Palette.wallSolid, 1)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(GameConfig.width - 60, rowY, "", {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "13px",
        color: "#1c1f26",
      })
      .setOrigin(0.5);

    const row: ToggleRow = { box, label, get, set };
    box.on("pointerup", () => {
      row.set(!row.get());
      this.refreshRow(row);
    });

    this.rows.push(row);
    this.refreshRow(row);
  }

  private refreshRow(row: ToggleRow): void {
    const enabled = row.get();
    row.box.setFillStyle(enabled ? Palette.laneGold : Palette.bgAsphaltLight, 1);
    row.label.setText(enabled ? "ON" : "OFF");
    row.label.setColor(enabled ? "#1c1f26" : Palette.textLight);
  }
}
