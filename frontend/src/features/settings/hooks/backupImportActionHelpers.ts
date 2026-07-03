import type { BackupPayload } from "@/features/settings/api/settingsApi";

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
  updated_redirects,
  updated_services,
}: {
  created_redirects: number;
  created_services: number;
  updated_redirects: number;
  updated_services: number;
}) {
  return [
    `가져오기 완료: 서비스 생성 ${created_services}개`,
    `서비스 수정 ${updated_services}개`,
    `리다이렉트 생성 ${created_redirects}개`,
    `리다이렉트 수정 ${updated_redirects}개`,
  ].join(", ");
}
