interface ManagerDeploymentLinksInput {
  latestReleaseUrl?: string | null;
  latestVersion?: string | null;
  revision?: string | null;
  source?: string | null;
}

interface ManagerDeploymentLinks {
  commitUrl?: string;
  releaseUrl?: string;
  sourceUrl?: string;
}

export function buildManagerDeploymentLinks({
  latestReleaseUrl,
  latestVersion,
  revision,
  source,
}: ManagerDeploymentLinksInput): ManagerDeploymentLinks {
  const sourceUrl = resolveGitHubSourceUrl(source);

  return {
    commitUrl: buildGitHubCommitUrl(sourceUrl, revision),
    releaseUrl: normalizeWebUrl(latestReleaseUrl) || buildGitHubReleaseUrl(sourceUrl, latestVersion),
    sourceUrl,
  };
}

function resolveGitHubSourceUrl(value?: string | null) {
  const source = normalizeText(value);
  if (!source) return undefined;

  const sshMatch = source.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return buildGitHubRepositoryUrl(sshMatch[1], sshMatch[2]);
  }

  try {
    const parsed = new URL(source);
    if (!["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase())) {
      return undefined;
    }

    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    return buildGitHubRepositoryUrl(owner, repo?.replace(/\.git$/, ""));
  } catch {
    return undefined;
  }
}

function buildGitHubRepositoryUrl(owner?: string, repo?: string) {
  const normalizedOwner = normalizeText(owner);
  const normalizedRepo = normalizeText(repo);
  if (!normalizedOwner || !normalizedRepo) return undefined;

  return `https://github.com/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}`;
}

function buildGitHubCommitUrl(sourceUrl?: string, revision?: string | null) {
  const normalizedRevision = normalizeText(revision);
  if (!sourceUrl || !normalizedRevision) return undefined;

  return `${sourceUrl}/commit/${encodeURIComponent(normalizedRevision)}`;
}

function buildGitHubReleaseUrl(sourceUrl?: string, version?: string | null) {
  const normalizedVersion = normalizeText(version);
  if (!sourceUrl || !normalizedVersion) return undefined;

  return `${sourceUrl}/releases/tag/${encodeURIComponent(normalizedVersion)}`;
}

function normalizeWebUrl(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return undefined;

  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeText(value?: string | null) {
  const text = value?.trim();
  if (!text || text.toLowerCase() === "unknown") return undefined;
  return text;
}
