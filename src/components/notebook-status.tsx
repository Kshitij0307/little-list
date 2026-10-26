import { Feather } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import styles from "./notebook-status.module.css";

export function NotebookStatus({
  onRetry,
  embedded = false,
}: {
  onRetry?: () => void;
  embedded?: boolean;
}) {
  const Container = embedded ? "section" : "main";
  const Heading = embedded ? "h2" : "h1";
  const content = (
    <Container
      className={`${styles.content} ${embedded ? styles.embedded : ""}`}
    >
      <div className={styles.message} role="status">
        <div className={styles.leaf}>
          <Feather size={24} aria-hidden="true" />
        </div>
        <Heading>
          {onRetry ? "Let’s try that again." : "A moment for your notebook."}
        </Heading>
        <p>
          {onRetry
            ? "We couldn’t connect to your notebook. Please try again."
            : "Picking up where you left off…"}
        </p>
        {!onRetry && (
          <div className={styles.dots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </Container>
  );
  return embedded ? content : <PageShell>{content}</PageShell>;
}
