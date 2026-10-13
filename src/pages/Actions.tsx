import { useEffect, useState } from "react";

import { ApiError, post } from "../api/client";
import type { ActionResult, CircuitStatus, GtfsImport } from "../api/types";
import { Button, Note, PageTitle, Section, StatusBadge } from "../components/ui";
import { useApi, useRefresh } from "../data";
import { dateTime, duration, number, relative, time } from "../format";
import { importSeconds } from "../stats";
import styles from "./pages.module.css";

const JOURNAL_KEY = "admin.journal";

interface Entry {
  at: string;
  action: string;
  ok: boolean;
  text: string;
}

interface Action {
  id: string;
  title: string;
  description: string;
  /** What it costs (quotas, time) */
  cost: string;
  run(): Promise<string>;
}

const actions: Action[] = [
  {
    id: "gtfs",
    title: "Importer le GTFS",
    description:
      "Télécharge le GTFS publié par IDFM et le charge dans un nouveau schéma, échangé avec l'ancien à la fin (l'ancien reste en service en cas d'échec). Fait automatiquement quand IDFM publie une nouvelle version.",
    cost: "Quelques minutes et environ 4 Go de disque le temps de l'import (il en faut 6 de libres) ; pas de quota PRIM.",
    async run() {
      await post<void>("/api/gtfs");
      return "Import lancé : suivi ci-dessous.";
    },
  },
  {
    id: "traffic",
    title: "Recharger l'info trafic",
    description:
      "Relit les perturbations tout de suite au lieu d'attendre le prochain rafraîchissement (au plus toutes les 3 minutes quand l'application la demande).",
    cost: "1 appel disruptions_bulk (quota : 18 000 par jour).",
    async run() {
      const result = await post<ActionResult>("/api/admin/actions/traffic");
      return `Info trafic relue à ${time(result.at)}.`;
    },
  },
  {
    id: "elevators",
    title: "Recharger l'état des ascenseurs",
    description: "Relit l'open data des ascenseurs tout de suite (sinon toutes les heures quand une page d'arrêt la demande).",
    cost: "1 appel à l'open data d'IDFM ; pas de quota PRIM.",
    async run() {
      const result = await post<ActionResult>("/api/admin/actions/elevators");
      return `Ascenseurs relus à ${time(result.at)}.`;
    },
  },
  {
    id: "search",
    title: "Reconstruire l'index de recherche",
    description:
      "Recharge les zones d'arrêt, leurs lignes et leurs communes pour la recherche (fait au démarrage et après chaque import GTFS).",
    cost: "Environ 3 secondes de calcul et 1 appel à l'open data des communes.",
    async run() {
      const result = await post<ActionResult>("/api/admin/actions/search-index");
      return `${number(result.count ?? 0)} zones d'arrêt indexées.`;
    },
  },
  {
    id: "circuits",
    title: "Rétablir les appels à PRIM",
    description:
      "Referme les disjoncteurs : les appels à PRIM reprennent tout de suite, même après des échecs récents. Utile quand PRIM est revenu avant la fin du délai.",
    cost: "Aucun, mais si PRIM ne répond toujours pas, les disjoncteurs se rouvriront.",
    async run() {
      const circuits = await post<CircuitStatus[]>("/api/admin/actions/prim-circuits");
      return `${circuits.filter((circuit) => circuit.state === "CLOSED").length} API sur ${circuits.length} appelées normalement.`;
    },
  },
  {
    id: "sessions",
    title: "Purger les sessions",
    description:
      "Supprime les sessions expirées et celles révoquées depuis plus de 7 jours (fait chaque nuit à 4 h). Aucune session en cours n'est fermée.",
    cost: "Aucun.",
    async run() {
      const result = await post<ActionResult>("/api/admin/actions/sessions-cleanup");
      return `${number(result.count ?? 0)} session${(result.count ?? 0) > 1 ? "s" : ""} supprimée${(result.count ?? 0) > 1 ? "s" : ""}.`;
    },
  },
];

