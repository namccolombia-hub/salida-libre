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
import { strings, format, getLocale, setLocale, LOCALES, type Locale } from "../i18n/index.ts";

// Spanish is the canonical/authoritative legal text (privacy.html /
// terms.html, no suffix); en/pt are informational translations that say so
// up front and link back to it. See docs/privacy.*.html in the repo.
const LEGAL_BASE_URL = "https://namccolombia-hub.github.io/salida-libre";
function legalUrl(doc: "privacy" | "terms"): string {
  const locale = getLocale();
  const suffix = locale === "es" ? "" : `.${locale}`;
  return `${LEGAL_BASE_URL}/${doc}${suffix}.html`;
}

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
      .text(20, 24, strings().levelSelect.back, {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "16px",
        color: Palette.textLight,
      })
      .setInteractive({ useHandCursor: true });
    back.on("pointerup", () => goTo(this, "MenuScene"));

    this.add
      .text(GameConfig.width / 2, 24, strings().settings.title, {
        fontFamily: Palette.displayFont,
        fontSize: "20px",
        color: Palette.textGold,
      })
      .setOrigin(0.5, 0);

    this.addToggleRow(140, strings().settings.hintsTitle, strings().settings.hintsDesc, loadHintsEnabled, saveHintsEnabled);

    this.addToggleRow(230, strings().settings.musicTitle, strings().settings.musicDesc, loadMusicEnabled, (v) => {
      saveMusicEnabled(v);
      setMusicEnabled(v);
    });

    this.addToggleRow(320, strings().settings.soundTitle, strings().settings.soundDesc, loadSfxEnabled, saveSfxEnabled);

    this.addLanguageRow(410);

    this.accountStatusText = undefined;
    this.accountButton = undefined;
    void this.addAccountSection(500);

    const creditsLink = this.add
      .text(GameConfig.width / 2, 590, strings().settings.creditsLink, {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    creditsLink.on("pointerup", () => this.showCreditsModal());

    const privacyLink = this.add
      .text(GameConfig.width / 2 - 60, 618, strings().settings.privacyLink, {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    privacyLink.on("pointerup", () => void openLink(legalUrl("privacy")));

    this.add
      .text(GameConfig.width / 2, 618, "·", {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5);

    const termsLink = this.add
      .text(GameConfig.width / 2 + 55, 618, strings().settings.termsLink, {
        fontFamily: Palette.bodyFont,
        fontSize: "13px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    termsLink.on("pointerup", () => void openLink(legalUrl("terms")));

    // AdMob policy requires the consent choice stay reachable after first
    // launch, not just on the initial EU/UK prompt — this is that entry
    // point. It's a no-op outside the EU/UK (nothing to show).
    const privacyOptionsLink = this.add
      .text(GameConfig.width / 2, 646, strings().settings.adPrivacyOptions, {
        fontFamily: Palette.bodyFont,
        fontSize: "12px",
        color: "#8a909c",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    privacyOptionsLink.on("pointerup", () => void showPrivacyOptions());
  }

  // Each language shows its own native autonym regardless of the currently
  // active locale (standard language-switcher convention) — not part of the
  // translated dictionaries since it doesn't change with them.
  private static readonly LANGUAGE_NAMES: Record<Locale, string> = {
    es: "Español",
    en: "English",
    pt: "Português",
  };

  private addLanguageRow(rowY: number): void {
    this.add
      .text(24, rowY - 14, strings().settings.languageTitle, {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "17px",
        color: Palette.textLight,
      })
      .setOrigin(0, 0);

    const pillWidth = 84;
    const gap = 8;
    const totalWidth = pillWidth * LOCALES.length + gap * (LOCALES.length - 1);
    let x = GameConfig.width - 24 - totalWidth + pillWidth / 2;

    const pills: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; locale: Locale }[] = [];
    const refresh = () => {
      const active = getLocale();
      for (const pill of pills) {
        const isActive = pill.locale === active;
        pill.box.setFillStyle(isActive ? Palette.laneGold : Palette.bgAsphaltLight, 1);
        pill.label.setColor(isActive ? "#1c1f26" : Palette.textLight);
      }
    };

    for (const locale of LOCALES) {
      const box = this.add
        .rectangle(x, rowY + 4, pillWidth, 32, Palette.bgAsphaltLight, 1)
        .setStrokeStyle(2, Palette.wallSolid, 1)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, rowY + 4, SettingsScene.LANGUAGE_NAMES[locale], {
          fontFamily: Palette.bodyFontBold,
          fontStyle: "700",
          fontSize: "12px",
          color: Palette.textLight,
        })
        .setOrigin(0.5);
      box.on("pointerup", () => {
        if (getLocale() === locale) return;
        setLocale(locale);
        this.scene.restart();
      });
      pills.push({ box, label, locale });
      x += pillWidth + gap;
    }

    refresh();
  }

  // CC-BY 3.0 requires crediting each author somewhere the player actually
  // sees — a repo file alone doesn't satisfy that. See CREDITS.md for the
  // same list with links.
  private showCreditsModal(): void {
    const overlay = this.add.rectangle(0, 0, GameConfig.width, GameConfig.height, 0x000000, 0.75).setOrigin(0).setDepth(40);
    const panel = this.add.rectangle(GameConfig.width / 2, GameConfig.height / 2, 400, 460, Palette.bgAsphaltLight, 1).setDepth(41);
    panel.setStrokeStyle(2, Palette.wallSolid, 1);

    const title = this.add
      .text(GameConfig.width / 2, GameConfig.height / 2 - 210, strings().settings.creditsTitle, {
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

    const closeButton = createButton(this, GameConfig.width / 2, GameConfig.height / 2 + 190, 160, 44, strings().settings.creditsClose, { fontSize: "14px" });
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
      .text(24, rowY - 14, strings().settings.accountTitle, {
        fontFamily: Palette.bodyFontBold,
        fontStyle: "700",
        fontSize: "17px",
        color: Palette.textLight,
      })
      .setOrigin(0, 0);

    this.accountStatusText = this.add
      .text(24, rowY + 12, strings().settings.accountLoading, {
        fontFamily: Palette.bodyFont,
        fontSize: "12px",
        color: "#8a909c",
        lineSpacing: 3,
        wordWrap: { width: GameConfig.width - 180 },
      })
      .setOrigin(0, 0);

    this.accountButton = createButton(this, GameConfig.width - 90, rowY + 4, 140, 40, strings().settings.accountLinkButton, { fontSize: "13px" });

    if (!Capacitor.isNativePlatform()) {
      this.accountStatusText.setText(strings().settings.accountPreviewWeb);
      this.accountButton.on("pointerup", () => {
        this.accountStatusText?.setText(strings().settings.accountPreviewWebTap);
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
      this.accountStatusText.setText(format(strings().settings.accountConnected, { name: displayName }));
      this.accountButton?.container.setVisible(false);
    } else {
      this.accountStatusText.setText(strings().settings.accountPrompt);
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
    row.label.setText(enabled ? strings().settings.on : strings().settings.off);
    row.label.setColor(enabled ? "#1c1f26" : Palette.textLight);
  }
}
