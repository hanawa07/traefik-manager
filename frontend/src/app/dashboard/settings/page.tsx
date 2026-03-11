"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Cloud,
  Download,
  Edit2,
  Laptop,
  LogOut,
  Save,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

import { useLogoutAllSessions, useRevokeSession, useSessions } from "@/features/auth/hooks/useSessions";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { BackupPayload } from "@/features/settings/api/settingsApi";
import {
  useCloudflareStatus,
  useUpdateCloudflareSettings,
  useExportBackup,
  useImportBackup,
  useTimeDisplaySettings,
  useUpstreamSecuritySettings,
  useUpdateTimeDisplaySettings,
  useUpdateUpstreamSecuritySettings,
} from "@/features/settings/hooks/useSettings";
import UserManagementSection from "@/features/users/components/UserManagementSection";
import { formatDateTime, getDefaultDisplayTimezone, getSupportedTimeZones } from "@/shared/lib/dateTimeFormat";

export default function SettingsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clearSession);
  const canManage = role === "admin";
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [importResultMessage, setImportResultMessage] = useState<string>("");
  const [exportErrorMessage, setExportErrorMessage] = useState<string>("");

  const [isEditingCf, setIsEditingCf] = useState(false);
  const [cfForm, setCfForm] = useState({ api_token: "", zone_id: "", record_target: "", proxied: false });
  const [isEditingTimeDisplay, setIsEditingTimeDisplay] = useState(false);
  const [timeDisplayForm, setTimeDisplayForm] = useState(getDefaultDisplayTimezone());
  const [timeDisplayErrorMessage, setTimeDisplayErrorMessage] = useState("");
  const [isEditingUpstreamSecurity, setIsEditingUpstreamSecurity] = useState(false);
  const [upstreamSecurityForm, setUpstreamSecurityForm] = useState(false);

  const { data: cloudflareStatus, isLoading: isCloudflareLoading } = useCloudflareStatus();
  const { data: timeDisplaySettings, isLoading: isTimeDisplayLoading } = useTimeDisplaySettings();
  const { data: upstreamSecuritySettings, isLoading: isUpstreamSecurityLoading } = useUpstreamSecuritySettings();
  const { data: sessionData, isLoading: isSessionsLoading } = useSessions();
  const updateCloudflare = useUpdateCloudflareSettings();
  const updateTimeDisplay = useUpdateTimeDisplaySettings();
  const updateUpstreamSecurity = useUpdateUpstreamSecuritySettings();
  const logoutAllSessions = useLogoutAllSessions();
  const revokeSession = useRevokeSession();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const supportedTimeZones = getSupportedTimeZones();

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

  const handleEditTimeDisplay = () => {
    setTimeDisplayForm(timeDisplaySettings?.display_timezone ?? getDefaultDisplayTimezone());
    setTimeDisplayErrorMessage("");
    setIsEditingTimeDisplay(true);
  };

  const handleSaveTimeDisplay = async () => {
    setTimeDisplayErrorMessage("");
    try {
      await updateTimeDisplay.mutateAsync({ display_timezone: timeDisplayForm.trim() });
      setIsEditingTimeDisplay(false);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response
        ?.data?.detail;
      setTimeDisplayErrorMessage(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail[0]?.msg || "표시 시간대 저장에 실패했습니다"
            : "표시 시간대 저장에 실패했습니다",
      );
    }
  };

  const handleEditUpstreamSecurity = () => {
    setUpstreamSecurityForm(upstreamSecuritySettings?.dns_strict_mode ?? false);
    setIsEditingUpstreamSecurity(true);
  };

  const handleSaveUpstreamSecurity = async () => {
    await updateUpstreamSecurity.mutateAsync({ dns_strict_mode: upstreamSecurityForm });
    setIsEditingUpstreamSecurity(false);
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

  const handleLogoutAllSessions = async () => {
    await logoutAllSessions.mutateAsync();
    clearSession();
    router.push("/login");
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    await revokeSession.mutateAsync(sessionId);
    if (isCurrent) {
      clearSession();
      router.push("/login");
    }
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
              <Clock3 className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-gray-900">시간 표시 설정</h2>
            </div>
            {canManage && !isEditingTimeDisplay && !isTimeDisplayLoading && (
              <button
                onClick={handleEditTimeDisplay}
                className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
              >
                <Edit2 className="w-3.5 h-3.5" /> 편집
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            저장/토큰/감사로그 원본 시각은 UTC로 유지하고, 화면 표시만 선택한 IANA 타임존으로 변환합니다.
          </p>

          {isTimeDisplayLoading ? (
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingTimeDisplay ? (
            <div className="space-y-3">
              <div>
                <label className="label">표시 시간대 (IANA)</label>
                <input
                  list="supported-timezones"
                  className="input"
                  placeholder="예: Asia/Seoul, UTC, America/New_York"
                  value={timeDisplayForm}
                  onChange={(e) => setTimeDisplayForm(e.target.value)}
                />
                <datalist id="supported-timezones">
                  {supportedTimeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-400 mt-1">
                  검색 가능한 전체 IANA 타임존 목록을 지원합니다. 예: `Asia/Seoul`, `UTC`, `Europe/Berlin`,
                  `America/New_York`
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">저장 기준</span>
                  <span className="font-mono text-gray-700">{timeDisplaySettings?.storage_timezone} (고정)</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">서버 시간대</span>
                  <span className="font-mono text-gray-700">
                    {timeDisplaySettings?.server_timezone_label} ({timeDisplaySettings?.server_timezone_offset})
                  </span>
                </div>
                <p className="text-xs text-gray-500 pt-1">
                  저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로,
                  `docker compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
                </p>
              </div>

              {timeDisplayErrorMessage && <p className="text-xs text-red-600">{timeDisplayErrorMessage}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={handleSaveTimeDisplay}
                  disabled={updateTimeDisplay.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateTimeDisplay.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={() => setIsEditingTimeDisplay(false)}
                >
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">현재 표시 시간대</span>
                <span className="font-mono text-gray-700">{timeDisplaySettings?.display_timezone || "(미설정)"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">저장 기준</span>
                <span className="font-mono text-gray-700">{timeDisplaySettings?.storage_timezone} (고정)</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">서버 시간대</span>
                <span className="font-mono text-gray-700">
                  {timeDisplaySettings?.server_timezone_label} ({timeDisplaySettings?.server_timezone_offset})
                </span>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로,
                `docker compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
              </p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <h2 className="font-semibold text-gray-900">업스트림 보안</h2>
            </div>
            {canManage && !isEditingUpstreamSecurity && !isUpstreamSecurityLoading && (
              <button
                onClick={handleEditUpstreamSecurity}
                className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
              >
                <Edit2 className="w-3.5 h-3.5" /> 편집
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            DNS strict mode를 켜면 도메인 업스트림 저장 시 DNS를 다시 조회해서 loopback, link-local, 문서 예제
            대역 같은 금지 주소로 해석되는지 검사합니다. IP 리터럴 업스트림에는 추가 DNS 조회를 하지 않습니다.
          </p>

          {isUpstreamSecurityLoading ? (
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingUpstreamSecurity ? (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-rose-600"
                  checked={upstreamSecurityForm}
                  onChange={(e) => setUpstreamSecurityForm(e.target.checked)}
                />
                <span>
                  <span className="block font-medium text-gray-900">DNS strict mode 활성화</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    내부 Docker/private 도메인은 계속 허용하지만, DNS 결과가 금지 주소로 향하면 저장을 거부합니다.
                  </span>
                </span>
              </label>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                <p>기본값은 비활성화입니다.</p>
                <p>권장 사용처: 외부 FQDN을 업스트림으로 자주 등록하는 환경</p>
                <p>주의: DNS 조회 실패 시 strict mode가 켜져 있으면 서비스 저장이 차단됩니다.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={handleSaveUpstreamSecurity}
                  disabled={updateUpstreamSecurity.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateUpstreamSecurity.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={() => setIsEditingUpstreamSecurity(false)}
                >
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">DNS strict mode</span>
                <span className="text-gray-700">
                  {upstreamSecuritySettings?.dns_strict_mode ? "활성화" : "비활성화"}
                </span>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                활성화 시 도메인 업스트림은 DNS 재해석 후 안전 대역을 검사합니다. 비활성화 시 현재 입력 형식 검증만
                수행합니다.
              </p>
            </div>
          )}
        </div>

        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="font-semibold text-gray-900">세션 관리</h2>
                <p className="text-xs text-gray-400 mt-1">
                  현재 로그인된 브라우저 세션을 확인하고, 필요하면 개별 종료 또는 전체 로그아웃할 수 있습니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2 text-xs py-1.5"
              onClick={handleLogoutAllSessions}
              disabled={logoutAllSessions.isPending || isSessionsLoading || !sessionData?.sessions?.length}
            >
              <LogOut className="w-3.5 h-3.5" />
              {logoutAllSessions.isPending ? "로그아웃 중..." : "모든 세션 로그아웃"}
            </button>
          </div>

          {isSessionsLoading ? (
            <div className="space-y-3">
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : !sessionData?.sessions?.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              활성 세션이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {sessionData.sessions.map((session) => (
                <div
                  key={session.session_id}
                  className={`rounded-xl border p-4 ${
                    session.is_current ? "border-amber-300 bg-amber-50/70" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Laptop className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {session.user_agent || "알 수 없는 브라우저"}
                        </span>
                        {session.is_current ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            현재 세션
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">세션 ID</span>
                          <span className="font-mono text-gray-700">{session.session_id}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">IP</span>
                          <span className="font-mono text-gray-700">{session.ip_address || "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">발급 시각</span>
                          <span className="text-gray-700">
                            {formatDateTime(session.issued_at, timeDisplaySettings?.display_timezone)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">최근 활동</span>
                          <span className="text-gray-700">
                            {formatDateTime(session.last_seen_at, timeDisplaySettings?.display_timezone)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">절대 만료</span>
                          <span className="text-gray-700">
                            {formatDateTime(session.expires_at, timeDisplaySettings?.display_timezone)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">유휴 만료</span>
                          <span className="text-gray-700">
                            {formatDateTime(session.idle_expires_at, timeDisplaySettings?.display_timezone)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary inline-flex items-center gap-2 text-xs py-1.5 shrink-0"
                      onClick={() => handleRevokeSession(session.session_id, session.is_current)}
                      disabled={revokeSession.isPending}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {session.is_current ? "현재 세션 종료" : "세션 종료"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
