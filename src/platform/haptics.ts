import { isReducedMotionActive } from "./reduced-motion";

// Tactile haptics progressive enhancement: Capacitor Haptics when available,
// Web Vibration API fallback on supported browsers, silent no-op otherwise.

export type HapticKind = "light" | "medium" | "celebrate";

export type Haptics = {
  trigger: (kind: HapticKind) => void;
  supported: () => boolean;
};

type ImpactStyle = "LIGHT" | "MEDIUM" | "HEAVY";
type NotificationType = "SUCCESS" | "WARNING" | "ERROR";

type NativeHapticsPlugin = {
  impact: (options: { style: ImpactStyle }) => void;
  notification?: (options: { type: NotificationType }) => void;
};

const VIBRATE_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 18,
  celebrate: [14, 40, 22],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNativeHaptics(): NativeHapticsPlugin | null {
  const root: unknown = globalThis;
  if (!isRecord(root) || !isRecord(root.Capacitor)) return null;
  const plugins = root.Capacitor.Plugins;
  if (!isRecord(plugins) || !isRecord(plugins.Haptics)) return null;
  const plugin = plugins.Haptics;
  const impact = plugin.impact;
  if (typeof impact !== "function") return null;
  const notification = plugin.notification;
  return {
    impact: (options) => {
      void impact.call(plugin, options);
    },
    ...(typeof notification === "function"
      ? {
          notification: (options) => {
            void notification.call(plugin, options);
          },
        }
      : {}),
  };
}

function hasWebVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function prefersReducedMotion(): boolean {
  return isReducedMotionActive();
}

export function createHaptics(): Haptics {
  const supported = (): boolean => readNativeHaptics() !== null || hasWebVibrate();

  const trigger = (kind: HapticKind): void => {
    if (prefersReducedMotion()) return;
    try {
      const native = readNativeHaptics();
      if (native !== null) {
        if (kind === "celebrate" && native.notification !== undefined) {
          native.notification({ type: "SUCCESS" });
        } else {
          const style: ImpactStyle =
            kind === "light" ? "LIGHT" : kind === "medium" ? "MEDIUM" : "HEAVY";
          native.impact({ style });
        }
        return;
      }
      if (hasWebVibrate()) {
        navigator.vibrate(VIBRATE_PATTERNS[kind]);
      }
    } catch {
      // Browsers may reject vibrate before a user gesture; stay silent.
    }
  };

  return { trigger, supported };
}
