import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import paper from "@/components/ui/paper.module.css";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import styles from "@/features/auth/components/auth.module.css";
import { signInWithGoogle } from "@/features/auth/server/actions";
import { currentSession } from "@/features/auth/server/session";
import { storageMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (storageMode() === "local") redirect("/");
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;
  return (
    <PageShell>
      <div className={styles.center}>
        <main className={`${paper.surface} ${paper.margin} ${styles.card}`}>
          <h1>
            Big thoughts.
            <br />
            Little steps.
          </h1>
          <p className={styles.copy}>One thing at a time.</p>
          <div
            className={styles.illustration}
            aria-label="Illustrative task list"
          >
            <p className={styles.listLabel}>A little plan for today</p>
            <ul className={styles.sampleList}>
              <li>
                <span className={styles.checkbox} aria-hidden="true" />
                Make something lovely
              </li>
              <li>
                <span className={styles.checkbox} aria-hidden="true" />
                Take a walk
              </li>
              <li className={styles.completed}>
                <span
                  className={`${styles.checkbox} ${styles.checked}`}
                  aria-hidden="true"
                >
                  <Check size={11} />
                </span>
                <s>Start somewhere</s>
              </li>
            </ul>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              We couldn’t finish signing you in. Please try again.
            </p>
          )}
          <form action={signInWithGoogle}>
            <AuthSubmitButton pendingLabel="Connecting to Google…">
              <span className={styles.googleMark} aria-hidden="true">
                G
              </span>
              Continue with Google
            </AuthSubmitButton>
          </form>
          <p className={styles.note}>Personal. Private. On all your devices.</p>
        </main>
      </div>
    </PageShell>
  );
}
