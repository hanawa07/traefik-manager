import { GitCommit, PackageCheck } from "lucide-react";

import type { DeploymentComponent, DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerDeploymentCardProps {
  deployment?: DeploymentInfo;
  timezone?: string;
}

export function ManagerDeploymentCard({ deployment, timezone }: ManagerDeploymentCardProps) {
  const revision = formatRevision(deployment?.revision);
  const version = deployment?.version || "-";
  const buildDate = formatDateTime(deployment?.build_date, timezone);

  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-gray-900">Manager 배포 버전</h2>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            backend/frontend 이미지의 OCI 라벨 기준으로 현재 배포된 커밋을 추적합니다.
          </p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {deployment?.enabled === false ? "Docker 조회 불가" : deployment ? "조회 완료" : "확인 중"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DeploymentFact label="버전" value={version} />
        <DeploymentFact label="커밋" value={revision} monospace />
        <DeploymentFact label="빌드 시각" value={buildDate} />
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
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold text-gray-900 ${monospace ? "font-mono" : ""}`}>{value}</p>
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
