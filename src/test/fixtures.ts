// Answers of the backend as it sends them, for the tests

import type {
  Accounts,
  ApiUsage,
  Audience,
  Favorites,
  GtfsImport,
  LineTraffic,
  Network,
  Quotas,
  Sites,
  Status,
  SystemInfo,
} from "../api/types";

/** An unsigned JWT with these claims (the page reads them, the backend checks them) */
export function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

export const adminJwt = () => jwt({ sub: "google:123", auth: ["ROLE_ADMIN"], exp: Math.floor(Date.now() / 1000) + 3600 });
export const userJwt = () => jwt({ sub: "google:456", auth: ["ROLE_USER"], exp: Math.floor(Date.now() / 1000) + 3600 });

export const gtfsImport: GtfsImport = {
  id: 12,
  source: "WATCH",
  feedDate: "2026-10-13T06:00:00Z",
  startedAt: "2026-10-13T06:10:00Z",
  finishedAt: "2026-10-13T06:14:30Z",
  status: "SUCCESS",
  rowCounts: "agency=40, routes=1900, stop_times=12000000, stops=54000, trips=450000",
  error: null,
};

export const status = (): Status => ({
  now: new Date().toISOString(),
  startedAt: "2026-10-12T08:00:00Z",
  quotas: [
    {
      api: "STOP_MONITORING",
      used: 12_000,
      limit: 900_000,
      guestUsed: 1_000,
      guestLimit: 150_000,
      primUsed: 15_000,
      primLimit: 1_000_000,
      primObservedAt: new Date().toISOString(),
    },
    {
      api: "ESTIMATED_TIMETABLE",
      used: 1_300,
      limit: 1_350,
      guestUsed: 10,
      guestLimit: 225,
      primUsed: null,
      primLimit: null,
      primObservedAt: null,
    },
    { api: "NAVITIA", used: 300, limit: 18_000, guestUsed: 20, guestLimit: 3_000, primUsed: null, primLimit: null, primObservedAt: null },
    {
      api: "DISRUPTIONS_BULK",
      used: 200,
      limit: 16_200,
      guestUsed: 0,
      guestLimit: 2_700,
      primUsed: null,
      primLimit: null,
      primObservedAt: null,
    },
  ],
  features: [
    { feature: "DEPARTURES", api: "STOP_MONITORING", calls: 12_000, guestCalls: 1_000 },
    { feature: "JOURNEYS", api: "NAVITIA", calls: 250, guestCalls: 20 },
  ],
  prim: [
    { api: "STOP_MONITORING", state: "CLOSED", failures: 0, openUntil: null, lastFailureAt: null, lastError: null },
    {
      api: "NAVITIA",
      state: "OPEN",
      failures: 5,
      openUntil: new Date(Date.now() + 30_000).toISOString(),
      lastFailureAt: new Date().toISOString(),
      lastError: "503 Service Unavailable",
    },
  ],
  lastGtfsSuccess: gtfsImport,
  lastGtfsImport: gtfsImport,
  gtfsStale: false,
  trafficSnapshotAt: new Date().toISOString(),
  elevatorsSnapshotAt: null,
});

export const accounts = (): Accounts => ({
  counts: {
    total: 42,
    admins: 1,
    activeToday: 5,
    active7Days: 17,
    active30Days: 30,
    new7Days: 3,
    new30Days: 9,
    withSession: 25,
    apiTokens: 2,
    apiTokensUsed7Days: 1,
  },
  signUps: [{ day: new Date().toISOString().slice(0, 10), count: 2 }],
  activePerDay: [],
  lastSignIns: [{ group: "today", count: 5 }],
  favoritesPerAccount: [{ group: "0", count: 20 }],
});

export const favorites = (): Favorites => ({
  total: 60,
  accounts: 22,
  perKind: [{ group: "STOP", count: 30 }],
  stops: [{ id: "IDFM:71264", name: "Châtelet", count: 8 }],
  lines: [{ line: { id: "C01371", name: "1", longName: "Métro 1", mode: "METRO", color: "FFCD00", textColor: "000000" }, count: 6 }],
  created: [],
});

