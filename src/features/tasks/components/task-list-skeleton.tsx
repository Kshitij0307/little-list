import styles from "./task-list-skeleton.module.css";

export function TaskListSkeleton() {
  return (
    <div role="status" aria-label="Loading tasks" className={styles.list}>
      {[0, 1, 2].map((row) => (
        <div key={row} className={styles.row} aria-hidden="true">
          <span className={styles.checkbox} />
          <div className={styles.copy}>
            <span className={styles.title} />
            <span className={styles.note} />
          </div>
          <span className={styles.action} />
        </div>
      ))}
    </div>
  );
}
