import { isReducedMotionActive } from "./reduced-motion";

// Tactile haptics progressive enhancement: Capacitor Haptics when available,
// dual-rumble Gamepad actuators on desktop/iOS controllers, Web Vibration API
// fallback on supported mobile browsers, silent no-op otherwise.

export type HapticKind = "light" | "medium" | "celebrate";

export type RumbleParams = {
  duration: number;
  strongMagnitude: number;
  weakMagnitude: number;
};

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

type RumbleActuator = {
  playEffect: (
    type: "dual-rumble",
    params: {
      startDelay: number;
      duration: number;
      strongMagnitude: number;
      weakMagnitude: number;
    },
  ) => unknown;
};

export const GAMEPAD_RUMBLE_EFFECTS: Record<HapticKind, RumbleParams> = {
  light: { duration: 35, strongMagnitude: 0.08, weakMagnitude: 0.22 },
  medium: { duration: 70, strongMagnitude: 0.22, weakMagnitude: 0.45 },
  celebrate: { duration: 150, strongMagnitude: 0.38, weakMagnitude: 0.65 },
};

const VIBRATE_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 18,
  celebrate: [14, 40, 22],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRumbleActuator(pad: unknown): RumbleActuator | null {
  if (!isRecord(pad)) return null;
  if ("connected" in pad && pad.connected === false) return null;
  const actuator = pad.vibrationActuator;
  if (!isRecord(actuator)) return null;
  const playEffect = actuator.playEffect;
  if (typeof playEffect !== "function") return null;
  return {
    playEffect: (type, params) => playEffect.call(actuator, type, params),
  };
}

export function hasRumbleGamepad(pads: readonly unknown[]): boolean {
  return pads.some((pad) => readRumbleActuator(pad) !== null);
}

export function triggerGamepadRumble(pads: readonly unknown[], kind: HapticKind): boolean {
  const effect = GAMEPAD_RUMBLE_EFFECTS[kind];
  let fired = false;
  for (const pad of pads) {
    const actuator = readRumbleActuator(pad);
    if (actuator === null) continue;
    try {
      const result = actuator.playEffect("dual-rumble", {
        startDelay: 0,
        ...effect,
      });
      if (isRecord(result) && typeof result.catch === "function") {
        void Promise.resolve(result).catch(() => {});
      }
      fired = true;
    } catch {
      // Ignore actuators that reject dual-rumble or throw on unsupported hardware.
    }
  }
  return fired;
}

function readPads(): readonly unknown[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  try {
    const list = navigator.getGamepads();
    return list ? Array.from(list) : [];
  } catch {
    return [];
  }
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
  const supported = (): boolean =>
    readNativeHaptics() !== null || hasWebVibrate() || hasRumbleGamepad(readPads());

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
      if (triggerGamepadRumble(readPads(), kind)) return;
      if (hasWebVibrate()) {
        navigator.vibrate(VIBRATE_PATTERNS[kind]);
      }
    } catch {
      // Browsers may reject vibrate before a user gesture; stay silent.
    }
  };

  return { trigger, supported };
}
