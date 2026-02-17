import { describe, expect, it } from "vitest";

import { presetDates, utcClockToBogotaLabel } from "./date";

describe("utcClockToBogotaLabel", () => {
  it("convierte UTC a COT (UTC-5)", () => {
    expect(utcClockToBogotaLabel("14:02:45 UTC")).toBe("09:02:45 COT");
  });

  it("devuelve marcador para valor vacio", () => {
    expect(utcClockToBogotaLabel("")).toBe("--");
    expect(utcClockToBogotaLabel(undefined)).toBe("--");
  });
});

describe("presetDates", () => {
  it("calcula YTD con referencia fija", () => {
    const ref = new Date("2026-02-17T12:00:00Z");
    const out = presetDates("YTD", ref);
    expect(out.startDate).toBe("2026-01-01");
    expect(out.endDate).toBe("2026-02-17");
  });

  it("calcula MAX en 1990", () => {
    const ref = new Date("2026-02-17T12:00:00Z");
    const out = presetDates("MAX", ref);
    expect(out.startDate).toBe("1990-01-01");
    expect(out.endDate).toBe("2026-02-17");
  });
});
