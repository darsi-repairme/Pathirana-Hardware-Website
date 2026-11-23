"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Loads `path` from the API (null = don't load yet). State is only set when
 * the request settles; `reload` re-runs it (e.g. after a change, or Retry).
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; path?: string | null }>({});
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    api
      .get<T>(path)
      .then((data) => alive && setState({ data, path }))
      .catch((e: Error) => alive && setState((s) => ({ data: s.data, error: e.message, path })));
    return () => {
      alive = false;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return {
    data: state.data,
    error: state.error,
    /** True until the first response for the current path arrives. */
    loading: state.path !== path,
    reload,
  };
}
