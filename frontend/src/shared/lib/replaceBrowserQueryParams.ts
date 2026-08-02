export type BrowserQueryParamUpdate = readonly [
  key: string,
  value: string,
  defaultValue: string,
];

export function replaceBrowserQueryParams(
  values: readonly BrowserQueryParamUpdate[],
): void {
  const url = new URL(window.location.href);
  values.forEach(([key, value, defaultValue]) => {
    if (value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  });
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}
