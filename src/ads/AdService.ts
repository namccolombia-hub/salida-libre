// Thin AdMob wrapper — a safe no-op everywhere except a real native build
// (Capacitor.isNativePlatform() is false in every browser, including this
// dev server), so the web version keeps working exactly as before, with no
// ads at all.
import { Capacitor } from "@capacitor/core";
import { AdMob } from "@capacitor-community/admob";

// Google's OFFICIAL PUBLIC TEST ad unit IDs — safe to ship during
// development (they never serve real ads or generate revenue, and using
// your own unapproved app's real IDs before review can get an AdMob account
// flagged). Replace these with your own real ad unit IDs from your AdMob
// account, and drop `isTesting: true` below, before publishing to a store.
const REWARDED_AD_ID = Capacitor.getPlatform() === "ios" ? "ca-app-pub-3940256099942544/1712485313" : "ca-app-pub-3940256099942544/5224354917";
const INTERSTITIAL_AD_ID = Capacitor.getPlatform() === "ios" ? "ca-app-pub-3940256099942544/4411468910" : "ca-app-pub-3940256099942544/1033173712";

let initialized = false;

async function prepareRewarded(): Promise<void> {
  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID, isTesting: true });
  } catch {
    // No fill / offline — showRewardedAd() below just won't reward anything.
  }
}

async function prepareInterstitial(): Promise<void> {
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID, isTesting: true });
  } catch {
    // Same as above.
  }
}

// Call once, early (e.g. BootScene), before any ad is shown.
export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;
  await AdMob.initialize({ initializeForTesting: true });
  void prepareRewarded();
  void prepareInterstitial();
}

// Shows a rewarded video. Calls onReward() only if it resolves — per the
// plugin's contract that only happens once the user actually earns the
// reward — never on a skipped/failed/not-yet-loaded ad. Always queues the
// next one afterward so a second watch is ready later.
export async function showRewardedAd(onReward: () => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.showRewardVideoAd();
    onReward();
  } catch {
    // Not loaded yet, or the user backed out — no reward, no crash.
  } finally {
    void prepareRewarded();
  }
}

export async function showInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.showInterstitial();
  } catch {
    // Not loaded yet — just skip showing one this time.
  } finally {
    void prepareInterstitial();
  }
}
