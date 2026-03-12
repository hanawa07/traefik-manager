export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "-";
  }

  if (minutes < 60) {
    return `${minutes}분`;
  }

  if (minutes % (60 * 24) === 0) {
    return `${minutes / (60 * 24)}일`;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60}시간`;
  }

  const days = Math.floor(minutes / (60 * 24));
  const remainderAfterDays = minutes % (60 * 24);
  const hours = Math.floor(remainderAfterDays / 60);
  const remainingMinutes = remainderAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}분`);

  return parts.join(" ");
}
