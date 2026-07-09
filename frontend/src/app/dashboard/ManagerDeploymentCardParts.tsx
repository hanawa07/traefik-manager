import { ExternalLink, GitCommit } from "lucide-react";

import type { DeploymentComponent } from "@/features/deployment/api/deploymentApi";

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
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-blue-200 hover:text-blue-700"
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

export function DeploymentComponentRow({
  component,
  hasMismatch,
  latestVersion,
}: {
  component: DeploymentComponent;
  hasMismatch?: boolean;
  latestVersion?: string | null;
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
    return <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">{children}</p>;
  }

  return (
    <a
      className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700"
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
