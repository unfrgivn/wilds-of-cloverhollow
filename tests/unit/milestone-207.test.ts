import { describe, expect, it } from "vitest";
import { journalControlsLines } from "../../src/ui/journal-options";

describe("Milestone 206: Journal OPTIONS Cozy Dash Controls Parity", () => {
  it("documents Cozy Dash (Shift) in keyboard primary controls alongside all 3 tools", () => {
    const allTools = { hasLantern: true, hasFlute: true, hasLasso: true };
    const none = { hasLantern: false, hasFlute: false, hasLasso: false };

    const full = journalControlsLines("keyboard", allTools);
    expect(full.primary).toBe(
      "Move: Arrows / WASD · Dash: Shift · Talk: Z · Journal: J · Mute: M",
    );
    expect(full.tools).toBe("Lantern: L · Flute: F · Lasso: R");

    const base = journalControlsLines("keyboard", none);
    expect(base.primary).toContain("Dash: Shift");
    expect(base.tools).toBe("");
  });

  it("documents Cozy Dash (B) in gamepad primary controls alongside all 3 tools", () => {
    const allTools = { hasLantern: true, hasFlute: true, hasLasso: true };
    const none = { hasLantern: false, hasFlute: false, hasLasso: false };

    const full = journalControlsLines("gamepad", allTools);
    expect(full.primary).toBe(
      "Move: Stick / D-Pad · Talk: A · Dash / Back: B · Journal: Y",
    );
    expect(full.tools).toBe("Lantern: X · Flute: RB · Lasso: LB · Photo / Guide: View");

    const base = journalControlsLines("gamepad", none);
    expect(base.primary).toContain("Dash / Back: B");
    expect(base.tools).toBe("Photo / Guide: View");
  });
});
