import assert from "node:assert/strict";

import { updateSmokeFailureMetadataSelection } from "../frontend/src/features/settings/lib/smokeFailureMetadataSelection.ts";

const initial = new Set([987]);
const selected = updateSmokeFailureMetadataSelection(
  initial,
  [{ run_id: 986 }, { run_id: 985 }],
  true,
);
assert.deepEqual([...selected], [987, 986, 985]);
assert.deepEqual([...initial], [987], "기존 선택 Set을 변경하면 안 됩니다");

const visibleCleared = updateSmokeFailureMetadataSelection(
  selected,
  [{ run_id: 986 }, { run_id: 985 }],
  false,
);
assert.deepEqual([...visibleCleared], [987], "필터 밖 선택은 유지해야 합니다");

console.log("스모크 실패 정보 대량 선택 self-test 통과");
