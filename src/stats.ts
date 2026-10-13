// What the pages compute from the backend's answers: series per day, totals, labels, and the alerts of the overview.

import type {
  DayCount,
  Feature,
  GtfsImport,
  Network,
  PrimApi,
  QuotaDay,
  Severity,
  SiteCheck,
  Status,
  SystemInfo,
  TransportMode,
} from "./api/types";
import { addDays, daysBetween, parisDate, percent, relative } from "./format";

export const FEATURES: { feature: Feature; label: string }[] = [
  { feature: "DEPARTURES", label: "Départs" },
  { feature: "VEHICLES", label: "Véhicules" },
  { feature: "JOURNEYS", label: "Itinéraires" },
  { feature: "WALKING_PATHS", label: "Trajets à pied (Vélib)" },
  { feature: "PLACES", label: "Lieux (Navitia)" },
  { feature: "TRAFFIC", label: "Info trafic" },
];

export const API_LABELS: Record<PrimApi, string> = {
  STOP_MONITORING: "Prochains passages (stop-monitoring)",
  ESTIMATED_TIMETABLE: "Véhicules (estimated-timetable)",
  NAVITIA: "Calculateur (Navitia)",
  DISRUPTIONS_BULK: "Info trafic (disruptions_bulk)",
};

export const MODE_LABELS: Record<TransportMode, string> = {
  METRO: "Métro",
  RER: "RER",
  TRANSILIEN: "Transilien",
  TER: "TER",
  TRAM: "Tram",
  BUS: "Bus",
  NOCTILIEN: "Noctilien",
};

export const MODES: TransportMode[] = ["METRO", "RER", "TRANSILIEN", "TER", "TRAM", "BUS", "NOCTILIEN"];

export const FAVORITE_KINDS: { group: string; label: string }[] = [
  { group: "STOP", label: "Arrêts" },
  { group: "LINE", label: "Lignes" },
  { group: "PLACE", label: "Lieux" },
  { group: "HOME", label: "Domicile" },
  { group: "WORK", label: "Travail" },
];

export const LAST_SIGN_INS: { group: string; label: string }[] = [
  { group: "today", label: "Aujourd'hui" },
  { group: "7d", label: "7 derniers jours" },
  { group: "30d", label: "30 derniers jours" },
  { group: "90d", label: "90 derniers jours" },
  { group: "older", label: "Plus ancienne" },
  { group: "never", label: "Jamais" },
];

export const FAVORITES_PER_ACCOUNT: { group: string; label: string }[] = [
  { group: "0", label: "Aucun" },
  { group: "1", label: "1" },
  { group: "2-4", label: "2 à 4" },
  { group: "5-9", label: "5 à 9" },
  { group: "10+", label: "10 et plus" },
];

export const SEVERITY_LABELS: Record<Severity, string> = {
  BLOCKING: "Interrompu",
  DISRUPTED: "Perturbé",
  INFO: "Information",
};

/** The [count] last Paris days, oldest first, ending [today] */
export function dayRange(count: number, today: string = parisDate()): string[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

/** Counts of [days], 0 for the days without one */
export function fillDays(counts: DayCount[], days: string[]): number[] {
  const byDay = new Map(counts.map((entry) => [entry.day, entry.count]));
  return days.map((day) => byDay.get(day) ?? 0);
}

/** Running total, starting from [start] */
export function cumulative(values: number[], start = 0): number[] {
  let total = start;
  return values.map((value) => (total += value));
}

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Calls per day of each feature (guests' calls only with [guests]) */
export function callsPerFeature(quotaDays: QuotaDay[], days: string[], guests = false): Map<Feature, number[]> {
  const index = new Map(days.map((day, position) => [day, position]));
  const series = new Map<Feature, number[]>(FEATURES.map(({ feature }) => [feature, days.map(() => 0)]));
  for (const entry of quotaDays) {
    const position = index.get(entry.day);
    const values = series.get(entry.feature);
    if (position !== undefined && values) {
      values[position] += guests ? entry.guestCalls : entry.calls;
    }
  }
  return series;
}

/** Calls per day of each PRIM API */
export function callsPerApi(quotaDays: QuotaDay[], days: string[]): Map<PrimApi, number[]> {
  const index = new Map(days.map((day, position) => [day, position]));
  const series = new Map<PrimApi, number[]>();
  for (const entry of quotaDays) {
    const position = index.get(entry.day);
    if (position === undefined) continue;
    const values = series.get(entry.api) ?? days.map(() => 0);
    values[position] += entry.calls;
    series.set(entry.api, values);
  }
  return series;
}

/** "agency=12, calendar=345" → [["agency", 12], ["calendar", 345]] */
export function parseRowCounts(rowCounts: string | null): [string, number][] {
  if (!rowCounts) return [];
  return rowCounts
    .split(",")
    .map((part) => part.trim().split("="))
    .filter((pair): pair is [string, string] => pair.length === 2 && pair[0] !== "")
    .map(([table, count]) => [table, Number(count)]);
}

/** Seconds an import took, null while running */
export function importSeconds(gtfsImport: GtfsImport): number | null {
  if (!gtfsImport.finishedAt) return null;
  return (Date.parse(gtfsImport.finishedAt) - Date.parse(gtfsImport.startedAt)) / 1000;
}

/** "https://app.guillaumedamiens.com/" → "app.guillaumedamiens.com", the path kept when there is one */
export function siteName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return url;
  }
}

