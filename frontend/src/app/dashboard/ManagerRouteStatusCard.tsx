import type { ManagerRouteStatus } from "@/features/deployment/api/deploymentApi";

interface ManagerRouteStatusCardProps {
  route?: ManagerRouteStatus | null;
}

export function ManagerRouteStatusCard({ route }: ManagerRouteStatusCardProps) {
  const tone = route?.healthy
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  const statusLabel = route === undefined
    ? "확인 중"
    : route?.healthy
      ? "정상"
      : "점검 필요";

  return (
    <section
      className={`mt-4 rounded-xl border p-4 text-xs ${tone}`}
      data-route-healthy={route?.healthy ? "true" : "false"}
      data-route-active-slot={route?.active_slot ?? "unknown"}
      data-route-provider={route?.provider ?? "unknown"}
      data-route-upstream-status={route?.upstream_status ?? "unknown"}
      data-testid="manager-route-status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Manager file-provider 라우터</h3>
          <p className="mt-1">{route?.message || "Traefik 라우터 상태를 확인하는 중입니다"}</p>
        </div>
        <span className="rounded-full bg-white/70 px-2.5 py-1 font-semibold dark:bg-slate-950/50">
          {statusLabel}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <RouteFact label="활성 슬롯" value={route?.active_slot || "-"} />
        <RouteFact label="Provider" value={route?.provider ? `${route.provider} provider` : "-"} />
        <RouteFact
          label="라우터"
          value={`${route?.https_router_status || "-"} / ${route?.http_router_status || "-"}`}
        />
        <RouteFact label="서비스" value={route?.service_status || "-"} />
        <RouteFact label="업스트림" value={route?.upstream_status || "-"} />
      </dl>
      {route?.upstream_url ? (
        <p className="mt-2 break-all font-mono text-[11px] opacity-80">{route.upstream_url}</p>
      ) : null}
    </section>
  );
}

function RouteFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 px-3 py-2 dark:bg-slate-950/40">
      <dt className="opacity-70">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
