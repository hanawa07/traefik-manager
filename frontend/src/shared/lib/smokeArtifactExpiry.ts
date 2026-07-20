const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type SmokeArtifactExpiryState = "active" | "expiring_soon" | "expired";
export type SmokeArtifactFilter = "all" | "available" | "expiring_soon" | "expired";
export type SmokeArtifactFilterCounts = Record<SmokeArtifactFilter, number>;

export function getSmokeArtifactExpiryState(
  expiresAt: string | null,
  referenceTime: number,
): SmokeArtifactExpiryState | null {
  const expiresAtTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAtTime) || !Number.isFinite(referenceTime)) return null;
  const remainingMs = expiresAtTime - referenceTime;
  if (remainingMs <= 0) return "expired";
  return remainingMs <= EXPIRING_SOON_MS ? "expiring_soon" : "active";
}

export function getSmokeArtifactRemainingLabel(
  expiresAt: string | null,
  referenceTime: number,
): string | null {
  const expiresAtTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const remainingMs = expiresAtTime - referenceTime;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / MINUTE_MS);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    const remainder = hours > 0 ? `${hours}시간` : minutes > 0 ? `${minutes}분` : "";
    return `${days}일${remainder ? ` ${remainder}` : ""} 남음`;
  }
  if (hours > 0) return `${hours}시간${minutes > 0 ? ` ${minutes}분` : ""} 남음`;
  return `${minutes}분 남음`;
}

export function filterAndPrioritizeSmokeArtifactRuns<
  T extends { artifact_url: string | null; artifact_expires_at: string | null },
>(runs: T[], filter: SmokeArtifactFilter, referenceTime: number): T[] {
  return runs
    .filter((run) => {
      const state = run.artifact_url
        ? getSmokeArtifactExpiryState(run.artifact_expires_at, referenceTime)
        : null;
      if (filter === "all") return true;
      if (filter === "available") return Boolean(run.artifact_url && state !== "expired");
      return Boolean(run.artifact_url && state === filter);
    })
    .sort((left, right) =>
      getArtifactSortValue(left, referenceTime) - getArtifactSortValue(right, referenceTime)
    );
}

export function getSmokeArtifactFilterCounts<
  T extends { artifact_url: string | null; artifact_expires_at: string | null },
>(runs: T[], referenceTime: number): SmokeArtifactFilterCounts {
  const counts: SmokeArtifactFilterCounts = {
    all: runs.length,
    available: 0,
    expiring_soon: 0,
    expired: 0,
  };
  runs.forEach((run) => {
    if (!run.artifact_url) return;
    const state = getSmokeArtifactExpiryState(run.artifact_expires_at, referenceTime);
    if (state !== "expired") counts.available += 1;
    if (state === "expiring_soon") counts.expiring_soon += 1;
    if (state === "expired") counts.expired += 1;
  });
  return counts;
}

function getArtifactSortValue(
  run: { artifact_url: string | null; artifact_expires_at: string | null },
  referenceTime: number,
): number {
  if (!run.artifact_url) return Number.MAX_SAFE_INTEGER;
  const state = getSmokeArtifactExpiryState(run.artifact_expires_at, referenceTime);
  if (state === "expired") return Number.MAX_SAFE_INTEGER - 1;
  const expiresAt = run.artifact_expires_at ? Date.parse(run.artifact_expires_at) : Number.NaN;
  return Number.isFinite(expiresAt) ? expiresAt : Number.MAX_SAFE_INTEGER - 2;
}
