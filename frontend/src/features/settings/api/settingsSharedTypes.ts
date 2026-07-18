export interface SettingsActionTestResult {
  success: boolean;
  message: string;
  detail: string | null;
  provider: string | null;
}

export interface SettingsRollbackActionResult {
  success: boolean;
  message: string;
  resource_name: string;
  event: string;
}

export interface SettingsTestHistoryEvent {
  audit_id: string;
  retry_of_audit_id: string | null;
  success: boolean | null;
  message: string | null;
  detail: string | null;
  provider: string | null;
  created_at: string;
}

export interface SettingsTestHistoryItem {
  last_event: string | null;
  last_success: boolean | null;
  last_message: string | null;
  last_detail: string | null;
  last_provider: string | null;
  last_created_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_audit_id: string | null;
  last_failure_message: string | null;
  last_failure_detail: string | null;
  last_failure_provider: string | null;
  recent_failure_count: number;
  recent_events: SettingsTestHistoryEvent[];
}

export interface SettingsTestHistoryStatus {
  cloudflare: SettingsTestHistoryItem;
  cloudflare_drift: SettingsTestHistoryItem;
  cloudflare_reconcile: SettingsTestHistoryItem;
  security_alert: SettingsTestHistoryItem;
  smoke_admin_stale: SettingsTestHistoryItem;
  security_alert_delivery: SettingsTestHistoryItem;
  change_alert_delivery: SettingsTestHistoryItem;
}
