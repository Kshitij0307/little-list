"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STATUSES, type TaskStatus } from "../domain/task";

function readStatus(value: string | null): TaskStatus {
  return STATUSES.find((status) => status === value) ?? "todo";
}

function readFlag(value: string | null) {
  return value === "true";
}

function useQueryParamState<T>(
  parameter: string,
  read: (value: string | null) => T,
  write: (value: T) => string | null,
) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const requestedValue = read(searchParams.get(parameter));
  const [pendingSelection, setPendingSelection] = useState<{
    query: string;
    value: T;
  } | null>(null);
  const value =
    pendingSelection?.query === currentQuery
      ? pendingSelection.value
      : requestedValue;

  const setValue = useCallback(
    (nextValue: T) => {
      const params = new URLSearchParams(window.location.search);
      const encoded = write(nextValue);
      if (encoded === null) params.delete(parameter);
      else params.set(parameter, encoded);
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
      setPendingSelection({ query, value: nextValue });
    },
    [parameter, write],
  );

  return [value, setValue] as const;
}

const writeStatus = (status: TaskStatus) => (status === "todo" ? null : status);
const writeFlag = (enabled: boolean) => (enabled ? "true" : null);

export function useStatusQueryParam(parameter: string) {
  return useQueryParamState(parameter, readStatus, writeStatus);
}

export function useFlagQueryParam(parameter: string) {
  return useQueryParamState(parameter, readFlag, writeFlag);
}
