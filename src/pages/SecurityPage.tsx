import { useState, type FormEvent } from "react";

import { ApiError, del, post } from "../api/client";
import type { ApiToken, NewApiToken, Security, Sessions } from "../api/types";
import { useSession } from "../auth/sessionContext";
import { Button, Grid, Kpi, Load, Note, PageTitle, Section, StatusBadge, Table } from "../components/ui";
import { useApi } from "../data";
import { dateTime, number, relative } from "../format";
import { SECURITY_EVENTS, securityTone } from "../stats";
import styles from "./pages.module.css";

const VALIDITIES = [
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 365, label: "1 an" },
];

/** Tokens unused for this long are worth revoking */
const IDLE_DAYS = 90;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What the backend refused since it started, who can get in (admin accounts, sessions, API tokens), and the signed-in
 * admin's own access: its API tokens and its sessions
 */
export default function SecurityPage() {
  const security = useApi<Security>("/api/admin/stats/security");

  return (
    <>
      <PageTitle title="Sécurité">
        Ce que le serveur a refusé depuis son démarrage, qui peut entrer, et vos propres accès : jetons d'API et sessions.
      </PageTitle>

      <Section title="Accès" id="access">
        <Load resource={security} label="la sécurité">
          {(data) => (
            <Grid>
              <Kpi
                label="Comptes administrateurs"
                value={number(data.access.admins)}
                tone={data.access.admins > data.adminEmails ? "bad" : undefined}
                detail={`${number(data.adminEmails)} adresse${data.adminEmails > 1 ? "s" : ""} prévue${data.adminEmails > 1 ? "s" : ""} (admin-emails)`}
              />
              <Kpi
                label="Sessions ouvertes"
                value={number(data.access.sessions)}
                detail={`${number(data.access.accountsWithSession)} compte${data.access.accountsWithSession > 1 ? "s" : ""}, 60 jours au plus`}
              />
              <Kpi
                label="Jetons d'API valides"
                value={number(data.access.apiTokens)}
                tone={data.access.apiTokensIdle > 0 || data.access.apiTokensExpiringSoon > 0 ? "warn" : undefined}
                detail={`${number(data.access.apiTokensIdle)} inutilisé${data.access.apiTokensIdle > 1 ? "s" : ""} depuis ${IDLE_DAYS} jours, ${number(data.access.apiTokensExpiringSoon)} expire${data.access.apiTokensExpiringSoon > 1 ? "nt" : ""} sous 30 jours`}
              />
            </Grid>
          )}
        </Load>
      </Section>

      <Section title="Refus" id="refusals" aside={security.data ? `Depuis le démarrage, ${relative(security.data.since)}` : undefined}>
        <Load resource={security} label="la sécurité">
          {(data) => (
            <>
              <Table caption="Identifiants et accès refusés, aujourd'hui et depuis le démarrage">
                <thead>
                  <tr>
                    <th scope="col">Événement</th>
                    <th scope="col" data-numeric>
                      Aujourd'hui
                    </th>
                    <th scope="col" data-numeric>
                      Depuis le démarrage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SECURITY_EVENTS.map(({ kind, label, description }) => {
                    const count = data.events.find((event) => event.kind === kind) ?? { today: 0, sinceStart: 0 };
                    const tone = securityTone(kind, count.today);
                    return (
                      <tr key={kind}>
                        <td>
                          {tone === "ok" ? label : <StatusBadge tone={tone}>{label}</StatusBadge>}
                          <br />
                          <span className={styles.muted}>{description}</span>
                        </td>
                        <td data-numeric>{number(count.today)}</td>
                        <td data-numeric>{number(count.sinceStart)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Note>
                Comptes seulement, en mémoire : un redémarrage les remet à zéro. Ni compte ni adresse n'est gardé ; les journaux du serveur
                disent quel compte a lancé une action.
              </Note>
            </>
          )}
        </Load>
      </Section>

      <ApiTokens />
      <OwnSessions />
    </>
  );
}

/** The signed-in admin's personal API tokens (Bruno, scripts): created here, shown once, revoked here */
function ApiTokens() {
  const tokens = useApi<ApiToken[]>("/api/v2/me/api-tokens");
  const [name, setName] = useState("");
  const [days, setDays] = useState(90);
  const [created, setCreated] = useState<NewApiToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setCopied(false);
    try {
      const token = await post<NewApiToken>("/api/v2/me/api-tokens", { name: name.trim(), validDays: days });
      setCreated(token);
      setName("");
      tokens.reload();
    } catch (error) {
      setMessage({ ok: false, text: `Échec : ${errorText(error)}` });
    }
    setBusy(false);
  };

  const revoke = async (token: ApiToken) => {
    setConfirming(null);
    setBusy(true);
    try {
      await del<void>(`/api/v2/me/api-tokens/${token.id}`);
      setMessage({ ok: true, text: `Jeton « ${token.name} » révoqué.` });
      if (created?.apiToken.id === token.id) setCreated(null);
    } catch (error) {
      setMessage({ ok: false, text: `Échec : ${errorText(error)}` });
    }
    setBusy(false);
    tokens.reload();
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section title="Mes jetons d'API" id="api-tokens" aside="Bruno et scripts, 10 au plus">
      <form className={styles.form} onSubmit={(event) => void create(event)}>
        <label className={styles.field}>
          <span>Nom</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="Bruno, portable" />
        </label>
        <label className={styles.field}>
          <span>Validité</span>
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {VALIDITIES.map((validity) => (
              <option key={validity.days} value={validity.days}>
                {validity.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.submit} disabled={busy || name.trim() === ""}>
          Créer un jeton
        </button>
      </form>

      {created && (
        <div className={styles.secret} role="status">
          <p>
            Jeton « {created.apiToken.name} », valable jusqu'au {dateTime(created.apiToken.expiresAt)}. Copiez-le maintenant : il ne sera
            plus montré.
          </p>
          <code>{created.token}</code>
          <div className={styles.actionButtons}>
            <Button onClick={() => void copy(created.token)}>{copied ? "Copié" : "Copier"}</Button>
            <Button onClick={() => setCreated(null)}>Masquer</Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status">
          <StatusBadge tone={message.ok ? "ok" : "bad"}>{message.text}</StatusBadge>
        </p>
      )}

      <Load resource={tokens} label="vos jetons">
        {(list) =>
          list.length === 0 ? (
            <Note>Aucun jeton : Bruno et les scripts n'ont pas d'accès.</Note>
          ) : (
            <Table caption="Vos jetons d'API">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Créé</th>
                  <th scope="col">Expire</th>
                  <th scope="col">Dernier usage</th>
                  <th scope="col">
                    <span className="sr-only">Révoquer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((token) => {
                  const idle = Date.now() - Date.parse(token.lastUsedAt ?? token.createdAt) > IDLE_DAYS * 86_400_000;
                  const expiringSoon = Date.parse(token.expiresAt) - Date.now() < 30 * 86_400_000;
                  return (
                    <tr key={token.id}>
                      <td>{token.name}</td>
                      <td>{dateTime(token.createdAt)}</td>
                      <td>
                        {expiringSoon ? <StatusBadge tone="warn">{relative(token.expiresAt)}</StatusBadge> : dateTime(token.expiresAt)}
                      </td>
                      <td>
                        {token.lastUsedAt === null ? "jamais" : relative(token.lastUsedAt)}
                        {idle && (
                          <>
                            {" "}
                            <StatusBadge tone="warn">à révoquer ?</StatusBadge>
                          </>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          {confirming === token.id ? (
                            <>
                              <Button kind="danger" onClick={() => void revoke(token)}>
                                Révoquer « {token.name} »
                              </Button>
                              <Button onClick={() => setConfirming(null)}>Annuler</Button>
                            </>
                          ) : (
                            <Button onClick={() => setConfirming(token.id)} disabled={busy}>
                              Révoquer
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )
        }
      </Load>
      <Note>
        Un jeton s'échange contre un accès d'une heure (POST /api/auth/api-token). Il ouvre l'API comme votre session, sauf la création
        d'autres jetons et la suppression du compte : un jeton qui fuit ne survit pas à sa révocation.
      </Note>
    </Section>
  );
}

/** The admin's own sessions (devices signed in with Google), all closed at once if one may be lost */
function OwnSessions() {
  const { signOut } = useSession();
  const sessions = useApi<Sessions>("/api/v2/me/sessions");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeAll = async () => {
    setConfirming(false);
    try {
      await del("/api/v2/me/sessions");
      await signOut();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : errorText(failure));
    }
  };

  return (
    <Section title="Mes sessions" id="sessions">
      <div className={styles.action}>
        <div className={styles.block}>
          <Load resource={sessions} label="vos sessions">
            {(data) => (
              <p>
                {number(data.active)} session{data.active > 1 ? "s" : ""} ouverte{data.active > 1 ? "s" : ""} avec votre compte Google
                (cette administration, les applications).
              </p>
            )}
          </Load>
          <p className={styles.muted}>
            Se déconnecter partout ferme chacune, celle-ci comprise : un appareil perdu ou un jeton de session volé n'ouvre plus rien (son
            accès en cours finit dans l'heure). Les jetons d'API ne sont pas touchés.
          </p>
        </div>
        <div className={styles.actionButtons}>
          {confirming ? (
            <>
              <Button kind="danger" onClick={() => void closeAll()}>
                Fermer toutes mes sessions
              </Button>
              <Button onClick={() => setConfirming(false)}>Annuler</Button>
            </>
          ) : (
            <Button onClick={() => setConfirming(true)}>Se déconnecter partout</Button>
          )}
        </div>
        {error && (
          <div className={styles.result} role="alert">
            <StatusBadge tone="bad">Échec : {error}</StatusBadge>
          </div>
        )}
      </div>
    </Section>
  );
}
