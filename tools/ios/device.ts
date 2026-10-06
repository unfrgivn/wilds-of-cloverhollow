import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Builds the production game for a real iPhone and, with --install, puts it on
// the first connected phone (or the one named by CLOVERHOLLOW_DEVICE).
//
// Signing is free personal-team signing (spec 3.2.1): the owner's Apple ID is
// signed in to Xcode, and CLOVERHOLLOW_TEAM_ID names that personal team. The
// team id never lives in the repo. Without a team id the build is unsigned,
// which still proves the arm64 app compiles and is the `just ios-device-build`
// gate.

const bundleId = "com.unfrgivn.cloverhollow";
const app = ".derived-data/Build/Products/Release-iphoneos/App.app";

type Phone = { name: string; udid: string; connected: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function run(command: string, args: string[], env: Record<string, string> = {}): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function phones(): Phone[] {
  const dir = mkdtempSync(join(tmpdir(), "cloverhollow-devicectl-"));
  const file = join(dir, "devices.json");
  try {
    run("xcrun", ["devicectl", "list", "devices", "--json-output", file]);
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!isRecord(parsed) || !isRecord(parsed.result) || !Array.isArray(parsed.result.devices))
      throw new Error("devicectl returned an invalid device list");
    const found: Phone[] = [];
    for (const device of parsed.result.devices) {
      if (!isRecord(device)) continue;
      const hardware = device.hardwareProperties;
      const properties = device.deviceProperties;
      const connection = device.connectionProperties;
      if (!isRecord(hardware) || !isRecord(properties) || !isRecord(connection)) continue;
      if (hardware.reality !== "physical" || hardware.platform !== "iOS") continue;
      if (typeof hardware.udid !== "string" || typeof properties.name !== "string") continue;
      found.push({
        name: properties.name,
        udid: hardware.udid,
        connected: connection.tunnelState === "connected",
      });
    }
    return found;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function pickPhone(): Phone {
  const all = phones();
  const wanted = process.env.CLOVERHOLLOW_DEVICE;
  const candidates = wanted === undefined
    ? all
    : all.filter((phone) => phone.name === wanted || phone.udid === wanted);
  const phone = candidates.find((candidate) => candidate.connected);
  if (phone !== undefined) return phone;
  const paired = all
    .map((p) => `${p.name} (${p.connected ? "connected" : "not connected"})`)
    .join(", ");
  const seen = all.length === 0 ? "no iPhone is paired with this Mac" : `paired: ${paired}`;
  const matching = wanted === undefined ? "" : ` matching "${wanted}"`;
  throw new Error(
    `No connected iPhone${matching}; ${seen}.\n` +
      "Plug the phone in over USB, unlock it, tap Trust, and turn on " +
      "Settings > Privacy & Security > Developer Mode.",
  );
}

function buildWeb(): void {
  run("bunx", ["vite", "build"]);
  run("bun", ["tools/check-dist.ts"]);
  run("bunx", ["cap", "sync", "ios"], { CLOVERHOLLOW_WEB_DIR: "dist" });
}

function buildApp(teamId: string | undefined): void {
  const signing = teamId === undefined
    ? ["CODE_SIGNING_ALLOWED=NO"]
    : [
        "-allowProvisioningUpdates",
        "-allowProvisioningDeviceRegistration",
        `DEVELOPMENT_TEAM=${teamId}`,
        "CODE_SIGN_STYLE=Automatic",
      ];
  run("xcodebuild", [
    "-quiet", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
    "-configuration", "Release", "-destination", "generic/platform=iOS",
    "-derivedDataPath", ".derived-data", "build", ...signing,
  ]);
}

function main(): void {
  const install = process.argv.includes("--install");
  const teamId = process.env.CLOVERHOLLOW_TEAM_ID;
  if (install && teamId === undefined) {
    throw new Error(
      "CLOVERHOLLOW_TEAM_ID is not set. Sign in to Xcode > Settings > Accounts with your " +
        "Apple ID, then put your personal team id (the 10-character id next to Personal " +
        "Team) in .env.ios; see .env.ios.example.",
    );
  }
  const phone = install ? pickPhone() : null;

  buildWeb();
  buildApp(teamId);
  console.log(`built ${app} (${teamId === undefined ? "unsigned" : `team ${teamId}`})`);

  if (phone === null) return;
  run("xcrun", ["devicectl", "device", "install", "app", "--device", phone.udid, app]);
  console.log(`installed on ${phone.name}`);
  console.log(run("xcrun", [
    "devicectl", "device", "process", "launch", "--terminate-existing",
    "--device", phone.udid, bundleId,
  ]));
  console.log(
    "If iOS refuses to open it: Settings > General > VPN & Device Management > trust the " +
      "developer app. Free profiles expire after 7 days; rerun `just ios-device` to refresh.",
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
