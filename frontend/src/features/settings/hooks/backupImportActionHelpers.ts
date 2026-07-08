import type {
  BackupPayload,
  BackupPreviewGroup,
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";

type BackupPayloadReadResult =
  | { ok: true; data: BackupPayload }
  | { ok: false; errorMessage: string };

export async function readBackupPayloadFile(file: File): Promise<BackupPayloadReadResult> {
  try {
    return { ok: true, data: JSON.parse(await file.text()) as BackupPayload };
  } catch {
    return { ok: false, errorMessage: "유효하지 않은 JSON 파일입니다" };
  }
}

export function formatBackupImportResult({
  created_redirects,
  created_services,
  deleted_redirects,
  deleted_services,
  updated_redirects,
  updated_services,
}: {
  created_redirects: number;
  created_services: number;
  deleted_redirects: number;
  deleted_services: number;
  updated_redirects: number;
  updated_services: number;
}) {
  return [
    `가져오기 완료: 서비스 생성 ${created_services}개`,
    `서비스 수정 ${updated_services}개`,
    `서비스 삭제 ${deleted_services}개`,
    `리다이렉트 생성 ${created_redirects}개`,
    `리다이렉트 수정 ${updated_redirects}개`,
    `리다이렉트 삭제 ${deleted_redirects}개`,
  ].join(", ");
}

export function formatBackupPreviewResult(result: BackupPreviewResult) {
  return [
    formatBackupPreviewGroup("서비스", result.services),
    formatBackupPreviewGroup("리다이렉트", result.redirect_hosts),
    formatBackupWarningCount(result.warning_count),
  ].join(" · ");
}

export function formatBackupValidationResult(result: BackupValidateResult) {
  return [
    `서비스 ${result.service_count}개`,
    `리다이렉트 ${result.redirect_count}개`,
    formatBackupWarningCount(result.warning_count),
  ].join(" · ");
}

function formatBackupPreviewGroup(label: string, group: BackupPreviewGroup) {
  return `${label} 생성 ${group.creates.length} / 수정 ${group.updates.length} / 삭제 ${group.deletes.length}`;
}

function formatBackupWarningCount(warningCount: number) {
  return warningCount ? `경고 ${warningCount}개` : "경고 없음";
}
