// Charts without a library: bars (stacked series) and lines in HTML and SVG, sized by their container. Each one
// keeps its numbers in a table under "Données", with a CSV export.

import { useId, type ReactNode } from "react";

import { number, oneDecimal } from "../format";
import { sum } from "../stats";
import { niceMax, toCsv } from "./chartMath";
import styles from "./charts.module.css";

export interface Series {
  label: string;
  values: number[];
}

const COLORS = ["var(--series-1)", "var(--series-3)", "var(--series-2)", "var(--series-4)", "var(--series-6)", "var(--series-5)"];

const color = (index: number) => COLORS[index % COLORS.length];

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Data({ title, labels, series, format }: { title: string; labels: string[]; series: Series[]; format: (value: number) => string }) {
  const header = ["", ...series.map((entry) => entry.label), ...(series.length > 1 ? ["Total"] : [])];
  const rows = labels.map((label, index) => {
    const values = series.map((entry) => entry.values[index] ?? 0);
    return [label, ...values, ...(series.length > 1 ? [sum(values)] : [])];
  });
  const fileName = `${title
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/gi, "-")
    .replace(/^-|-$/g, "")}.csv`;
  return (
    <details className={styles.data}>
      <summary>Données</summary>
      <button type="button" className={styles.csv} onClick={() => download(fileName, toCsv(header, rows))}>
        Exporter en CSV
      </button>
      <div className={styles.dataTable}>
        <table>
          <thead>
            <tr>
              {header.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...values], row) => (
              <tr key={row}>
                <th scope="row">{label}</th>
                {values.map((value, index) => (
                  <td key={index}>{format(Number(value))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className={styles.legend}>
      {series.map((entry, index) => (
        <li key={entry.label}>
          <span className={styles.swatch} style={{ background: color(index) }} aria-hidden="true" />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

function Axis({ max, format }: { max: number; format: (value: number) => string }) {
  return (
    <div className={styles.axis} aria-hidden="true">
      <span>{format(max)}</span>
      <span>{Number.isInteger(max / 2) ? format(max / 2) : oneDecimal(max / 2)}</span>
      <span>0</span>
    </div>
  );
}

function XLabels({ labels }: { labels: string[] }) {
  // About 5 labels at most (charts can be half the page wide), the last one always
  const every = Math.max(1, Math.ceil(labels.length / 5));
  return (
    <div className={styles.xLabels} aria-hidden="true">
      {labels.map((label, index) => (
        <span key={index}>{(labels.length - 1 - index) % every === 0 ? label : ""}</span>
      ))}
    </div>
  );
}

interface ChartProps {
  /** What the chart shows, for screen readers and the CSV file */
  title: string;
  labels: string[];
  series: Series[];
  format?: (value: number) => string;
  height?: number;
  /** Shown under the chart */
  footer?: ReactNode;
}

/** Bars per label, the series stacked */
export function BarChart({ title, labels, series, format = number, height = 180, footer }: ChartProps) {
  const totals = labels.map((_, index) => sum(series.map((entry) => entry.values[index] ?? 0)));
  const max = niceMax(Math.max(0, ...totals));
  const summary = `${title} : ${labels.length} valeurs, maximum ${format(Math.max(0, ...totals))}, total ${format(sum(totals))}`;
  return (
    <figure className={styles.chart}>
      <div className={styles.plot} style={{ height }}>
        <Axis max={max} format={format} />
        <div className={styles.area} role="img" aria-label={summary}>
          <div className={styles.grid} aria-hidden="true" />
          {labels.map((label, index) => (
            <div
              key={index}
              className={styles.column}
              title={`${label}\n${series.map((entry) => `${entry.label} : ${format(entry.values[index] ?? 0)}`).join("\n")}`}
            >
              {series.map((entry, position) =>
                (entry.values[index] ?? 0) > 0 ? (
                  <div
                    key={entry.label}
                    className={styles.segment}
                    style={{ height: `${((entry.values[index] ?? 0) / max) * 100}%`, background: color(position) }}
                  />
                ) : null,
              )}
            </div>
          ))}
        </div>
      </div>
      <XLabels labels={labels} />
      <Legend series={series} />
      {footer}
      <Data title={title} labels={labels} series={series} format={format} />
    </figure>
  );
}

/** Lines per series over the labels */
export function LineChart({ title, labels, series, format = number, height = 180, footer }: ChartProps) {
  const max = niceMax(Math.max(0, ...series.flatMap((entry) => entry.values)));
  const x = (index: number) => (labels.length < 2 ? 50 : (index / (labels.length - 1)) * 100);
  const y = (value: number) => 100 - (value / max) * 100;
  const last = series.map((entry) => `${entry.label} ${format(entry.values.at(-1) ?? 0)}`).join(", ");
  return (
    <figure className={styles.chart}>
      <div className={styles.plot} style={{ height }}>
        <Axis max={max} format={format} />
        <div className={styles.area} role="img" aria-label={`${title} : ${last} au ${labels.at(-1) ?? ""}`}>
          <div className={styles.grid} aria-hidden="true" />
          <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {series.map((entry, index) => (
              <polyline
                key={entry.label}
                points={entry.values.map((value, position) => `${x(position)},${y(value)}`).join(" ")}
                style={{ stroke: color(index) }}
              />
            ))}
          </svg>
        </div>
      </div>
      <XLabels labels={labels} />
      <Legend series={series} />
      {footer}
      <Data title={title} labels={labels} series={series} format={format} />
    </figure>
  );
}

/** A small line without axis, for a key figure */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const id = useId();
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${30 - (value / max) * 28}`).join(" ");
  return (
    <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-labelledby={id}>
      <title id={id}>{label}</title>
      <polyline points={points} />
    </svg>
  );
}

/** Horizontal bars, one per row, scaled on the biggest */
export function HBars({
  rows,
  format = number,
}: {
  rows: { label: ReactNode; value: number; key: string; hint?: string }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className={styles.hbars}>
      {rows.map((row) => (
        <li key={row.key} title={row.hint}>
          <span className={styles.hlabel}>{row.label}</span>
          <span className={styles.htrack} aria-hidden="true">
            <span className={styles.hfill} style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className={styles.hvalue}>{format(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}
