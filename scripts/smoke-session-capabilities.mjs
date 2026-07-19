import assert from "node:assert/strict";

export function resolveSmokeSessionCapabilities(session) {
  const role = session?.role;
  if (role !== "admin" && role !== "viewer") {
    throw new Error(`지원하지 않는 스모크 세션 역할입니다: ${String(role)}`);
  }
  return { canManage: role === "admin" };
}

export function runSmokeSessionCapabilitiesSelfTest() {
  assert.deepEqual(resolveSmokeSessionCapabilities({ role: "viewer" }), {
    canManage: false,
  });
  assert.deepEqual(resolveSmokeSessionCapabilities({ role: "admin" }), {
    canManage: true,
  });
  assert.throws(() => resolveSmokeSessionCapabilities({ role: "operator" }), /지원하지 않는/);
}
