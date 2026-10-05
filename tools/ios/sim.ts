import { spawnSync } from "node:child_process";

type Device = { name: string; udid: string; state: string; isAvailable: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function run(args: string[]): string {
  const result = spawnSync("xcrun", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`xcrun failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** Sort key for runtime ids like "...SimRuntime.iOS-27-0"; non-iOS runtimes sort last. */
function iosVersion(runtime: string): number {
  const match = runtime.match(/\.iOS-(\d+)-(\d+)$/);
  if (match === null) return -1;
  return Number(match[1] ?? 0) * 1000 + Number(match[2] ?? 0);
}

function resolveDevice(): Device {
  const parsed: unknown = JSON.parse(run(["simctl", "list", "devices", "available", "-j"]));
  if (!isRecord(parsed) || !("devices" in parsed)) {
    throw new Error("simctl returned an invalid device list");
  }
  const devices = parsed.devices;
  if (!isRecord(devices)) {
    throw new Error("simctl returned no device runtimes");
  }
  const name = process.env.IOS_SIMULATOR_NAME ?? "iPhone 17";
  const runtimes = Object.keys(devices).sort((a, b) => iosVersion(b) - iosVersion(a));
  for (const runtime of runtimes) {
    const entries = devices[runtime];
    if (!Array.isArray(entries)) continue;
    const match = entries.find(
      (device): device is Device =>
        typeof device === "object" &&
        device !== null &&
        "name" in device && device.name === name &&
        "udid" in device && typeof device.udid === "string" &&
        "state" in device && typeof device.state === "string" &&
        "isAvailable" in device && device.isAvailable === true,
    );
    if (match !== undefined) return match;
  }
  throw new Error(`No available simulator named "${name}" was found`);
}

const device = resolveDevice();
if (process.argv[2] === "id") {
  console.log(device.udid);
} else if (process.argv[2] === "boot") {
  if (device.state !== "Booted") run(["simctl", "boot", device.udid]);
  run(["simctl", "bootstatus", device.udid, "-b"]);
  console.log(device.udid);
} else {
  throw new Error("Usage: bun tools/ios/sim.ts <id|boot>");
}
