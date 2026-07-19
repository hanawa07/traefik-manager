"use client";

import { CirclePause, Construction } from "lucide-react";
import { useEffect, useState } from "react";

import type { RoutingMode } from "../api/serviceApi";
import { formatMaintenanceRemaining } from "../lib/maintenanceSchedule";

export function ServiceCardRoutingModeBadge({
  routingMode,
  maintenanceUntil,
}: {
  routingMode: RoutingMode;
  maintenanceUntil?: string | null;
}) {
  if (routingMode === "active") return null;

  const disabled = routingMode === "disabled";
  if (!disabled) return <MaintenanceBadge maintenanceUntil={maintenanceUntil} />;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
    >
      <CirclePause className="h-3 w-3" />
      라우팅 비활성
    </span>
  );
}

function MaintenanceBadge({ maintenanceUntil }: { maintenanceUntil?: string | null }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = formatMaintenanceRemaining(maintenanceUntil, now);

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      title={maintenanceUntil || undefined}
      suppressHydrationWarning
    >
      <Construction className="h-3 w-3" />
      점검 안내 중{remaining ? ` · ${remaining}` : ""}
    </span>
  );
}
