import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import paper from "./ui/paper.module.css";
import styles from "./notebook-notice.module.css";

export function NotebookNotice({
  kind,
  onRetry,
  embedded = false,
  description,
}: {
  kind: "error" | "not-found";
  onRetry?: () => void;
  embedded?: boolean;
  description?: string;
}) {
  const missing = kind === "not-found";
  const Container = embedded ? "section" : "main";
  const Heading = embedded ? "h2" : "h1";
  return (
    <Container
      className={`${styles.center} ${embedded ? styles.embedded : ""}`}
    >
      <div className={`${paper.surface} ${paper.margin} ${styles.note}`}>
        {missing ? (
          <p className={styles.code}>404</p>
        ) : (
          <p className={styles.eyebrow}>An unexpected error</p>
        )}
        <Heading>
          {missing ? "A page out of place." : "Something went wrong."}
        </Heading>
        <p className={styles.copy}>
          {description ??
            (missing
              ? "We couldn’t find this page. Check the link, or head back to your notebook."
              : "We couldn’t open this page. Please try again, or return to your notebook.")}
        </p>
        <div className={styles.actions}>
          {!missing && onRetry && (
            <Button onClick={onRetry}>
              <RotateCcw size={15} aria-hidden="true" />
              Try again
            </Button>
          )}
          <Button asChild variant={missing ? "default" : "outline"}>
            <a href="/">
              {missing && <ArrowLeft size={15} aria-hidden="true" />}Back to
              notebook
            </a>
          </Button>
        </div>
      </div>
    </Container>
  );
}
