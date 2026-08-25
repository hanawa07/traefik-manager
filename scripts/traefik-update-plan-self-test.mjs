import assert from "node:assert/strict";

import { buildTraefikUpdatePlan } from "../frontend/src/app/dashboard/traefikUpdatePlan.ts";

const health = {
  connected: true,
  message: "connected",
  version: "v3.7.10",
  latest_version: "v3.7.11",
  latest_release_has_security_fixes: true,
  latest_release_security_advisories: ["GHSA-5W68-77R2-R64C"],
  update_available: true,
};
const updateCommand = {
  label: "업데이트 적용",
  description: "custom compose fixture",
  command: '"${HOME}/docker/traefik-manager/scripts/run-traefik-recreate-safely.sh"',
};
const deployment = {
  enabled: true,
  message: "fixture",
  container_name: "traefik",
  current_image: "traefik:v3.7.10",
  target_image: "traefik:v3.7.11",
  current_version: "v3.7.10",
  target_version: "v3.7.11",
  update_available: true,
  compose_project: "edge",
  compose_service: "edge-proxy",
  compose_working_dir: "/srv/traefik",
  compose_config_files: ["/srv/traefik/compose.prod.yml"],
  can_apply: false,
  apply_blocked_reason: "fixture",
  checks: [],
  commands: [updateCommand],
};

const dynamicPlan = buildTraefikUpdatePlan(health, deployment);
assert.ok(dynamicPlan);
assert.deepEqual(dynamicPlan.commands, [updateCommand]);
assert.equal(dynamicPlan.riskLabel, "보안 패치");
assert.match(dynamicPlan.summary, /우선 적용/);
assert.match(dynamicPlan.checks[0], /GHSA-5W68-77R2-R64C/);
assert.match(dynamicPlan.rollbackNote, /위의 `업데이트 적용` 명령/);
assert.doesNotMatch(dynamicPlan.rollbackNote, /docker compose up -d traefik/);
assert.match(dynamicPlan.commands[0].command, /run-traefik-recreate-safely\.sh/);

const fallbackPlan = buildTraefikUpdatePlan(health);
assert.ok(fallbackPlan);
assert.doesNotMatch(fallbackPlan.rollbackNote, /docker compose up -d traefik/);
assert.match(fallbackPlan.commands[2].command, /run-traefik-recreate-safely\.sh/);

console.log("Traefik 업데이트 계획 self-test 통과");
