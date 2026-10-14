// French formatting of numbers, sizes, durations and dates. Days are ISO dates (Paris days), instants ISO strings.

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const preciseDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Paris" });
const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

export const number = (value: number) => integer.format(value);
export const compact = (value: number) => (Math.abs(value) < 10_000 ? integer.format(value) : compactFormat.format(value));
export const percent = (ratio: number) => percentFormat.format(ratio);
export const oneDecimal = (value: number) => decimal.format(value);
export const twoDecimals = (value: number) => preciseDecimal.format(value);

/** 1 234 567 890 → "1,1 Go" (powers of 1 024, French units) */
export function bytes(value: number): string {
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let size = value;
  let unit = 0;
  while (Math.abs(size) >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${unit === 0 ? integer.format(size) : decimal.format(size)} ${units[unit]}`;
}

/** 93 784 s → "1 j 2 h", 3 900 s → "1 h 5 min", 45 s → "45 s" */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes > 0) return `${minutes} min`;
  return `${s} s`;
}

/** "il y a 5 min", "dans 3 j" */
export function relative(instant: string | null | undefined, now: number = Date.now()): string {
  if (!instant) return "jamais";
  const seconds = (Date.parse(instant) - now) / 1000;
  if (Math.abs(seconds) < 45) return "à l'instant";
  return seconds < 0 ? `il y a ${duration(-seconds)}` : `dans ${duration(seconds)}`;
}

export const dateTime = (instant: string | null | undefined) => (instant ? dateTimeFormat.format(new Date(instant)) : "—");
export const time = (instant: string | null | undefined) => (instant ? timeFormat.format(new Date(instant)) : "—");

/** "2026-10-13" → "13 oct." */
export const shortDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));
/** "2026-10-13" → "mar. 13 octobre 2026" */
export const longDay = (day: string) => longDayFormat.format(new Date(`${day}T00:00:00Z`));

/** The Paris day of an instant, as an ISO date */
export const parisDate = (instant: Date | number = Date.now()) => parisDay.format(instant);

/** Whole days from one ISO date to another */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The ISO date [days] days after [day] */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
