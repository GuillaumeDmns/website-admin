import type { PrimApi, Quotas, Status } from "../api/types";
import { BarChart } from "../components/charts";
import { Period } from "../components/Period";
import { Load, Meter, Note, PageTitle, Section, Table } from "../components/ui";
import { usePeriod, useApi } from "../data";
import { compact, longDay, number, percent, relative, shortDay } from "../format";
import { API_LABELS, callsPerApi, callsPerFeature, dayRange, FEATURES, sum } from "../stats";
import styles from "./pages.module.css";

/** PRIM calls: today against the quotas, then per day (what the app's use costs) */
export default function Usage() {
  const [days, setDays] = usePeriod(30);
  const status = useApi<Status>("/api/admin/status");
  const quotas = useApi<Quotas>(`/api/admin/stats/quotas?days=${days}`);
  const range = dayRange(days);
  const labels = range.map(shortDay);

  return (
    <>
      <PageTitle title="Utilisation">
        Les appels de l'application aux API d'Île-de-France Mobilités (PRIM), qui ont chacune un quota par jour : ce que coûte l'usage de
        l'application. Les invités (sans compte) n'ont droit qu'à 15 % de chaque quota.
      </PageTitle>

      <Section title="Aujourd'hui" id="today">
        <Load resource={status} label="les quotas du jour">
          {(data) => (
            <>
              <div className={styles.meters}>
                {data.quotas.map((quota) => (
                  <div key={quota.api} className={styles.block}>
                    <h3>{API_LABELS[quota.api]}</h3>
                    <Meter
                      label="Tous les appels"
                      value={quota.used}
                      max={quota.limit}
                      text={`${number(quota.used)} / ${number(quota.limit)}`}
                      mark={quota.primUsed ?? undefined}
                      markLabel={quota.primUsed !== null ? `PRIM compte ${number(quota.primUsed)}` : undefined}
                    />
                    <Meter
                      label="Invités"
                      value={quota.guestUsed}
                      max={quota.guestLimit}
                      text={`${number(quota.guestUsed)} / ${number(quota.guestLimit)}`}
                    />
                    <p className={styles.muted}>
                      {quota.primUsed !== null && quota.primLimit !== null
                        ? `Selon PRIM : ${number(quota.primUsed)} / ${number(quota.primLimit)} (${relative(quota.primObservedAt)})`
                        : "PRIM n'a pas encore répondu aujourd'hui"}
                    </p>
                  </div>
                ))}
              </div>
              <Table caption="Appels du jour par fonction">
                <thead>
                  <tr>
                    <th scope="col">Fonction</th>
                    <th scope="col">API</th>
                    <th scope="col" data-numeric>
                      Appels
                    </th>
                    <th scope="col" data-numeric>
                      Invités
                    </th>
                    <th scope="col" data-numeric>
                      Part des invités
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map(({ feature, label }) => {
                    const usage = data.features.find((entry) => entry.feature === feature);
                    if (!usage) return null;
                    return (
                      <tr key={feature}>
                        <td>{label}</td>
                        <td className={styles.muted}>{API_LABELS[usage.api]}</td>
                        <td data-numeric>{number(usage.calls)}</td>
                        <td data-numeric>{number(usage.guestCalls)}</td>
                        <td data-numeric>{usage.calls > 0 ? percent(usage.guestCalls / usage.calls) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </Load>
      </Section>

      <Section title="Appels par jour" id="per-day" aside={<Period days={days} onChange={setDays} />}>
        <Load resource={quotas} label="l'historique des appels">
          {(data) => {
            const perFeature = callsPerFeature(data.days, range);
            const guests = callsPerFeature(data.days, range, true);
            const totals = range.map((_, index) => sum([...perFeature.values()].map((values) => values[index])));
            const guestTotals = range.map((_, index) => sum([...guests.values()].map((values) => values[index])));
            const busiest = totals.indexOf(Math.max(...totals));
            return (
              <>
                <BarChart
                  title="Appels PRIM par jour et par fonction"
                  labels={labels}
                  series={FEATURES.map(({ feature, label }) => ({ label, values: perFeature.get(feature) ?? [] }))}
                  format={compact}
                  height={220}
                  footer={
                    <Note>
                      {number(sum(totals))} appels sur la période, {number(Math.round(sum(totals) / range.length))} par jour en moyenne
                      {totals[busiest] > 0 ? `, au plus ${number(totals[busiest])} le ${longDay(range[busiest])}` : ""}. Part des invités :{" "}
                      {sum(totals) > 0 ? percent(sum(guestTotals) / sum(totals)) : "—"}.
                    </Note>
                  }
                />
                <div className={styles.columns}>
                  {data.apis.map((api) => (
                    <ApiChart
                      key={api.api}
                      api={api.api}
                      limit={api.limit}
                      perDay={api.perDay}
                      values={callsPerApi(data.days, range).get(api.api) ?? range.map(() => 0)}
                      labels={labels}
                    />
                  ))}
                </div>
              </>
            );
          }}
        </Load>
        <Note>
          Comptés par ce serveur et enregistrés toutes les 30 secondes ; les jours à zéro avant le premier enregistrement n'ont pas été
          comptés.
        </Note>
      </Section>

      <Section title="Invités" id="guests">
        <Load resource={quotas} label="l'historique des appels">
          {(data) => {
            const guests = callsPerFeature(data.days, range, true);
            return (
              <BarChart
                title="Appels PRIM des invités par jour"
                labels={labels}
                series={FEATURES.map(({ feature, label }) => ({ label, values: guests.get(feature) ?? [] }))}
                format={compact}
              />
            );
          }}
        </Load>
      </Section>

      <Section title="Totaux de la période" id="totals">
        <Load resource={quotas} label="l'historique des appels">
          {(data) => {
            const perFeature = callsPerFeature(data.days, range);
            const guests = callsPerFeature(data.days, range, true);
            return (
              <Table caption="Appels de la période par fonction">
                <thead>
                  <tr>
                    <th scope="col">Fonction</th>
                    <th scope="col" data-numeric>
                      Total
                    </th>
                    <th scope="col" data-numeric>
                      Par jour
                    </th>
                    <th scope="col" data-numeric>
                      Jour le plus chargé
                    </th>
                    <th scope="col" data-numeric>
                      Invités
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map(({ feature, label }) => {
                    const values = perFeature.get(feature) ?? [];
                    const total = sum(values);
                    return (
                      <tr key={feature}>
                        <td>{label}</td>
                        <td data-numeric>{number(total)}</td>
                        <td data-numeric>{number(Math.round(total / range.length))}</td>
                        <td data-numeric>{number(Math.max(0, ...values))}</td>
                        <td data-numeric>{total > 0 ? percent(sum(guests.get(feature) ?? []) / total) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            );
          }}
        </Load>
      </Section>
    </>
  );
}

function ApiChart({
  api,
  limit,
  perDay,
  values,
  labels,
}: {
  api: PrimApi;
  limit: number;
  perDay: number;
  values: number[];
  labels: string[];
}) {
  const max = Math.max(0, ...values);
  return (
    <div className={styles.block}>
      <h3>{API_LABELS[api]}</h3>
      <BarChart
        title={`Appels ${API_LABELS[api]} par jour`}
        labels={labels}
        series={[{ label: "Appels", values }]}
        format={compact}
        height={130}
        footer={
          <Note>
            Quota PRIM {number(perDay)} par jour (utilisable : {number(limit)}). Jour le plus chargé : {percent(max / perDay)} du quota.
          </Note>
        }
      />
    </div>
  );
}
