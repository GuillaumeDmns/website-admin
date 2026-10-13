import type { QuotaDay } from "./api/types";
import {
  alerts,
  callsPerApi,
  callsPerFeature,
  cumulative,
  dayRange,
  fillDays,
  parseRowCounts,
  siteName,
  siteTone,
  usageTone,
} from "./stats";
import * as fixtures from "./test/fixtures";

const NOW = Date.parse("2026-10-13T12:00:00Z");

describe("stats", () => {
  it("lists the last days, oldest first", () => {
    expect(dayRange(3, "2026-10-01")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  });

  it("fills the days without a count with 0 and adds them up", () => {
    const days = dayRange(4, "2026-10-13");
    const values = fillDays(
      [
        { day: "2026-10-11", count: 2 },
        { day: "2026-10-13", count: 1 },
        { day: "2026-09-01", count: 9 },
      ],
      days,
    );
    expect(values).toEqual([0, 2, 0, 1]);
    expect(cumulative(values, 10)).toEqual([10, 12, 12, 13]);
  });

  it("spreads the PRIM calls per feature and per API", () => {
    const days = dayRange(2, "2026-10-13");
    const quotaDays: QuotaDay[] = [
      { day: "2026-10-12", feature: "DEPARTURES", api: "STOP_MONITORING", calls: 100, guestCalls: 10 },
      { day: "2026-10-13", feature: "JOURNEYS", api: "NAVITIA", calls: 5, guestCalls: 1 },
      { day: "2026-10-13", feature: "PLACES", api: "NAVITIA", calls: 2, guestCalls: 0 },
    ];
    expect(callsPerFeature(quotaDays, days).get("DEPARTURES")).toEqual([100, 0]);
    expect(callsPerFeature(quotaDays, days, true).get("JOURNEYS")).toEqual([0, 1]);
    expect(callsPerApi(quotaDays, days).get("NAVITIA")).toEqual([0, 7]);
  });

  it("reads the rows of an import", () => {
    expect(parseRowCounts("agency=40, stops=54000")).toEqual([
      ["agency", 40],
      ["stops", 54000],
    ]);
    expect(parseRowCounts(null)).toEqual([]);
  });

  it("names the sites by host, with their path", () => {
    expect(siteName("https://app.guillaumedamiens.com/")).toBe("app.guillaumedamiens.com");
    expect(siteName("https://guillaumedamiens.com/api/health")).toBe("guillaumedamiens.com/api/health");
  });

  it("colors a usage from 75 and 90 %", () => {
    expect(usageTone(0.5)).toBe("ok");
    expect(usageTone(0.8)).toBe("warn");
    expect(usageTone(0.95)).toBe("bad");
  });

  it("says nothing when all is well", () => {
    const status = fixtures.status();
    status.prim = status.prim.filter((circuit) => circuit.state === "CLOSED");
    status.quotas = status.quotas.filter((quota) => quota.api !== "ESTIMATED_TIMETABLE");
    expect(alerts({ status, system: fixtures.system(), sites: fixtures.sites().sites, network: fixtures.network() }, NOW)).toEqual([]);
  });

  it("raises what needs a look, worst first", () => {
    const status = { ...fixtures.status(), gtfsStale: true };
    const site = {
      url: "https://admin.guillaumedamiens.com/",
      status: null,
      millis: null,
      certificateExpiry: null,
      error: "ConnectException",
    };
    const expiring = {
      url: "https://guillaumedamiens.com/",
      status: 200,
      millis: 50,
      certificateExpiry: "2026-10-25T00:00:00Z",
      error: null,
    };
    const system = { ...fixtures.system(), diskFree: 2 * 1024 ** 3 };
    const network = { ...fixtures.network(), publishedVersion: "2026-10-13T06:00:00Z", importedVersion: "2026-10-12T06:00:00Z" };

    const found = alerts({ status, system, sites: [site, expiring], network }, NOW);

    expect(found.map((alert) => alert.tone)).toEqual(["bad", "bad", "bad", "bad", "warn", "warn", "warn"]);
    expect(found.map((alert) => alert.text)).toEqual([
      expect.stringContaining("Aucun import GTFS réussi"),
      expect.stringContaining("Calculateur (Navitia) ne répond plus : 503"),
      expect.stringContaining("Véhicules (estimated-timetable) : 96"),
      "admin.guillaumedamiens.com ne répond pas (ConnectException)",
      expect.stringContaining("Le certificat de guillaumedamiens.com expire dans 11 j"),
      "Moins de 6 Go libres sur le disque : l'import GTFS sera refusé",
      expect.stringContaining("n'est pas importée"),
    ]);
  });

  it("marks a site down, failing or with a certificate about to expire", () => {
    const site = fixtures.sites().sites[0];
    expect(siteTone(site)).toBe("ok");
    expect(siteTone({ ...site, status: 502 })).toBe("bad");
    expect(siteTone({ ...site, status: 404 })).toBe("warn");
    expect(siteTone({ ...site, certificateExpiry: new Date(Date.now() + 3 * 86_400_000).toISOString() })).toBe("bad");
  });
});
