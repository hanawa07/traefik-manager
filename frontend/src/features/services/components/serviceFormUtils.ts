export function parseHealthcheckExpectedStatuses(input: string | undefined): number[] {
  if (!input) return [];
  const normalized = input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));

  const uniqueStatuses = Array.from(new Set(normalized));
  return uniqueStatuses.sort((a, b) => a - b);
}

export function parseAllowedIps(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseBlockedPaths(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((path) => (path.startsWith("/") ? path : `/${path}`));
}

export function generateSecureToken() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const randomStr = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `service_${btoa(randomStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").substring(0, 44)}`;
}
