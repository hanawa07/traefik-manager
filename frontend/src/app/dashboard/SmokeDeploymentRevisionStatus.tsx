import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  getSmokeDeploymentRevisionStatus,
  normalizeSmokeRevision,
} from "./smokeDeploymentRevision";

interface SmokeDeploymentRevisionStatusProps {
  deployedRevision?: string | null;
  localCheckedAt?: string | null;
  localRevision?: string | null;
  mode?: "local" | "remote";
  runs: SmokeMonitoringRecentRun[];
  timezone?: string;
}

export function SmokeDeploymentRevisionStatus({
  deployedRevision,
  localCheckedAt,
  localRevision,
  mode = "remote",
  runs,
  timezone,
}: SmokeDeploymentRevisionStatusProps) {
  if (mode === "local") {
    return (
      <LocalRevisionStatus
        checkedAt={localCheckedAt}
        deployedRevision={deployedRevision}
        revision={localRevision}
        timezone={timezone}
      />
    );
  }
  const status = getSmokeDeploymentRevisionStatus(deployedRevision, runs);
  if (!status) {
    return (
      <p
        className="mt-1 w-fit rounded bg-white/70 px-2 py-1 font-semibold text-cyan-900 dark:bg-slate-950/60 dark:text-cyan-100"
        data-smoke-revision-status="pending"
        data-testid="smoke-deployment-revision-status"
      >
        운영 스모크 커밋 확인 대기 · 비교 정보 수집 중
      </p>
    );
  }

  return (
    <p
      className={`mt-1 w-fit rounded px-2 py-1 font-semibold ${status.matches ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"}`}
      data-deployed-revision={status.deployedRevision}
      data-smoke-revision={status.smokeRevision}
      data-smoke-revision-status={status.matches ? "match" : "mismatch"}
      data-testid="smoke-deployment-revision-status"
      role={status.matches ? undefined : "alert"}
    >
      운영 스모크 커밋 {status.matches ? "일치" : "불일치"} · 배포{" "}
      <code>{status.deployedRevision.slice(0, 7)}</code> · 최근 성공{" "}
      <a
        className="underline decoration-current/40 underline-offset-2"
        href={status.run.run_url}
        rel="noreferrer"
        target="_blank"
      >
        <code>{status.smokeRevision.slice(0, 7)}</code> · 실행 #{status.run.run_number ?? status.run.run_id}
      </a>
    </p>
  );
}

function LocalRevisionStatus({
  checkedAt,
  deployedRevision,
  revision,
  timezone,
}: {
  checkedAt?: string | null;
  deployedRevision?: string | null;
  revision?: string | null;
  timezone?: string;
}) {
  const deployed = normalizeSmokeRevision(deployedRevision);
  const checked = normalizeSmokeRevision(revision);
  if (!deployed || !checked) {
    return (
      <p
        className="mt-1 w-fit rounded bg-white/70 px-2 py-1 font-semibold text-cyan-900 dark:bg-slate-950/60 dark:text-cyan-100"
        data-smoke-revision-status="pending"
        data-testid="smoke-deployment-revision-status"
      >
        운영 스모크 커밋 확인 대기 · 다음 로컬 점검에서 기록
      </p>
    );
  }
  const matches = deployed.startsWith(checked) || checked.startsWith(deployed);
  return (
    <p
      className={`mt-1 w-fit rounded px-2 py-1 font-semibold ${matches ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"}`}
      data-deployed-revision={deployed}
      data-smoke-revision={checked}
      data-smoke-revision-status={matches ? "match" : "mismatch"}
      data-testid="smoke-deployment-revision-status"
      role={matches ? undefined : "alert"}
    >
      운영 스모크 커밋 {matches ? "일치" : "불일치"} · 배포 <code>{deployed.slice(0, 7)}</code>
      {" · 로컬 점검 "}<code>{checked.slice(0, 7)}</code>
      {checkedAt ? ` · ${formatDateTime(checkedAt, timezone)}` : ""}
    </p>
  );
}
