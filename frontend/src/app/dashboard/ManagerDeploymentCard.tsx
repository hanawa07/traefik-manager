import { PackageCheck, RefreshCw } from "lucide-react";

import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { buildDeploymentComponentConsistency } from "./managerDeploymentConsistency";
import { buildManagerDeploymentLinks } from "./managerDeploymentLinks";
import { buildDeploymentVersionDisplay } from "./managerDeploymentVersionDisplay";
import {
  DeploymentComponentRow,
  DeploymentFact,
  DeploymentLinkBar,
  formatDeploymentRevision,
} from "./ManagerDeploymentCardParts";

interface ManagerDeploymentCardProps {
  deployment?: DeploymentInfo;
  isRefreshingLatest?: boolean;
  onRefreshLatest?: () => void;
  refreshLatestError?: string | null;
  timezone?: string;
}

export function ManagerDeploymentCard({
  deployment,
  isRefreshingLatest = false,
  onRefreshLatest,
  refreshLatestError,
  timezone,
}: ManagerDeploymentCardProps) {
  const revision = formatDeploymentRevision(deployment?.revision);
  const latestVersion = deployment?.latest_version || "-";
  const buildDate = formatDateTime(deployment?.build_date, timezone);
  const latestCheckedAt = formatDateTime(deployment?.latest_version_checked_at, timezone);
  const componentConsistency = buildDeploymentComponentConsistency(deployment?.components);
  const deploymentLinks = buildManagerDeploymentLinks({
    latestReleaseUrl: deployment?.latest_release_url,
    latestVersion: deployment?.latest_version,
    revision: deployment?.revision,
    source: deployment?.source,
  });
  const versionDisplay = buildDeploymentVersionDisplay({
    enabled: deployment?.enabled,
    latestVersion: deployment?.latest_version,
    latestVersionError: deployment?.latest_version_error,
    updateAvailable: deployment?.update_available,
    version: deployment?.version,
  });
  const releaseTone = getReleaseTone(versionDisplay.state, componentConsistency.hasMismatch);

  return (
    <div className="card mb-4 p-4 sm:mb-6 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Manager 배포 버전</h2>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            backend/frontend 이미지의 OCI 라벨과 GitHub 최신 릴리즈를 비교합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefreshLatest ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
              disabled={isRefreshingLatest}
              onClick={onRefreshLatest}
              type="button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingLatest ? "animate-spin" : ""}`} />
              {isRefreshingLatest ? "재확인 중" : "최신 재확인"}
            </button>
          ) : null}
          <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${releaseTone.badge}`}>
            {componentConsistency.hasMismatch ? "컴포넌트 불일치" : versionDisplay.statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <DeploymentFact
          description={versionDisplay.currentDetail}
          descriptionMonospace
          href={deploymentLinks.commitUrl}
          label="현재 빌드"
          value={versionDisplay.currentValue}
        />
        <DeploymentFact
          href={deploymentLinks.releaseUrl}
          label="최신 릴리즈"
          value={latestVersion}
        />
        <DeploymentFact href={deploymentLinks.commitUrl} label="커밋" value={revision} monospace />
        <DeploymentFact label="빌드 시각" value={buildDate} />
      </div>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${releaseTone.panel}`}>
        <p className="font-medium">{deployment?.message || "배포 정보를 확인하는 중입니다"}</p>
        {componentConsistency.message ? <p className="mt-1 font-semibold">{componentConsistency.message}</p> : null}
        {refreshLatestError ? <p className="mt-1 font-semibold text-red-700 dark:text-red-200">{refreshLatestError}</p> : null}
        {versionDisplay.releaseMessage ? <p className="mt-1">{versionDisplay.releaseMessage}</p> : null}
        <p className="mt-1">
          최신 릴리즈 확인: {latestCheckedAt}
          {deployment?.latest_version_error ? ` · ${deployment.latest_version_error}` : ""}
        </p>
      </div>

      <DeploymentLinkBar
        commitUrl={deploymentLinks.commitUrl}
        releaseUrl={deploymentLinks.releaseUrl}
        sourceUrl={deploymentLinks.sourceUrl}
      />

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(deployment?.components || []).map((component) => (
          <DeploymentComponentRow
            key={component.name}
            component={component}
            hasMismatch={componentConsistency.mismatchedComponentNames.has(component.name)}
            latestVersion={deployment?.latest_version}
          />
        ))}
      </div>
    </div>
  );
}

function getReleaseTone(state: ReturnType<typeof buildDeploymentVersionDisplay>["state"], hasMismatch: boolean) {
  if (hasMismatch) {
    return {
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
      panel: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    };
  }
  if (state === "loading") {
    return {
      badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
      panel: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
    };
  }
  if (state === "unavailable") {
    return {
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
      panel: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    };
  }
  if (state === "update" || state === "unknown") {
    return {
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
      panel: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    };
  }
  if (state === "post_release") {
    return {
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
      panel: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    };
  }
  if (state === "current") {
    return {
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
      panel: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    };
  }
  return {
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    panel: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
  };
}
