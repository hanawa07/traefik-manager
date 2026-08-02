export function formatDurationSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours) return `${hours}시간 ${minutes}분`;
  if (minutes) return `${minutes}분 ${remainingSeconds}초`;
  return `${remainingSeconds}초`;
}

export function formatSignedDurationSeconds(value: number): string {
  if (value === 0) return formatDurationSeconds(0);
  return `${value > 0 ? "+" : "-"}${formatDurationSeconds(Math.abs(value))}`;
}
