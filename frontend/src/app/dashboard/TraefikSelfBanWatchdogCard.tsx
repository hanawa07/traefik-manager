import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { TraefikSelfBanWatchdog } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface TraefikSelfBanWatchdogCardProps {
  state?: TraefikSelfBanWatchdog;
  timezone?: string;
}

const statusView = (state?: TraefikSelfBanWatchdog) => {
  if (state?.status === "blocked") {
    return { label: "차단 남음", tone: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100" };
  }
  if (state?.stale) {
    return { label: "점검 지연", tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" };
  }
  if (state?.status === "recovered") {
    return { label: "자동 복구", tone: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100" };
  }
  if (state?.status === "healthy") {
    return { label: "정상", tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100" };
  }
  return { label: "상태 없음", tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" };
};

const eventLabel = (event: TraefikSelfBanWatchdog["events"][number]) => {
  if (event.event === "auto_recovered") return `자기 차단 감지 후 ${event.unbanned_count}건 자동 해제`;
  if (event.event === "blocked") return "자기 차단 감지, 자동 해제 미완료";
  return "자기 차단 해제 확인";
};

export function TraefikSelfBanWatchdogCard({ state, timezone }: TraefikSelfBanWatchdogCardProps) {
  const view = statusView(state);
  const Icon = state?.status === "blocked" ? ShieldAlert : ShieldCheck;

  return (
    <section className={`mt-4 rounded-xl border px-4 py-3 text-xs ${view.tone}`} data-testid="traefik-self-ban-watchdog">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4" />
          Traefik 자기 차단 방어
        </p>
        <span className="rounded-full border border-current/20 px-2 py-0.5 font-semibold">{view.label}</span>
      </div>
      <p className="mt-2 opacity-90">
        호스트 watchdog이 Fail2ban을 직접 확인합니다. 장애 중에는 이 화면이 열리지 않으며, 아래 결과는 복구 후 표시됩니다.
      </p>
      <p className="mt-1">
        마지막 점검: {formatDateTime(state?.checked_at, timezone)} · 활성 Jail {state?.active_jail_count ?? 0}개
        {state?.stale ? ` · ${state.stale_after_minutes}분 이상 갱신 없음` : ""}
      </p>
      <p className="mt-1">
        최근 감지: {formatDateTime(state?.last_incident_at, timezone)} · 최근 복구: {formatDateTime(state?.last_recovery_at, timezone)}
        {state?.last_notification_status ? ` · 직접 알림 ${notificationLabel(state.last_notification_status)}` : ""}
      </p>
      {state?.remaining_jails.length ? (
        <p className="mt-1 font-semibold">차단이 남은 Jail: {state.remaining_jails.join(", ")}</p>
      ) : null}
      {state?.events.length ? (
        <div className="mt-3 border-t border-current/15 pt-2">
          <p className="font-semibold">최근 감지·복구 이력</p>
          <ul className="mt-1 space-y-1">
            {state.events.slice(0, 5).map((event) => (
              <li key={`${event.event}-${event.occurred_at}`}>
                {formatDateTime(event.occurred_at, timezone)} · {eventLabel(event)}
                {event.jails.length ? ` · ${event.jails.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function notificationLabel(status: NonNullable<TraefikSelfBanWatchdog["last_notification_status"]>) {
  if (status === "sent") return "성공";
  if (status === "failed") return "실패";
  return "비활성";
}
