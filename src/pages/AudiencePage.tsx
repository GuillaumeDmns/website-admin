import type { Audience } from "../api/types";
import { BarChart, HBars, LineChart } from "../components/charts";
import { Period } from "../components/Period";
import { Grid, Kpi, Load, Note, PageTitle, Section, Table } from "../components/ui";
import { useApi, usePeriod } from "../data";
import { number, oneDecimal, parisDate, relative, shortDay } from "../format";
import { dayRange, metricGroups, metricPerDay, PLATFORM_LABELS, sites, sum } from "../stats";
import styles from "./pages.module.css";

/** Who uses the app and the sites, day by day: counts only, from the backend's usage statistics */
export default function AudiencePage() {
  const [days, setDays] = usePeriod(30);
  const audience = useApi<Audience>(`/api/admin/stats/audience?days=${days}`);
  const range = dayRange(days);
  const labels = range.map(shortDay);
  const today = parisDate();

  return (
    <>
      <PageTitle title="Audience">
        Combien de personnes utilisent l'app et visitent les sites, chaque jour. Que des comptages : chaque appareil ou visiteur est compté
        une fois par jour par une empreinte qui change chaque jour et disparaît le lendemain.
      </PageTitle>

      <Load resource={audience} label="l'audience">
        {(data) => {
          const accounts = metricPerDay(data.metrics, "active:account", range);
          const guests = metricPerDay(data.metrics, "active:guest", range);
          const hosts = sites([
            ...data.viewsPerDay.map((entry) => entry.host),
            ...data.metrics.filter((m) => m.metric.startsWith("visitors:")).map((m) => m.metric.slice(9)),
          ]);
          const visitors = hosts.map((host) => ({ label: host, values: metricPerDay(data.metrics, `visitors:${host}`, range) }));
          const views = hosts.map((host) => ({
            label: host,
            values: range.map((day) =>
              sum(data.viewsPerDay.filter((entry) => entry.host === host && entry.day === day).map((entry) => entry.views)),
            ),
          }));
          const platforms = metricGroups(data.metrics, "platform:", today);
          const versions = metricGroups(data.metrics, "version:", today);
          const average = (values: number[]) => oneDecimal(sum(values) / Math.max(1, values.length));
          return (
            <>
              <Section title="Aujourd'hui" id="today" aside={<Period days={days} onChange={setDays} />}>
                <Grid>
                  <Kpi label="Comptes actifs" value={number(accounts.at(-1) ?? 0)} detail={`${average(accounts)} par jour en moyenne`} />
                  <Kpi label="Appareils invités" value={number(guests.at(-1) ?? 0)} detail={`${average(guests)} par jour en moyenne`} />
                  {visitors.map((site) => (
                    <Kpi
                      key={site.label}
                      label={`Visiteurs de ${site.label}`}
                      value={number(site.values.at(-1) ?? 0)}
                      detail={`${average(site.values)} par jour en moyenne`}
                    />
                  ))}
                </Grid>
              </Section>

              <Section title="L'app" id="app">
                <div className={styles.columns}>
                  <div className={styles.block}>
                    <h3>Utilisateurs par jour</h3>
                    <BarChart
                      title="Comptes et appareils invités actifs par jour"
                      labels={labels}
                      series={[
                        { label: "Comptes", values: accounts },
                        { label: "Invités", values: guests },
                      ]}
                    />
                  </div>
                  <div className={styles.block}>
                    <h3>Plateformes aujourd'hui</h3>
                    {platforms.length === 0 ? (
                      <Note>Pas encore d'appareil aujourd'hui.</Note>
                    ) : (
                      <HBars
                        rows={platforms.map((entry) => ({
                          key: entry.name,
                          label: PLATFORM_LABELS[entry.name] ?? entry.name,
                          value: entry.count,
                        }))}
                      />
                    )}
                    <h3>Versions en circulation aujourd'hui</h3>
                    {versions.length === 0 ? (
                      <Note>Pas encore d'appareil aujourd'hui.</Note>
                    ) : (
                      <HBars
                        rows={versions.map((entry) => ({
                          key: entry.name,
                          label: entry.name === "dev" ? "développement" : entry.name,
                          value: entry.count,
                        }))}
                      />
                    )}
                  </div>
                </div>
                <Note>
                  Appareils comptés une fois par jour, qu'ils fassent une requête ou mille ; les jours ne s'additionnent pas (un même
                  appareil revient d'un jour sur l'autre). Plateformes et versions : envoyées par les versions de l'app qui suivent celle-ci
                  (0.4.0).
                </Note>
              </Section>

              <Section
                title="Les sites"
                id="sites"
                aside={data.pagesReadAt ? `Journal lu ${relative(data.pagesReadAt)}` : "Journal des pages non lu (pas de journal ici)"}
              >
                <div className={styles.columns}>
                  <div className={styles.block}>
                    <h3>Visiteurs par jour</h3>
                    <LineChart title="Visiteurs par jour et par site" labels={labels} series={visitors} />
                  </div>
                  <div className={styles.block}>
                    <h3>Pages vues par jour</h3>
                    <BarChart title="Pages vues par jour et par site" labels={labels} series={views} />
                  </div>
                </div>
                <div className={styles.columns}>
                  <div className={styles.block}>
                    <h3>Pages les plus vues</h3>
                    {data.pages.length === 0 ? (
                      <Note>Aucune page vue sur la période.</Note>
                    ) : (
                      <Table caption="Pages les plus vues">
                        <thead>
                          <tr>
                            <th scope="col">Site</th>
                            <th scope="col">Page</th>
                            <th scope="col" data-numeric>
                              Vues
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pages.map((page) => (
                            <tr key={page.host + page.path}>
                              <td className={styles.muted}>{page.host}</td>
                              <td>{page.path}</td>
                              <td data-numeric>{number(page.views)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </div>
                  <div className={styles.block}>
                    <h3>Venus d'autres sites</h3>
                    {data.referrers.length === 0 ? (
                      <Note>Aucun visiteur venu d'un autre site sur la période.</Note>
                    ) : (
                      <HBars
                        rows={data.referrers.map((entry) => ({
                          key: entry.host + entry.referrer,
                          label: entry.referrer,
                          value: entry.views,
                          hint: `vers ${entry.host}`,
                        }))}
                      />
                    )}
                  </div>
                </div>
                <Note>
                  Chargements de pages lus dans le journal de nginx toutes les 5 minutes (gardé 3 jours) : sans robots, fichiers ni erreurs.
                  Pour l'app web, une visite = un chargement ; la navigation dans l'app passe par l'API.
                </Note>
              </Section>
            </>
          );
        }}
      </Load>
    </>
  );
}
