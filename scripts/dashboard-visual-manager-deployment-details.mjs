import assert from "node:assert/strict";

import {
  evaluate,
  installClipboardCapture,
  waitForCondition,
} from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentHistoryDetails({ cdp, timeoutMs }) {
  await checkFailureStageAverages(cdp);
  await checkJsonDetails({ cdp, timeoutMs });
  await checkCompareLink(cdp);
  await checkCopyButtons({ cdp, timeoutMs });
}

async function checkFailureStageAverages(cdp) {
  const averages = await evaluate(cdp, `Object.fromEntries(Array.from(document.querySelectorAll(
    '[data-failure-stage-average]',
  )).map((item) => [item.getAttribute('data-failure-stage-average'), item.textContent?.trim()]))`);
  assert.match(averages.build, /이미지 빌드 1 · 평균 2분/);
  assert.match(averages.public_probe, /공개 health probe 1 · 평균 1분/);
}

async function checkJsonDetails({ cdp, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const details = document.querySelector('[data-deployment-json-details]');
    const toggle = details?.querySelector('[data-deployment-json-toggle]');
    toggle?.click();
    return Boolean(details && toggle);
  })()`);
  assert.equal(clicked, true, "Manager 배포 상세 JSON 토글을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `document.querySelector('[data-deployment-json-details]')?.hasAttribute('open')`,
    timeoutMs,
    "Manager 배포 상세 JSON을 펼치지 못했습니다",
  );
  const entry = await evaluate(cdp, `(() => {
    const text = document.querySelector('[data-deployment-json]')?.textContent;
    return text ? JSON.parse(text) : null;
  })()`);
  assert.equal(entry.version, "v1.38.70");
  assert.equal(entry.revision, "a".repeat(40));
  assert.equal(entry.failure_stage, "public_probe");
}

async function checkCompareLink(cdp) {
  const links = await evaluate(cdp, `Array.from(document.querySelectorAll(
    '[data-history-source="archive"] [data-deployment-compare]',
  )).map((link) => link.href)`);
  assert.equal(links.length, 1, "Manager 이전 버전 비교 링크 수가 다릅니다");
  assert.match(
    links[0],
    /\/compare\/v1\.38\.69\.\.\.v1\.38\.70$/,
    "Manager 이전·현재 버전 비교 URL이 올바르지 않습니다",
  );
}

async function checkCopyButtons({ cdp, timeoutMs }) {
  const buttons = await evaluate(cdp, `(() => ({
    failures: document.querySelectorAll('[data-deployment-copy="failure_reason"]').length,
    json: document.querySelectorAll('[data-deployment-copy="json"]').length,
    revisions: document.querySelectorAll('[data-deployment-copy="revision"]').length,
  }))()`);
  assert.deepEqual(buttons, { failures: 2, json: 2, revisions: 2 });

  await installClipboardCapture(cdp);
  await clickCopyAndWait({
    cdp,
    expected: "a".repeat(40),
    kind: "revision",
    toast: "커밋 SHA 복사 완료",
    timeoutMs,
  });
  await clickCopyAndWait({
    cdp,
    expected: "=archive fixture probe failure",
    kind: "failure_reason",
    toast: "실패 원인 복사 완료",
    timeoutMs,
  });
  const expectedJson = await evaluate(
    cdp,
    `(() => {
      const text = document.querySelector('[data-deployment-json]')?.textContent;
      return text ? JSON.stringify(JSON.parse(text), null, 2) : null;
    })()`,
  );
  assert.ok(expectedJson, "Manager 상세 JSON 원문을 읽지 못했습니다");
  await clickCopyAndWait({
    cdp,
    expected: expectedJson,
    kind: "json",
    toast: "상세 JSON 복사 완료",
    timeoutMs,
  });
}

async function clickCopyAndWait({ cdp, expected, kind, toast, timeoutMs }) {
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-deployment-copy="${kind}"]`)},
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, `Manager ${kind} 복사 버튼을 찾지 못했습니다`);
  await waitForCondition(
    cdp,
    `window.__managerDeploymentClipboard === ${JSON.stringify(expected)} &&
      document.body.textContent?.includes(${JSON.stringify(toast)})`,
    timeoutMs,
    `Manager ${kind} 값과 복사 완료 알림이 일치하지 않습니다`,
  );
}
