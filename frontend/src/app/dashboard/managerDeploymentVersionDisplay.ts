export interface DeploymentVersionDisplay {
  currentValue: string;
  currentDetail?: string;
  statusLabel: string;
  releaseMessage?: string;
  state: "loading" | "update" | "post_release" | "current" | "unavailable" | "unknown";
}

const GIT_DESCRIBE_RE = /^(v?\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)(?:-dirty)?$/i;

export function buildDeploymentVersionDisplay({
  enabled,
  latestVersion,
  latestVersionError,
  updateAvailable,
  version,
}: {
  enabled?: boolean;
  latestVersion?: string | null;
  latestVersionError?: string | null;
  updateAvailable?: boolean | null;
  version?: string | null;
}): DeploymentVersionDisplay {
  const currentVersion = normalizeVersionText(version);
  const latest = normalizeVersionText(latestVersion);
  const gitDescribe = parseGitDescribeVersion(currentVersion);

  if (!currentVersion && enabled === undefined) {
    return { currentValue: "-", statusLabel: "확인 중", state: "loading" };
  }
  if (enabled === false) {
    return {
      currentValue: currentVersion || "-",
      statusLabel: "Docker 조회 불가",
      state: "unavailable",
    };
  }
  if (updateAvailable === true) {
    return {
      currentValue: currentVersion || "-",
      statusLabel: "업데이트 필요",
      state: "update",
    };
  }
  if (gitDescribe && latest && normalizeSemver(gitDescribe.baseVersion) === normalizeSemver(latest)) {
    return {
      currentValue: `${gitDescribe.baseVersion} 이후 ${gitDescribe.commitCount}커밋`,
      currentDetail: currentVersion ?? undefined,
      statusLabel: "릴리즈 이후 빌드",
      releaseMessage: `현재 배포는 최신 릴리즈 ${gitDescribe.baseVersion} 이후 ${gitDescribe.commitCount}개 커밋이 포함된 빌드입니다.`,
      state: "post_release",
    };
  }
  if (updateAvailable === false) {
    return {
      currentValue: currentVersion || "-",
      statusLabel: "최신 상태",
      state: "current",
    };
  }
  if (latestVersionError) {
    return {
      currentValue: currentVersion || "-",
      statusLabel: "확인 실패",
      state: "unknown",
    };
  }
  return {
    currentValue: currentVersion || "-",
    statusLabel: "비교 불가",
    state: "unknown",
  };
}

function parseGitDescribeVersion(version: string | null) {
  if (!version) return null;
  const match = version.match(GIT_DESCRIBE_RE);
  if (!match) return null;
  return {
    baseVersion: normalizeVersionPrefix(match[1]),
    commitCount: Number.parseInt(match[2], 10),
  };
}

function normalizeVersionText(value?: string | null) {
  const text = value?.trim();
  return text && text.toLowerCase() !== "unknown" ? text : null;
}

function normalizeSemver(value: string) {
  return value.replace(/^v/i, "");
}

function normalizeVersionPrefix(value: string) {
  return value.startsWith("v") || value.startsWith("V") ? `v${value.slice(1)}` : `v${value}`;
}
