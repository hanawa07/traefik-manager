"use client";

import { TraefikUpdatePlanPanel } from "@/app/dashboard/TraefikUpdatePlanPanel";
import type { TraefikDeploymentStatus, TraefikHealth } from "@/features/traefik/api/traefikApi";

const health: TraefikHealth = {
  connected: true,
  message: "fixture",
  version: "v3.7.10",
  latest_version: "v3.7.11",
  latest_release_url: null,
  latest_release_has_security_fixes: false,
  latest_release_security_advisories: [],
  update_available: true,
  latest_version_checked_at: null,
  latest_version_error: null,
};

const deployment: TraefikDeploymentStatus = {
  enabled: true,
  message: "fixture",
  container_name: "traefik",
  current_image: `traefik@sha256:${"a".repeat(64)}`,
  target_image: `traefik@sha256:${"b".repeat(64)}`,
  current_version: "v3.7.10",
  target_version: "v3.7.11",
  update_available: true,
  compose_project: "fixture",
  compose_service: "traefik",
  compose_working_dir: `/srv/${"long-compose-directory-".repeat(6)}traefik`,
  compose_config_files: [],
  can_apply: false,
  apply_blocked_reason: "fixture",
  checks: [],
  commands: [],
};

export function TraefikUpdatePlanFixture() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 p-4 dark:bg-slate-950" data-visual-fixture="traefik-update-plan">
      <TraefikUpdatePlanPanel canManage={false} deployment={deployment} health={health} />
    </main>
  );
}
