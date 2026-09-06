import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repo = join(import.meta.dir, "../..");

async function runCaptured(root: string, command: string, env: Record<string, string | undefined>): Promise<{ status: number; stdout: string; stderr: string }> {
  const stdoutPath = join(root, "stdout");
  const stderrPath = join(root, "stderr");
  const statusPath = join(root, "status");
  Bun.spawnSync(["bash", "-c", `${command} > "$1" 2> "$2"; status=$?; printf '%s' "$status" > "$3"; exit 0`, "renderer-test", stdoutPath, stderrPath, statusPath], { cwd: repo, env: { ...process.env, ...env }, stdout: "ignore", stderr: "ignore" });
  return { status: Number(await readFile(statusPath, "utf8")), stdout: await readFile(stdoutPath, "utf8"), stderr: await readFile(stderrPath, "utf8") };
}

describe("rendering compatibility override", () => {
  test("rejects an unsupported override before starting Godot", async () => {
    const root = await mkdtemp(join(tmpdir(), "renderer-method-"));
    try {
      const result = await runCaptured(root, "bash tools/ci/run-godot-isolated.sh --headless --quit-after 1", { GODOT_ISOLATION_ROOT: join(root, "isolation"), GODOT_RENDERING_METHOD: "not-a-renderer" });
      if (result.status !== 2) throw new Error(`invalid renderer override exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      expect(result.stderr).toContain("unsupported GODOT_RENDERING_METHOD");
      expect(result.stderr).not.toContain("Godot Engine");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("records the compatibility method from a real rendered run", { timeout: 120_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), "renderer-method-"));
    const capture = join(root, "capture");
    await mkdir(capture, { recursive: true });
    try {
      const result = await runCaptured(root, "bash tools/ci/run-scenario-rendered.sh renderer_compatibility_smoke", { GODOT_ISOLATION_ROOT: join(root, "isolation"), GODOT_RENDERING_METHOD: "gl_compatibility", CAPTURE_DIR: capture, SEED: "228", QUIT_AFTER_FRAMES: "120" });
      if (result.status !== 0) throw new Error(`compatibility renderer scenario failed (exit ${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      const trace: unknown = JSON.parse(await readFile(join(capture, "trace.json")));
      if (!isRecord(trace)) throw new Error("renderer compatibility trace is not an object");
      expect(trace.rendering_method).toBe("gl_compatibility");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
