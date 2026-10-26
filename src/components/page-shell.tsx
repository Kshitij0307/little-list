import type { ReactNode } from "react";
import { Brand } from "./brand";
import { ThemeMenu } from "./theme-menu";
import styles from "./page-shell.module.css";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/" aria-label="Little list home">
          <Brand />
        </a>
        <div className={styles.actions}>
          <span className={styles.caption}>A little space for you</span>
          <ThemeMenu />
        </div>
      </header>
      {children}
      <footer className={styles.footer}>Less noise. More doing.</footer>
    </div>
  );
}
