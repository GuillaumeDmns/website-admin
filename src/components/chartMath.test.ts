import { niceMax, toCsv } from "./chartMath";

describe("charts", () => {
  it("rounds the axis up to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(2_300)).toBe(2_500);
    expect(niceMax(41_000)).toBe(50_000);
  });

  it("exports CSV for French spreadsheets", () => {
    expect(
      toCsv(
        ["", "Appels"],
        [
          ["13 oct.", 12],
          ['a;"b"', 3],
        ],
      ),
    ).toBe(';Appels\n13 oct.;12\n"a;""b""";3');
  });
});
