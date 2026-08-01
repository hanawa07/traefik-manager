import assert from "node:assert/strict";

import {
  captureVisualDom,
  captureVisualScreenshot,
} from "./dashboard-visual-artifacts.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const EXPECTED_FORM = {
  domain: "english.lizstudio.co.kr",
  name: "english-app-1",
  tlsEnabled: true,
  upstreamHost: "english-nginx-1",
  upstreamPort: "80",
};

export async function checkServiceGatewayImportAdminFixture({
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
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.navigate", { url: `${baseUrl}/dashboard/services/new` });
    await loaded;
    await waitForCondition(
      cdp,
      `location.pathname === '/dashboard/services/new' &&
        document.body.innerText.includes('서비스 추가') &&
        Boolean(document.querySelector('input[name="domain"]'))`,
      timeoutMs,
      "관리자 서비스 추가 폼이 표시되지 않았습니다",
    );

    const opened = await evaluate(cdp, `(() => {
      const domain = document.querySelector('input[name="domain"]');
      const tls = document.querySelector('input[name="tls_enabled"]');
      const openButton = [...document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('컨테이너 정보 가져오기'));
      if (!(domain instanceof HTMLInputElement) ||
          !(tls instanceof HTMLInputElement) || !openButton) return false;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(domain, ${JSON.stringify(EXPECTED_FORM.domain)});
      domain.dispatchEvent(new Event('input', { bubbles: true }));
      if (!tls.checked) tls.click();
      openButton.click();
      return true;
    })()`);
    assert.equal(opened, true, "컨테이너 가져오기 모달을 열지 못했습니다");

    await waitForCondition(
      cdp,
      `Boolean(document.querySelector('[role="dialog"] input[placeholder^="컨테이너 이름"]'))`,
      timeoutMs,
      "컨테이너 가져오기 목록을 불러오지 못했습니다",
    );
    const searched = await evaluate(cdp, `(() => {
      const input = document.querySelector(
        '[role="dialog"] input[placeholder^="컨테이너 이름"]',
      );
      if (!(input instanceof HTMLInputElement)) return false;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, ${JSON.stringify(EXPECTED_FORM.name)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    assert.equal(searched, true, "English 컨테이너 검색어를 입력하지 못했습니다");

    await waitForCondition(
      cdp,
      `document.querySelector('[role="dialog"]')?.innerText.includes(
        '업스트림은 추천 gateway english-nginx-1:80으로 채웁니다',
      ) === true`,
      timeoutMs,
      "English 컨테이너의 추천 gateway 안내가 표시되지 않았습니다",
    );
    const imported = await evaluate(cdp, `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const button = dialog && [...dialog.querySelectorAll('button')].find((item) =>
        item.textContent?.includes('english-app-1') &&
        item.textContent?.includes('english-nginx-1:80'),
      );
      button?.click();
      return Boolean(button);
    })()`);
    assert.equal(imported, true, "English 추천 gateway 항목을 선택하지 못했습니다");

    await waitForCondition(
      cdp,
      `!document.querySelector('[role="dialog"]')`,
      timeoutMs,
      "컨테이너 가져오기 모달이 닫히지 않았습니다",
    );
    const snapshot = await evaluate(cdp, `(() => ({
      domain: document.querySelector('input[name="domain"]')?.value,
      name: document.querySelector('input[name="name"]')?.value,
      tlsEnabled: document.querySelector('input[name="tls_enabled"]')?.checked,
      upstreamHost: document.querySelector('input[name="upstream_host"]')?.value,
      upstreamPort: document.querySelector('input[name="upstream_port"]')?.value,
    }))()`);
    assert.deepEqual(snapshot, EXPECTED_FORM, "English 추천 gateway 폼 값이 올바르지 않습니다");
    return true;
  } catch (error) {
    await Promise.allSettled([
      captureVisualScreenshot({ artifactDir, cdp, name: "admin-service-gateway-import-failure" }),
      captureVisualDom({ artifactDir, cdp, name: "admin-service-gateway-import-failure" }),
    ]);
    throw error;
  } finally {
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(cdp, `localStorage.removeItem("auth")`);
  }
}