export const quotas = (): Quotas => ({
  apis: status().quotas.map((quota) => ({
    api: quota.api,
    perDay: Math.round(quota.limit / 0.9),
    limit: quota.limit,
    guestLimit: quota.guestLimit,
  })),
  days: [{ day: new Date().toISOString().slice(0, 10), feature: "DEPARTURES", api: "STOP_MONITORING", calls: 12_000, guestCalls: 1_000 }],
});

export const system = (): SystemInfo => ({
  java: "25.0.1+8",
  springBoot: "4.1.1",
  builtAt: "2026-10-12T07:00:00Z",
  startedAt: "2026-10-12T08:00:00Z",
  uptimeSeconds: 100_000,
  processors: 4,
  processCpu: 0.05,
  systemCpu: 0.2,
  loadAverage: 0.8,
  heapUsed: 500 * 1024 ** 2,
  heapMax: 2 * 1024 ** 3,
  nonHeapUsed: 200 * 1024 ** 2,
  memoryTotal: 8 * 1024 ** 3,
  memoryFree: 3 * 1024 ** 3,
  threads: 60,
  peakThreads: 90,
  gcCount: 300,
  gcMillis: 4_000,
  diskFree: 40 * 1024 ** 3,
  diskTotal: 100 * 1024 ** 3,
});

export const sites = (): Sites => ({
  checkedAt: new Date().toISOString(),
  sites: [
    {
      url: "https://guillaumedamiens.com/",
      status: 200,
      millis: 80,
      certificateExpiry: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      error: null,
    },
    {
      url: "https://app.guillaumedamiens.com/",
      status: 200,
      millis: 95,
      certificateExpiry: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      error: null,
    },
  ],
});

export const network = (): Network => ({
  linesPerMode: { METRO: 16, RER: 5, BUS: 1500 },
  stopAreas: 15_000,
  quays: 40_000,
  calendar: { from: "2026-10-01", until: "2026-12-31" },
  publishedVersion: "2026-10-13T06:00:00Z",
  importedVersion: "2026-10-13T06:00:00Z",
  database: { bytes: 4 * 1024 ** 3, postgres: "18.0 (Debian 18.0-1)", postgis: "3.6.0", connections: 7 },
  tables: [{ schema: "gtfs", name: "stop_times", bytes: 2 * 1024 ** 3, rows: 12_000_000 }],
});

export const traffic = (): LineTraffic[] => [
  {
    line: { id: "C01742", name: "A", longName: "RER A", mode: "RER", color: "EB2132", textColor: "FFFFFF" },
    severity: "BLOCKING",
    titles: ["Trafic interrompu entre Nanterre et La Défense"],
  },
  {
    line: { id: "C01371", name: "1", longName: "Métro 1", mode: "METRO", color: "FFCD00", textColor: "000000" },
    severity: null,
    titles: [],
  },
];

export const imports = (): GtfsImport[] => [gtfsImport];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

export const audience = (): Audience => ({
  metrics: [
    { day: today(), metric: "active:account", count: 4 },
    { day: today(), metric: "active:guest", count: 11 },
    { day: today(), metric: "platform:android", count: 9 },
    { day: today(), metric: "platform:web", count: 6 },
    { day: today(), metric: "version:0.5.0", count: 8 },
    { day: today(), metric: "version:dev", count: 1 },
    { day: today(), metric: "visitors:guillaumedamiens.com", count: 23 },
    { day: today(), metric: "visitors:app.guillaumedamiens.com", count: 5 },
  ],
  viewsPerDay: [{ day: today(), host: "guillaumedamiens.com", views: 41 }],
  pages: [{ host: "guillaumedamiens.com", path: "/photos", views: 17 }],
  referrers: [{ host: "guillaumedamiens.com", referrer: "linkedin.com", views: 6 }],
  pagesReadAt: new Date().toISOString(),
});

export const apiUsage = (): ApiUsage => ({
  perHour: [
    {
      hour: new Date(Date.now() - 3_600_000).toISOString(),
      requests: 1200,
      clientErrors: 30,
      serverErrors: 2,
      rateLimited: 5,
      totalMillis: 96_000,
    },
  ],
  endpoints: [
    {
      endpoint: "GET /api/v2/stops/{stopAreaId}/departures",
      requests: 800,
      clientErrors: 10,
      serverErrors: 2,
      rateLimited: 3,
      totalMillis: 64_000,
      maxMillis: 900,
    },
  ],
  callers: [{ day: today(), caller: "GUEST", requests: 700 }],
});
