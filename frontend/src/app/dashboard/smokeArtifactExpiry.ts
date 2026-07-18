const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type SmokeArtifactExpiryState = "active" | "expiring_soon" | "expired";

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
