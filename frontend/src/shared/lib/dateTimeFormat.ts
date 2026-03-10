const DEFAULT_DISPLAY_TIMEZONE = "Asia/Seoul";
const FALLBACK_TIMEZONES = [
  "UTC",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
];

type SupportedValuesIntl = typeof Intl & {
  supportedValuesOf?: (key: "timeZone") => string[];
};

export function getDefaultDisplayTimezone(): string {
  return DEFAULT_DISPLAY_TIMEZONE;
}

export function getSupportedTimeZones(): string[] {
  const intlObject = Intl as SupportedValuesIntl;
  if (typeof intlObject.supportedValuesOf === "function") {
    return intlObject.supportedValuesOf("timeZone");
  }
  return FALLBACK_TIMEZONES;
}

export function isSupportedTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("ko-KR", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveDisplayTimeZone(value: string | null | undefined): string {
  return isSupportedTimeZone(value) ? value : DEFAULT_DISPLAY_TIMEZONE;
}

export function formatDateTime(
  value: string | null | undefined,
  timeZone?: string | null,
  locale = "ko-KR",
): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    timeZone: resolveDisplayTimeZone(timeZone),
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatServerDateTime(
  value: string | null | undefined,
  serverTimeZone?: string | null,
  locale = "ko-KR",
): string {
  if (!value) return "-";
  if (isSupportedTimeZone(serverTimeZone)) {
    return formatDateTime(value, serverTimeZone, locale);
  }
  return value.replace("T", " ");
}
