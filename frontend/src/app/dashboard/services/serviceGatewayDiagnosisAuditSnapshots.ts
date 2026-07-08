import type { AuditLogItem } from "@/features/audit/api/auditApi";
import type { ServiceGatewayDiagnosis, ServiceGatewayDiagnosticCheck } from "@/features/services/api/serviceApi";
import type { ServiceDiagnosisSnapshotMap, ServiceSaveDiagnosisNotice } from "./serviceSaveDiagnosis";

export type ServiceDiagnosisHistoryMap = Record<string, ServiceGatewayDiagnosis[]>;

export function buildServiceDiagnosisSnapshotsFromAuditLogs(logs: AuditLogItem[]): ServiceDiagnosisSnapshotMap {
  const snapshots: ServiceDiagnosisSnapshotMap = {};
  for (const log of logs) {
    if (snapshots[log.resource_id]) continue;
    const notice = toServiceDiagnosisNotice(log);
    if (notice) {
      snapshots[log.resource_id] = notice;
    }
  }
  return snapshots;
}

export function buildServiceDiagnosisHistoriesFromAuditLogs(
  logs: AuditLogItem[],
  limitPerService = 3,
): ServiceDiagnosisHistoryMap {
  const histories: ServiceDiagnosisHistoryMap = {};
  for (const log of logs) {
    const notice = toServiceDiagnosisNotice(log);
    if (!notice?.diagnosis) continue;
    const history = histories[notice.serviceId] ?? (histories[notice.serviceId] = []);
    if (history.length >= limitPerService) continue;
    history.push(notice.diagnosis);
  }
  return histories;
}

function toServiceDiagnosisNotice(log: AuditLogItem): ServiceSaveDiagnosisNotice | null {
  const detail = log.detail;
  if (!detail || detail.event !== "service_gateway_diagnosis") return null;

  const status = toDiagnosisStatus(detail.status);
  const domain = typeof detail.domain === "string" ? detail.domain : log.resource_name;
  const checkedAt = typeof detail.checked_at === "string" ? detail.checked_at : log.created_at;
  const summary = typeof detail.summary === "string" ? detail.summary : "게이트웨이 진단 결과";
  const checks = toDiagnosticChecks(detail.checks);

  return {
    action: "updated",
    checkedAt,
    diagnosis: {
      service_id: log.resource_id,
      domain,
      status,
      summary,
      checked_at: checkedAt,
      checks,
    } satisfies ServiceGatewayDiagnosis,
    domain,
    error: null,
    serviceId: log.resource_id,
  };
}

function toDiagnosisStatus(value: unknown): ServiceGatewayDiagnosis["status"] {
  if (value === "ok" || value === "warning" || value === "fail") return value;
  return "warning";
}

function toDiagnosticChecks(value: unknown): ServiceGatewayDiagnosticCheck[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : null;
    const label = typeof record.label === "string" ? record.label : key;
    const message = typeof record.message === "string" ? record.message : "";
    if (!key || !label) return [];
    return [
      {
        key,
        label,
        status: toCheckStatus(record.status),
        message,
        details: isRecord(record.details) ? record.details : {},
      },
    ];
  });
}

function toCheckStatus(value: unknown): ServiceGatewayDiagnosticCheck["status"] {
  if (value === "ok" || value === "warning" || value === "fail") return value;
  return "warning";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
