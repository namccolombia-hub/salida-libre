// Thin AdMob wrapper — a safe no-op everywhere except a real native build
// (Capacitor.isNativePlatform() is false in every browser, including this
// dev server), so the web version keeps working exactly as before, with no
// ads at all.
import { Capacitor } from "@capacitor/core";
import { AdMob, AdmobConsentStatus } from "@capacitor-community/admob";

const isIOS = Capacitor.getPlatform() === "ios";

// Android has a real AdMob app + ad units (Namc Colombia account) — live.
// iOS doesn't have a registered AdMob app yet (no Mac to build/publish on
// yet), so it stays on Google's OFFICIAL PUBLIC TEST ad unit IDs — safe to
// ship, never serve real ads or generate revenue. Once iOS gets its own
// AdMob app, swap this ternary's iOS branch for its real ad unit IDs and
// it'll automatically stop being treated as a test (see IS_TESTING below).
const REWARDED_AD_ID = isIOS ? "ca-app-pub-3940256099942544/1712485313" : "ca-app-pub-7661622406962970/3128325788";
const INTERSTITIAL_AD_ID = isIOS ? "ca-app-pub-3940256099942544/4411468910" : "ca-app-pub-7661622406962970/4593501026";

// Real ad units only actually serve real ads once isTesting is false.
const IS_TESTING = isIOS;

let initialized = false;

// EU/UK users must be asked for consent (Google's UMP flow) before any ad
// request; everyone else gets AdmobConsentStatus.NOT_REQUIRED immediately.
// If the request itself fails (offline, etc.) we default to allowing ads —
// the vast majority of installs are outside the EU/UK anyway.
async function ensureConsent(): Promise<boolean> {
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      const updated = await AdMob.showConsentForm();
      return updated.canRequestAds;
    }
    return info.canRequestAds;
  } catch {
    return true;
  }
}

// Re-opens the same Google consent form so a player can change their mind
// later — required by AdMob policy to be reachable from somewhere other
// than first launch. Wired to a Settings button; a no-op outside the EU/UK
// since the form simply won't have anything to show.
export async function showPrivacyOptions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    // Nothing to show (NOT_REQUIRED) or UMP not ready yet — fine either way.
  }
}

async function prepareRewarded(): Promise<void> {
  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID, isTesting: IS_TESTING });
  } catch {
    // No fill / offline — showRewardedAd() below just won't reward anything.
  }
}

async function prepareInterstitial(): Promise<void> {
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID, isTesting: IS_TESTING });
  } catch {
    // Same as above.
  }
}

// Call once, early (e.g. BootScene), before any ad is shown.
export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;
  const canRequestAds = await ensureConsent();
  if (!canRequestAds) return; // EU/UK user declined — no ad requests at all.
  // Real ad requests are gated per-ad-unit by IS_TESTING above, not here —
  // initializeForTesting only registers specific test device ids, which we
  // don't need.
  await AdMob.initialize();
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
