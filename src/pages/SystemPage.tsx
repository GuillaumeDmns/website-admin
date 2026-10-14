import type { Sites, Status, SystemInfo } from "../api/types";
import { Grid, Kpi, Load, Meter, Note, PageTitle, Section, StatusBadge, Table } from "../components/ui";
import { useApi } from "../data";
import { bytes, dateTime, duration, number, parisDate, percent, relative, shortDay, time, twoDecimals } from "../format";
import { API_LABELS, certificateTone, GTFS_MIN_FREE_DISK, siteName, siteTone } from "../stats";
import styles from "./pages.module.css";

const CIRCUIT_LABELS = { CLOSED: "Répond", OPEN: "Coupé", TRIAL: "Nouvel essai" } as const;

/** The backend's machine and JVM, its PRIM circuit breakers, and the public pages */
export default function SystemPage() {
  const system = useApi<SystemInfo>("/api/admin/stats/system");
  const status = useApi<Status>("/api/admin/status");
  const sites = useApi<Sites>("/api/admin/stats/sites");

  return (
    <>
      <PageTitle title="Système">Le serveur (VPS), sa JVM, ses appels à PRIM, et les pages publiques vues de l'extérieur.</PageTitle>

      <Section title="Serveur" id="server">
        <Load resource={system} label="la machine">
          {(data) => {
            const load = data.loadAverage !== null ? data.loadAverage / data.processors : null;
            return (
              <>
                <Grid>
                  <Kpi label="En marche depuis" value={duration(data.uptimeSeconds)} detail={`démarré le ${dateTime(data.startedAt)}`} />
                  <Kpi
                    label="Version du serveur"
                    value={data.version}
                    detail={
                      data.builtAt
                        ? `jar construit le ${shortDay(parisDate(Date.parse(data.builtAt)))} à ${time(data.builtAt).slice(0, 5)}`
                        : "jar sans date de construction"
                    }
                  />
                  <Kpi label="Java" value={data.java.split("+")[0]} detail={`Spring Boot ${data.springBoot}`} />
                  <Kpi
                    label="Processeurs"
                    value={number(data.processors)}
                    detail={data.loadAverage !== null ? `charge moyenne ${twoDecimals(data.loadAverage)}` : undefined}
                  />
                  <Kpi label="Threads" value={number(data.threads)} detail={`au plus ${number(data.peakThreads)} depuis le démarrage`} />
                  <Kpi
                    label="Ramasse-miettes"
                    value={number(data.gcCount)}
                    detail={`passages, ${duration(data.gcMillis / 1000)} au total (${percent(data.gcMillis / 1000 / Math.max(1, data.uptimeSeconds))} du temps)`}
                  />
                </Grid>
                <div className={styles.meters}>
                  {data.processCpu !== null && <Meter label="Processeur (JVM)" value={data.processCpu} max={1} />}
                  {data.systemCpu !== null && <Meter label="Processeur (machine)" value={data.systemCpu} max={1} />}
                  {load !== null && <Meter label="Charge par processeur" value={load} max={1} text={twoDecimals(load)} />}
                  <Meter
                    label="Mémoire de la JVM"
                    value={data.heapUsed}
                    max={data.heapMax}
                    text={`${bytes(data.heapUsed)} / ${bytes(data.heapMax)}`}
                  />
                  {data.memoryTotal !== null && data.memoryFree !== null && (
                    <Meter
                      label="Mémoire de la machine"
                      value={data.memoryTotal - data.memoryFree}
                      max={data.memoryTotal}
                      text={`${bytes(data.memoryTotal - data.memoryFree)} / ${bytes(data.memoryTotal)}`}
                    />
                  )}
                  <Meter
                    label="Disque"
                    value={data.diskTotal - data.diskFree}
                    max={data.diskTotal}
                    tone={data.diskFree < GTFS_MIN_FREE_DISK ? "bad" : undefined}
                    text={`${bytes(data.diskFree)} libres sur ${bytes(data.diskTotal)}`}
                    mark={data.diskTotal - GTFS_MIN_FREE_DISK}
                    markLabel="Au-delà, l'import GTFS est refusé (6 Go libres)"
                  />
                </div>
                <Note>
                  Hors JVM : {bytes(data.nonHeapUsed)} (classes, code compilé). Le trait du disque marque la place que demande un import
                  GTFS.
                </Note>
              </>
            );
          }}
        </Load>
      </Section>

      <Section title="PRIM" id="prim">
        <Load resource={status} label="l'état de PRIM">
          {(data) => (
            <Table caption="Disjoncteurs des API PRIM">
              <thead>
                <tr>
                  <th scope="col">API</th>
                  <th scope="col">État</th>
                  <th scope="col" data-numeric>
                    Échecs
                  </th>
                  <th scope="col">Dernier échec</th>
                </tr>
              </thead>
              <tbody>
                {data.prim.map((circuit) => (
                  <tr key={circuit.api}>
                    <td>{API_LABELS[circuit.api]}</td>
                    <td>
                      <StatusBadge tone={circuit.state === "CLOSED" ? "ok" : circuit.state === "OPEN" ? "bad" : "warn"}>
                        {CIRCUIT_LABELS[circuit.state]}
                        {circuit.state === "OPEN" && circuit.openUntil ? ` jusqu'à ${dateTime(circuit.openUntil)}` : ""}
                      </StatusBadge>
                    </td>
                    <td data-numeric>{number(circuit.failures)}</td>
                    <td>
                      {circuit.lastFailureAt ? (
                        <>
                          {relative(circuit.lastFailureAt)}
                          {circuit.lastError && <div className={styles.error}>{circuit.lastError}</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Load>
        <Note>
          Après 5 échecs de suite, une API n'est plus appelée pendant 30 s (5 min après un refus de quota), puis un appel réessaie. Les
          actions permettent de les rétablir tout de suite.
        </Note>
      </Section>

      <Section title="Sites" id="sites" aside={sites.data ? `Vérifiés ${relative(sites.data.checkedAt)}` : undefined}>
        <Load resource={sites} label="les sites">
          {(data) => (
            <Table caption="Pages publiques">
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Réponse</th>
                  <th scope="col" data-numeric>
                    Temps
                  </th>
                  <th scope="col">Certificat</th>
                </tr>
              </thead>
              <tbody>
                {data.sites.map((site) => (
                  <tr key={site.url}>
                    <td>
                      <a href={site.url}>{siteName(site.url)}</a>
                    </td>
                    <td>
                      <StatusBadge tone={site.status === null ? "bad" : siteTone({ ...site, certificateExpiry: null })}>
                        {site.status ?? "Pas de réponse"}
                      </StatusBadge>
                      {site.error && <div className={styles.error}>{site.error}</div>}
                    </td>
                    <td data-numeric>{site.millis !== null ? `${number(site.millis)} ms` : "—"}</td>
                    <td>
                      {site.certificateExpiry ? (
                        <StatusBadge tone={certificateTone(site.certificateExpiry)}>expire {relative(site.certificateExpiry)}</StatusBadge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Load>
        <Note>
          Vus depuis le serveur (redirections non suivies), au plus une fois par minute. certbot renouvelle les certificats 30 jours avant
          leur fin.
        </Note>
      </Section>
    </>
  );
}
