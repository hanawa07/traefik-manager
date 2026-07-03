import type { DeploymentComponent } from "@/features/deployment/api/deploymentApi";

export interface DeploymentComponentConsistency {
  hasMismatch: boolean;
  message?: string;
  mismatchedComponentNames: Set<string>;
}

export function buildDeploymentComponentConsistency(
  components?: DeploymentComponent[],
): DeploymentComponentConsistency {
  const availableComponents = (components || []).filter((component) => component.status === "ok");
  const versionGroups = groupComponentValues(availableComponents, "version");
  const revisionGroups = groupComponentValues(availableComponents, "revision");
  const versionMismatch = versionGroups.size > 1;
  const revisionMismatch = revisionGroups.size > 1;

  if (!versionMismatch && !revisionMismatch) {
    return { hasMismatch: false, mismatchedComponentNames: new Set() };
  }

  const mismatchedComponentNames = new Set<string>();
  for (const component of availableComponents) {
    mismatchedComponentNames.add(component.name);
  }

  return {
    hasMismatch: true,
    message: buildMismatchMessage(versionMismatch, revisionMismatch),
    mismatchedComponentNames,
  };
}

function groupComponentValues(
  components: DeploymentComponent[],
  key: "version" | "revision",
): Set<string> {
  const values = new Set<string>();
  for (const component of components) {
    const value = normalizeComponentValue(component[key]);
    if (value) values.add(value);
  }
  return values;
}

function normalizeComponentValue(value?: string | null) {
  const text = value?.trim();
  return text && text.toLowerCase() !== "unknown" ? text : null;
}

function buildMismatchMessage(versionMismatch: boolean, revisionMismatch: boolean) {
  if (versionMismatch && revisionMismatch) {
    return "Backend와 Frontend의 버전 및 커밋 라벨이 서로 다릅니다.";
  }
  if (versionMismatch) {
    return "Backend와 Frontend의 버전 라벨이 서로 다릅니다.";
  }
  return "Backend와 Frontend의 커밋 라벨이 서로 다릅니다.";
}
