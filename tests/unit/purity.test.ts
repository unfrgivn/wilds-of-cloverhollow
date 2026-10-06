import { describe, expect, it } from "vitest";
import { importErrors, stripComments } from "../../tools/purity";

describe("purity scan comment stripping", () => {
  it("blanks line and block comments but keeps code and line numbers", () => {
    const source = "/** a ** b, Date */\nconst x = 1; // performance\nconst y = x * 2;";
    const stripped = stripComments(source);
    expect(stripped).not.toMatch(/\*\*|Date|performance/);
    expect(stripped).toContain("const x = 1;");
    expect(stripped).toContain("const y = x * 2;");
    expect(stripped.split("\n")).toHaveLength(3);
  });

  it("keeps comment markers that appear inside strings", () => {
    const source = 'const url = "http://x"; const pow = 2 ** 3;';
    expect(stripComments(source)).toBe(source);
  });

  it("allows only the Ink adapter package import", () => {
    expect(importErrors("src/core/ink.ts", 'import { Story } from "inkjs";')).toEqual([]);
    expect(importErrors("src/core/sim.ts", 'import "inkjs";')).toHaveLength(1);
    expect(importErrors("src/core/sim.ts", 'const x = import("inkjs");')).toHaveLength(1);
    expect(importErrors("src/core/sim.ts", 'import x from "../render/view";')).toHaveLength(1);
  });
});
