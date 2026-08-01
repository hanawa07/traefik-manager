import assert from "node:assert/strict";

import {
  assertRequest,
  buildMaintenanceServices,
  fulfillJson,
  installRequestCapture,
  restoreRequestCapture,
  SERVICE_ID,
  SERVICE_NAME,
  waitForFetch,
} from "./dashboard-visual-maintenance-fixture.mjs";
import { checkMaintenanceHistory } from "./dashboard-visual-maintenance-history.mjs";
import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkMaintenanceScheduleFixture({ canManage, cdp, timeoutMs }) {
  if (!canManage) return false;
  let services = buildMaintenanceServices();
  const origin = await evaluate(cdp, "location.origin");
  await cdp.send("Fetch.enable", {
    patterns: [
      { requestStage: "Request", urlPattern: "*/api/v1/services" },
      { requestStage: "Request", urlPattern: `*/api/v1/services/${SERVICE_ID}` },
      { requestStage: "Request", urlPattern: `*/api/v1/audit*search=${SERVICE_ID}*` },
    ],
  });
  try {
    const initialRequest = waitForFetch(cdp, timeoutMs, "점검 서비스 목록");
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${origin}/dashboard` });
    const initial = await initialRequest;
    assertRequest(initial, "GET", "/api/v1/services");
    await fulfillJson(cdp, initial, services);
    await loaded;
    await waitForCondition(
      cdp,
      `(() => {
        const card = document.querySelector('[data-testid="maintenance-schedule-summary"]');
        return card?.getAttribute('data-maintenance-service-count') === '5' &&
          document.querySelectorAll('[data-maintenance-service-id]').length === 3 &&
          document.querySelector('[data-maintenance-schedule-toggle]')?.textContent?.includes('전체 5개 보기');
      })()`,
      timeoutMs,
      "점검 일정 fixture의 축약 목록이 표시되지 않았습니다",
    );

    const expanded = await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-maintenance-schedule-toggle]');
      button?.click();
      return Boolean(button);
    })()`);
    assert.equal(expanded, true, "점검 일정 전체 보기 버튼이 없습니다");
    await waitForCondition(
      cdp,
      `document.querySelectorAll('[data-maintenance-service-id]').length === 5 &&
        document.querySelector('[data-maintenance-schedule-toggle]')?.getAttribute('aria-expanded') === 'true'`,
      timeoutMs,
      "점검 일정 전체 목록이 펼쳐지지 않았습니다",
    );

    await checkMaintenanceHistory({ cdp, services, timeoutMs });

    await installRequestCapture(cdp);
    try {
      const patchRequest = waitForFetch(cdp, timeoutMs, "점검 연장 PATCH");
      await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 1시간 연장`);
      const patch = await patchRequest;
      assertRequest(patch, "PATCH", `/api/v1/services/${SERVICE_ID}`);
      const body = JSON.parse(patch.request.postData || "{}");
      const expectedUntil = new Date(
        Date.parse(services[0].maintenance_until) + 60 * 60 * 1_000,
      ).toISOString();
      assert.deepEqual(body, {
        maintenance_until: expectedUntil,
        routing_mode: "maintenance",
      });

      const refreshedListRequest = waitForFetch(cdp, timeoutMs, "점검 연장 후 서비스 목록");
      services = [{ ...services[0], maintenance_until: expectedUntil }, ...services.slice(1)];
      await fulfillJson(cdp, patch, services[0]);
      const refreshedList = await refreshedListRequest;
      assertRequest(refreshedList, "GET", "/api/v1/services");
      await fulfillJson(cdp, refreshedList, services);
      await waitForCondition(
        cdp,
        `(() => {
          const row = document.querySelector('[data-maintenance-service-id="${SERVICE_ID}"]');
          return row?.getAttribute('data-maintenance-until') === ${JSON.stringify(expectedUntil)} &&
            document.body.innerText.includes('${SERVICE_NAME} 점검 종료를 1시간 연장했습니다.');
        })()`,
        timeoutMs,
        "점검 종료 연장 결과가 화면에 반영되지 않았습니다",
      );

      const directUntilLocal = "2035-02-03T14:30";
      const directUntil = "2035-02-03T05:30:00.000Z";
      const changed = await evaluate(cdp, `(() => {
        const input = document.querySelector('input[aria-label="${SERVICE_NAME} 점검 종료 시각"]');
        if (!(input instanceof HTMLInputElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, ${JSON.stringify(directUntilLocal)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return input.value === ${JSON.stringify(directUntilLocal)};
      })()`);
      assert.equal(changed, true, "점검 종료 시각 입력값을 변경하지 못했습니다");
      await waitForCondition(
        cdp,
        `document.querySelector('input[aria-label="${SERVICE_NAME} 점검 종료 시각"]')?.value === ${JSON.stringify(directUntilLocal)} &&
          document.querySelector('button[aria-label="${SERVICE_NAME} 점검 종료 시각 적용"]')?.disabled === false`,
        timeoutMs,
        "점검 종료 시각 직접 편집값이 반영되지 않았습니다",
      );

      const directPatchRequest = waitForFetch(cdp, timeoutMs, "점검 종료 시각 PATCH");
      await clickAriaLabel(cdp, `${SERVICE_NAME} 점검 종료 시각 적용`);
      const directPatch = await directPatchRequest;
      assertRequest(directPatch, "PATCH", `/api/v1/services/${SERVICE_ID}`);
      assert.deepEqual(JSON.parse(directPatch.request.postData || "{}"), {
        maintenance_until: directUntil,
        routing_mode: "maintenance",
      });

      const directRefreshedListRequest = waitForFetch(cdp, timeoutMs, "점검 시각 변경 후 서비스 목록");
      services = [{ ...services[0], maintenance_until: directUntil }, ...services.slice(1)];
      await fulfillJson(cdp, directPatch, services[0]);
      const directRefreshedList = await directRefreshedListRequest;
      assertRequest(directRefreshedList, "GET", "/api/v1/services");
      await fulfillJson(cdp, directRefreshedList, services);
      await waitForCondition(
        cdp,
        `(() => {
          const row = document.querySelector('[data-maintenance-service-id="${SERVICE_ID}"]');
          return row?.getAttribute('data-maintenance-until') === ${JSON.stringify(directUntil)} &&
            document.body.innerText.includes('${SERVICE_NAME} 점검 종료 시각을 변경했습니다.');
        })()`,
        timeoutMs,
        "점검 종료 시각 직접 편집 결과가 화면에 반영되지 않았습니다",
      );

      await clickAriaLabel(cdp, `${SERVICE_NAME} 지금 정상 운영`);
      await waitForCondition(
        cdp,
        "window.__tmMaintenanceConfirmMessages?.length === 1",
        timeoutMs,
        "즉시 정상 운영 확인창이 호출되지 않았습니다",
      );
      await evaluate(cdp, "new Promise((resolve) => setTimeout(resolve, 250))");
      const capture = await evaluate(cdp, `({
        confirms: window.__tmMaintenanceConfirmMessages,
        requests: window.__tmMaintenanceRequests,
      })`);
      assert.match(capture.confirms[0], /점검 스모크 1.*지금 정상 운영/);
      assert.deepEqual(
        capture.requests.map((request) => request.method),
        ["PATCH", "PATCH"],
        "즉시 정상 운영을 취소한 뒤 추가 변경 요청이 발생했습니다",
      );
    } finally {
      await restoreRequestCapture(cdp);
    }
  } finally {
    await cdp.send("Fetch.disable");
  }
  return true;
}
