import assert from "node:assert/strict";

import { getSmokeRotationDetailRows } from "../frontend/src/app/dashboard/audit/audit-page-helpers/smokeRotationDetailRows.ts";

const failure = getSmokeRotationDetailRows("smoke_rotation_failed", {
  failure_kind: "smoke_validation",
  step: "GitHub secret 갱신 실패: TM_SMOKE_ADMIN_PASSWORD (시도 3/3)",
});
assert.deepEqual(
  failure.map(({ label, value }) => [label, value]),
  [
    ["점검 결과", "실패"],
    ["실패 유형", "로그인·API·화면 검증"],
    ["실패 Secret", "TM_SMOKE_ADMIN_PASSWORD"],
    ["시도 횟수", "3/3"],
    ["실패 단계", "GitHub secret 갱신 실패: TM_SMOKE_ADMIN_PASSWORD (시도 3/3)"],
  ],
);
assert.equal(getSmokeRotationDetailRows("smoke_rotation_succeeded", { event: "smoke_rotation_succeeded" })[0].value, "성공");
assert.deepEqual(getSmokeRotationDetailRows("service_update", {}), []);

console.log("스모크 계정 점검 감사 상세 self-test 통과");
