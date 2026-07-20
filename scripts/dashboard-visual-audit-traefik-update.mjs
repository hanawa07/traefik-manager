import assert from "node:assert/strict";

import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";
import { TRAEFIK_UPDATE_HISTORY_FIXTURE } from "./dashboard-visual-traefik-update-history.mjs";

const AUDIT_ID = "00000000-0000-4000-8000-000000000011";
const RETRY_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const FIXTURE = {
  id: AUDIT_ID,
  actor: "security-admin",
  action: "request",
  resource_type: "traefik",
  resource_id: RETRY_REQUEST_ID,
  resource_name: "Traefik 자동 롤백 실패 알림 재시도",
  event: "traefik_rollback_alert_retry_requested",
  created_at: "2026-07-21T00:00:00Z",
  detail: {
    event: "traefik_rollback_alert_retry_requested",
    source_request_id: SOURCE_REQUEST_ID,
    target_version: "v3.7.9",
  },
};

export async function checkTraefikAuditAutoExpand(cdp, timeoutMs) {
  await evaluate(cdp, `history.replaceState(
    null,
    '',
    ${JSON.stringify(`/dashboard/audit?q=${RETRY_REQUEST_ID}&expand=first`)}
  )`);
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/audit\\?*" }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    const request = await requestPaused;
    assert.equal(new URL(request.request.url).searchParams.get("search"), RETRY_REQUEST_ID);
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "X-Total-Count", value: "1" },
      ],
      body: Buffer.from(JSON.stringify([FIXTURE])).toString("base64"),
    });
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const row = document.querySelector('[data-audit-log-id="${AUDIT_ID}"]');
        const source = row?.nextElementSibling?.querySelector(
          '[data-traefik-update-source="${SOURCE_REQUEST_ID}"]',
        );
        const link = source?.querySelector('a');
        const url = link ? new URL(link.href) : null;
        return document.querySelector('input[aria-label="감사 로그 검색"]')?.value ===
            '${RETRY_REQUEST_ID}' &&
          row?.textContent?.includes('Traefik 알림 재시도') &&
          row.textContent.includes('요청') &&
          source?.textContent?.includes('${SOURCE_REQUEST_ID}') &&
          url?.pathname === '/dashboard' &&
          url.searchParams.get('traefik_update_actor') === '${SOURCE_REQUEST_ID}' &&
          url.hash === '#traefik-update-history';
      })()`,
      timeoutMs,
      "Traefik 재시도 감사 자동 펼침과 원본 이력 링크가 표시되지 않았습니다",
    );
  } finally {
    await cdp.send("Fetch.disable");
  }

  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/traefik/update-operations*" }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    const clicked = await evaluate(cdp, `(() => {
      const source = document.querySelector(
        '[data-traefik-update-source="${SOURCE_REQUEST_ID}"]',
      );
      const link = source?.querySelector('a');
      link?.click();
      return Boolean(link);
    })()`);
    assert.equal(clicked, true, "Traefik 원본 업데이트 이력 링크를 클릭하지 못했습니다");
    const request = await requestPaused;
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(TRAEFIK_UPDATE_HISTORY_FIXTURE)).toString("base64"),
    });
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const entries = document.querySelectorAll(
          '[data-testid="traefik-update-history"] li[data-traefik-update-request-id]',
        );
        return location.pathname === '/dashboard' &&
          location.hash === '#traefik-update-history' &&
          new URLSearchParams(location.search).get('traefik_update_actor') ===
            '${SOURCE_REQUEST_ID}' &&
          document.querySelector('[data-traefik-update-actor-filter]')?.value ===
            '${SOURCE_REQUEST_ID}' &&
          entries.length === 1 &&
          entries[0].getAttribute('data-traefik-update-request-id') === '${SOURCE_REQUEST_ID}';
      })()`,
      timeoutMs,
      "Traefik 원본 요청 UUID로 업데이트 이력이 한 건만 표시되지 않았습니다",
    );
  } finally {
    await cdp.send("Fetch.disable");
  }
  return true;
}
