import type { ApiUsage, Caller } from "../api/types";
import { BarChart } from "../components/charts";
import { Period } from "../components/Period";
import { Grid, Kpi, Load, Note, PageTitle, Section, Table } from "../components/ui";
import { useApi, usePeriod } from "../data";
import { compact, number, percent, shortDay, time } from "../format";
import { CALLER_LABELS, dayRange, parisDayOf, sum } from "../stats";
import styles from "./pages.module.css";

const CALLERS: Caller[] = ["ACCOUNT", "GUEST", "ANONYMOUS"];

/** How the backend's API is used and answers: requests per hour or day, per route, per kind of caller */
export default function ApiPage() {
  const [days, setDays] = usePeriod(7);
  const usage = useApi<ApiUsage>(`/api/admin/stats/usage?days=${days}`);
  const range = dayRange(days);

  return (
    <>
      <PageTitle title="API">
        Les requêtes de l'app au serveur : volume, erreurs, refus pour excès de requêtes (429) et temps de réponse, par route et par type
        d'appelant.
      </PageTitle>

      <Load resource={usage} label="l'utilisation de l'API">
        {(data) => {
          const total = sum(data.perHour.map((hour) => hour.requests));
          const serverErrors = sum(data.perHour.map((hour) => hour.serverErrors));
          const rateLimited = sum(data.perHour.map((hour) => hour.rateLimited));
          const totalMillis = sum(data.perHour.map((hour) => hour.totalMillis));
          // Per hour over 2 days at most, per day beyond
          const hourly = days <= 2;
          const buckets = hourly ? data.perHour.map((hour) => hour.hour) : range;
          const bucketOf = (hour: string) => (hourly ? hour : parisDayOf(hour));
          const series = (pick: (hour: ApiUsage["perHour"][number]) => number) =>
            buckets.map((bucket) => sum(data.perHour.filter((hour) => bucketOf(hour.hour) === bucket).map(pick)));
          const labels = hourly ? buckets.map((hour) => time(hour).slice(0, 5)) : range.map(shortDay);
          return (
            <>
              <Section title="Sur la période" id="period" aside={<Period days={days} onChange={setDays} />}>
                <Grid>
                  <Kpi
                    label="Requêtes"
                    value={compact(total)}
                    detail={`${number(Math.round(total / Math.max(1, days)))} par jour en moyenne`}
                  />
                  <Kpi
                    label="Erreurs du serveur (5xx)"
                    value={number(serverErrors)}
                    tone={total > 0 && serverErrors / total > 0.01 ? "bad" : undefined}
                    detail={total > 0 ? `${percent(serverErrors / total)} des requêtes` : undefined}
                  />
                  <Kpi
                    label="Refus (429)"
                    value={number(rateLimited)}
                    tone={total > 0 && rateLimited / total > 0.01 ? "warn" : undefined}
                    detail="trop de requêtes d'un même appelant"
                  />
                  <Kpi label="Temps de réponse moyen" value={`${number(total > 0 ? Math.round(totalMillis / total) : 0)} ms`} />
                </Grid>
                <BarChart
                  title={hourly ? "Requêtes par heure" : "Requêtes par jour"}
                  labels={labels}
                  series={[
                    {
                      label: "Réussies",
                      values: series((hour) => hour.requests - hour.clientErrors - hour.serverErrors - hour.rateLimited),
                    },
                    { label: "Erreurs de la requête (4xx)", values: series((hour) => hour.clientErrors) },
                    { label: "Refus (429)", values: series((hour) => hour.rateLimited) },
                    { label: "Erreurs du serveur (5xx)", values: series((hour) => hour.serverErrors) },
                  ]}
                  format={compact}
                  height={200}
                />
              </Section>

              <Section title="Par type d'appelant" id="callers">
                <BarChart
                  title="Requêtes par jour et par type d'appelant"
                  labels={range.map(shortDay)}
                  series={CALLERS.map((caller) => ({
                    label: CALLER_LABELS[caller],
                    values: range.map((day) =>
                      sum(data.callers.filter((entry) => entry.day === day && entry.caller === caller).map((entry) => entry.requests)),
                    ),
                  }))}
                  format={compact}
                />
                <Note>« Sans jeton » : connexion, renouvellement de session, santé du serveur.</Note>
              </Section>

              <Section title="Par route" id="endpoints">
                <Table caption="Requêtes par route">
                  <thead>
                    <tr>
                      <th scope="col">Route</th>
                      <th scope="col" data-numeric>
                        Requêtes
                      </th>
                      <th scope="col" data-numeric>
                        4xx
                      </th>
                      <th scope="col" data-numeric>
                        429
                      </th>
                      <th scope="col" data-numeric>
                        5xx
                      </th>
                      <th scope="col" data-numeric>
                        Moyenne
                      </th>
                      <th scope="col" data-numeric>
                        Max
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.endpoints.map((endpoint) => (
                      <tr key={endpoint.endpoint}>
                        <td>
                          <code>{endpoint.endpoint}</code>
                        </td>
                        <td data-numeric>{number(endpoint.requests)}</td>
                        <td data-numeric>{number(endpoint.clientErrors)}</td>
                        <td data-numeric>{number(endpoint.rateLimited)}</td>
                        <td data-numeric className={endpoint.serverErrors > 0 ? styles.error : undefined}>
                          {number(endpoint.serverErrors)}
                        </td>
                        <td data-numeric>{number(Math.round(endpoint.totalMillis / Math.max(1, endpoint.requests)))} ms</td>
                        <td data-numeric>{number(endpoint.maxMillis)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Note>Les 40 routes les plus demandées, comptées depuis la mise en place des statistiques d'usage.</Note>
              </Section>
            </>
          );
        }}
      </Load>
    </>
  );
}
