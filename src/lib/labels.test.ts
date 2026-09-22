import { describe, expect, it } from "vitest";

import { dueInLabel } from "./labels";

describe("dueInLabel", () => {
  it("describes the distance to a due date in Spanish", () => {
    expect(dueInLabel(-3)).toBe("Venció hace 3 días");
    expect(dueInLabel(-1)).toBe("Venció ayer");
    expect(dueInLabel(0)).toBe("Vence hoy");
    expect(dueInLabel(1)).toBe("Vence mañana");
    expect(dueInLabel(6)).toBe("Vence en 6 días");
  });
});
