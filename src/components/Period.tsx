import styles from "./Period.module.css";

const PERIODS = [7, 30, 90, 365];

/** Days shown by the charts of a page */
export function Period({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  return (
    <div className={styles.period} role="group" aria-label="Période">
      {PERIODS.map((option) => (
        <button key={option} type="button" aria-pressed={option === days} onClick={() => onChange(option)}>
          {option === 365 ? "1 an" : `${option} j`}
        </button>
      ))}
    </div>
  );
}
