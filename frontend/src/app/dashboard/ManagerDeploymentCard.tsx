import { ExternalLink, GitCommit, PackageCheck } from "lucide-react";

import type { DeploymentComponent, DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { buildDeploymentComponentConsistency } from "./managerDeploymentConsistency";
import { buildDeploymentVersionDisplay } from "./managerDeploymentVersionDisplay";

interface ManagerDeploymentCardProps {
  deployment?: DeploymentInfo;
  timezone?: string;
}

export function ManagerDeploymentCard({ deployment, timezone }: ManagerDeploymentCardProps) {
  const revision = formatRevision(deployment?.revision);
  const latestVersion = deployment?.latest_version || "-";
  const buildDate = formatDateTime(deployment?.build_date, timezone);
  const latestCheckedAt = formatDateTime(deployment?.latest_version_checked_at, timezone);
  const componentConsistency = buildDeploymentComponentConsistency(deployment?.components);
  const versionDisplay = buildDeploymentVersionDisplay({
    enabled: deployment?.enabled,
    latestVersion: deployment?.latest_version,
    latestVersionError: deployment?.latest_version_error,
    updateAvailable: deployment?.update_available,
    version: deployment?.version,
  });
  const releaseTone = getReleaseTone(versionDisplay.state, componentConsistency.hasMismatch);

  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-gray-900">Manager 배포 버전</h2>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            backend/frontend 이미지의 OCI 라벨과 GitHub 최신 릴리즈를 비교합니다.
          </p>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${releaseTone.badge}`}>
          {componentConsistency.hasMismatch ? "컴포넌트 불일치" : versionDisplay.statusLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DeploymentFact
          description={versionDisplay.currentDetail}
          descriptionMonospace
          label="현재 빌드"
          value={versionDisplay.currentValue}
        />
        <DeploymentFact
          href={deployment?.latest_release_url || undefined}
          label="최신 릴리즈"
          value={latestVersion}
        />
        <DeploymentFact label="커밋" value={revision} monospace />
        <DeploymentFact label="빌드 시각" value={buildDate} />
      </div>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${releaseTone.panel}`}>
        <p className="font-medium">{deployment?.message || "배포 정보를 확인하는 중입니다"}</p>
        {componentConsistency.message ? <p className="mt-1 font-semibold">{componentConsistency.message}</p> : null}
        {versionDisplay.releaseMessage ? <p className="mt-1">{versionDisplay.releaseMessage}</p> : null}
        <p className="mt-1">
          최신 릴리즈 확인: {latestCheckedAt}
          {deployment?.latest_version_error ? ` · ${deployment.latest_version_error}` : ""}
        </p>
      </div>

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

function DeploymentFact({
  description,
  descriptionMonospace = false,
  href,
  label,
  value,
  monospace = false,
}: {
  description?: string;
  descriptionMonospace?: boolean;
  href?: string;
  label: string;
  value: string;
  monospace?: boolean;
}) {
  const valueClassName = `mt-1 truncate text-sm font-semibold text-gray-900 ${monospace ? "font-mono" : ""}`;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      {href ? (
        <a
          className={`${valueClassName} inline-flex max-w-full items-center gap-1 text-blue-700 hover:text-blue-800`}
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{value}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <p className={valueClassName}>{value}</p>
      )}
      {description ? (
        <p className={`mt-1 truncate text-[11px] text-gray-500 ${descriptionMonospace ? "font-mono" : ""}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

function DeploymentComponentRow({
  component,
  hasMismatch,
  latestVersion,
}: {
  component: DeploymentComponent;
  hasMismatch?: boolean;
  latestVersion?: string | null;
}) {
  const revision = formatRevision(component.revision);
  const versionDisplay = buildDeploymentVersionDisplay({
    enabled: component.status !== "unavailable",
    latestVersion,
    updateAvailable: null,
    version: component.version,
  });

  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${hasMismatch ? "border-amber-300" : "border-gray-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{getComponentLabel(component.name)}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasMismatch ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              불일치
            </span>
          ) : null}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClassName(component.status)}`}>
            {getStatusLabel(component.status)}
          </span>
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-gray-500">{component.container_name}</p>
      <p className="mt-2 truncate text-xs font-medium text-gray-700">{versionDisplay.currentValue}</p>
      {versionDisplay.currentDetail ? (
        <p className="mt-1 truncate font-mono text-[11px] text-gray-500">{versionDisplay.currentDetail}</p>
      ) : null}
      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        <GitCommit className="h-3.5 w-3.5" />
        <span className="font-mono">{revision}</span>
      </p>
    </div>
  );
}

function formatRevision(value?: string | null) {
  if (!value) return "-";
  return value.length > 12 ? value.slice(0, 12) : value;
}

function getComponentLabel(name: string) {
  if (name === "backend") return "Backend";
  if (name === "frontend") return "Frontend";
  return name;
}

function getStatusLabel(status: string) {
  if (status === "ok") return "정상";
  if (status === "local_env") return "환경값";
  return "조회 실패";
}

function getStatusClassName(status: string) {
  if (status === "ok") return "bg-emerald-100 text-emerald-700";
  if (status === "local_env") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

function getReleaseTone(state: ReturnType<typeof buildDeploymentVersionDisplay>["state"], hasMismatch: boolean) {
  if (hasMismatch) {
    return {
      badge: "bg-amber-100 text-amber-800",
      panel: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (state === "loading") {
    return {
      badge: "bg-slate-100 text-slate-700",
      panel: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }
  if (state === "unavailable") {
    return {
      badge: "bg-amber-100 text-amber-800",
      panel: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (state === "update" || state === "unknown") {
    return {
      badge: "bg-amber-100 text-amber-800",
      panel: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (state === "post_release") {
    return {
      badge: "bg-blue-100 text-blue-700",
      panel: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (state === "current") {
    return {
      badge: "bg-emerald-100 text-emerald-700",
      panel: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  return {
    badge: "bg-slate-100 text-slate-700",
    panel: "border-slate-200 bg-slate-50 text-slate-600",
  };
}
