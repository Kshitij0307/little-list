import { Feather } from "lucide-react";
import styles from "./brand.module.css";

export function Brand() {
  return (
    <span className={styles.brand}>
      <Feather size={22} aria-hidden="true" />
      little list.
    </span>
  );
}
