// Answers of the backend's admin endpoints (website-back: AdminController, AdminStatsController, GtfsController) and
// of the mobility API used here. Instants are ISO strings, days ISO dates (Paris days).

export type PrimApi = "STOP_MONITORING" | "ESTIMATED_TIMETABLE" | "NAVITIA" | "DISRUPTIONS_BULK";
export type Feature = "DEPARTURES" | "VEHICLES" | "JOURNEYS" | "WALKING_PATHS" | "PLACES" | "TRAFFIC";
export type TransportMode = "BUS" | "NOCTILIEN" | "METRO" | "TRAM" | "TER" | "TRANSILIEN" | "RER";

export interface QuotaUsage {
  api: PrimApi;
  used: number;
  limit: number;
  guestUsed: number;
  guestLimit: number;
  primUsed: number | null;
  primLimit: number | null;
  primObservedAt: string | null;
}

export interface FeatureUsage {
  feature: Feature;
  api: PrimApi;
  calls: number;
  guestCalls: number;
}

export interface CircuitStatus {
  api: PrimApi;
  state: "CLOSED" | "OPEN" | "TRIAL";
  failures: number;
  openUntil: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

export interface GtfsImport {
  id: number;
  source: "WATCH" | "MANUAL";
  feedDate: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  /** "agency=12, calendar=345, …" */
  rowCounts: string | null;
  error: string | null;
}

export interface Status {
  now: string;
  startedAt: string;
  quotas: QuotaUsage[];
  features: FeatureUsage[];
  prim: CircuitStatus[];
  lastGtfsSuccess: GtfsImport | null;
  lastGtfsImport: GtfsImport | null;
  gtfsStale: boolean;
  trafficSnapshotAt: string | null;
  elevatorsSnapshotAt: string | null;
}

export interface DayCount {
  day: string;
  count: number;
}

export interface GroupCount {
  group: string;
  count: number;
}

export interface Accounts {
  counts: {
    total: number;
    admins: number;
    activeToday: number;
    active7Days: number;
    active30Days: number;
    new7Days: number;
    new30Days: number;
    withSession: number;
    apiTokens: number;
    apiTokensUsed7Days: number;
  };
  signUps: DayCount[];
  activePerDay: DayCount[];
  lastSignIns: GroupCount[];
  favoritesPerAccount: GroupCount[];
}

export interface LineSummary {
  id: string;
  name: string;
  longName: string | null;
  mode: TransportMode | null;
  color: string | null;
  textColor: string | null;
}

export interface Favorites {
  total: number;
  accounts: number;
  perKind: GroupCount[];
  stops: { id: string; name: string | null; count: number }[];
  lines: { line: LineSummary; count: number }[];
  created: DayCount[];
}

export interface QuotaDay {
  day: string;
  feature: Feature;
  api: PrimApi;
  calls: number;
  guestCalls: number;
}

export interface Quotas {
  apis: { api: PrimApi; perDay: number; limit: number; guestLimit: number }[];
  days: QuotaDay[];
}

export interface TableSize {
  schema: string;
  name: string;
  bytes: number;
  rows: number;
}

export interface Network {
  linesPerMode: Partial<Record<TransportMode, number>>;
  stopAreas: number;
  quays: number;
  calendar: { from: string | null; until: string | null };
  publishedVersion: string | null;
  importedVersion: string | null;
  database: { bytes: number; postgres: string; postgis: string | null; connections: number };
  tables: TableSize[];
}

export interface SystemInfo {
  java: string;
  springBoot: string;
  builtAt: string | null;
  startedAt: string;
  uptimeSeconds: number;
  processors: number;
  processCpu: number | null;
  systemCpu: number | null;
  loadAverage: number | null;
  heapUsed: number;
  heapMax: number;
  nonHeapUsed: number;
  memoryTotal: number | null;
  memoryFree: number | null;
  threads: number;
  peakThreads: number;
  gcCount: number;
  gcMillis: number;
  diskFree: number;
  diskTotal: number;
}

export interface SiteCheck {
  url: string;
  status: number | null;
  millis: number | null;
  certificateExpiry: string | null;
  error: string | null;
}

export interface Sites {
  checkedAt: string;
  sites: SiteCheck[];
}

export type Severity = "INFO" | "DISRUPTED" | "BLOCKING";

export interface LineTraffic {
  line: LineSummary;
  severity: Severity | null;
  titles: string[];
}

export interface Account {
  email: string | null;
  firstName: string | null;
  role: string;
  google: boolean;
  createdAt: string;
}

export interface ActionResult {
  at: string;
  count: number | null;
}
