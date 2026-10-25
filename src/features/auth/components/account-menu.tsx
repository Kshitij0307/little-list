import { signOut } from "../server/actions";
import { AuthSubmitButton } from "./auth-submit-button";
import styles from "./auth.module.css";

export function AccountMenu({ email }: { email?: string }) {
  return (
    <div className={styles.account}>
      <span className={styles.email} title={email}>
        {email ?? "Your account"}
      </span>
      <form action={signOut}>
        <AuthSubmitButton small pendingLabel="Signing out…">
          Sign out
        </AuthSubmitButton>
      </form>
    </div>
  );
}
