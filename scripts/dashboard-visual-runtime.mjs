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

export async function fetchJsonReadWithRetry(
  cdp,
  path,
  { attempts = 2, retryDelayMs = 250 } = {},
) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await evaluate(cdp, `(async () => {
        const response = await fetch(${JSON.stringify(path)}, {
          credentials: 'include',
          cache: 'no-store',
        });
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}
        return {
          data,
          ok: response.ok,
          status: response.status,
          text: text.slice(0, 500),
        };
      })()`);
      return { ...result, attemptCount: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw new Error(
    `스모크 읽기 GET ${path} 실패 (${attempts}/${attempts}회): ${lastError?.message || "알 수 없는 오류"}`,
  );
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

  const retryResponses = [
    { exceptionDetails: { text: "Uncaught (in promise) TypeError: Failed to fetch" } },
    {
      result: {
        value: { data: { status: "ok" }, ok: true, status: 200, text: '{"status":"ok"}' },
      },
    },
  ];
  const retryResult = await fetchJsonReadWithRetry(
    { send: async () => retryResponses.shift() },
    "/api/v1/retry-target",
    { retryDelayMs: 0 },
  );
  assert.equal(retryResult.attemptCount, 2);
  assert.deepEqual(retryResult.data, { status: "ok" });

  let failedAttempts = 0;
  await assert.rejects(
    fetchJsonReadWithRetry(
      {
        send: async () => {
          failedAttempts += 1;
          return { exceptionDetails: { text: "TypeError: Failed to fetch" } };
        },
      },
      "/api/v1/failing-target?window=24",
      { retryDelayMs: 0 },
    ),
    /GET \/api\/v1\/failing-target\?window=24 실패 \(2\/2회\).*Failed to fetch/,
  );
  assert.equal(failedAttempts, 2);

  let httpAttempts = 0;
  const httpError = await fetchJsonReadWithRetry(
    {
      send: async () => {
        httpAttempts += 1;
        return {
          result: {
            value: { data: { detail: "server error" }, ok: false, status: 500, text: "server error" },
          },
        };
      },
    },
    "/api/v1/http-error",
    { retryDelayMs: 0 },
  );
  assert.equal(httpError.status, 500);
  assert.equal(httpError.attemptCount, 1);
  assert.equal(httpAttempts, 1);
}
