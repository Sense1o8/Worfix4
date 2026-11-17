"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getVersion, subscribe } from "./db";

/** Re-render whenever the local store changes (this tab or another). */
export function useStoreVersion() {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}

export interface Query<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Run an async API call, re-run when the store changes or deps change. Ignores stale responses. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const version = useStoreVersion();
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean }>({
    data: undefined, error: null, loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const mine = ++seq.current;
    fnRef
      .current()
      .then((data) => mine === seq.current && setState({ data, error: null, loading: false }))
      .catch((error: Error) => mine === seq.current && setState((s) => ({ data: s.data, error, loading: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
