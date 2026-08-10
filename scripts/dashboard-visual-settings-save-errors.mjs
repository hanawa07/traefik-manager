import assert from "node:assert/strict";

import {
  captureVisualDom,
  captureVisualScreenshot,
} from "./dashboard-visual-artifacts.mjs";
import {
  evaluate,
  navigateAndWait,
  waitForCondition,
} from "./dashboard-visual-runtime.mjs";

const INTERNAL_DETAIL = "Internal persistence failure at /private/settings.db";

// API-invalid values keep live settings unchanged even if interception fails.
const CASES = [
  {
    cardTestId: "certificate-diagnostics-settings-card",
    controlSelector: 'input[type="number"]',
    endpoint: "/api/v1/settings/certificate-diagnostics",
    errorTestId: "certificate-diagnostics-settings-error",
    expectedError:
      "서버 오류가 발생했습니다. 인증서 진단 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    expectedPayloadField: "auto_check_interval_minutes",
    expectedPayloadValue: 1,
    invalidValue: "1",
    name: "인증서 진단",
  },
  {
    cardTestId: "deployment-bottleneck-settings-card",
    controlSelector: 'input[type="number"]',
    endpoint: "/api/v1/settings/deployment-bottleneck-alert",
    errorTestId: "deployment-bottleneck-settings-error",
    expectedError:
      "서버 오류가 발생했습니다. 배포 병목 운영 알림 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    expectedPayloadField: "threshold_ms",
    expectedPayloadValue: 0,
    invalidValue: "0",
    name: "배포 병목 운영 알림",
  },
  {
    cardTestId: "upstream-security-settings-card",
    controlSelector: "textarea",
    endpoint: "/api/v1/settings/upstream-security",
    errorTestId: "upstream-security-settings-error",
    expectedError:
      "서버 오류가 발생했습니다. 업스트림 보안 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    expectedPayloadField: "allowed_domain_suffixes",
    expectedPayloadValue: ["not a valid suffix"],
    invalidValue: "not a valid suffix",
    name: "업스트림 보안",
  },
];

export async function checkSettingsSaveErrorAdminFixture({
  artifactDir,
  baseUrl,
  cdp,
  cookies,
  timeoutMs,
}) {
  await cdp.send("Network.clearBrowserCookies");
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  for (const cookie of cookies) {
    await cdp.send("Network.setCookie", { url: baseUrl, ...cookie });
  }

  try {
    await navigateAndWait(cdp, `${baseUrl}/dashboard/settings`, timeoutMs);
    await waitForCondition(
      cdp,
      `(() => ${JSON.stringify(CASES.map(({ cardTestId }) => cardTestId))}.every((testId) => {
        const card = document.querySelector('[data-testid="' + testId + '"]');
        return Array.from(card?.querySelectorAll('button') || []).some(
          (button) => button.textContent?.trim() === '편집' && !button.disabled
        );
      }))()`,
      timeoutMs,
      "설정 저장 오류 회귀 대상 카드가 준비되지 않았습니다",
    );

    for (const fixture of CASES) {
      await checkFailedSave({ cdp, fixture, timeoutMs });
    }
  } catch (error) {
    await Promise.allSettled([
      captureVisualScreenshot({ artifactDir, cdp, name: "admin-settings-save-errors-failure" }),
      captureVisualDom({ artifactDir, cdp, name: "admin-settings-save-errors-failure" }),
    ]);
    throw error;
  } finally {
    await cdp.send("Fetch.disable").catch(() => undefined);
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(cdp, `localStorage.removeItem("auth")`);
  }
}

