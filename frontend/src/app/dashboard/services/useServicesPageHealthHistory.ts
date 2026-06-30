"use client";

import { useEffect, useState } from "react";

import type { UpstreamHealth } from "@/features/services/api/serviceApi";

import type { HealthHistoryEntry } from "./servicesPageTypes";

export function useServicesPageHealthHistory(healthMap?: Record<string, UpstreamHealth>) {
  const [healthHistory, setHealthHistory] = useState<Record<string, HealthHistoryEntry>>({});

  useEffect(() => {
    if (!healthMap) return;

    setHealthHistory((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const [serviceId, health] of Object.entries(healthMap)) {
        const entry = next[serviceId] ?? {};
        if (health.status === "up" && entry.last_up_at !== health.checked_at) {
          next[serviceId] = { ...entry, last_up_at: health.checked_at };
          changed = true;
        } else if (health.status === "down" && entry.last_down_at !== health.checked_at) {
          next[serviceId] = { ...entry, last_down_at: health.checked_at };
          changed = true;
        } else if (health.status === "unknown" && entry.last_unknown_at !== health.checked_at) {
          next[serviceId] = { ...entry, last_unknown_at: health.checked_at };
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [healthMap]);

  return healthHistory;
}
