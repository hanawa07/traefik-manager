import assert from "node:assert/strict";

import { getSmokeRotationDetailRows } from "../frontend/src/app/dashboard/audit/audit-page-helpers/smokeRotationDetailRows.ts";

const failure = getSmokeRotationDetailRows("smoke_rotation_failed", {
  step: "GitHub secret 갱신 실패: TM_SMOKE_ADMIN_PASSWORD (시도 3/3)",
});
assert.deepEqual(
  failure.map(({ label, value }) => [label, value]),
  [
    ["회전 결과", "실패"],
    ["실패 Secret", "TM_SMOKE_ADMIN_PASSWORD"],
    ["시도 횟수", "3/3"],
    ["실패 단계", "GitHub secret 갱신 실패: TM_SMOKE_ADMIN_PASSWORD (시도 3/3)"],
  ],
);
assert.equal(getSmokeRotationDetailRows("smoke_rotation_succeeded", { event: "smoke_rotation_succeeded" })[0].value, "성공");
assert.deepEqual(getSmokeRotationDetailRows("service_update", {}), []);

console.log("Secret 회전 감사 상세 self-test 통과");
