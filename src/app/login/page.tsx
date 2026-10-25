import { redirect } from "next/navigation";
import { Feather } from "lucide-react";
import { ThemeMenu } from "@/components/theme-menu";
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
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Feather size={22} /> little list.
        </span>
        <ThemeMenu />
      </header>
      <main className={styles.card}>
        <p className={styles.eyebrow}>A little space for you</p>
        <h1>
          Your thoughts.
          <br />
          Your little list.
        </h1>
        <p className={styles.copy}>
          A calm place for everything you want to do. Sign in to keep your
          personal notebook with you, on any device.
        </p>
        {error && (
          <p className={styles.error} role="alert">
            We couldn’t finish signing you in. Please try again.
          </p>
        )}
        <form action={signInWithGoogle}>
          <AuthSubmitButton pendingLabel="Connecting to Google…">
            Continue with Google
          </AuthSubmitButton>
        </form>
        <p className={styles.note}>
          Your tasks belong to your account. Other users can’t see or change
          them.
        </p>
      </main>
      <footer className={styles.footer}>Less noise. More doing.</footer>
    </div>
  );
}
