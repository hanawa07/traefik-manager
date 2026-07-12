import { ExternalLink, GitCommit } from "lucide-react";

import type { DeploymentComponent } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { buildManagerDeploymentLinks } from "./managerDeploymentLinks";
import { buildDeploymentVersionDisplay } from "./managerDeploymentVersionDisplay";

export function DeploymentLinkBar({
  commitUrl,
  releaseUrl,
  sourceUrl,
}: {
  commitUrl?: string;
  releaseUrl?: string;
  sourceUrl?: string;
}) {
  const links = [
    { href: releaseUrl, label: "릴리즈 보기" },
    { href: commitUrl, label: "커밋 보기" },
    { href: sourceUrl, label: "저장소 보기" },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  if (links.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
          href={link.href}
          key={link.label}
          rel="noreferrer"
          target="_blank"
        >
          {link.label}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

export function DeploymentFact({
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
  const valueClassName = `mt-1 truncate text-sm font-semibold text-gray-900 dark:text-slate-100 ${monospace ? "font-mono" : ""}`;

  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 sm:px-4 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
      {href ? (
        <a
          className={`${valueClassName} inline-flex max-w-full items-center gap-1 text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200`}
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
        <p className={`mt-1 truncate text-[11px] text-gray-500 dark:text-slate-400 ${descriptionMonospace ? "font-mono" : ""}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function DeploymentComponentRow({
  component,
  hasMismatch,
  latestVersion,
  timezone,
}: {
  component: DeploymentComponent;
  hasMismatch?: boolean;
  latestVersion?: string | null;
  timezone?: string;
}) {
  const revision = formatDeploymentRevision(component.revision);
  const versionDisplay = buildDeploymentVersionDisplay({
    enabled: component.status !== "unavailable",
    latestVersion,
    updateAvailable: null,
    version: component.version,
  });
  const componentLinks = buildManagerDeploymentLinks({
    latestVersion,
    revision: component.revision,
    source: component.source,
  });
  const dockerStatus = getDockerStatus(component);

  return (
    <div
      className={`rounded-xl border bg-white px-4 py-3 dark:bg-slate-950 ${
        hasMismatch ? "border-amber-300 dark:border-amber-500/40" : "border-gray-200 dark:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{getComponentLabel(component.name)}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasMismatch ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-100">
              불일치
            </span>
          ) : null}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dockerStatus.className}`}>
            {dockerStatus.label}
          </span>
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-gray-500 dark:text-slate-400">{component.container_name}</p>
      <p className="mt-2 truncate text-xs font-medium text-gray-700 dark:text-slate-300">{versionDisplay.currentValue}</p>
      {versionDisplay.currentDetail ? (
        <p className="mt-1 truncate font-mono text-[11px] text-gray-500 dark:text-slate-400">{versionDisplay.currentDetail}</p>
      ) : null}
      {component.health_status === "unhealthy" ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <p className="font-semibold">
            최근 검사 결과: 종료 코드 {component.health_last_exit_code ?? "확인 불가"} · 연속 실패 {component.health_failing_streak}회
          </p>
          <p className="mt-1">마지막 검사: {formatDateTime(component.health_last_checked_at, timezone)}</p>
        </div>
      ) : null}
      <DeploymentRevisionLink href={componentLinks.commitUrl} revision={revision} />
    </div>
  );
}

function DeploymentRevisionLink({ href, revision }: { href?: string; revision: string }) {
  const children = (
    <>
      <GitCommit className="h-3.5 w-3.5" />
      <span className="font-mono">{revision}</span>
    </>
  );

  if (!href) {
    return <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">{children}</p>;
  }

  return (
    <a
      className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export function formatDeploymentRevision(value?: string | null) {
  if (!value) return "-";
  return value.length > 12 ? value.slice(0, 12) : value;
}

function getComponentLabel(name: string) {
  if (name === "backend") return "Backend";
  if (name === "frontend") return "Frontend";
  return name;
}

function getDockerStatus(component: DeploymentComponent) {
  if (component.status === "unavailable") {
    return {
      label: "조회 실패",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100",
    };
  }
  if (component.runtime_status && component.runtime_status !== "running") {
    return {
      label: "Docker 중지",
      className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }
  if (component.health_status === "healthy") {
    return {
      label: "Docker 정상",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    };
  }
  if (component.health_status === "unhealthy") {
    return {
      label: "Docker 이상",
      className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }
  if (component.health_status === "starting") {
    return {
      label: "점검 중",
      className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    };
  }
  if (component.runtime_status === "running") {
    return {
      label: "실행 중",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    };
  }
  if (component.status === "local_env") {
    return {
      label: "환경값",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    };
  }
  return {
    label: "상태 미확인",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100",
  };
}
