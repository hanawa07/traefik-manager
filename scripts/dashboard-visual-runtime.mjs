import assert from "node:assert/strict";

export async function clickAriaLabel(cdp, label) {
  const clicked = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
      element?.click();
      return Boolean(element);
    })()`,
  );
  assert.equal(clicked, true, `${label}: 요소를 찾지 못했습니다`);
}

export async function reloadPage(cdp, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.reload", { ignoreCache: true });
  await loaded;
}

export async function waitForCondition(cdp, expression, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

export async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "브라우저 상호작용 검사 실패");
  }
  return response.result.value;
}
