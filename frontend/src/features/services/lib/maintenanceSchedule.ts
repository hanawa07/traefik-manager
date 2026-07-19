const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toKoreanDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";
  return new Date(timestamp + KOREA_OFFSET_MS).toISOString().slice(0, 16);
}

export function toMaintenanceUntilIso(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(`${value}:00+09:00`);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export function formatMaintenanceRemaining(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const remainingMinutes = Math.ceil((timestamp - now) / 60_000);
  if (remainingMinutes <= 0) return "종료 처리 중";

  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  const minutes = remainingMinutes % 60;
  if (days > 0) return `${days}일${hours > 0 ? ` ${hours}시간` : ""} 남음`;
  if (hours > 0) return `${hours}시간${minutes > 0 ? ` ${minutes}분` : ""} 남음`;
  return `${minutes}분 남음`;
}
