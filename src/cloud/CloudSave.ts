// Optional cross-device progress sync via Google Play Games Services
// (Android) / Game Center (iOS) — a safe no-op everywhere else, same
// pattern as src/ads/AdService.ts. Never blocks or interrupts play: sign-in
// is either silent (reuses an existing platform login) or an explicit tap
// in Settings, never a gate before the game starts.
import { Capacitor } from "@capacitor/core";
import { PlayGames } from "@idleflowgames/capacitor-play-games";
import { LevelState } from "../state/LevelState.ts";
import { loadMaxLevel } from "../state/Persistence.ts";

const SNAPSHOT_NAME = "progress";

interface ProgressSnapshot {
  maxLevel: number;
}

// Only "how far did I get" is synced — sound/hint preferences and seen
// tutorials stay local, they make more sense per device than per player.
async function reconcile(): Promise<void> {
  const { snapshot } = await PlayGames.loadSnapshot({ name: SNAPSHOT_NAME });
  const remoteMaxLevel = snapshot ? (JSON.parse(snapshot.data) as ProgressSnapshot).maxLevel : 0;
  const localMaxLevel = loadMaxLevel();

  if (remoteMaxLevel > localMaxLevel) {
    LevelState.unlockUpTo(remoteMaxLevel);
  } else if (localMaxLevel > remoteMaxLevel) {
    const data: ProgressSnapshot = { maxLevel: localMaxLevel };
    await PlayGames.saveSnapshot({ name: SNAPSHOT_NAME, data: JSON.stringify(data) });
  }
}

// Call once at boot. Attempts a silent sign-in only — no UI, succeeds only
// if the player already authorized this game before, so a returning player
// gets their progress back with zero taps.
export async function initCloudSave(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PlayGames.initialize();
    const { signedIn } = await PlayGames.signIn({ silent: true });
    if (signedIn) await reconcile();
  } catch {
    // Offline, not previously linked, or a platform hiccup — the game just
    // keeps using local progress, exactly as if this feature didn't exist.
  }
}

// The interactive flow — only call this from an explicit user tap.
export async function linkAccount(): Promise<{ signedIn: boolean; displayName: string | null }> {
  if (!Capacitor.isNativePlatform()) return { signedIn: false, displayName: null };
  try {
    const { signedIn } = await PlayGames.signIn({ silent: false });
    if (!signedIn) return { signedIn: false, displayName: null };
    await reconcile();
    const player = await PlayGames.getPlayer();
    return { signedIn: true, displayName: player.displayName };
  } catch {
    return { signedIn: false, displayName: null };
  }
}

// For SettingsScene to show the right state when it opens.
export async function getLinkedPlayerName(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { signedIn } = await PlayGames.isSignedIn();
    if (!signedIn) return null;
    const player = await PlayGames.getPlayer();
    return player.displayName;
  } catch {
    return null;
  }
}

// Call after the local max level rises (a level was just cleared for the
// first time) so a signed-in player's cloud progress stays current.
export async function pushProgress(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { signedIn } = await PlayGames.isSignedIn();
    if (signedIn) await reconcile();
  } catch {
    // Same as above — silently skip, local progress is unaffected.
  }
}
