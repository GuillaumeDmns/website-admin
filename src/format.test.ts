import { addDays, bytes, compact, daysBetween, duration, parisDate, relative, shortDay } from "./format";

const nbsp = (text: string) => text.replace(/[\u202f\u00a0]/g, " ");

describe("format", () => {
  it("writes sizes in French units", () => {
    expect(bytes(512)).toBe("512 o");
    expect(nbsp(bytes(1536))).toBe("1,5 Ko");
    expect(nbsp(bytes(3.6 * 1024 ** 3))).toBe("3,6 Go");
  });

  it("writes durations with their two biggest units", () => {
    expect(duration(45)).toBe("45 s");
    expect(duration(3_900)).toBe("1 h 5 min");
    expect(duration(93_784)).toBe("1 j 2 h");
    expect(duration(2 * 86_400)).toBe("2 j");
  });

  it("tells how long ago or how long until", () => {
    const now = Date.parse("2026-10-13T12:00:00Z");
    expect(relative("2026-10-13T11:55:00Z", now)).toBe("il y a 5 min");
    expect(relative("2026-10-16T12:00:00Z", now)).toBe("dans 3 j");
    expect(relative("2026-10-13T11:59:50Z", now)).toBe("à l'instant");
    expect(relative(null, now)).toBe("jamais");
  });

  it("keeps small numbers whole and shortens big ones", () => {
    expect(nbsp(compact(9_999))).toBe("9 999");
    expect(nbsp(compact(123_456))).toBe("123,5 k");
  });

  it("counts Paris days", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-13", "2026-10-20")).toBe(7);
    expect(shortDay("2026-10-13")).toBe("13 oct.");
    // 23:30 UTC is already the next day in Paris
    expect(parisDate(Date.parse("2026-10-13T23:30:00Z"))).toBe("2026-10-14");
  });
});
