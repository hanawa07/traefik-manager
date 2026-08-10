import { CircleSlash2 } from "lucide-react";

import type { ManagerHttpClientCancellationSummary } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerHttpClientCancellationStatusProps {
  summary?: ManagerHttpClientCancellationSummary | null;
  timezone?: string;
}

export function ManagerHttpClientCancellationStatus({
  summary,
  timezone,
}: ManagerHttpClientCancellationStatusProps) {
  return (
    <div
      className="border-b border-slate-200 px-4 py-3 text-xs dark:border-slate-700"
      data-client-cancellation-available={summary?.available ? "true" : "false"}
      data-client-cancellation-count={summary?.count ?? ""}
      data-client-cancellation-coverage={summary?.sample_coverage_percent ?? ""}
      data-testid="manager-http-client-cancellation"
    >
      <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
        <CircleSlash2 className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
        <span>499 클라이언트 취소</span>
      </div>
      {summary?.available ? (
        <>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Traefik 최근 로그 표본 {summary.count}건 · 관측 시작{" "}
            {formatDateTime(summary.observed_since, timezone)} · 조회 기간 표본{" "}
            {summary.sample_coverage_percent}%
          </p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            화면 이동처럼 클라이언트가 연결을 먼저 닫은 요청이며 서버 오류·임계치 계산에서 제외합니다.
          </p>
          {summary.top_paths.length > 0 ? (
            <p className="mt-1 break-all text-slate-500 dark:text-slate-400">
              상위 경로:{" "}
              {summary.top_paths
                .map((item) => `${item.path} ${item.count}건`)
                .join(" · ")}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {summary?.message ?? "Traefik 접근 로그를 확인하는 중입니다."}
        </p>
      )}
    </div>
  );
}
