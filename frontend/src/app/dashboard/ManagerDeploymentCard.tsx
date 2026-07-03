import { ExternalLink, GitCommit, PackageCheck } from "lucide-react";

import type { DeploymentComponent, DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerDeploymentCardProps {
  deployment?: DeploymentInfo;
  timezone?: string;
}

export function ManagerDeploymentCard({ deployment, timezone }: ManagerDeploymentCardProps) {
  const revision = formatRevision(deployment?.revision);
  const version = deployment?.version || "-";
  const latestVersion = deployment?.latest_version || "-";
  const buildDate = formatDateTime(deployment?.build_date, timezone);
  const latestCheckedAt = formatDateTime(deployment?.latest_version_checked_at, timezone);
  const releaseStatus = getReleaseStatus(deployment);
  const releaseTone = getReleaseTone(deployment);

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
          {releaseStatus}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DeploymentFact label="현재 버전" value={version} />
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
        <p className="mt-1">
          최신 릴리즈 확인: {latestCheckedAt}
          {deployment?.latest_version_error ? ` · ${deployment.latest_version_error}` : ""}
        </p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(deployment?.components || []).map((component) => (
          <DeploymentComponentRow key={component.name} component={component} />
        ))}
      </div>
    </div>
  );
}

function DeploymentFact({
  href,
  label,
  value,
  monospace = false,
}: {
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
    </div>
  );
}

function DeploymentComponentRow({ component }: { component: DeploymentComponent }) {
  const revision = formatRevision(component.revision);
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{getComponentLabel(component.name)}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClassName(component.status)}`}>
          {getStatusLabel(component.status)}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-gray-500">{component.container_name}</p>
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

function getReleaseStatus(deployment?: DeploymentInfo) {
  if (!deployment) return "확인 중";
  if (deployment.enabled === false) return "Docker 조회 불가";
  if (deployment.update_available === true) return "업데이트 필요";
  if (deployment.update_available === false) return "최신 상태";
  if (deployment.latest_version_error) return "확인 실패";
  return "비교 불가";
}

function getReleaseTone(deployment?: DeploymentInfo) {
  if (!deployment) {
    return {
      badge: "bg-slate-100 text-slate-700",
      panel: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }
  if (deployment.enabled === false) {
    return {
      badge: "bg-amber-100 text-amber-800",
      panel: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (deployment.update_available === true || deployment.latest_version_error) {
    return {
      badge: "bg-amber-100 text-amber-800",
      panel: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (deployment.update_available === false) {
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
