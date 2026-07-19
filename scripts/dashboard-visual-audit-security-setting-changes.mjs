import assert from "node:assert/strict";

import { clickAriaLabel, evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

const SUPPORTED_KEYS_BY_EVENT = {
  settings_update_security_alert: new Set([
    "enabled",
    "change_alerts_enabled",
    "manager_health_monitoring_enabled",
    "manager_health_alert_cooldown_minutes",
    "external_watchdog_stale_minutes",
    "automatic_retry_delay_warning_minutes",
    "manager_http_error_monitoring_enabled",
    "manager_http_error_window_minutes",
    "manager_http_not_found_threshold",
    "manager_http_server_error_threshold",
    "manager_http_excluded_paths_count",
    "provider",
  ]),
  settings_update_login_defense: new Set([
    "suspicious_block_enabled",
    "suspicious_trusted_networks_count",
    "suspicious_block_escalation_enabled",
    "suspicious_block_escalation_window_minutes",
    "suspicious_block_escalation_multiplier",
    "suspicious_block_max_minutes",
    "turnstile_mode",
    "turnstile_enabled",
  ]),
};

export async function checkAuditSecuritySettingChanges({ cdp, timeoutMs }) {
  const targets = await evaluate(cdp, `(async () => {
    const events = ${JSON.stringify(Object.keys(SUPPORTED_KEYS_BY_EVENT))};
    const supported = ${JSON.stringify(
      Object.fromEntries(
        Object.entries(SUPPORTED_KEYS_BY_EVENT).map(([event, keys]) => [event, [...keys]]),
      ),
    )};
    const results = [];
    for (const event of events) {
      const response = await fetch('/api/v1/audit?event=' + event + '&limit=100');
      if (!response.ok) continue;
      const logs = await response.json();
      const target = logs.find((log) =>
        Array.isArray(log.detail?.changed_keys) &&
          log.detail.changed_keys.some((key) => supported[event].includes(key))
      );
      if (!target) continue;
      results.push({
        event,
        id: target.id,
        keys: target.detail.changed_keys.filter((key) => supported[event].includes(key)),
      });
    }
    return results;
  })()`);

  for (const target of targets) {
    const origin = await evaluate(cdp, "location.origin");
    await navigateAndWait(
      cdp,
      `${origin}/dashboard/audit?q=${encodeURIComponent(target.id)}&expand=${encodeURIComponent(target.id)}`,
      timeoutMs,
    );
    await waitForCondition(
      cdp,
      `Boolean(document.querySelector('[data-testid="audit-security-setting-changes"]'))`,
      timeoutMs,
      `${target.event}: 보안 설정 변경 카드를 불러오지 못했습니다`,
    );
    const rendered = await evaluate(cdp, `(() => {
      const card = document.querySelector('[data-testid="audit-security-setting-changes"]');
      return Array.from(card?.querySelectorAll('[data-setting-key]') || []).map((item) => ({
        after: item.getAttribute('data-after'),
        before: item.getAttribute('data-before'),
        key: item.getAttribute('data-setting-key'),
      }));
    })()`);
    assert.deepEqual(
      rendered.map((item) => item.key),
      target.keys,
      `${target.event}: 보안 설정 변경 키가 감사 API와 다릅니다`,
    );
    assert.equal(
      rendered.every((item) => item.before && item.after && item.before !== item.after),
      true,
      `${target.event}: 보안 설정 변경 전후 값이 올바르지 않습니다`,
    );
  }

  await clickAriaLabel(cdp, "감사 필터 전체 초기화");
  await waitForCondition(
    cdp,
    `location.pathname === '/dashboard/audit' && !location.search`,
    timeoutMs,
    "보안 설정 감사 검증 후 필터가 초기화되지 않았습니다",
  );
  return targets.length;
}

async function navigateAndWait(cdp, url, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.navigate", { url });
  await loaded;
}

export function runAuditSecuritySettingChangesSelfTest() {
  assert.deepEqual(Object.keys(SUPPORTED_KEYS_BY_EVENT), [
    "settings_update_security_alert",
    "settings_update_login_defense",
  ]);
  assert.equal(
    SUPPORTED_KEYS_BY_EVENT.settings_update_security_alert.has(
      "automatic_retry_delay_warning_minutes",
    ),
    true,
  );
  assert.equal(SUPPORTED_KEYS_BY_EVENT.settings_update_login_defense.has("turnstile_mode"), true);
}
