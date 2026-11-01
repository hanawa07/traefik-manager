const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const vm = require("node:vm");
const redirects = require("../frontend/node_modules/follow-redirects");

async function main() {
  const target = http.createServer((req, res) => res.end(JSON.stringify(req.headers)));
  const source = http.createServer((_req, res) => {
    res.writeHead(302, { Location: `http://target.invalid:${target.address().port}/` });
    res.end();
  });
  target.listen(0, "127.0.0.1");
  source.listen(0, "127.0.0.1");
  try {
    await Promise.all([once(target, "listening"), once(source, "listening")]);
    const crossRealmHeaders = vm.runInNewContext("['X-Fixture-Key']");
    assert.equal(Array.isArray(crossRealmHeaders), true);
    assert.equal(crossRealmHeaders instanceof Array, false);
    async function requestHeaders(headers, sensitiveHeaders) {
      return await new Promise((resolve, reject) => {
        const request = redirects.http.get(`http://source.invalid:${source.address().port}/`, {
          lookup: (host, options, callback) => {
            if (!["source.invalid", "target.invalid"].includes(host)) {
              callback(new Error("non-fixture-host"));
              return;
            }
            if (options.all) callback(null, [{ address: "127.0.0.1", family: 4 }]);
            else callback(null, "127.0.0.1", 4);
          },
          sensitiveHeaders,
          headers,
        }, (response) => {
          let body = "";
          response.on("data", (chunk) => { body += chunk; });
          response.on("end", () => {
            try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
          });
          response.on("error", reject);
        });
        request.on("error", reject);
        request.setTimeout(3000, () => request.destroy(new Error("fixture-timeout")));
      });
    }
    const cases = [
      [{ "X-Fixture-Key": "fake-only", "X-Harmless": "keep" }, crossRealmHeaders, "x-fixture-key"],
      [["X-Fixture-Key", "fake-only", "X-Harmless", "keep"], ["X-Fixture-Key"], "x-fixture-key"],
      [{ "X-Fixture$Key": "fake-only", "X-Harmless": "keep" }, ["X-Fixture$Key"], "x-fixture$key"],
      [{ Authorization: "Bearer fake-only", Cookie: "fake=only", "X-Harmless": "keep" }, [], "authorization"],
    ];
    for (const [headers, sensitiveHeaders, key] of cases) {
      const received = await requestHeaders(headers, sensitiveHeaders);
      assert.equal(received[key], undefined, "다른 origin에 가짜 credential 헤더가 전달됐습니다");
      assert.equal(received.cookie, undefined);
      assert.equal(received["x-harmless"], "keep");
    }
    console.log("follow-redirects cross-realm·배열 헤더·정규식 문자·기본 인증 보호 loopback 검사 4개 통과");
  } finally {
    await Promise.all([new Promise(resolve => source.close(resolve)), new Promise(resolve => target.close(resolve))]);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