function storedJournal(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function Actions() {
  const { refreshNow } = useRefresh();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Entry>>({});
  const [journal, setJournal] = useState<Entry[]>(storedJournal);
  const imports = useApi<GtfsImport[]>("/api/gtfs/imports?limit=1");
  const gtfsImport = imports.data?.[0] ?? null;
  const reloadImports = imports.reload;

  // The last import, followed every 5 s while it runs
  useEffect(() => {
    if (gtfsImport?.status !== "RUNNING") return;
    const timer = window.setInterval(reloadImports, 5_000);
    return () => window.clearInterval(timer);
  }, [gtfsImport?.status, reloadImports]);

  const run = async (action: Action) => {
    setConfirming(null);
    setRunning(action.id);
    let entry: Entry;
    try {
      entry = { at: new Date().toISOString(), action: action.title, ok: true, text: await action.run() };
    } catch (error) {
      const text =
        error instanceof ApiError && error.status === 409
          ? "Un import est déjà en cours."
          : `Échec : ${error instanceof Error ? error.message : String(error)}`;
      entry = { at: new Date().toISOString(), action: action.title, ok: false, text };
    }
    setRunning(null);
    setResults((previous) => ({ ...previous, [action.id]: entry }));
    setJournal((previous) => {
      const next = [entry, ...previous].slice(0, 30);
      try {
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
      } catch {
        // Kept for this page only
      }
      return next;
    });
    // The import is recorded once started, in the background
    if (action.id === "gtfs") window.setTimeout(reloadImports, 1_500);
    refreshNow();
  };

  return (
    <>
      <PageTitle title="Actions">
        Ce que le serveur fait de lui-même, à lancer tout de suite. Chaque action demande une confirmation.
      </PageTitle>

      <Section title="Lancer" id="run">
        <ul className={styles.actions}>
          {actions.map((action) => {
            const result = results[action.id];
            return (
              <li key={action.id} className={styles.action}>
                <div className={styles.block}>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                  <p>Coût : {action.cost}</p>
                </div>
                <div className={styles.actionButtons}>
                  {confirming === action.id ? (
                    <>
                      <Button kind="primary" onClick={() => void run(action)}>
                        Confirmer
                      </Button>
                      <Button onClick={() => setConfirming(null)}>Annuler</Button>
                    </>
                  ) : (
                    <Button onClick={() => setConfirming(action.id)} disabled={running !== null}>
                      {running === action.id ? "En cours…" : action.title}
                    </Button>
                  )}
                </div>
                {result && (
                  <div className={styles.result} role="status">
                    <StatusBadge tone={result.ok ? "ok" : "bad"}>{result.text}</StatusBadge>
                  </div>
                )}
                {action.id === "gtfs" && gtfsImport && (
                  <div className={styles.result}>
                    <ImportState gtfsImport={gtfsImport} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Journal" id="journal" aside="Sur ce navigateur, 30 dernières actions">
        {journal.length === 0 ? (
          <Note>Aucune action lancée d'ici.</Note>
        ) : (
          <ul className={styles.alerts}>
            {journal.map((entry) => (
              <li key={entry.at + entry.action}>
                <StatusBadge tone={entry.ok ? "ok" : "bad"}>
                  {dateTime(entry.at)} · {entry.action} : {entry.text}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function ImportState({ gtfsImport }: { gtfsImport: GtfsImport }) {
  if (gtfsImport.status === "RUNNING") {
    return <StatusBadge tone="warn">Import en cours depuis {relative(gtfsImport.startedAt).replace("il y a ", "")}…</StatusBadge>;
  }
  const seconds = importSeconds(gtfsImport);
  return gtfsImport.status === "SUCCESS" ? (
    <StatusBadge tone="ok">
      Dernier import réussi {relative(gtfsImport.finishedAt)}
      {seconds !== null ? ` en ${duration(seconds)}` : ""}
    </StatusBadge>
  ) : (
    <StatusBadge tone="bad">
      Dernier import échoué {relative(gtfsImport.finishedAt)} : {gtfsImport.error}
    </StatusBadge>
  );
}
