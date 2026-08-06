interface SmokeFailureMetadataIdentity {
  run_id: number;
}

export function updateSmokeFailureMetadataSelection(
  current: ReadonlySet<number>,
  entries: readonly SmokeFailureMetadataIdentity[],
  selected: boolean,
): Set<number> {
  const next = new Set(current);
  for (const entry of entries) {
    if (selected) next.add(entry.run_id);
    else next.delete(entry.run_id);
  }
  return next;
}