export type Tone = "ok" | "warn" | "bad";

/** warn from 75 %, bad from 90 % */
export function usageTone(ratio: number): Tone {
  return ratio >= 0.9 ? "bad" : ratio >= 0.75 ? "warn" : "ok";
}

/** Days before a certificate expires; certbot renews 30 days before */
export function certificateTone(expiry: string, now = Date.now()): Tone {
  const days = (Date.parse(expiry) - now) / 86_400_000;
  return days < 7 ? "bad" : days < 21 ? "warn" : "ok";
}

export function siteTone(site: SiteCheck): Tone {
  if (site.status === null || site.status >= 500) return "bad";
  if (site.status >= 400) return "warn";
  if (site.certificateExpiry) return certificateTone(site.certificateExpiry);
  return "ok";
}

export interface Alert {
  tone: "warn" | "bad";
  text: string;
  /** The page that tells more */
  to: string;
}

/** The GTFS import refuses to start under this much free disk (application.gtfs.min-free-disk-gb) */
export const GTFS_MIN_FREE_DISK = 6 * 1024 ** 3;

/** What needs a look, worst first */
export function alerts(
  { status, system, sites, network }: { status?: Status; system?: SystemInfo; sites?: SiteCheck[]; network?: Network },
  now = Date.now(),
): Alert[] {
  const found: Alert[] = [];
  if (status) {
    if (status.gtfsStale) {
      found.push({
        tone: "bad",
        text: `Aucun import GTFS réussi depuis plus de 26 h (dernier : ${relative(status.lastGtfsSuccess?.finishedAt, now)})`,
        to: "/network",
      });
    }
    if (status.lastGtfsImport?.status === "FAILED") {
      found.push({
        tone: "warn",
        text: `Le dernier import GTFS a échoué : ${status.lastGtfsImport.error ?? "erreur inconnue"}`,
        to: "/network",
      });
    }
    for (const circuit of status.prim) {
      if (circuit.state === "OPEN") {
        found.push({ tone: "bad", text: `${API_LABELS[circuit.api]} ne répond plus : ${circuit.lastError ?? "erreur"}`, to: "/system" });
      } else if (circuit.state === "TRIAL") {
        found.push({ tone: "warn", text: `${API_LABELS[circuit.api]} : nouvel essai après des échecs`, to: "/system" });
      }
    }
    for (const quota of status.quotas) {
      const ratio = quota.limit > 0 ? quota.used / quota.limit : 0;
      const tone = usageTone(ratio);
      if (tone !== "ok") {
        found.push({ tone, text: `${API_LABELS[quota.api]} : ${percent(ratio)} du quota utilisable aujourd'hui`, to: "/usage" });
      }
      if (quota.guestLimit > 0 && quota.guestUsed / quota.guestLimit >= 0.9) {
        found.push({ tone: "warn", text: `${API_LABELS[quota.api]} : la part des invités est presque épuisée`, to: "/usage" });
      }
    }
  }
  for (const site of sites ?? []) {
    const name = siteName(site.url);
    if (site.status === null) {
      found.push({ tone: "bad", text: `${name} ne répond pas${site.error ? ` (${site.error})` : ""}`, to: "/system" });
    } else if (site.status >= 400) {
      found.push({ tone: site.status >= 500 ? "bad" : "warn", text: `${name} répond ${site.status}`, to: "/system" });
    }
    if (site.certificateExpiry) {
      const tone = certificateTone(site.certificateExpiry, now);
      if (tone !== "ok") {
        found.push({ tone, text: `Le certificat de ${name} expire ${relative(site.certificateExpiry, now)}`, to: "/system" });
      }
    }
  }
  if (system) {
    if (system.diskFree < GTFS_MIN_FREE_DISK) {
      found.push({ tone: "warn", text: "Moins de 6 Go libres sur le disque : l'import GTFS sera refusé", to: "/system" });
    }
    if (system.heapMax > 0 && system.heapUsed / system.heapMax >= 0.9) {
      found.push({ tone: "warn", text: `Mémoire de la JVM : ${percent(system.heapUsed / system.heapMax)} utilisée`, to: "/system" });
    }
  }
  if (network) {
    const today = parisDate(now);
    if (network.calendar.until && daysBetween(today, network.calendar.until) < 7) {
      found.push({
        tone: "warn",
        text: `Les horaires du GTFS s'arrêtent ${relative(`${network.calendar.until}T23:59:59Z`, now)}`,
        to: "/network",
      });
    }
    if (
      network.publishedVersion &&
      network.importedVersion &&
      Date.parse(network.publishedVersion) > Date.parse(network.importedVersion) &&
      now - Date.parse(network.publishedVersion) > 2 * 3_600_000
    ) {
      found.push({
        tone: "warn",
        text: `Une version du GTFS publiée ${relative(network.publishedVersion, now)} n'est pas importée`,
        to: "/network",
      });
    }
  }
  return found.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));
}
