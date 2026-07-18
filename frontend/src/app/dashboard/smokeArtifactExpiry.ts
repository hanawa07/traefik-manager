const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000;

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