async function checkFailedSave({ cdp, fixture, timeoutMs }) {
  await cdp.send("Fetch.enable", {
    patterns: [{
      requestStage: "Request",
      urlPattern: `*${fixture.endpoint}`,
    }],
  });

  try {
    await openAndChangeForm({ cdp, fixture, timeoutMs });
    const updateRequest = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const clicked = await clickCardButton(cdp, fixture.cardTestId, "저장");
    assert.equal(clicked, true, `${fixture.name} 저장 버튼을 누르지 못했습니다`);

    const update = await updateRequest;
    assert.equal(update.request.method, "PUT");
    assert.equal(new URL(update.request.url).pathname, fixture.endpoint);
    const payload = JSON.parse(update.request.postData || "{}");
    assert.deepEqual(payload[fixture.expectedPayloadField], fixture.expectedPayloadValue);
    assert.ok(
      Object.keys(update.request.headers).some((name) => name.toLowerCase() === "x-csrf-token"),
      `${fixture.name} 저장 요청에 CSRF 헤더가 없습니다`,
    );
    await cdp.send("Fetch.fulfillRequest", {
      requestId: update.requestId,
      responseCode: 500,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify({ detail: INTERNAL_DETAIL })).toString("base64"),
    });

    await waitForCondition(
      cdp,
      `(() => {
        const card = document.querySelector('[data-testid=${JSON.stringify(fixture.cardTestId)}]');
        const control = card?.querySelector(${JSON.stringify(fixture.controlSelector)});
        const error = card?.querySelector('[data-testid=${JSON.stringify(fixture.errorTestId)}]');
        const save = Array.from(card?.querySelectorAll('button') || []).find(
          (button) => button.textContent?.trim() === '저장'
        );
        return control?.value === ${JSON.stringify(fixture.invalidValue)} &&
          error?.getAttribute('role') === 'alert' &&
          error.textContent?.trim() === ${JSON.stringify(fixture.expectedError)} &&
          !document.body.innerText.includes(${JSON.stringify(INTERNAL_DETAIL)}) &&
          save instanceof HTMLButtonElement && !save.disabled;
      })()`,
      timeoutMs,
      `${fixture.name} 500 실패 후 폼·한국어 오류가 유지되지 않았습니다`,
    );

    const cancelled = await clickCardButton(cdp, fixture.cardTestId, "취소");
    assert.equal(cancelled, true, `${fixture.name} 편집 취소 버튼을 누르지 못했습니다`);
    await waitForCondition(
      cdp,
      `(() => {
        const card = document.querySelector('[data-testid=${JSON.stringify(fixture.cardTestId)}]');
        return !card?.querySelector(${JSON.stringify(fixture.controlSelector)}) &&
          !card?.querySelector('[data-testid=${JSON.stringify(fixture.errorTestId)}]');
      })()`,
      timeoutMs,
      `${fixture.name} 실패 폼을 닫지 못했습니다`,
    );
  } finally {
    await cdp.send("Fetch.disable").catch(() => undefined);
  }
}

async function openAndChangeForm({ cdp, fixture, timeoutMs }) {
  const opened = await clickCardButton(cdp, fixture.cardTestId, "편집");
  assert.equal(opened, true, `${fixture.name} 편집 버튼을 누르지 못했습니다`);
  await waitForCondition(
    cdp,
    `document.querySelector(
      '[data-testid=${JSON.stringify(fixture.cardTestId)}] ${fixture.controlSelector}'
    ) instanceof HTMLElement`,
    timeoutMs,
    `${fixture.name} 편집 입력이 표시되지 않았습니다`,
  );
  const changed = await evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid=${JSON.stringify(fixture.cardTestId)}]');
    const control = card?.querySelector(${JSON.stringify(fixture.controlSelector)});
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return false;
    const prototype = control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(control, ${JSON.stringify(fixture.invalidValue)});
    control.dispatchEvent(new Event('input', { bubbles: true }));
    return control.value === ${JSON.stringify(fixture.invalidValue)};
  })()`);
  assert.equal(changed, true, `${fixture.name} 회귀 입력값을 설정하지 못했습니다`);
}

function clickCardButton(cdp, cardTestId, label) {
  return evaluate(cdp, `(() => {
    const card = document.querySelector('[data-testid=${JSON.stringify(cardTestId)}]');
    const button = Array.from(card?.querySelectorAll('button') || []).find(
      (candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)}
    );
    button?.click();
    return Boolean(button);
  })()`);
}
