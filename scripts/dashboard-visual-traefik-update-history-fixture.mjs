const DAY_MS = 24 * 60 * 60 * 1_000;

export const FIXTURE_DATE = new Date(Date.now() - 2 * DAY_MS).toISOString().slice(0, 10);
export const ALERT_RUN_URL = "https://github.com/hanawa07/traefik-manager/actions/runs/123";

export const TRAEFIK_UPDATE_HISTORY_FIXTURE = {
  runner: {
    available: true,
    status: "ready",
    checked_at: `${FIXTURE_DATE}T03:00:00Z`,
    message: "fixture ready",
  },
  pending_request: false,
  recreation_history: [
    {
      container_id: "a".repeat(64),
      previous_container_id: "b".repeat(64),
      created_at: `${FIXTURE_DATE}T03:02:00Z`,
      observed_at: `${FIXTURE_DATE}T03:02:01Z`,
      image: "traefik:v3.7.9",
      status: "unmanaged",
      source: "direct_or_unknown",
      request_id: null,
      actor: null,
    },
    {
      container_id: "c".repeat(64),
      previous_container_id: "d".repeat(64),
      created_at: `${FIXTURE_DATE}T03:01:00Z`,
      observed_at: `${FIXTURE_DATE}T03:01:01Z`,
      image: "traefik:v3.7.9",
      status: "managed",
      source: "patch_update",
      request_id: "11111111-1111-4111-8111-111111111111",
      actor: "smoke-admin",
    },
  ],
  history: [
    {
      request_id: "11111111-1111-4111-8111-111111111111",
      actor: "=smoke-admin",
      status: "rollback_failed",
      from_version: "v3.7.8",
      target_version: "v3.7.9",
      requested_at: `${FIXTURE_DATE}T03:00:00Z`,
      started_at: `${FIXTURE_DATE}T03:00:01Z`,
      completed_at: `${FIXTURE_DATE}T03:00:05Z`,
      message: "fixture rollback failed",
      backup_dir: "/tmp/traefik-update-smoke",
      backup_created: true,
      rollback_performed: true,
      alert_request_status: "requested",
      alert_channel: "github",
      alert_run_url: ALERT_RUN_URL,
      alert_retry_request_id: "33333333-3333-4333-8333-333333333333",
      alert_retry_actor: "security-admin",
      alert_retry_requested_at: `${FIXTURE_DATE}T03:00:30Z`,
      alert_run_status: "completed",
      alert_run_conclusion: "success",
      alert_run_checked_at: `${FIXTURE_DATE}T03:01:00Z`,
      alert_run_error: null,
      validations: [
        { key: "container_version", status: "fail", message: "fixture mismatch" },
      ],
    },
    {
      request_id: "22222222-2222-4222-8222-222222222222",
      actor: "smoke-admin",
      status: "success",
      from_version: "v3.7.7",
      target_version: "v3.7.8",
      requested_at: "2026-01-01T03:00:00Z",
      started_at: "2026-01-01T03:00:01Z",
      completed_at: "2026-01-01T03:00:05Z",
      message: "fixture update completed",
      backup_dir: null,
      backup_created: true,
      rollback_performed: false,
      alert_request_status: "not_needed",
      alert_channel: null,
      alert_run_url: null,
      alert_retry_request_id: null,
      alert_retry_actor: null,
      alert_retry_requested_at: null,
      alert_run_status: null,
      alert_run_conclusion: null,
      alert_run_checked_at: null,
      alert_run_error: null,
      validations: [],
    },
  ],
};

export async function reloadTraefikUpdateHistoryFixture({ cdp, timeoutMs }) {
  await cdp.send("Fetch.enable", {
    patterns: [{ requestStage: "Request", urlPattern: "*/api/v1/traefik/update-operations*" }],
  });
  try {
    const requestPaused = cdp.waitFor("Fetch.requestPaused", timeoutMs);
    const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
    await cdp.send("Page.reload", { ignoreCache: true });
    const request = await requestPaused;
    await cdp.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(TRAEFIK_UPDATE_HISTORY_FIXTURE)).toString("base64"),
    });
    await loaded;
  } finally {
    await cdp.send("Fetch.disable");
  }
}
