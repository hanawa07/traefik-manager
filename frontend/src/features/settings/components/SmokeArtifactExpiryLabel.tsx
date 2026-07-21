import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  getSmokeArtifactExpiryState,
  getSmokeArtifactRemainingLabel,
  type SmokeArtifactExpiryState,
} from "@/shared/lib/smokeArtifactExpiry";

const EXPIRY_LABELS: Record<SmokeArtifactExpiryState, string> = {
  active: "만료",
  expiring_soon: "만료 임박",
  expired: "만료됨",
};

const EXPIRY_STYLES: Record<SmokeArtifactExpiryState, string> = {
  active: "text-amber-700 dark:text-amber-300",
  expiring_soon:
    "bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  expired: "bg-rose-100 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};

interface SmokeArtifactExpiryLabelProps {
  expiresAt: string;
  referenceTime: number;
  timezone?: string;
}

export function SmokeArtifactExpiryLabel({
  expiresAt,
  referenceTime,
  timezone,
}: SmokeArtifactExpiryLabelProps) {
  const state = getSmokeArtifactExpiryState(expiresAt, referenceTime);
  const remaining = getSmokeArtifactRemainingLabel(expiresAt, referenceTime);
  if (!state) return formatDateTime(expiresAt, timezone);

  return (
    <span
      className={`rounded font-medium ${EXPIRY_STYLES[state]}`}
      data-expiry-state={state}
      data-testid="smoke-artifact-expiry-label"
    >
      {EXPIRY_LABELS[state]}
      {remaining ? ` · ${remaining}` : ""} · {formatDateTime(expiresAt, timezone)}
    </span>
  );
}
