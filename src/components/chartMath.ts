// Numbers of the charts (components/charts.tsx)

/** A round axis maximum above [value]: 1, 2, 2.5 or 5 times a power of ten */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * power) return step * power;
  }
  return 10 * power;
}

/** CSV of a table, values with a dot as decimal separator and semicolons between columns (French spreadsheets) */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((row) => row.map(cell).join(";")).join("\n");
}
