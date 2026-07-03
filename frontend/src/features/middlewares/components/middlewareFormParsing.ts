export function parseMultiline(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}
