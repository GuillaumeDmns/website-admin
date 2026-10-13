import type { GtfsImport, LineTraffic, Network, Status } from "../api/types";
import { BarChart, HBars } from "../components/charts";
import { Grid, Kpi, LineBadge, Load, Note, PageTitle, Section, StatusBadge, Table } from "../components/ui";
import { useApi } from "../data";
import {
  bytes,
  compact,
  dateTime,
  daysBetween,
  duration,
  longDay,
  number,
  oneDecimal,
  parisDate,
  relative,
  shortDay,
  time,
} from "../format";
import { importSeconds, MODE_LABELS, MODES, parseRowCounts, SEVERITY_LABELS, sum, type Tone } from "../stats";
import styles from "./pages.module.css";

const IMPORT_TONES: Record<GtfsImport["status"], Tone> = { SUCCESS: "ok", RUNNING: "warn", FAILED: "bad" };
const IMPORT_LABELS: Record<GtfsImport["status"], string> = { SUCCESS: "Réussi", RUNNING: "En cours", FAILED: "Échoué" };

/** The GTFS in use and its imports, the traffic now, the database */
export default function NetworkPage() {
  const network = useApi<Network>("/api/admin/stats/network");
  const imports = useApi<GtfsImport[]>("/api/gtfs/imports?limit=30");
  const status = useApi<Status>("/api/admin/status");
  const traffic = useApi<LineTraffic[]>("/api/v2/traffic");

  return (
    <>
      <PageTitle title="Réseau">
        Le GTFS d'Île-de-France Mobilités en service (importé quand IDFM en publie un nouveau, vérifié tous les quarts d'heure), l'info
        trafic du moment et la base de données.
      </PageTitle>

      <Section title="GTFS" id="gtfs">
        <Load resource={network} label="du réseau">
          {(data) => {
            const upToDate =
              !data.publishedVersion || !data.importedVersion || Date.parse(data.importedVersion) >= Date.parse(data.publishedVersion);
            const daysLeft = data.calendar.until ? daysBetween(parisDate(), data.calendar.until) : null;
            const lines = sum(Object.values(data.linesPerMode));
            return (
              <>
                <Grid>
                  <Kpi
                    label="Version importée"
                    value={data.importedVersion ? shortDay(parisDate(Date.parse(data.importedVersion))) : "Aucune"}
                    tone={upToDate ? undefined : "warn"}
                    detail={
                      upToDate
                        ? `publiée à ${time(data.importedVersion).slice(0, 5)}, la dernière`
                        : `une version plus récente attend : ${dateTime(data.publishedVersion)}`
                    }
                  />
                  <Kpi
                    label="Horaires"
                    value={daysLeft !== null ? `${number(daysLeft)} jours` : "—"}
                    tone={daysLeft !== null && daysLeft < 7 ? "warn" : undefined}
                    detail={data.calendar.until ? `jusqu'au ${longDay(data.calendar.until)}` : undefined}
                  />
                  <Kpi label="Lignes" value={number(lines)} />
                  <Kpi label="Zones d'arrêt" value={number(data.stopAreas)} detail={`${number(data.quays)} quais`} />
                </Grid>
                <div className={styles.columns}>
                  <div className={styles.block}>
                    <h3>Lignes par mode</h3>
                    <HBars rows={MODES.map((mode) => ({ key: mode, label: MODE_LABELS[mode], value: data.linesPerMode[mode] ?? 0 }))} />
                  </div>
                  <Load resource={imports} label="des imports">
                    {(list) => {
                      const last = list.find((entry) => entry.status === "SUCCESS");
                      return (
                        <div className={styles.block}>
                          <h3>Lignes par fichier (dernier import réussi)</h3>
                          {last ? (
                            <HBars
                              format={compact}
                              rows={parseRowCounts(last.rowCounts)
                                .sort((a, b) => b[1] - a[1])
                                .map(([table, count]) => ({ key: table, label: table, value: count }))}
                            />
                          ) : (
                            <Note>Aucun import réussi.</Note>
                          )}
                        </div>
                      );
                    }}
                  </Load>
                </div>
              </>
            );
          }}
        </Load>
      </Section>

      <Section title="Imports" id="imports">
        <Load resource={imports} label="des imports">
          {(list) => {
            const done = [...list].reverse().filter((entry) => entry.status === "SUCCESS");
            return (
              <>
                {done.length > 1 && (
                  <BarChart
                    title="Durée des imports réussis (minutes)"
                    labels={done.map((entry) => shortDay(parisDate(Date.parse(entry.startedAt))))}
                    series={[
                      { label: "Durée (min)", values: done.map((entry) => Math.round(((importSeconds(entry) ?? 0) / 60) * 10) / 10) },
                    ]}
                    format={oneDecimal}
                    height={120}
                  />
                )}
                <Table caption="Derniers imports GTFS">
                  <thead>
                    <tr>
                      <th scope="col">Début</th>
                      <th scope="col">Origine</th>
                      <th scope="col">Version</th>
                      <th scope="col">État</th>
                      <th scope="col" data-numeric>
                        Durée
                      </th>
                      <th scope="col" data-numeric>
                        Lignes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((entry) => {
                      const seconds = importSeconds(entry);
                      return (
                        <tr key={entry.id}>
                          <td>{dateTime(entry.startedAt)}</td>
                          <td>{entry.source === "WATCH" ? "Automatique" : "Manuel"}</td>
                          <td>{dateTime(entry.feedDate)}</td>
                          <td>
                            <StatusBadge tone={IMPORT_TONES[entry.status]}>{IMPORT_LABELS[entry.status]}</StatusBadge>
                            {entry.error && <div className={styles.error}>{entry.error}</div>}
                          </td>
                          <td data-numeric>{seconds === null ? relative(entry.startedAt) : duration(seconds)}</td>
                          <td data-numeric>
                            {entry.rowCounts ? compact(sum(parseRowCounts(entry.rowCounts).map(([, count]) => count))) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </>
            );
          }}
        </Load>
      </Section>

      <Section
        title="Info trafic"
        id="traffic"
        aside={
          status.data
            ? `Relevée ${relative(status.data.trafficSnapshotAt)}, ascenseurs ${relative(status.data.elevatorsSnapshotAt)}`
            : undefined
        }
      >
        <Load resource={traffic} label="l'info trafic">
          {(lines) => {
            const disrupted = lines.filter((line) => line.severity !== null);
            const count = (severity: string) => disrupted.filter((line) => line.severity === severity).length;
            const perMode = MODES.map((mode) => ({
              key: mode,
              label: MODE_LABELS[mode],
              value: disrupted.filter((line) => line.line.mode === mode && line.severity !== "INFO").length,
            })).filter((row) => row.value > 0);
            return (
              <>
                <Grid>
                  <Kpi
                    label={SEVERITY_LABELS.BLOCKING}
                    value={number(count("BLOCKING"))}
                    tone={count("BLOCKING") > 0 ? "bad" : undefined}
                    detail="lignes"
                  />
                  <Kpi
                    label={SEVERITY_LABELS.DISRUPTED}
                    value={number(count("DISRUPTED"))}
                    tone={count("DISRUPTED") > 0 ? "warn" : undefined}
                    detail="lignes"
                  />
                  <Kpi label={SEVERITY_LABELS.INFO} value={number(count("INFO"))} detail="lignes" />
                </Grid>
                {perMode.length > 0 && (
                  <div className={styles.block}>
                    <h3>Lignes perturbées ou interrompues par mode</h3>
                    <HBars rows={perMode} />
                  </div>
                )}
                <Table caption="Lignes perturbées">
                  <thead>
                    <tr>
                      <th scope="col">Ligne</th>
                      <th scope="col">État</th>
                      <th scope="col">Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disrupted
                      .filter((line) => line.severity !== "INFO")
                      .map((line) => (
                        <tr key={line.line.id}>
                          <td>
                            <LineBadge line={line.line} />
                          </td>
                          <td>
                            <StatusBadge tone={line.severity === "BLOCKING" ? "bad" : "warn"}>
                              {SEVERITY_LABELS[line.severity ?? "INFO"]}
                            </StatusBadge>
                          </td>
                          <td>
                            <ul className={styles.titles}>
                              {line.titles.map((title) => (
                                <li key={title}>{title}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </>
            );
          }}
        </Load>
        <Note>
          Une lecture de cette page peut coûter un appel disruptions_bulk si l'info trafic a plus de 3 minutes (partagée avec
          l'application).
        </Note>
      </Section>

      <Section title="Base de données" id="database">
        <Load resource={network} label="de la base">
          {(data) => (
            <>
              <Grid>
                <Kpi label="Taille" value={bytes(data.database.bytes)} />
                <Kpi
                  label="PostgreSQL"
                  value={data.database.postgres.split(" ")[0]}
                  detail={data.database.postgis ? `PostGIS ${data.database.postgis}` : "sans PostGIS"}
                />
                <Kpi label="Connexions" value={number(data.database.connections)} detail="ouvertes sur la base" />
              </Grid>
              <div className={styles.block}>
                <h3>Tables les plus grandes</h3>
                <HBars
                  format={bytes}
                  rows={data.tables.slice(0, 12).map((table) => ({
                    key: `${table.schema}.${table.name}`,
                    label: `${table.schema}.${table.name}`,
                    value: table.bytes,
                    hint: `environ ${number(table.rows)} lignes`,
                  }))}
                />
              </div>
            </>
          )}
        </Load>
      </Section>
    </>
  );
}
