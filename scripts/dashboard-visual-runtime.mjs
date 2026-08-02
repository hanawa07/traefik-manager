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

export async function navigateAndWait(cdp, url, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.navigate", { url });
  await loaded;
}

export async function navigateWithLinkFallback(cdp, url, timeoutMs) {
  const clicked = await evaluate(cdp, `(() => {
    const target = new URL(${JSON.stringify(url)});
    if (target.origin !== location.origin ||
        (target.pathname === location.pathname && target.search === location.search)) {
      return false;
    }
    const link = Array.from(document.querySelectorAll('a[href]')).find((candidate) => {
      const href = new URL(candidate.href, location.href);
      return href.origin === target.origin && href.pathname === target.pathname &&
        href.search === target.search;
    });
    if (!(link instanceof HTMLAnchorElement)) return false;
    link.click();
    return true;
  })()`);
  if (clicked) return "client";
  await navigateAndWait(cdp, url, timeoutMs);
  return "document";
}

export async function installClipboardCapture(cdp) {
  const installed = await evaluate(cdp, `(() => {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value) => { window.__managerDeploymentClipboard = value; },
        },
      });
      window.__managerDeploymentClipboard = '';
      return true;
    } catch {
      return false;
    }
  })()`);
  assert.equal(installed, true, "Manager 클립보드 캡처를 준비하지 못했습니다");
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

export async function runDashboardVisualRuntimeSelfTest() {
  for (const [clicked, expected] of [[true, "client"], [false, "document"]]) {
    const calls = [];
    const cdp = {
      send: async (method) => {
        calls.push(method);
        return method === "Runtime.evaluate" ? { result: { value: clicked } } : {};
      },
      waitFor: async () => undefined,
    };
    assert.equal(await navigateWithLinkFallback(cdp, "https://example.com/dashboard", 100), expected);
    assert.deepEqual(calls, clicked
      ? ["Runtime.evaluate"]
      : ["Runtime.evaluate", "Page.navigate"]);
  }
}
