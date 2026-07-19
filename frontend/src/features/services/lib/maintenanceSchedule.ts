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
