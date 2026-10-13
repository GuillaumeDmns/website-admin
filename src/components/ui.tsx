// Building blocks of the pages: sections, key figures, meters, status badges, line badges, loading and error states.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { LineSummary } from "../api/types";
import type { Resource } from "../data";
import { percent } from "../format";
import type { Tone } from "../stats";
import styles from "./ui.module.css";

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className={styles.pageTitle}>
      <title>{`${title} · Administration`}</title>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className={styles.section} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className={styles.sectionHead}>
        <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children, min = "13rem" }: { children: ReactNode; min?: string }) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}>
      {children}
    </div>
  );
}

/** A key figure: its label, value, a detail line and an optional small chart */
export function Kpi({
  label,
  value,
  detail,
  tone,
  to,
  chart,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  to?: string;
  chart?: ReactNode;
}) {
  const content = (
    <>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue} data-tone={tone}>
        {value}
      </span>
      {detail && <span className={styles.kpiDetail}>{detail}</span>}
      {chart && <span className={styles.kpiChart}>{chart}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={`${styles.kpi} ${styles.kpiLink}`}>
      {content}
    </Link>
  ) : (
    <div className={styles.kpi}>{content}</div>
  );
}

/** How much of something is used: a bar, colored by [tone] (from the ratio unless given), with an optional mark */
export function Meter({
  label,
  value,
  max,
  text,
  tone,
  mark,
  markLabel,
}: {
  label: ReactNode;
  value: number;
  max: number;
  text?: ReactNode;
  tone?: Tone;
  mark?: number;
  markLabel?: string;
}) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const shownTone = tone ?? (ratio >= 0.9 ? "bad" : ratio >= 0.75 ? "warn" : "ok");
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <span className={styles.meterText}>{text ?? percent(ratio)}</span>
      </div>
      <div
        className={styles.meterTrack}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={typeof label === "string" ? label : undefined}
      >
        <div className={styles.meterFill} data-tone={shownTone} style={{ width: `${ratio * 100}%` }} />
        {mark !== undefined && max > 0 && (
          <div className={styles.meterMark} style={{ left: `${Math.min(mark / max, 1) * 100}%` }} title={markLabel} />
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={styles.badge} data-tone={tone}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

/** A line as the apps show it: its name on its color */
export function LineBadge({ line }: { line: LineSummary }) {
  return (
    <span
      className={styles.line}
      style={{ background: line.color ? `#${line.color}` : undefined, color: line.textColor ? `#${line.textColor}` : undefined }}
      title={line.longName ?? undefined}
    >
      {line.name}
    </span>
  );
}

/** A table with the page's style */
export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

/** Shows [children] with the data once loaded; the loading state, or the error with a retry, otherwise */
export function Load<T>({ resource, children, label }: { resource: Resource<T>; children: (data: T) => ReactNode; label: string }) {
  if (resource.data !== undefined) {
    return (
      <>
        {resource.error && (
          <p className={styles.stale} role="status">
            Données de {label} pas à jour : {resource.error.message}
          </p>
        )}
        {children(resource.data)}
      </>
    );
  }
  if (resource.error) {
    return (
      <div className={styles.failure} role="alert">
        <p>
          Impossible de charger {label} : {resource.error.message}
        </p>
        <button type="button" className={styles.button} onClick={resource.reload}>
          Réessayer
        </button>
      </div>
    );
  }
  return (
    <p className={styles.loading} role="status">
      Chargement de {label}…
    </p>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  kind = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind?: "default" | "primary" | "danger";
}) {
  return (
    <button type="button" className={styles.button} data-kind={kind} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
