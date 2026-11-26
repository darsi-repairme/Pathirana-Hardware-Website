"use client";

import { useEffect, useRef } from "react";

/**
 * Opens a page's "Add" dialog when the URL has ?new=1 (Dashboard Quick Actions), then removes the
 * parameter so a refresh or Back does not reopen it.
 */
export function useOpenNew(open: () => void) {
  const done = useRef(false);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    openRef.current();
  }, []);
}
