import { evaluate, reloadPage, waitForCondition } from "./dashboard-visual-runtime.mjs";


export async function checkManagerHttpAuditAutoExpand(cdp, timeoutMs) {
  const eventId = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/v1/audit?resource_type=manager_component&manager_source=api&period_days=1&limit=50');
    if (!response.ok) return null;
    const logs = await response.json();
    const item = Array.isArray(logs)
      ? logs.find((log) => ['manager_http_errors_high', 'manager_http_errors_recovered'].includes(log?.event))
      : null;
    return item?.id || null;
  })()`);
  if (!eventId) return false;

  await evaluate(cdp, `history.replaceState(
    null,
    '',
    '/dashboard/audit?filter=manager_health&manager_source=api&period=1&expand=latest'
  )`);
  await reloadPage(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    `(() => {
      const row = document.querySelector('[data-audit-log-id="' + CSS.escape(${JSON.stringify(eventId)}) + '"]');
      return document.querySelector('select[aria-label="Manager 소스"]')?.value === 'api' &&
        document.querySelector('select[aria-label="감사 기간"]')?.value === '1' &&
        Boolean(row?.nextElementSibling?.querySelector('[data-testid="manager-http-audit-detail"]'));
    })()`,
    timeoutMs,
    "Manager API 감사 이벤트가 자동으로 펼쳐지지 않았습니다",
  );
  return true;
}
