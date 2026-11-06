"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import styles from "./unsaved-changes-provider.module.css";

const HISTORY_INDEX = "__littleListNavigationIndex";

type GuardContextValue = {
  setDirty(token: symbol, dirty: boolean): void;
  navigate(action: () => void): boolean;
};

const GuardContext = createContext<GuardContextValue | null>(null);

function UnsavedChangesDialog({
  open,
  onStay,
  onDiscard,
}: {
  open: boolean;
  onStay(): void;
  onDiscard(): void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const stayButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    stayButton.current?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onStay();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyDown, true);
    return () => {
      document.removeEventListener("keydown", keyDown, true);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onStay, open]);

  if (!open) return null;
  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onStay();
      }}
    >
      <section
        ref={dialog}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
      >
        <p className={styles.eyebrow}>Unsaved changes</p>
        <h2 id="unsaved-changes-title">Leave without saving?</h2>
        <p id="unsaved-changes-description" className={styles.copy}>
          Your edits haven’t been saved. If you leave now, they’ll be discarded.
        </p>
        <div className={styles.actions}>
          <Button ref={stayButton} type="button" onClick={onStay}>
            Keep editing
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            Discard changes
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function historyState(value: unknown, index: number) {
  return {
    ...(value && typeof value === "object" ? value : {}),
    [HISTORY_INDEX]: index,
  };
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<symbol, boolean>());
  const bypassUntil = useRef(0);
  const historyIndex = useRef(0);
  const restoringHistory = useRef(false);
  const pendingHistoryAction = useRef<(() => void) | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{
    action: () => void;
  } | null>(null);
  const hasChanges = useCallback(
    () => [...drafts.current.values()].some(Boolean),
    [],
  );
  const isBypassed = useCallback(() => Date.now() < bypassUntil.current, []);

  const setDirty = useCallback((token: symbol, dirty: boolean) => {
    if (dirty) drafts.current.set(token, true);
    else drafts.current.delete(token);
  }, []);

  const navigate = useCallback(
    (action: () => void) => {
      if (isBypassed() || !hasChanges()) {
        action();
        return true;
      }
      setPendingNavigation((current) => current ?? { action });
      return false;
    },
    [hasChanges, isBypassed],
  );

  useEffect(() => {
    const currentIndex = Number(window.history.state?.[HISTORY_INDEX]);
    historyIndex.current = Number.isFinite(currentIndex) ? currentIndex : 0;
    window.history.replaceState(
      historyState(window.history.state, historyIndex.current),
      "",
      window.location.href,
    );

    const pushState = window.history.pushState.bind(window.history);
    const replaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = (data, unused, url) => {
      historyIndex.current += 1;
      pushState(historyState(data, historyIndex.current), unused, url);
    };
    window.history.replaceState = (data, unused, url) => {
      replaceState(historyState(data, historyIndex.current), unused, url);
    };

    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        isBypassed() ||
        !hasChanges()
      )
        return;
      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a")
          : null;
      if (
        !anchor ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.href === current.href ||
        (destination.origin === current.origin &&
          destination.pathname === current.pathname &&
          destination.search === current.search)
      )
        return;

      event.preventDefault();
      event.stopPropagation();
      navigate(() => anchor.click());
    };

    const submit = (event: SubmitEvent) => {
      if (isBypassed() || !hasChanges()) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.dataset.navigationForm)
        return;
      event.preventDefault();
      event.stopPropagation();
      navigate(() =>
        form.requestSubmit(
          event.submitter instanceof HTMLElement ? event.submitter : undefined,
        ),
      );
    };

    const popState = (event: PopStateEvent) => {
      const nextIndex = Number(event.state?.[HISTORY_INDEX]);
      const previousIndex = historyIndex.current;
      if (Number.isFinite(nextIndex)) historyIndex.current = nextIndex;
      if (restoringHistory.current) {
        restoringHistory.current = false;
        const action = pendingHistoryAction.current;
        pendingHistoryAction.current = null;
        if (action) setPendingNavigation({ action });
        return;
      }
      if (isBypassed() || !hasChanges()) return;
      restoringHistory.current = true;
      const movedBack =
        !Number.isFinite(nextIndex) || nextIndex < previousIndex;
      const direction = movedBack ? -1 : 1;
      pendingHistoryAction.current = () => window.history.go(direction);
      window.history.go(-direction);
    };

    window.addEventListener("popstate", popState);
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      window.removeEventListener("popstate", popState);
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
    };
  }, [hasChanges, isBypassed, navigate]);

  const stay = useCallback(() => setPendingNavigation(null), []);
  const discard = useCallback(() => {
    const action = pendingNavigation?.action;
    setPendingNavigation(null);
    if (!action) return;
    bypassUntil.current = Date.now() + 1_000;
    action();
  }, [pendingNavigation]);
  const value = useMemo(() => ({ setDirty, navigate }), [navigate, setDirty]);
  return (
    <GuardContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={!!pendingNavigation}
        onStay={stay}
        onDiscard={discard}
      />
    </GuardContext.Provider>
  );
}

export function useUnsavedChangesGuard(dirty: boolean) {
  const guard = useContext(GuardContext);
  const token = useRef(Symbol("unsaved changes"));

  useEffect(() => {
    const id = token.current;
    guard?.setDirty(id, dirty);
    return () => guard?.setDirty(id, false);
  }, [dirty, guard]);
}

export function useGuardedNavigation() {
  const guard = useContext(GuardContext);
  return useCallback(
    (action: () => void) => {
      if (guard) return guard.navigate(action);
      action();
      return true;
    },
    [guard],
  );
}
