import { KeyRound } from "lucide-react";

import type {
  SmokeRotationState,
  SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";
import {
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

const STATUS_LABELS: Record<SmokeRotationState, string> = {
  never: "실행 기록 없음",
  running: "진행 중",
  success: "정상",
  failure: "실패",
};

const STATUS_STYLES: Record<SmokeRotationState, string> = {
  never: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function SmokeRotationStatusCard({
  isLoading,
  isError,
  status,
  timezone,
}: {
  isLoading: boolean;
  isError: boolean;
  status?: SmokeRotationStatus;
  timezone?: string;
}) {
  const isStaleSuccess = status?.status === "success" && status.is_stale;
  return (
    <div className="card order-6 p-6" data-testid="smoke-rotation-status-card">
      <SettingsCardHeader
        icon={<KeyRound className="h-5 w-5 text-cyan-600" />}
        title="스모크 계정 자동 회전"
        description="예약된 운영 검사용 viewer 비밀번호와 GitHub Actions secret의 최근 동기화 상태입니다."
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isError || !status ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">회전 상태를 불러오지 못했습니다.</p>
      ) : (
        <SettingsSummary>
          <SettingsSummaryRow
            label="상태"
            value={
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isStaleSuccess ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : STATUS_STYLES[status.status]}`}>
                {isStaleSuccess ? "점검 필요" : STATUS_LABELS[status.status]}
              </span>
            }
          />
          <SettingsSummaryRow label="최근 시도" value={formatDateTime(status.last_attempt_at, timezone)} />
          <SettingsSummaryRow label="최근 성공" value={formatDateTime(status.last_success_at, timezone)} />
          <SettingsSummaryRow label="실행 주기" value="매월 1일 04:17" />
          {status.detail ? <SettingsSummaryRow label="세부 상태" value={status.detail} /> : null}
          {status.is_stale ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              마지막 성공 후 {status.stale_after_days}일이 지났습니다. cron 실행 로그와 GitHub secret 동기화를 확인하세요.
            </div>
          ) : null}
        </SettingsSummary>
      )}
    </div>
  );
}
