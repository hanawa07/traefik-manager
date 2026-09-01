import { Cloud, CloudAlert } from "lucide-react";

import type { CloudflareIpProtection } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface CloudflareIpProtectionCardProps {
  state?: CloudflareIpProtection;
  timezone?: string;
}

const components: Array<{
  key: keyof CloudflareIpProtection["components"];
  label: string;
}> = [
  { key: "traefik_web", label: "Traefik HTTP" },
  { key: "traefik_websecure", label: "Traefik HTTPS" },
  { key: "hanastay_apache", label: "Hanastay Apache" },
  { key: "fail2ban_auth", label: "Fail2Ban 로그인" },
  { key: "fail2ban_probe", label: "빠른 스캔" },
  { key: "fail2ban_slow", label: "저속 스캔" },
];

const statusView = (state?: CloudflareIpProtection) => {
  if (state?.stale) {
    return {
      label: "점검 지연",
      tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    };
  }
  if (state?.status === "drift") {
    return {
      label: "설정 불일치",
      tone: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100",
    };
  }
  if (state?.status === "unavailable") {
    return {
      label: "확인 실패",
      tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    };
  }
  if (state?.status === "healthy") {
    return {
      label: "정상",
      tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
    };
  }
  return {
    label: "상태 없음",
    tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
  };
};

const componentLabel = (status: CloudflareIpProtection["components"][keyof CloudflareIpProtection["components"]]) => {
  if (status === "ok") return "정상";
  if (status === "drift") return "불일치";
  if (status === "unavailable") return "확인 실패";
  return "상태 없음";
};

export function CloudflareIpProtectionCard({
  state,
  timezone,
}: CloudflareIpProtectionCardProps) {
  const view = statusView(state);
  const Icon = state?.status === "healthy" && !state.stale ? Cloud : CloudAlert;

  return (
    <section
      className={`card mb-4 border p-4 sm:mb-6 sm:p-5 ${view.tone}`}
      data-testid="cloudflare-ip-protection"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-5 w-5" />
          Cloudflare IP 대역 보호
        </h2>
        <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-semibold">
          {view.label}
        </span>
      </div>

      <p className="mt-2 text-xs opacity-90">
        공식 프록시 대역의 전달 헤더 신뢰 설정과 Fail2Ban 예외·오차단을 하루 한 번 확인합니다.
        Cloudflare WAF 규칙 본문은 현재 읽기 권한이 없어 이 상태에 포함하지 않습니다.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {components.map(({ key, label }) => {
          const status = state?.components[key] ?? "unknown";
          return (
            <div
              className="flex items-center justify-between rounded-lg border border-current/15 bg-white/55 px-3 py-2 text-xs dark:bg-slate-950/35"
              key={key}
            >
              <span>{label}</span>
              <span className="font-semibold">{componentLabel(status)}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs opacity-80">
        마지막 점검: {formatDateTime(state?.checked_at, timezone)}
        {state?.stale ? ` · ${state.stale_after_hours}시간 이상 갱신 없음` : ""}
      </p>
    </section>
  );
}
