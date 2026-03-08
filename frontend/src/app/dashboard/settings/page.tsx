"use client";
import { useState } from "react";
import { Cloud, Download, Edit2, Save, Settings, Upload, X } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { BackupPayload } from "@/features/settings/api/settingsApi";
import {
  useCloudflareStatus,
  useUpdateCloudflareSettings,
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

  const [isEditingCf, setIsEditingCf] = useState(false);
  const [cfForm, setCfForm] = useState({ api_token: "", zone_id: "", record_target: "", proxied: false });

  const { data: cloudflareStatus, isLoading: isCloudflareLoading } = useCloudflareStatus();
  const updateCloudflare = useUpdateCloudflareSettings();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();

  const handleEditCf = () => {
    setCfForm({
      api_token: "",
      zone_id: cloudflareStatus?.zone_id ?? "",
      record_target: cloudflareStatus?.record_target ?? "",
      proxied: cloudflareStatus?.proxied ?? false,
    });
    setIsEditingCf(true);
  };

  const handleSaveCf = async () => {
    await updateCloudflare.mutateAsync(cfForm);
    setIsEditingCf(false);
  };

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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Cloudflare DNS 자동 연동</h2>
            </div>
            {canManage && !isEditingCf && !isCloudflareLoading && (
              <button onClick={handleEditCf} className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs">
                <Edit2 className="w-3.5 h-3.5" /> 편집
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">서비스 추가/삭제 시 Cloudflare DNS A 레코드를 자동으로 생성/삭제합니다. 이미 DNS가 수동으로 설정되어 있다면 사용하지 않아도 됩니다.</p>

          {isCloudflareLoading ? (
            <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingCf ? (
            <div className="space-y-3">
              <div>
                <label className="label">API Token</label>
                <input
                  type="password"
                  className="input"
                  placeholder="새 토큰 입력 (빈칸으로 저장 시 설정 초기화)"
                  value={cfForm.api_token}
                  onChange={(e) => setCfForm({ ...cfForm, api_token: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Cloudflare → My Profile → API Tokens → Create Token → <strong>Zone:DNS:Edit</strong> 권한으로 생성. 빈칸 저장 시 모든 CF 설정이 초기화됩니다.</p>
              </div>
              <div>
                <label className="label">Zone ID</label>
                <input
                  type="text"
                  className="input"
                  value={cfForm.zone_id}
                  onChange={(e) => setCfForm({ ...cfForm, zone_id: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Cloudflare 도메인 대시보드 우측 하단 &apos;Zone ID&apos;. 이 Zone에 속한 도메인만 자동 DNS 등록됩니다.</p>
              </div>
              <div>
                <label className="label">Record Target <span className="text-gray-400 font-normal">(선택)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="예: 1.2.3.4 (비워두면 업스트림 자동 사용)"
                  value={cfForm.record_target}
                  onChange={(e) => setCfForm({ ...cfForm, record_target: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">DNS A 레코드가 가리킬 서버 공인 IP. 비워두면 서비스 upstream_host를 사용하지만, upstream이 내부 IP인 경우 반드시 공인 IP를 입력하세요.</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={cfForm.proxied}
                    onChange={(e) => setCfForm({ ...cfForm, proxied: e.target.checked })}
                  />
                  Cloudflare Proxy (Proxied) 사용
                </label>
                <p className="text-xs text-gray-400 mt-1">활성화 시 트래픽이 Cloudflare를 경유하며 실제 서버 IP가 숨겨집니다 (주황 구름 아이콘). DNS only 모드를 원하면 체크 해제.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={handleSaveCf}
                  disabled={updateCloudflare.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateCloudflare.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={() => setIsEditingCf(false)}
                >
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className={`text-sm font-medium ${cloudflareStatus?.enabled ? "text-green-700" : "text-gray-600"}`}>
                {cloudflareStatus?.enabled ? "활성화됨" : "비활성화됨"}
              </p>
              <p className="text-xs text-gray-500 mt-1">{cloudflareStatus?.message}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Zone ID</span>
                  <span className="font-mono text-gray-700">{cloudflareStatus?.zone_id || "(미설정)"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">기본 대상</span>
                  <span className="font-mono text-gray-700">{cloudflareStatus?.record_target || "(서비스 업스트림 사용)"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">프록시 모드</span>
                  <span className="text-gray-700">{cloudflareStatus?.proxied ? "활성" : "비활성"}</span>
                </div>
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
