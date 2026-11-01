const assert = require("node:assert/strict");
require("../frontend/node_modules/sucrase/register");
const { zodResolver } = require("../frontend/node_modules/@hookform/resolvers/zod");
const { serviceFormSchema } = require("../frontend/src/features/services/components/serviceFormSchema.ts");
const { createServiceFormDefaultValues, buildServiceSubmitPayload } = require("../frontend/src/features/services/components/serviceFormPayload.ts");
const { middlewareFormSchema } = require("../frontend/src/features/middlewares/components/middlewareFormModel.ts");
const { userFormSchema, buildUserFormPayload } = require("../frontend/src/features/users/components/userFormSchema.ts");
const { redirectFormSchema } = require("../frontend/src/features/redirects/components/redirectFormSchema.ts");

let checked = 0;
async function valid(schema, value) {
  const result = await zodResolver(schema)(value, undefined, { criteriaMode: "all", fields: {}, shouldUseNativeValidation: false });
  assert.deepEqual(result.errors, {});
  checked++;
  return result.values;
}
async function invalid(schema, value, path, message) {
  const result = await zodResolver(schema)(value, undefined, { criteriaMode: "all", fields: {}, shouldUseNativeValidation: false });
  assert.equal(result.errors[path]?.message, message);
  assert.deepEqual(result.values, {});
  checked++;
}

async function main() {
  const service = createServiceFormDefaultValues({ name: "fixture", domain: "fixture.example", upstream_host: "fixture" });
  const parsed = await valid(serviceFormSchema, { ...service, upstream_port: "8443", healthcheck_timeout_ms: "3000" });
  assert.equal(parsed.upstream_port, 8443);
  assert.equal(parsed.healthcheck_timeout_ms, 3000);
  assert.equal(buildServiceSubmitPayload(parsed).rate_limit_average, null);
  await invalid(serviceFormSchema, { ...service, domain: "bad domain" }, "domain", "유효한 도메인 형식이 아닙니다");
  await invalid(serviceFormSchema, { ...service, upstream_port: 65536 }, "upstream_port", "1~65535 범위의 포트를 입력하세요");
  await invalid(serviceFormSchema, { ...service, tls_enabled: false }, "https_redirect_enabled", "HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다");
  await invalid(serviceFormSchema, { ...service, auth_mode: "authentik", basic_auth_enabled: true }, "basic_auth_enabled", "외부 인증(Authentik/Token)과 Basic Auth는 동시에 사용할 수 없습니다");
  await invalid(serviceFormSchema, { ...service, rate_limit_enabled: true }, "rate_limit_average", "Rate Limit을 활성화하면 average와 burst를 모두 입력해야 합니다");
  await invalid(serviceFormSchema, { ...service, healthcheck_path: "bad" }, "healthcheck_path", "헬스 체크 경로는 '/'로 시작해야 합니다");
  await invalid(serviceFormSchema, { ...service, healthcheck_expected_statuses_input: "200,600" }, "healthcheck_expected_statuses_input", "기대 상태 코드는 100~599 범위 정수만 입력할 수 있습니다");
  await invalid(serviceFormSchema, { ...service, maintenance_until: "bad" }, "maintenance_until", "올바른 점검 종료 예정 시각을 입력하세요");
  const rate = await valid(serviceFormSchema, { ...service, rate_limit_enabled: true, rate_limit_average: "5", rate_limit_burst: "10" });
  assert.equal(buildServiceSubmitPayload(rate).rate_limit_average, 5);

  const middleware = { name: "fixture", type: "ipAllowList", custom_headers: [], source_range_input: "192.0.2.1/32" };
  await valid(middlewareFormSchema, middleware);
  await invalid(middlewareFormSchema, { ...middleware, source_range_input: "" }, "source_range_input", "sourceRange를 1개 이상 입력하세요");
  const limit = await valid(middlewareFormSchema, { ...middleware, type: "rateLimit", rate_limit_average: "5", rate_limit_burst: "10" });
  assert.equal(limit.rate_limit_burst, 10);
  await invalid(middlewareFormSchema, { ...middleware, type: "rateLimit" }, "rate_limit_average", "average와 burst를 모두 입력하세요");
  await valid(middlewareFormSchema, { ...middleware, type: "basicAuth", basic_auth_users_input: "fixture:fake-hash" });
  await invalid(middlewareFormSchema, { ...middleware, type: "basicAuth" }, "basic_auth_users_input", "users를 1개 이상 입력하세요 (예: user:$apr1$...)");
  await valid(middlewareFormSchema, { ...middleware, type: "headers", custom_headers: [{ key: "X-Fixture", value: "true" }] });
  await invalid(middlewareFormSchema, { ...middleware, type: "headers" }, "custom_headers", "헤더를 1개 이상 입력하세요");

  const user = { username: " fixture ", password: "", role: "viewer", is_active: true };
  assert.deepEqual(buildUserFormPayload(await valid(userFormSchema, user)), { username: "fixture", role: "viewer", is_active: true });
  await invalid(userFormSchema, { ...user, username: "" }, "username", "사용자 이름을 입력하세요");
  const redirect = { domain: "old.example", target_url: "new.example", permanent: true, tls_enabled: true };
  await valid(redirectFormSchema, redirect);
  await invalid(redirectFormSchema, { ...redirect, domain: "bad domain" }, "domain", "유효한 도메인 형식이 아닙니다");
  await invalid(redirectFormSchema, { ...redirect, target_url: "" }, "target_url", "리다이렉트 대상 URL을 입력하세요");
  console.log(`실제 4개 폼 schema·resolver·숫자 변환·한국어 오류 회귀 검사 ${checked}개 통과`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
