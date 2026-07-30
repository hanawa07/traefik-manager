import { useEffect, useRef, useState } from "react";

import type { SmokeRotationStatus } from "@/features/settings/api/settingsApi";
import {
  isGithubApiRefreshBlocked,
  isGithubSecondaryRateLimitBlocked,
} from "@/features/settings/lib/smokeGithubRateLimit";
import {
  findNewSmokeRun,
  getTrackedManualSmokeRun,
  LAST_MANUAL_SMOKE_RUN_STORAGE_KEY,
  parseTrackedManualSmokeRun,
  type TrackedManualSmokeRun,
} from "@/features/settings/lib/smokeManualRunTracking";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { getSettingsModelErrorMessage } from "./settingsModelErrors";

const MANUAL_RUN_POLL_INTERVAL_MS = 30_000;
const MANUAL_RUN_TRACKING_TIMEOUT_MS = 6 * 60_000;

interface UseManualSmokeRunTrackingOptions {
  canManage: boolean;
  onToast: (notice: ToastNoticeValue) => void;
  refreshHistory: () => Promise<SmokeRotationStatus>;
  status?: SmokeRotationStatus;
  timezone?: string;
}

export function useManualSmokeRunTracking({
  canManage,
  onToast,
  refreshHistory,
  status,
  timezone,
}: UseManualSmokeRunTrackingOptions) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastRun, setLastRun] = useState<TrackedManualSmokeRun | null>(null);
  const timerRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  useEffect(() => () => {
    generationRef.current += 1;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  useEffect(() => {
    try {
      setLastRun(
        parseTrackedManualSmokeRun(window.localStorage.getItem(LAST_MANUAL_SMOKE_RUN_STORAGE_KEY)),
      );
    } catch {
      setLastRun(null);
    }
  }, []);

  const handleOpen = () => {
    if (!canManage) return;
    const secondaryBlocked = isGithubSecondaryRateLimitBlocked(
      status?.monitoring_github_secondary_limit_retry_at,
    );
    if (
      isGithubApiRefreshBlocked(
        status?.monitoring_github_rate_limit_remaining,
        status?.monitoring_github_rate_limit_reset_at,
        status?.monitoring_github_secondary_limit_retry_at,
        status?.monitoring_github_refresh_reserve,
      )
    ) {
      const retryAt = secondaryBlocked
        ? status?.monitoring_github_secondary_limit_retry_at
        : status?.monitoring_github_rate_limit_reset_at;
      onToast({
        tone: "warning",
        message: "자동 결과 확인을 시작하지 않았습니다",
        detail: `GitHub API ${secondaryBlocked ? "보조 제한 재시도" : "초기화"} 시각 ${formatDateTime(retryAt, timezone)} 이후 사용할 수 있습니다.`,
      });
      return;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const startedAt = Date.now();
    const knownRunUrls = (status?.monitoring_recent_runs ?? []).map((run) => run.run_url);
    setIsTracking(true);

    const finish = () => {
      if (generationRef.current !== generation) return;
      generationRef.current += 1;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
      setIsTracking(false);
    };
    const poll = async () => {
      try {
        const refreshed = await refreshHistory();
        if (generationRef.current !== generation) return;
        if (refreshed.monitoring_history_error) {
          finish();
          onToast({
            tone: "warning",
            message: "새 실행 결과 자동 확인 중지",
            detail: refreshed.monitoring_history_error,
          });
          return;
        }
        const newRun = findNewSmokeRun(refreshed.monitoring_recent_runs, knownRunUrls);
        if (newRun) {
          const trackedRun = getTrackedManualSmokeRun(newRun);
          if (trackedRun) {
            setLastRun(trackedRun);
            try {
              window.localStorage.setItem(
                LAST_MANUAL_SMOKE_RUN_STORAGE_KEY,
                JSON.stringify(trackedRun),
              );
            } catch {
              // The result still remains visible for the current page session.
            }
          }
          finish();
          onToast({
            tone: newRun.status === "success" ? "success" : newRun.status === "failure" ? "error" : "warning",
            message: `새 수동 점검 ${newRun.status === "success" ? "성공" : newRun.status === "failure" ? "실패" : "건너뜀"}`,
            detail: newRun.run_number ? `GitHub Actions #${newRun.run_number}` : "GitHub Actions 실행 결과를 확인했습니다.",
            link: { href: newRun.run_url, label: "GitHub 실행 보기" },
          });
          return;
        }
        if (Date.now() - startedAt >= MANUAL_RUN_TRACKING_TIMEOUT_MS) {
          finish();
          onToast({
            tone: "warning",
            message: "새 실행 결과를 아직 찾지 못했습니다",
            detail: "GitHub 실행 후 설정 화면의 지금 새로고침을 눌러 확인하세요.",
          });
          return;
        }
        timerRef.current = window.setTimeout(poll, MANUAL_RUN_POLL_INTERVAL_MS);
      } catch (error) {
        if (generationRef.current !== generation) return;
        finish();
        onToast({
          tone: "error",
          message: "새 실행 결과 자동 확인 실패",
          detail: getSettingsModelErrorMessage(error, "GitHub 실행 이력을 확인하지 못했습니다"),
        });
      }
    };
    timerRef.current = window.setTimeout(poll, MANUAL_RUN_POLL_INTERVAL_MS);
  };

  const handleClear = () => {
    try {
      window.localStorage.removeItem(LAST_MANUAL_SMOKE_RUN_STORAGE_KEY);
    } catch {
      // The result still remains hidden for the current page session.
    }
    setLastRun(null);
  };

  return {
    isTracking,
    lastRun,
    onClear: handleClear,
    onOpen: handleOpen,
  };
}
