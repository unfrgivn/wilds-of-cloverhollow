import { describe, expect, it } from "vitest";
import { stripComments } from "../../tools/purity";

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
});
