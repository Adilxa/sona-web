import styles from "./sona-loader.module.css";

export function SonaLoader({ label = "Загружаем…" }: { label?: string }) {
  return (
    <span className={styles.loader} role="status">
      <span className={styles.wave} aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span>{label}</span>
    </span>
  );
}

export function RouteLoader() {
  return <div className={styles.page}><SonaLoader label="Загружаем страницу…" /></div>;
}
