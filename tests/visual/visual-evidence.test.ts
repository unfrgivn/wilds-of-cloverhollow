import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==", "base64");
const otherPixel = Buffer.from(pixel);
const changedPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAP+KeNJXAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==", "base64");
const sameColorDifferentDimensions = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC", "base64");

async function runCompare(baseline: string, capture: string): Promise<number> {
  const result = Bun.spawnSync(["bash", "tools/ci/diff-visual.sh", "fixture", capture], {
    cwd: join(import.meta.dir, "../.."),
    env: { ...process.env, BASELINE_DIR: baseline },
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode;
}

async function makeComparisonFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "visual-compare-"));
  await mkdir(join(root, "baseline", "fixture"), { recursive: true });
  await mkdir(join(root, "capture"), { recursive: true });
  await writeFile(join(root, "baseline", "fixture", "frame.png"), pixel);
  await writeFile(join(root, "capture", "frame.png"), otherPixel);
  return root;
}

describe("visual evidence comparison", () => {
  test("identical images pass comparison", async () => {
    const root = await makeComparisonFixture();
    try { expect(await runCompare(join(root, "baseline"), join(root, "capture"))).toBe(0); } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("missing, extra, empty, and invalid images fail comparison", async () => {
    const root = await makeComparisonFixture();
    const baseline = join(root, "baseline");
    const capture = join(root, "capture");
    try {
      await rm(join(capture, "frame.png"));
      expect(await runCompare(baseline, capture)).toBe(1);
      await writeFile(join(capture, "frame.png"), pixel);
      await writeFile(join(capture, "extra.png"), pixel);
      expect(await runCompare(baseline, capture)).toBe(1);
      await rm(join(capture, "frame.png"));
      await rm(join(capture, "extra.png"));
      expect(await runCompare(baseline, capture)).toBe(1);
      await mkdir(join(root, "empty-baseline"), { recursive: true });
      expect(await runCompare(join(root, "empty-baseline"), capture)).toBe(1);
      await writeFile(join(capture, "frame.png"), Buffer.from("not a png"));
      expect(await runCompare(baseline, capture)).toBe(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("a one-pixel color change fails exact comparison", async () => {
    const root = await makeComparisonFixture();
    try {
      await writeFile(join(root, "capture", "frame.png"), changedPixel);
      expect(await runCompare(join(root, "baseline"), join(root, "capture"))).toBe(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("same-color images with different dimensions fail", async () => {
    const root = await makeComparisonFixture();
    try {
      await writeFile(join(root, "capture", "frame.png"), sameColorDifferentDimensions);
      expect(await runCompare(join(root, "baseline"), join(root, "capture"))).toBe(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("promotion rejects without review and preserves the old baseline", async () => {
    const work = await mkdtemp(join(tmpdir(), "visual-promotion-"));
    const source = join(work, "source");
    const baselines = join(work, "baselines");
    await mkdir(source, { recursive: true });
    await mkdir(join(baselines, "fixture"), { recursive: true });
    await writeFile(join(baselines, "fixture", "old.png"), pixel);
    await writeFile(join(source, "001_frame.png"), pixel);
    await writeFile(join(source, "run.log"), "scenario completed\n");
    await writeFile(join(source, "trace.json"), JSON.stringify({ scenario_id: "fixture", passed: true, errors: [], events: [{ type: "capture", label: "frame" }] }));
    const result = Bun.spawnSync(["bash", "tools/ci/update-baseline.sh", "fixture", source], { cwd: join(import.meta.dir, "../.."), env: { ...process.env, BASELINE_DIR: baselines }, stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(1);
    expect(await readFile(join(baselines, "fixture", "old.png"))).toEqual(pixel);
    await rm(work, { recursive: true, force: true });
  });

  test("promotion rejects failed or wrong-scenario traces without changing the baseline", async () => {
    const work = await mkdtemp(join(tmpdir(), "visual-promotion-"));
    const source = join(work, "source");
    const baselines = join(work, "baselines");
    await mkdir(source, { recursive: true });
    await mkdir(join(baselines, "fixture"), { recursive: true });
    await writeFile(join(baselines, "fixture", "old.png"), pixel);
    await writeFile(join(source, "001_frame.png"), pixel);
    await writeFile(join(source, "run.log"), "scenario completed\n");
    for (const trace of [
      { scenario_id: "fixture", passed: false, errors: ["failed"], events: [] },
      { scenario_id: "other", passed: true, errors: [], events: [] },
    ]) {
      await writeFile(join(source, "trace.json"), JSON.stringify(trace));
      const result = Bun.spawnSync(["bash", "tools/ci/update-baseline.sh", "fixture", source, "--reviewed"], { cwd: join(import.meta.dir, "../.."), env: { ...process.env, BASELINE_DIR: baselines }, stdout: "pipe", stderr: "pipe" });
      expect(result.exitCode).toBe(1);
      expect(await readFile(join(baselines, "fixture", "old.png"))).toEqual(pixel);
    }
    await rm(work, { recursive: true, force: true });
  });

  test("reviewed promotion replaces the exact frame set and records provenance", async () => {
    const work = await mkdtemp(join(tmpdir(), "visual-promotion-"));
    const source = join(work, "source");
    const baselines = join(work, "baselines");
    await mkdir(source, { recursive: true });
    await mkdir(join(baselines, "fixture"), { recursive: true });
    await writeFile(join(baselines, "fixture", "stale.png"), pixel);
    await writeFile(join(source, "001_frame.png"), pixel);
    await writeFile(join(source, "run.log"), "scenario completed\n");
    await writeFile(join(source, "trace.json"), JSON.stringify({ scenario_id: "fixture", passed: true, errors: [], engine_version: "pending", renderer: "pending", events: [{ type: "capture", label: "frame" }] }));
    const status_file = join(work, "promotion-status");
    const stdout_file = join(work, "promotion-stdout");
    const stderr_file = join(work, "promotion-stderr");
    const result = Bun.spawnSync(["/bin/bash", "-c", `tools/ci/update-baseline.sh fixture "$1" --reviewed > "$3" 2> "$4"; status=$?; printf '%s' "$status" > "$2"; exit 0`, "update-baseline-test", source, status_file, stdout_file, stderr_file], { cwd: join(import.meta.dir, "../.."), env: { ...process.env, BASELINE_DIR: baselines }, stdout: "ignore", stderr: "ignore" });
    expect(result.exitCode).toBe(0);
    const promotionStatus = await readFile(status_file, "utf8");
    if (promotionStatus !== "0") throw new Error(`update-baseline child exit ${promotionStatus}\nstdout:\n${await readFile(stdout_file, "utf8")}\nstderr:\n${await readFile(stderr_file, "utf8")}`);
    expect(await readFile(join(baselines, "fixture", "001_frame.png"))).toEqual(pixel);
    expect(await Bun.file(join(baselines, "fixture", "stale.png")).exists()).toBe(false);
    expect(await readFile(join(baselines, "fixture", "provenance.json"), "utf8")).toContain("engine_version");
    await rm(work, { recursive: true, force: true });
  });
});
