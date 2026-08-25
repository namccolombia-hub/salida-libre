import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

// Native builds need @capacitor/browser to reliably hand external links to
// the system browser — window.open()'s behavior inside a Capacitor WebView
// isn't guaranteed the same way across Android/iOS.
export async function openLink(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}
