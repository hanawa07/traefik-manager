"use client";
import { useState } from "react";
import { Cloud, Download, Settings, Upload } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { BackupPayload } from "@/features/settings/api/settingsApi";
import {
  useCloudflareStatus,
  useExportBackup,
  useImportBackup,
} from "@/features/settings/hooks/useSettings";
import UserManagementSection from "@/features/users/components/UserManagementSection";

export default function SettingsPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [importResultMessage, setImportResultMessage] = useState<string>("");
  const [exportErrorMessage, setExportErrorMessage] = useState<string>("");

  const { data: cloudflareStatus, isLoading: isCloudflareLoading } = useCloudflareStatus();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();

  const handleExport = async () => {
    setExportErrorMessage("");
    try {
      const data = await exportBackup.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `traefik-manager-backup-${now}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportErrorMessage("백업 내보내기에 실패했습니다");
    }
  };

  const handleImport = async () => {
    if (!canManage) return;
    if (!backupFile) return;
    setImportResultMessage("");

    let parsed: BackupPayload;
    try {
      const text = await backupFile.text();
      parsed = JSON.parse(text) as BackupPayload;
    } catch {
      setImportResultMessage("유효하지 않은 JSON 파일입니다");
      return;
    }

    let result;
    try {
      result = await importBackup.mutateAsync({
        mode: importMode,
        data: parsed,
      });
    } catch {
      return;
    }

    setImportResultMessage(
      `가져오기 완료: 서비스 생성 ${result.created_services}개, 서비스 수정 ${result.updated_services}개, 리다이렉트 생성 ${result.created_redirects}개, 리다이렉트 수정 ${result.updated_redirects}개`
    );
    setBackupFile(null);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 text-sm mt-1">시스템 설정</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Cloudflare DNS 자동 연동</h2>
          </div>

          {isCloudflareLoading ? (
            <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <>
              <p
                className={`text-sm font-medium ${
                  cloudflareStatus?.enabled ? "text-green-700" : "text-gray-600"
                }`}
              >
                {cloudflareStatus?.enabled ? "활성화됨" : "비활성화됨"}
              </p>
              <p className="text-xs text-gray-500 mt-1">{cloudflareStatus?.message}</p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Zone ID</span>
                  <span className="font-mono text-gray-700">
                    {cloudflareStatus?.zone_id || "(미설정)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">기본 대상</span>
                  <span className="font-mono text-gray-700">
                    {cloudflareStatus?.record_target || "(서비스 업스트림 사용)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">프록시 모드</span>
                  <span className="text-gray-700">{cloudflareStatus?.proxied ? "활성" : "비활성"}</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  Cloudflare 값은 환경 변수(`CLOUDFLARE_*`)로 관리됩니다.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">백업 / 복원</h2>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              className="btn-secondary w-full inline-flex items-center justify-center gap-2"
              onClick={handleExport}
              disabled={exportBackup.isPending}
            >
              <Download className="w-4 h-4" />
              {exportBackup.isPending ? "내보내는 중..." : "설정 JSON 내보내기"}
            </button>
            {exportErrorMessage && <p className="text-xs text-red-600">{exportErrorMessage}</p>}

            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">JSON 복원</p>
              <input
                type="file"
                accept="application/json"
                className="input"
                onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
              />

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="radio"
                    className="accent-blue-600"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                  />
                  병합 (기존 데이터 유지)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="radio"
                    className="accent-blue-600"
                    checked={importMode === "overwrite"}
                    onChange={() => setImportMode("overwrite")}
                  />
                  덮어쓰기 (기존 데이터 삭제 후 복원)
                </label>
              </div>

              <button
                type="button"
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
                onClick={handleImport}
                disabled={!canManage || !backupFile || importBackup.isPending}
              >
                <Upload className="w-4 h-4" />
                {importBackup.isPending ? "복원 중..." : "설정 JSON 가져오기"}
              </button>
              {!canManage ? (
                <p className="text-xs text-gray-500">viewer 계정은 백업 복원을 실행할 수 없습니다.</p>
              ) : null}

              {importBackup.error && (
                <p className="text-xs text-red-600">
                  {(importBackup.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                    "백업 복원 중 오류가 발생했습니다"}
                </p>
              )}
              {importResultMessage && <p className="text-xs text-green-700">{importResultMessage}</p>}
            </div>
          </div>
        </div>

        {canManage ? <UserManagementSection /> : null}
      </div>
    </div>
  );
}
