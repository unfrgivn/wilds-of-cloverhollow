import { spawnSync } from "node:child_process";

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const udid = run("bun", ["tools/ios/sim.ts", "boot"]).trim().split("\n").at(-1);
if (udid === undefined || udid === "") throw new Error("Simulator UDID was empty");
spawnSync("open", ["-a", "Simulator"], { stdio: "ignore" });
run("xcodebuild", [
  "-quiet", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
  "-configuration", "Debug", "-sdk", "iphonesimulator",
  "-derivedDataPath", ".derived-data", "build", "CODE_SIGNING_ALLOWED=NO",
]);
run("xcrun", [
  "simctl", "install", udid,
  ".derived-data/Build/Products/Debug-iphonesimulator/App.app",
]);
console.log(run("xcrun", [
  "simctl", "launch", "--terminate-running-process", udid,
  "com.unfrgivn.cloverhollow",
]));
