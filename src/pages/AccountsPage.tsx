import type { Accounts, Favorites } from "../api/types";
import { BarChart, HBars, LineChart } from "../components/charts";
import { Period } from "../components/Period";
import { Grid, Kpi, LineBadge, Load, Note, PageTitle, Section } from "../components/ui";
import { useApi, usePeriod } from "../data";
import { number, oneDecimal, percent, shortDay } from "../format";
import { cumulative, dayRange, FAVORITE_KINDS, FAVORITES_PER_ACCOUNT, fillDays, LAST_SIGN_INS, sum } from "../stats";
import styles from "./pages.module.css";

/** Accounts and their favorites, counted only: nobody is named, no position is shown */
export default function AccountsPage() {
  const [days, setDays] = usePeriod(90);
  const accounts = useApi<Accounts>(`/api/admin/stats/accounts?days=${days}`);
  const favorites = useApi<Favorites>(`/api/admin/stats/favorites?days=${days}`);
  const range = dayRange(days);
  const labels = range.map(shortDay);
  const week = dayRange(7);

  return (
    <>
      <PageTitle title="Comptes">
        Les comptes Google de l'application et ce qu'ils enregistrent, en nombres seulement : aucune personne, aucun domicile ni lieu
        n'apparaît ici. Les invités ne sont pas des comptes (rien n'est gardé d'eux).
      </PageTitle>

      <Section title="Comptes" id="accounts" aside={<Period days={days} onChange={setDays} />}>
        <Load resource={accounts} label="des comptes">
          {({ counts, signUps, activePerDay, lastSignIns, favoritesPerAccount }) => {
            const newPerDay = fillDays(signUps, range);
            const before = Math.max(0, counts.total - sum(newPerDay));
            return (
              <>
                <Grid>
                  <Kpi
                    label="Comptes"
                    value={number(counts.total)}
                    detail={`dont ${number(counts.admins)} administrateur${counts.admins > 1 ? "s" : ""}`}
                  />
                  <Kpi
                    label="Nouveaux"
                    value={`+${number(counts.new7Days)}`}
                    detail={`en 7 jours, +${number(counts.new30Days)} en 30 jours`}
                  />
                  <Kpi
                    label="Actifs"
                    value={number(counts.active7Days)}
                    detail={`connectés en 7 jours (${counts.total > 0 ? percent(counts.active7Days / counts.total) : "—"}), ${number(counts.activeToday)} aujourd'hui, ${number(counts.active30Days)} en 30 jours`}
                  />
                  <Kpi label="Sessions ouvertes" value={number(counts.withSession)} detail="comptes connectés sur au moins un appareil" />
                  <Kpi
                    label="Jetons d'API"
                    value={number(counts.apiTokens)}
                    detail={`${number(counts.apiTokensUsed7Days)} utilisé${counts.apiTokensUsed7Days > 1 ? "s" : ""} en 7 jours (Bruno, scripts)`}
                  />
                </Grid>
                <div className={styles.columns}>
                  <div className={styles.block}>
                    <h3>Inscriptions par jour</h3>
                    <BarChart title="Inscriptions par jour" labels={labels} series={[{ label: "Inscriptions", values: newPerDay }]} />
                  </div>
                  <div className={styles.block}>
                    <h3>Nombre de comptes</h3>
                    <LineChart
                      title="Nombre de comptes"
                      labels={labels}
                      series={[{ label: "Comptes", values: cumulative(newPerDay, before) }]}
                    />
                  </div>
                  <div className={styles.block}>
                    <h3>Comptes actifs par jour</h3>
                    <BarChart
                      title="Comptes actifs par jour"
                      labels={week.map(shortDay)}
                      series={[{ label: "Comptes actifs", values: fillDays(activePerDay, week) }]}
                      height={140}
                    />
                    <Note>
                      Comptes qui ont utilisé l'application ce jour-là (la session se renouvelle à chaque heure d'utilisation) : 7 derniers
                      jours seulement, les renouvellements ne sont gardés qu'une semaine.
                    </Note>
                  </div>
                  <div className={styles.block}>
                    <h3>Dernière connexion</h3>
                    <HBars
                      rows={LAST_SIGN_INS.map(({ group, label }) => ({
                        key: group,
                        label,
                        value: lastSignIns.find((entry) => entry.group === group)?.count ?? 0,
                      }))}
                    />
                    <h3>Favoris par compte</h3>
                    <HBars
                      rows={FAVORITES_PER_ACCOUNT.map(({ group, label }) => ({
                        key: group,
                        label,
                        value: favoritesPerAccount.find((entry) => entry.group === group)?.count ?? 0,
                      }))}
                    />
                  </div>
                </div>
              </>
            );
          }}
        </Load>
      </Section>

      <Section title="Favoris" id="favorites">
        <Load resource={favorites} label="des favoris">
          {(data) => (
            <>
              <Grid>
                <Kpi
                  label="Favoris"
                  value={number(data.total)}
                  detail={`${number(data.accounts)} compte${data.accounts > 1 ? "s" : ""} en ont`}
                />
                <Kpi
                  label="Par compte qui en a"
                  value={data.accounts > 0 ? oneDecimal(data.total / data.accounts) : "—"}
                  detail="en moyenne"
                />
              </Grid>
              <div className={styles.columns}>
                <div className={styles.block}>
                  <h3>Par type</h3>
                  <HBars
                    rows={FAVORITE_KINDS.map(({ group, label }) => ({
                      key: group,
                      label,
                      value: data.perKind.find((entry) => entry.group === group)?.count ?? 0,
                    }))}
                  />
                  <h3>Ajoutés par jour</h3>
                  <BarChart
                    title="Favoris ajoutés par jour"
                    labels={labels}
                    series={[{ label: "Favoris", values: fillDays(data.created, range) }]}
                    height={140}
                  />
                </div>
                <div className={styles.block}>
                  <h3>Arrêts les plus enregistrés</h3>
                  {data.stops.length === 0 ? (
                    <Note>Aucun arrêt en favori.</Note>
                  ) : (
                    <HBars
                      rows={data.stops.map((stop) => ({ key: stop.id, label: stop.name ?? stop.id, value: stop.count, hint: stop.id }))}
                    />
                  )}
                  <h3>Lignes les plus enregistrées</h3>
                  {data.lines.length === 0 ? (
                    <Note>Aucune ligne en favori.</Note>
                  ) : (
                    <HBars
                      rows={data.lines.map(({ line, count }) => ({
                        key: line.id,
                        label: (
                          <>
                            <LineBadge line={line} /> {line.longName ?? ""}
                          </>
                        ),
                        value: count,
                      }))}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </Load>
      </Section>
    </>
  );
}
