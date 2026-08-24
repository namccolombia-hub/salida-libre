// Native vibration feedback — a safe no-op on web (Capacitor.isNativePlatform()
// is false in every browser), same defensive pattern as AdService/CloudSave.
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

function safe(fn: () => Promise<void>): void {
  if (!Capacitor.isNativePlatform()) return;
  void fn().catch(() => {});
}

// A crash/bounce — the car hit something.
export function hapticImpact(): void {
  safe(() => Haptics.impact({ style: ImpactStyle.Medium }));
}

// A light tap acknowledgment — kept subtle since it fires often.
export function hapticTap(): void {
  safe(() => Haptics.impact({ style: ImpactStyle.Light }));
}

// A win moment — level cleared, chase won.
export function hapticSuccess(): void {
  safe(() => Haptics.notification({ type: NotificationType.Success }));
}

// A loss moment — life lost, chase failed, game over.
export function hapticError(): void {
  safe(() => Haptics.notification({ type: NotificationType.Error }));
}
