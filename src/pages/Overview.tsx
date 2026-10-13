import { Link } from "react-router-dom";

import type { Accounts, LineTraffic, Network, Quotas, Sites, Status, SystemInfo } from "../api/types";
import { Sparkline } from "../components/charts";
import { Grid, Kpi, Load, Meter, Note, PageTitle, Section, StatusBadge } from "../components/ui";
import { useApi } from "../data";
import { bytes, compact, dateTime, duration, number, percent, relative, time } from "../format";
import { alerts, API_LABELS, callsPerApi, certificateTone, cumulative, dayRange, fillDays, siteTone, sum, usageTone } from "../stats";
import styles from "./pages.module.css";

export default function Overview() {
  const status = useApi<Status>("/api/admin/status");
  const accounts = useApi<Accounts>("/api/admin/stats/accounts?days=30");
  const quotas = useApi<Quotas>("/api/admin/stats/quotas?days=30");
  const system = useApi<SystemInfo>("/api/admin/stats/system");
  const sites = useApi<Sites>("/api/admin/stats/sites");
  const network = useApi<Network>("/api/admin/stats/network");
  const traffic = useApi<LineTraffic[]>("/api/v2/traffic");

  const found = alerts({ status: status.data, system: system.data, sites: sites.data?.sites, network: network.data });
  const days = dayRange(30);

  return (
    <>
      <PageTitle title="Vue d'ensemble">
        L'application, son serveur et les sites en un coup d'œil
        {status.loadedAt ? `, mis à jour à ${time(new Date(status.loadedAt).toISOString())}` : ""}.
      </PageTitle>

      <Section title="À surveiller" id="alerts">
        {found.length === 0 ? (
          <StatusBadge tone="ok">{status.data ? "Rien à signaler" : "Vérification…"}</StatusBadge>
        ) : (
          <ul className={styles.alerts}>
            {found.map((alert) => (
              <li key={alert.text}>
                <StatusBadge tone={alert.tone}>
                  <Link to={alert.to}>{alert.text}</Link>
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Chiffres clés" id="kpis">
        <Grid>
          <Load resource={accounts} label="des comptes">
            {({ counts, signUps }) => (
              <>
                <Kpi
                  label="Comptes"
                  value={number(counts.total)}
                  detail={`+${number(counts.new7Days)} en 7 jours, +${number(counts.new30Days)} en 30 jours`}
                  to="/accounts"
                  chart={
                    <Sparkline values={cumulative(fillDays(signUps, days), counts.total - counts.new30Days)} label="Comptes sur 30 jours" />
                  }
                />
                <Kpi
                  label="Comptes actifs (7 j)"
                  value={number(counts.active7Days)}
                  detail={`${number(counts.activeToday)} aujourd'hui, ${number(counts.active30Days)} sur 30 jours`}
                  to="/accounts"
                />
                <Kpi
                  label="Sessions ouvertes"
                  value={number(counts.withSession)}
                  detail="comptes connectés sur au moins un appareil"
                  to="/accounts"
                />
              </>
            )}
          </Load>
          <Load resource={status} label="l'état du service">
            {(data) => {
              const used = sum(data.quotas.map((quota) => quota.used));
              const stopMonitoring = data.quotas.find((quota) => quota.api === "STOP_MONITORING");
              const vehicles = data.quotas.find((quota) => quota.api === "ESTIMATED_TIMETABLE");
              const journeys = data.features.find((feature) => feature.feature === "JOURNEYS");
              const navitia = data.quotas.find((quota) => quota.api === "NAVITIA");
              const perDay = quotas.data ? sumPerDay(quotas.data, days) : undefined;
              return (
                <>
                  <Kpi
                    label="Appels PRIM aujourd'hui"
                    value={compact(used)}
                    detail={
                      stopMonitoring ? `prochains passages : ${percent(stopMonitoring.used / stopMonitoring.limit)} du quota` : undefined
                    }
                    to="/usage"
                    chart={perDay && <Sparkline values={perDay} label="Appels PRIM par jour sur 30 jours" />}
                  />
                  <Kpi
                    label="Itinéraires aujourd'hui"
                    value={number(journeys?.calls ?? 0)}
                    detail={navitia ? `Navitia : ${percent(navitia.used / navitia.limit)} du quota` : undefined}
                    tone={navitia ? usageTone(navitia.used / navitia.limit) : undefined}
                    to="/usage"
                  />
                  {vehicles && (
                    <Kpi
                      label="Véhicules (estimated-timetable)"
                      value={`${number(vehicles.used)} / ${number(vehicles.limit)}`}
                      detail="le plus petit quota : 1 500 par jour"
                      tone={usageTone(vehicles.used / vehicles.limit)}
                      to="/usage"
                    />
                  )}
                  <Kpi
                    label="GTFS"
                    value={data.gtfsStale ? "En retard" : "À jour"}
                    tone={data.gtfsStale ? "bad" : data.lastGtfsImport?.status === "FAILED" ? "warn" : "ok"}
                    detail={`importé ${relative(data.lastGtfsSuccess?.finishedAt)}`}
                    to="/network"
                  />
                </>
              );
            }}
          </Load>
          <Load resource={traffic} label="l'info trafic">
            {(lines) => {
              const disrupted = lines.filter((line) => line.severity === "DISRUPTED" || line.severity === "BLOCKING");
              const blocking = disrupted.filter((line) => line.severity === "BLOCKING").length;
              return (
                <Kpi
                  label="Lignes perturbées"
                  value={number(disrupted.length)}
                  detail={blocking > 0 ? `dont ${number(blocking)} interrompue${blocking > 1 ? "s" : ""}` : "aucune interrompue"}
                  tone={blocking > 0 ? "warn" : undefined}
                  to="/network"
                />
              );
            }}
          </Load>
          <Load resource={system} label="la machine">
            {(data) => (
              <>
                <Kpi
                  label="Serveur"
                  value={duration(data.uptimeSeconds)}
                  detail={`sans redémarrage, depuis le ${dateTime(data.startedAt)}`}
                  to="/system"
                />
                <Kpi
                  label="Mémoire de la JVM"
                  value={percent(data.heapUsed / data.heapMax)}
                  detail={`${bytes(data.heapUsed)} sur ${bytes(data.heapMax)}`}
                  tone={usageTone(data.heapUsed / data.heapMax)}
                  to="/system"
                />
              </>
            )}
          </Load>
          <Load resource={sites} label="les sites">
            {({ sites: checks }) => {
              const up = checks.filter((site) => siteTone(site) !== "bad").length;
              const expiries = checks.flatMap((site) => (site.certificateExpiry ? [site.certificateExpiry] : [])).sort();
              return (
                <Kpi
                  label="Sites en ligne"
                  value={`${up} / ${checks.length}`}
                  tone={up < checks.length ? "bad" : expiries[0] ? certificateTone(expiries[0]) : undefined}
                  detail={expiries[0] ? `premier certificat à renouveler ${relative(expiries[0])}` : "sans HTTPS"}
                  to="/system"
                />
              );
            }}
          </Load>
          <Load resource={network} label="le réseau">
            {(data) => (
              <Kpi
                label="Base de données"
                value={bytes(data.database.bytes)}
                detail={`PostgreSQL ${data.database.postgres}`}
                to="/network"
              />
            )}
          </Load>
        </Grid>
      </Section>

      <Section title="Quotas PRIM du jour" id="quotas" aside={<Link to="/usage">Détail par jour</Link>}>
        <Load resource={status} label="les quotas">
          {(data) => (
            <div className={styles.meters}>
              {data.quotas.map((quota) => (
                <Meter
                  key={quota.api}
                  label={API_LABELS[quota.api]}
                  value={quota.used}
                  max={quota.limit}
                  text={`${number(quota.used)} / ${number(quota.limit)}`}
                  mark={quota.primUsed ?? undefined}
                  markLabel={quota.primUsed !== null ? `PRIM compte ${number(quota.primUsed)} appels` : undefined}
                />
              ))}
            </div>
          )}
        </Load>
        <Note>
          Limite utilisable : 90 % du quota PRIM, le reste gardé pour les redémarrages. Le trait marque le compte de PRIM (clé partagée avec
          la machine de développement).
        </Note>
      </Section>
    </>
  );
}

function sumPerDay(quotas: Quotas, days: string[]): number[] {
  const perApi = [...callsPerApi(quotas.days, days).values()];
  return days.map((_, index) => sum(perApi.map((values) => values[index])));
}
