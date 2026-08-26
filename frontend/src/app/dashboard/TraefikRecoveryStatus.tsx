import { ArchiveRestore, CircleAlert, ShieldCheck } from "lucide-react";

import type {
  TraefikCheckpointSummary,
  TraefikRecoverySummary,
} from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface TraefikRecoveryStatusProps {
  checkpoint?: TraefikCheckpointSummary;
  latestRecovery?: TraefikRecoverySummary;
  timezone?: string;
}

const SOURCE_LABELS: Record<NonNullable<TraefikRecoverySummary["source"]>, string> = {
  patch_update: "패치 업데이트",
  manual_safe: "수동 안전 경로",
};

export function TraefikRecoveryStatus({
  checkpoint,
  latestRecovery,
  timezone,
}: TraefikRecoveryStatusProps) {
  const checkpointReady = checkpoint?.status === "ready";
  const recoveryFailed = latestRecovery?.status === "rollback_failed";
  const recoveryInvalid = latestRecovery?.status === "invalid";

  return (
    <section
      className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700"
      data-checkpoint-status={checkpoint?.status ?? "loading"}
      data-recovery-status={latestRecovery?.status ?? "loading"}
      data-testid="traefik-recovery-status"
    >
      <p className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
        <ArchiveRestore className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
        안전 복구 상태
      </p>
      <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-slate-500 dark:text-slate-400">마지막 정상 체크포인트</dt>
          <dd
            className={`mt-1 flex items-center gap-1.5 font-semibold ${
              checkpointReady
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {checkpointReady ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">{checkpointLabel(checkpoint, timezone)}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500 dark:text-slate-400">최근 자동 복구</dt>
          <dd
            className={`mt-1 flex items-center gap-1.5 font-semibold ${
              recoveryFailed || recoveryInvalid
                ? "text-rose-700 dark:text-rose-300"
                : "text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {recoveryFailed || recoveryInvalid ? (
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">
              {recoveryLabel(latestRecovery, timezone)}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function checkpointLabel(checkpoint: TraefikCheckpointSummary | undefined, timezone?: string) {
  if (checkpoint?.status === "ready" && checkpoint.saved_at && checkpoint.version) {
    return `${formatDateTime(checkpoint.saved_at, timezone)} · ${checkpoint.version}`;
  }
  return checkpoint?.status === "invalid" ? "상태 파일 확인 필요" : "생성 이력 없음";
}

function recoveryLabel(recovery: TraefikRecoverySummary | undefined, timezone?: string) {
  if (recovery?.status === "invalid") return "결과 파일 확인 필요";
  if (
    recovery?.status !== "rolled_back"
    && recovery?.status !== "rollback_failed"
  ) return "자동 복구 이력 없음";
  const result = recovery.status === "rolled_back" ? "복구 완료" : "복구 실패";
  const source = recovery.source ? SOURCE_LABELS[recovery.source] : "";
  const occurredAt = recovery.occurred_at
    ? formatDateTime(recovery.occurred_at, timezone)
    : "시각 미확인";
  return [result, source, occurredAt].filter(Boolean).join(" · ");
}
