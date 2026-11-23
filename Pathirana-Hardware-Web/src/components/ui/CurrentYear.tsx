"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * The build year in the static HTML (server snapshot), switched to the
 * visitor's current year right after hydration — no hydration mismatch.
 */
export function CurrentYear({ initial }: { initial: number }) {
  const year = useSyncExternalStore(
    noSubscribe,
    () => new Date().getFullYear(),
    () => initial,
  );
  return <>{year}</>;
}
