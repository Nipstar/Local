"use client";

import { useEffect } from "react";

/** Fires a one-shot view beacon for owner analytics (spec Phase 5). */
export function ViewBeacon({ businessId }: { businessId: string }) {
  useEffect(() => {
    const key = `viewed:${businessId}`;
    if (sessionStorage.getItem(key)) return; // once per session
    sessionStorage.setItem(key, "1");
    fetch(`/api/track/${businessId}`, { method: "POST", keepalive: true }).catch(() => {});
  }, [businessId]);
  return null;
}
