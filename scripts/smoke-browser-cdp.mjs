import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function launchSmokeChrome(timeoutMs) {
  const port = await getFreePort();
  const userDataDir = await mkdtemp(join(tmpdir(), "tm-smoke-chrome-"));
  const chromeBin = process.env.TM_SMOKE_CHROME_BIN || findChromeBinary();
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];

  if (process.getuid?.() === 0 || process.env.TM_SMOKE_NO_SANDBOX === "1") {
    args.unshift("--no-sandbox");
  }
  if (process.env.TM_SMOKE_IGNORE_CERT_ERRORS === "1") {
    args.unshift("--ignore-certificate-errors");
  }

  const processHandle = spawn(chromeBin, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  processHandle.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    stderr = stderr.slice(-4000);
  });

  const debugUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForJson(`${debugUrl}/json/version`, timeoutMs);
  } catch (error) {
    processHandle.kill("SIGTERM");
    await rm(userDataDir, { force: true, recursive: true });
    throw new Error(`Chrome 시작 실패: ${error.message}${stderr ? `\n${stderr}` : ""}`);
  }

  return {
    debugUrl,
    close: async () => {
      processHandle.kill("SIGTERM");
      await waitForExit(processHandle, 2000);
      await rm(userDataDir, {
        force: true,
        maxRetries: 3,
        recursive: true,
        retryDelay: 100,
      });
    },
  };
}

export async function connectToSmokePage(debugUrl, timeoutMs) {
  let response = await fetch(`${debugUrl}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) {
    response = await fetch(`${debugUrl}/json/list`);
  }
  const target = await response.json();
  const pageTarget = Array.isArray(target)
    ? target.find((item) => item.type === "page")
    : target;
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("Chrome page target을 찾지 못했습니다");
  }
  return CdpClient.connect(pageTarget.webSocketDebuggerUrl, timeoutMs);
}

export async function navigateSmokePage(cdp, url, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.navigate", { url });
  await loaded;
}

export async function evaluateInSmokePage(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "브라우저 평가 실패");
  }
  return response.result.value;
}

class CdpClient {
  constructor(socket) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => this.handleMessage(event));
  }

  static async connect(url, timeoutMs) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket 연결 시간 초과")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("CDP WebSocket 연결 실패"));
      });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitFor(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${method} 이벤트 대기 시간 초과`));
      }, timeoutMs);
      const listeners = this.events.get(method) ?? [];
      listeners.push((params) => {
        clearTimeout(timer);
        resolve(params);
      });
      this.events.set(method, listeners);
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
      return;
    }

    const listeners = this.events.get(message.method);
    if (!listeners?.length) return;
    const listener = listeners.shift();
    listener(message.params ?? {});
  }
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError ?? new Error(`${url} 응답 없음`);
}

function findChromeBinary() {
  const result = spawnSync("sh", [
    "-lc",
    "command -v google-chrome || command -v chromium || command -v chromium-browser",
  ]);
  const path = result.stdout.toString().trim().split("\n")[0];
  if (!path) {
    throw new Error("Chrome/Chromium 실행 파일을 찾지 못했습니다. TM_SMOKE_CHROME_BIN을 지정하세요.");
  }
  return path;
}

export async function getFreePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExit(processHandle, timeoutMs) {
  if (processHandle.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      processHandle.kill("SIGKILL");
      resolve();
    }, timeoutMs);
    processHandle.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function runSmokeBrowserCdpSelfTest() {
  const listeners = new Map();
  const sent = [];
  const socket = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    send: (payload) => sent.push(JSON.parse(payload)),
  };
  const cdp = new CdpClient(socket);

  const resultPromise = cdp.send("Runtime.enable");
  assert.deepEqual(sent[0], { id: 1, method: "Runtime.enable", params: {} });
  listeners.get("message")({ data: JSON.stringify({ id: 1, result: { enabled: true } }) });
  assert.deepEqual(await resultPromise, { enabled: true });

  const eventPromise = cdp.waitFor("Page.loadEventFired", 100);
  listeners.get("message")({
    data: JSON.stringify({ method: "Page.loadEventFired", params: { timestamp: 1 } }),
  });
  assert.deepEqual(await eventPromise, { timestamp: 1 });

  const evaluated = await evaluateInSmokePage(
    { send: async () => ({ result: { value: "ok" } }) },
    `"ok"`,
  );
  assert.equal(evaluated, "ok");
  await assert.rejects(
    evaluateInSmokePage(
      { send: async () => ({ exceptionDetails: { text: "fixture failure" } }) },
      `throw new Error()`,
    ),
    /fixture failure/,
  );
}
