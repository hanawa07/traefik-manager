"use client";
// PONYTAIL-DEBT(settings-page): split this oversized settings page into focused section components.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  Cloud,
  Download,
  Laptop,
  LogOut,
  Save,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

import { useLogoutAllSessions, useRevokeSession, useSessions } from "@/features/auth/hooks/useSessions";
import { useAuditRetryDelivery } from "@/features/audit/hooks/useAudit";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import {
  BackupValidateResult,
  BackupPayload,
  BackupPreviewResult,
  CloudflareDriftCheckResult,
  CloudflareZoneInput,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { CertificateDiagnosticsSettingsCard } from "@/features/settings/components/CertificateDiagnosticsSettingsCard";
import {
  ActionResultNotice,
  BackupPreviewNotice,
  CloudflareDriftNotice,
  SettingsTestHistoryNotice,
} from "@/features/settings/components/SettingsNotices";
import { LoginDefenseSettingsCard } from "@/features/settings/components/LoginDefenseSettingsCard";
import { SecurityAlertSettingsCard } from "@/features/settings/components/SecurityAlertSettingsCard";
import { TimeDisplaySettingsCard } from "@/features/settings/components/TimeDisplaySettingsCard";
import { UpstreamSecuritySettingsCard } from "@/features/settings/components/UpstreamSecuritySettingsCard";
import {
  useCertificateDiagnosticsSettings,
  useCloudflareStatus,
  useDiagnoseCloudflareDnsDrift,
  useExportBackup,
  useImportBackup,
  useLoginDefenseSettings,
  useSecurityAlertSettings,
  useTraefikDashboardSettings,
  useTimeDisplaySettings,
  useReconcileCloudflareDns,
  useTestCloudflareConnection,
  useTestSecurityAlertSettings,
  useSettingsTestHistory,
  useUpdateCertificateDiagnosticsSettings,
  useUpdateCloudflareSettings,
  useUpdateTraefikDashboardSettings,
  useUpstreamSecuritySettings,
  useUpdateSecurityAlertSettings,
  useUpdateTimeDisplaySettings,
  useUpdateLoginDefenseSettings,
  useUpdateUpstreamSecuritySettings,
  useValidateBackup,
  usePreviewBackup,
} from "@/features/settings/hooks/useSettings";
import {
  createDefaultCertificateDiagnosticsForm,
  createDefaultCloudflareZoneForm,
  createDefaultLoginDefenseForm,
  createDefaultSecurityAlertForm,
  createDefaultTraefikDashboardForm,
  createDefaultUpstreamSecurityForm,
} from "@/features/settings/lib/settingsDefaults";
import {
  parseMultivalueText,
} from "@/features/settings/lib/settingsFormHelpers";
import UserManagementSection from "@/features/users/components/UserManagementSection";
import { formatDateTime, getDefaultDisplayTimezone } from "@/shared/lib/dateTimeFormat";

function buildActionFailure(message: string, detail?: string): SettingsActionTestResult {
  return {
    success: false,
    message,
    detail: detail || null,
    provider: null,
  };
}

function getApiErrorDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return fallback;
}

export default function SettingsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clearSession);
  const canManage = role === "admin";
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [importResultMessage, setImportResultMessage] = useState<string>("");
  const [exportErrorMessage, setExportErrorMessage] = useState<string>("");
  const [cloudflareErrorMessage, setCloudflareErrorMessage] = useState("");
  const [cloudflareTestResult, setCloudflareTestResult] = useState<SettingsActionTestResult | null>(null);
  const [cloudflareDriftResult, setCloudflareDriftResult] = useState<CloudflareDriftCheckResult | null>(null);
  const [cloudflareReconcileResult, setCloudflareReconcileResult] = useState<SettingsActionTestResult | null>(null);
  const [securityAlertTestResult, setSecurityAlertTestResult] = useState<SettingsActionTestResult | null>(null);
  const [securityAlertDeliveryRetryResult, setSecurityAlertDeliveryRetryResult] = useState<SettingsActionTestResult | null>(null);
  const [changeAlertDeliveryRetryResult, setChangeAlertDeliveryRetryResult] = useState<SettingsActionTestResult | null>(null);
  const [backupValidationResult, setBackupValidationResult] = useState<BackupValidateResult | null>(null);
  const [backupPreviewResult, setBackupPreviewResult] = useState<BackupPreviewResult | null>(null);
  const [retryTargetAuditId, setRetryTargetAuditId] = useState<string | null>(null);

  const [isEditingCf, setIsEditingCf] = useState(false);
  const [cfForm, setCfForm] = useState<CloudflareZoneInput[]>([createDefaultCloudflareZoneForm()]);
  const [isEditingTimeDisplay, setIsEditingTimeDisplay] = useState(false);
  const [timeDisplayForm, setTimeDisplayForm] = useState(getDefaultDisplayTimezone());
  const [timeDisplayErrorMessage, setTimeDisplayErrorMessage] = useState("");
  const [isEditingCertificateDiagnostics, setIsEditingCertificateDiagnostics] = useState(false);
  const [certificateDiagnosticsForm, setCertificateDiagnosticsForm] = useState(
    createDefaultCertificateDiagnosticsForm(),
  );
  const [isEditingTraefikDashboard, setIsEditingTraefikDashboard] = useState(false);
  const [traefikDashboardForm, setTraefikDashboardForm] = useState(createDefaultTraefikDashboardForm());
  const [traefikDashboardErrorMessage, setTraefikDashboardErrorMessage] = useState("");
  const [isEditingUpstreamSecurity, setIsEditingUpstreamSecurity] = useState(false);
  const [upstreamSecurityForm, setUpstreamSecurityForm] = useState(createDefaultUpstreamSecurityForm());
  const [isEditingLoginDefense, setIsEditingLoginDefense] = useState(false);
  const [loginDefenseForm, setLoginDefenseForm] = useState(createDefaultLoginDefenseForm());
  const [loginDefenseErrorMessage, setLoginDefenseErrorMessage] = useState("");
  const [isEditingSecurityAlert, setIsEditingSecurityAlert] = useState(false);
  const [securityAlertForm, setSecurityAlertForm] = useState(createDefaultSecurityAlertForm());
  const [securityAlertErrorMessage, setSecurityAlertErrorMessage] = useState("");

  const { data: cloudflareStatus, isLoading: isCloudflareLoading } = useCloudflareStatus();
  const { data: timeDisplaySettings, isLoading: isTimeDisplayLoading } = useTimeDisplaySettings();
  const { data: certificateDiagnosticsSettings, isLoading: isCertificateDiagnosticsLoading } =
    useCertificateDiagnosticsSettings();
  const { data: traefikDashboardSettings, isLoading: isTraefikDashboardLoading } = useTraefikDashboardSettings();
  const { data: upstreamSecuritySettings, isLoading: isUpstreamSecurityLoading } = useUpstreamSecuritySettings();
  const { data: loginDefenseSettings, isLoading: isLoginDefenseLoading } = useLoginDefenseSettings();
  const { data: securityAlertSettings, isLoading: isSecurityAlertLoading } = useSecurityAlertSettings();
  const { data: settingsTestHistory, isLoading: isSettingsTestHistoryLoading } = useSettingsTestHistory();
  const { data: sessionData, isLoading: isSessionsLoading } = useSessions();
  const updateCloudflare = useUpdateCloudflareSettings();
  const testCloudflareConnection = useTestCloudflareConnection();
  const diagnoseCloudflareDnsDrift = useDiagnoseCloudflareDnsDrift();
  const reconcileCloudflareDns = useReconcileCloudflareDns();
  const updateTimeDisplay = useUpdateTimeDisplaySettings();
  const updateCertificateDiagnostics = useUpdateCertificateDiagnosticsSettings();
  const updateTraefikDashboard = useUpdateTraefikDashboardSettings();
  const updateUpstreamSecurity = useUpdateUpstreamSecuritySettings();
  const updateLoginDefense = useUpdateLoginDefenseSettings();
  const updateSecurityAlert = useUpdateSecurityAlertSettings();
  const testSecurityAlertSettings = useTestSecurityAlertSettings();
  const retryDelivery = useAuditRetryDelivery();
  const logoutAllSessions = useLogoutAllSessions();
  const revokeSession = useRevokeSession();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const validateBackup = useValidateBackup();
  const previewBackup = usePreviewBackup();

  const handleEditCf = () => {
    setCfForm(
      cloudflareStatus?.zones?.length
        ? cloudflareStatus.zones.map((zone) => ({
            api_token: "",
            zone_id: zone.zone_id,
            record_target: zone.record_target ?? "",
            proxied: zone.proxied,
          }))
        : [createDefaultCloudflareZoneForm()],
    );
    setCloudflareErrorMessage("");
    setIsEditingCf(true);
  };

  const updateCfZone = (index: number, patch: Partial<CloudflareZoneInput>) => {
    setCfForm((current) => current.map((zone, currentIndex) => (currentIndex === index ? { ...zone, ...patch } : zone)));
  };

  const addCfZone = () => {
    setCfForm((current) => [...current, createDefaultCloudflareZoneForm()]);
  };

  const removeCfZone = (index: number) => {
    setCfForm((current) => {
      if (current.length === 1) {
        return [createDefaultCloudflareZoneForm()];
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleSaveCf = async () => {
    setCloudflareErrorMessage("");
    try {
      await updateCloudflare.mutateAsync({ zones: cfForm });
      setCloudflareTestResult(null);
      setCloudflareDriftResult(null);
      setCloudflareReconcileResult(null);
      setIsEditingCf(false);
    } catch (error) {
      setCloudflareErrorMessage(getApiErrorDetail(error, "Cloudflare 설정 저장에 실패했습니다"));
    }
  };

  const handleTestCf = async () => {
    try {
      setCloudflareTestResult(await testCloudflareConnection.mutateAsync());
    } catch (error) {
      setCloudflareTestResult(buildActionFailure("Cloudflare 연결 테스트에 실패했습니다", getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다")));
    }
  };

  const handleReconcileCf = async () => {
    try {
      setCloudflareReconcileResult(await reconcileCloudflareDns.mutateAsync());
    } catch (error) {
      setCloudflareReconcileResult(
        buildActionFailure("Cloudflare DNS 재동기화에 실패했습니다", getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다")),
      );
    }
  };

  const handleDiagnoseCfDrift = async () => {
    try {
      setCloudflareDriftResult(await diagnoseCloudflareDnsDrift.mutateAsync());
    } catch (error) {
      setCloudflareDriftResult({
        success: false,
        message: "Cloudflare DNS 드리프트 진단에 실패했습니다",
        detail: getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다"),
        zone_count: 0,
        total_services: 0,
        eligible_services: 0,
        skipped_services: 0,
        healthy_services: 0,
        zones: [],
        excluded_services: [],
        missing_records: [],
        mismatched_records: [],
        orphan_records: [],
      });
    }
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

  const handleEditCertificateDiagnostics = () => {
    setCertificateDiagnosticsForm({
      auto_check_interval_minutes: certificateDiagnosticsSettings?.auto_check_interval_minutes ?? 60,
      repeat_alert_threshold: certificateDiagnosticsSettings?.repeat_alert_threshold ?? 3,
      repeat_alert_window_minutes: certificateDiagnosticsSettings?.repeat_alert_window_minutes ?? 240,
      repeat_alert_cooldown_minutes: certificateDiagnosticsSettings?.repeat_alert_cooldown_minutes ?? 240,
    });
    setIsEditingCertificateDiagnostics(true);
  };

  const handleSaveCertificateDiagnostics = async () => {
    await updateCertificateDiagnostics.mutateAsync(certificateDiagnosticsForm);
    setIsEditingCertificateDiagnostics(false);
  };

  const handleEditTraefikDashboard = () => {
    setTraefikDashboardForm({
      enabled: traefikDashboardSettings?.enabled ?? false,
      domain: traefikDashboardSettings?.domain ?? "",
      auth_username: traefikDashboardSettings?.auth_username ?? "",
      auth_password: "",
    });
    setTraefikDashboardErrorMessage("");
    setIsEditingTraefikDashboard(true);
  };

  const handleSaveTraefikDashboard = async () => {
    setTraefikDashboardErrorMessage("");
    try {
      await updateTraefikDashboard.mutateAsync({
        enabled: traefikDashboardForm.enabled,
        domain: traefikDashboardForm.domain.trim(),
        auth_username: traefikDashboardForm.auth_username.trim(),
        auth_password: traefikDashboardForm.auth_password,
      });
      setIsEditingTraefikDashboard(false);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response
        ?.data?.detail;
      setTraefikDashboardErrorMessage(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail[0]?.msg || "Traefik 디버그 대시보드 설정 저장에 실패했습니다"
            : "Traefik 디버그 대시보드 설정 저장에 실패했습니다",
      );
    }
  };

  const handleEditUpstreamSecurity = () => {
    setUpstreamSecurityForm({
      dns_strict_mode: upstreamSecuritySettings?.dns_strict_mode ?? false,
      allowlist_enabled: upstreamSecuritySettings?.allowlist_enabled ?? false,
      allowed_domain_suffixes: upstreamSecuritySettings?.allowed_domain_suffixes ?? [],
      allowed_domain_suffixes_text: (upstreamSecuritySettings?.allowed_domain_suffixes ?? []).join("\n"),
      allow_docker_service_names: upstreamSecuritySettings?.allow_docker_service_names ?? true,
      allow_private_networks: upstreamSecuritySettings?.allow_private_networks ?? true,
    });
    setIsEditingUpstreamSecurity(true);
  };

  const handleSaveUpstreamSecurity = async () => {
    await updateUpstreamSecurity.mutateAsync({
      dns_strict_mode: upstreamSecurityForm.dns_strict_mode,
      allowlist_enabled: upstreamSecurityForm.allowlist_enabled,
      allowed_domain_suffixes: parseMultivalueText(upstreamSecurityForm.allowed_domain_suffixes_text),
      allow_docker_service_names: upstreamSecurityForm.allow_docker_service_names,
      allow_private_networks: upstreamSecurityForm.allow_private_networks,
    });
    setIsEditingUpstreamSecurity(false);
  };

  const handleEditLoginDefense = () => {
    setLoginDefenseForm({
      suspicious_block_enabled: loginDefenseSettings?.suspicious_block_enabled ?? true,
      suspicious_trusted_networks: loginDefenseSettings?.suspicious_trusted_networks ?? [],
      suspicious_trusted_networks_text: (loginDefenseSettings?.suspicious_trusted_networks ?? []).join("\n"),
      suspicious_block_escalation_enabled: loginDefenseSettings?.suspicious_block_escalation_enabled ?? false,
      suspicious_block_escalation_window_minutes: loginDefenseSettings?.suspicious_block_escalation_window_minutes ?? 1440,
      suspicious_block_escalation_multiplier: loginDefenseSettings?.suspicious_block_escalation_multiplier ?? 2,
      suspicious_block_max_minutes: loginDefenseSettings?.suspicious_block_max_minutes ?? 1440,
      turnstile_mode: loginDefenseSettings?.turnstile_mode ?? "off",
      turnstile_site_key: loginDefenseSettings?.turnstile_site_key ?? "",
      turnstile_secret_key: "",
    });
    setLoginDefenseErrorMessage("");
    setIsEditingLoginDefense(true);
  };

  const handleSaveLoginDefense = async () => {
    setLoginDefenseErrorMessage("");
    try {
      await updateLoginDefense.mutateAsync({
        suspicious_block_enabled: loginDefenseForm.suspicious_block_enabled,
        suspicious_trusted_networks: parseMultivalueText(loginDefenseForm.suspicious_trusted_networks_text),
        suspicious_block_escalation_enabled: loginDefenseForm.suspicious_block_escalation_enabled,
        suspicious_block_escalation_window_minutes: loginDefenseForm.suspicious_block_escalation_window_minutes,
        suspicious_block_escalation_multiplier: loginDefenseForm.suspicious_block_escalation_multiplier,
        suspicious_block_max_minutes: loginDefenseForm.suspicious_block_max_minutes,
        turnstile_mode: loginDefenseForm.turnstile_mode,
        turnstile_site_key: loginDefenseForm.turnstile_site_key.trim(),
        turnstile_secret_key: loginDefenseForm.turnstile_secret_key.trim(),
      });
      setIsEditingLoginDefense(false);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response
        ?.data?.detail;
      setLoginDefenseErrorMessage(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail[0]?.msg || "로그인 방어 설정 저장에 실패했습니다"
            : "로그인 방어 설정 저장에 실패했습니다",
      );
    }
  };

  const handleEditSecurityAlert = () => {
    setSecurityAlertForm({
      enabled: securityAlertSettings?.enabled ?? false,
      change_alerts_enabled: securityAlertSettings?.change_alerts_enabled ?? false,
      provider: securityAlertSettings?.provider ?? "generic",
      webhook_url: securityAlertSettings?.webhook_url ?? "",
      telegram_bot_token: "",
      telegram_chat_id: securityAlertSettings?.telegram_chat_id ?? "",
      pagerduty_routing_key: "",
      email_host: securityAlertSettings?.email_host ?? "",
      email_port: securityAlertSettings?.email_port ?? 587,
      email_security: securityAlertSettings?.email_security ?? "starttls",
      email_username: securityAlertSettings?.email_username ?? "",
      email_password: "",
      email_from: securityAlertSettings?.email_from ?? "",
      email_recipients: securityAlertSettings?.email_recipients ?? [],
      event_routes: securityAlertSettings?.event_routes ?? createDefaultSecurityAlertForm().event_routes,
      change_event_routes:
        securityAlertSettings?.change_event_routes ?? createDefaultSecurityAlertForm().change_event_routes,
    });
    setSecurityAlertErrorMessage("");
    setIsEditingSecurityAlert(true);
  };

  const handleSaveSecurityAlert = async () => {
    setSecurityAlertErrorMessage("");
    try {
      await updateSecurityAlert.mutateAsync({
        enabled: securityAlertForm.enabled,
        change_alerts_enabled: securityAlertForm.change_alerts_enabled,
        provider: securityAlertForm.provider,
        webhook_url: securityAlertForm.webhook_url.trim(),
        telegram_bot_token: securityAlertForm.telegram_bot_token.trim(),
        telegram_chat_id: securityAlertForm.telegram_chat_id.trim(),
        pagerduty_routing_key: securityAlertForm.pagerduty_routing_key.trim(),
        email_host: securityAlertForm.email_host.trim(),
        email_port: securityAlertForm.email_port,
        email_security: securityAlertForm.email_security,
        email_username: securityAlertForm.email_username.trim(),
        email_password: securityAlertForm.email_password.trim(),
        email_from: securityAlertForm.email_from.trim(),
        email_recipients: securityAlertForm.email_recipients,
        event_routes: securityAlertForm.event_routes,
        change_event_routes: securityAlertForm.change_event_routes,
      });
      setSecurityAlertTestResult(null);
      setIsEditingSecurityAlert(false);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } })?.response
        ?.data?.detail;
      setSecurityAlertErrorMessage(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail[0]?.msg || "보안 알림 설정 저장에 실패했습니다"
            : "보안 알림 설정 저장에 실패했습니다",
      );
    }
  };

  const handleTestSecurityAlert = async () => {
    try {
      setSecurityAlertTestResult(await testSecurityAlertSettings.mutateAsync());
    } catch (error) {
      setSecurityAlertTestResult(
        buildActionFailure("테스트 보안 알림 전송에 실패했습니다", getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다")),
      );
    }
  };

  const handleRetryDelivery = async (
    history: SettingsTestHistoryItem | null | undefined,
    target: "security" | "change",
  ) => {
    const auditLogId = history?.last_failure_audit_id;
    if (!auditLogId) return;

    try {
      setRetryTargetAuditId(auditLogId);
      const result = await retryDelivery.mutateAsync({ auditLogId });
      const notice = {
        success: result.success,
        message: result.message,
        detail: result.detail,
        provider: result.provider,
      };
      if (target === "security") {
        setSecurityAlertDeliveryRetryResult(notice);
      } else {
        setChangeAlertDeliveryRetryResult(notice);
      }
    } catch (error) {
      const notice = buildActionFailure(
        "알림 전송 재시도에 실패했습니다",
        getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다"),
      );
      if (target === "security") {
        setSecurityAlertDeliveryRetryResult(notice);
      } else {
        setChangeAlertDeliveryRetryResult(notice);
      }
    } finally {
      setRetryTargetAuditId(null);
    }
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
    setBackupValidationResult(null);
    setBackupPreviewResult(null);

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

  const handleValidateBackup = async () => {
    if (!backupFile) return;
    setImportResultMessage("");
    setBackupValidationResult(null);
    setBackupPreviewResult(null);

    let parsed: BackupPayload;
    try {
      const text = await backupFile.text();
      parsed = JSON.parse(text) as BackupPayload;
    } catch {
      setImportResultMessage("유효하지 않은 JSON 파일입니다");
      return;
    }

    try {
      const result = await validateBackup.mutateAsync({
        mode: importMode,
        data: parsed,
      });
      setBackupValidationResult(result);
    } catch (error) {
      setImportResultMessage(getApiErrorDetail(error, "백업 사전 검증에 실패했습니다"));
    }
  };

  const handlePreviewBackup = async () => {
    if (!backupFile) return;
    setImportResultMessage("");
    setBackupPreviewResult(null);

    let parsed: BackupPayload;
    try {
      const text = await backupFile.text();
      parsed = JSON.parse(text) as BackupPayload;
    } catch {
      setImportResultMessage("유효하지 않은 JSON 파일입니다");
      return;
    }

    try {
      const result = await previewBackup.mutateAsync({
        mode: importMode,
        data: parsed,
      });
      setBackupPreviewResult(result);
    } catch (error) {
      setImportResultMessage(getApiErrorDetail(error, "복원 미리보기에 실패했습니다"));
    }
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
        <TimeDisplaySettingsCard
          canManage={canManage}
          isLoading={isTimeDisplayLoading}
          isEditing={isEditingTimeDisplay}
          settings={timeDisplaySettings}
          formValue={timeDisplayForm}
          errorMessage={timeDisplayErrorMessage}
          isSaving={updateTimeDisplay.isPending}
          onEdit={handleEditTimeDisplay}
          onSave={handleSaveTimeDisplay}
          onCancel={() => setIsEditingTimeDisplay(false)}
          onFormValueChange={setTimeDisplayForm}
        />

        <CertificateDiagnosticsSettingsCard
          canManage={canManage}
          isLoading={isCertificateDiagnosticsLoading}
          isEditing={isEditingCertificateDiagnostics}
          settings={certificateDiagnosticsSettings}
          formValue={certificateDiagnosticsForm}
          isSaving={updateCertificateDiagnostics.isPending}
          onEdit={handleEditCertificateDiagnostics}
          onSave={handleSaveCertificateDiagnostics}
          onCancel={() => setIsEditingCertificateDiagnostics(false)}
          onFormChange={setCertificateDiagnosticsForm}
        />

        <UpstreamSecuritySettingsCard
          canManage={canManage}
          isLoading={isUpstreamSecurityLoading}
          isEditing={isEditingUpstreamSecurity}
          settings={upstreamSecuritySettings}
          formValue={upstreamSecurityForm}
          isSaving={updateUpstreamSecurity.isPending}
          onEdit={handleEditUpstreamSecurity}
          onSave={handleSaveUpstreamSecurity}
          onCancel={() => setIsEditingUpstreamSecurity(false)}
          onFormChange={setUpstreamSecurityForm}
        />

        <LoginDefenseSettingsCard
          canManage={canManage}
          isLoading={isLoginDefenseLoading}
          isEditing={isEditingLoginDefense}
          settings={loginDefenseSettings}
          formValue={loginDefenseForm}
          errorMessage={loginDefenseErrorMessage}
          isSaving={updateLoginDefense.isPending}
          onEdit={handleEditLoginDefense}
          onSave={handleSaveLoginDefense}
          onCancel={() => setIsEditingLoginDefense(false)}
          onFormChange={setLoginDefenseForm}
        />

        <SecurityAlertSettingsCard
          canManage={canManage}
          isLoading={isSecurityAlertLoading}
          isEditing={isEditingSecurityAlert}
          settings={securityAlertSettings}
          formValue={securityAlertForm}
          errorMessage={securityAlertErrorMessage}
          isSaving={updateSecurityAlert.isPending}
          isTesting={testSecurityAlertSettings.isPending}
          isHistoryLoading={isSettingsTestHistoryLoading}
          displayTimezone={timeDisplaySettings?.display_timezone}
          testResult={securityAlertTestResult}
          securityRetryResult={securityAlertDeliveryRetryResult}
          changeRetryResult={changeAlertDeliveryRetryResult}
          securityTestHistory={settingsTestHistory?.security_alert}
          securityDeliveryHistory={settingsTestHistory?.security_alert_delivery}
          changeDeliveryHistory={settingsTestHistory?.change_alert_delivery}
          isRetryingSecurityDelivery={
            retryDelivery.isPending &&
            retryTargetAuditId === settingsTestHistory?.security_alert_delivery?.last_failure_audit_id
          }
          isRetryingChangeDelivery={
            retryDelivery.isPending &&
            retryTargetAuditId === settingsTestHistory?.change_alert_delivery?.last_failure_audit_id
          }
          onEdit={handleEditSecurityAlert}
          onSave={handleSaveSecurityAlert}
          onCancel={() => setIsEditingSecurityAlert(false)}
          onTest={handleTestSecurityAlert}
          onRetrySecurityDelivery={() =>
            handleRetryDelivery(settingsTestHistory?.security_alert_delivery, "security")
          }
          onRetryChangeDelivery={() =>
            handleRetryDelivery(settingsTestHistory?.change_alert_delivery, "change")
          }
          onFormChange={setSecurityAlertForm}
        />

        <div className="card p-6 h-full order-5">
          <SettingsCardHeader
            icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
            title="세션 관리"
            description="현재 로그인된 브라우저 세션을 확인하고, 필요하면 개별 종료 또는 전체 로그아웃할 수 있습니다."
            action={
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
                onClick={handleLogoutAllSessions}
                disabled={logoutAllSessions.isPending || isSessionsLoading || !sessionData?.sessions?.length}
              >
                <LogOut className="h-3.5 w-3.5" />
                {logoutAllSessions.isPending ? "로그아웃 중..." : "모든 세션 로그아웃"}
              </button>
            }
          />

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
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <Laptop className="w-4 h-4 text-gray-500" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                          {session.user_agent || "알 수 없는 브라우저"}
                        </span>
                        {session.is_current ? (
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            현재 세션
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                        <SettingsSummaryRow label="세션 ID" value={session.session_id} mono />
                        <SettingsSummaryRow label="IP" value={session.ip_address || "-"} mono />
                        <SettingsSummaryRow
                          label="발급 시각"
                          value={formatDateTime(session.issued_at, timeDisplaySettings?.display_timezone)}
                        />
                        <SettingsSummaryRow
                          label="최근 활동"
                          value={formatDateTime(session.last_seen_at, timeDisplaySettings?.display_timezone)}
                        />
                        <SettingsSummaryRow
                          label="절대 만료"
                          value={formatDateTime(session.expires_at, timeDisplaySettings?.display_timezone)}
                        />
                        <SettingsSummaryRow
                          label="유휴 만료"
                          value={formatDateTime(session.idle_expires_at, timeDisplaySettings?.display_timezone)}
                        />
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

        {canManage ? <UserManagementSection className="order-6" /> : null}

        <div className="card p-6 h-full order-7">
          <SettingsCardHeader
            icon={<Bug className="w-5 h-5 text-violet-600" />}
            title="Traefik 디버그 대시보드"
            description="내장 Traefik dashboard를 필요할 때만 공개 도메인으로 노출합니다. 기본적으로는 비공개로 두고, 디버깅이 끝나면 다시 끄는 것을 권장합니다."
            canEdit={canManage && !isEditingTraefikDashboard && !isTraefikDashboardLoading}
            onEdit={handleEditTraefikDashboard}
          />

          {isTraefikDashboardLoading ? (
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingTraefikDashboard ? (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-violet-600"
                  checked={traefikDashboardForm.enabled}
                  onChange={(e) =>
                    setTraefikDashboardForm((current) => ({
                      ...current,
                      enabled: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">공개 라우트 활성화</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    `api@internal`을 지정한 공개 도메인으로 연결합니다. 평소에는 끄고, 디버깅할 때만 잠깐 켜는
                    용도입니다.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <label className="label">공개 도메인</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="예: traefik-debug.lizstudio.co.kr"
                    value={traefikDashboardForm.domain}
                    onChange={(e) =>
                      setTraefikDashboardForm((current) => ({
                        ...current,
                        domain: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">기본 인증 사용자명</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="예: debug-admin"
                    value={traefikDashboardForm.auth_username}
                    onChange={(e) =>
                      setTraefikDashboardForm((current) => ({
                        ...current,
                        auth_username: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">기본 인증 비밀번호</label>
                <input
                  type="password"
                  className="input"
                  placeholder="처음 활성화 시 필수, 비워두면 기존 비밀번호 유지"
                  value={traefikDashboardForm.auth_password}
                  onChange={(e) =>
                    setTraefikDashboardForm((current) => ({
                      ...current,
                      auth_password: e.target.value,
                    }))
                  }
                />
                <p className="mt-1 text-xs text-gray-500">
                  비밀번호는 해시로만 저장됩니다. 이 설정은 Traefik dashboard 엔진 자체를 켜고 끄는 게 아니라,
                  public route를 생성하거나 제거합니다.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                <p>전제 조건: 외부 Traefik 정적 설정에서 `api.dashboard=true`가 켜져 있어야 합니다.</p>
                <p>보호 방식: 공개 도메인 + HTTPS + Traefik Basic Auth</p>
                <p>도메인 제약: 기존 서비스 또는 리다이렉트에서 사용하는 도메인과 중복될 수 없습니다.</p>
                <p>권장 운영: 디버깅 후 즉시 비활성화</p>
              </div>

              {traefikDashboardErrorMessage ? (
                <p className="text-xs text-red-600">{traefikDashboardErrorMessage}</p>
              ) : null}

              <SettingsActionRow>
                <button
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={handleSaveTraefikDashboard}
                  disabled={updateTraefikDashboard.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateTraefikDashboard.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={() => setIsEditingTraefikDashboard(false)}
                >
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </SettingsActionRow>
            </div>
          ) : (
            <SettingsSummary>
              <SettingsSummaryRow
                label="상태"
                value={traefikDashboardSettings?.enabled ? "활성화" : "비활성화"}
              />
              <SettingsSummaryRow
                label="공개 주소"
                value={
                  traefikDashboardSettings?.public_url ? (
                    <a
                      href={traefikDashboardSettings.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {traefikDashboardSettings.public_url}
                    </a>
                  ) : (
                    "(미설정)"
                  )
                }
                mono
              />
              <SettingsSummaryRow
                label="기본 인증 사용자"
                value={traefikDashboardSettings?.auth_username || "(미설정)"}
                mono
              />
              <SettingsSummaryRow
                label="비밀번호"
                value={traefikDashboardSettings?.auth_password_configured ? "설정됨" : "(미설정)"}
              />
              <SettingsSummaryRow
                label="라우트 준비 상태"
                value={traefikDashboardSettings?.configured ? "완료" : "불완전"}
              />
              <p className="text-xs text-gray-500">{traefikDashboardSettings?.message}</p>
              <p className="text-xs text-gray-500 pt-1">
                이 설정은 Traefik Manager가 dynamic route 파일을 생성/삭제해서 public 노출만 제어합니다.
              </p>
            </SettingsSummary>
          )}
        </div>

        <div className="card p-6 h-full order-10">
          <SettingsCardHeader
            icon={<Cloud className="w-5 h-5 text-blue-600" />}
            title="Cloudflare DNS 자동 연동"
            description="서비스 추가/삭제 시 Cloudflare DNS A 레코드를 자동으로 생성/삭제합니다. 이미 DNS가 수동으로 설정되어 있다면 사용하지 않아도 됩니다."
            canEdit={canManage && !isEditingCf && !isCloudflareLoading}
            onEdit={handleEditCf}
          />

          {isCloudflareLoading ? (
            <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingCf ? (
            <div className="space-y-4">
              {cfForm.map((zone, index) => (
                <div key={`cf-zone-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Cloudflare 영역 {index + 1}</p>
                      <p className="text-xs text-gray-500">한 zone과 그 하위 도메인만 자동 연동 대상으로 포함됩니다.</p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary py-1.5 text-xs"
                      onClick={() => removeCfZone(index)}
                      disabled={cfForm.length === 1}
                    >
                      영역 제거
                    </button>
                  </div>

                  <div>
                    <label className="label">API Token</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="새 토큰 입력 (비워두면 기존 값 유지가 아니라 이 영역 저장 자체가 비활성화됩니다)"
                      value={zone.api_token}
                      onChange={(e) => updateCfZone(index, { api_token: e.target.value })}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Cloudflare → My Profile → API Tokens → Create Token → <strong>Zone:DNS:Edit</strong>,{" "}
                      <strong>Zone:Zone:Read</strong> 권한이 필요합니다.
                    </p>
                  </div>

                  <div>
                    <label className="label">Zone ID</label>
                    <input
                      type="text"
                      className="input"
                      value={zone.zone_id}
                      onChange={(e) => updateCfZone(index, { zone_id: e.target.value })}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Cloudflare 도메인 대시보드 우측 하단 `Zone ID`. 이 zone에 속한 도메인만 자동 DNS 등록과
                      드리프트 진단 대상이 됩니다.
                    </p>
                  </div>

                  <div>
                    <label className="label">
                      Record Target <span className="text-gray-400 font-normal">(선택)</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="예: 1.2.3.4 (비워두면 서비스 업스트림 호스트 사용)"
                      value={zone.record_target}
                      onChange={(e) => updateCfZone(index, { record_target: e.target.value })}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      DNS A/CNAME 레코드가 가리킬 대상입니다. 비워두면 서비스 upstream_host를 사용하지만, upstream이
                      내부 IP인 경우 공인 IP나 외부 hostname을 직접 입력해야 합니다.
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={zone.proxied}
                        onChange={(e) => updateCfZone(index, { proxied: e.target.checked })}
                      />
                      Cloudflare Proxy (Proxied) 사용
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      활성화 시 트래픽이 Cloudflare를 경유하며 실제 서버 IP가 숨겨집니다. DNS only가 필요하면 체크를
                      해제하세요.
                    </p>
                  </div>
                </div>
              ))}

              <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addCfZone}>
                영역 추가
              </button>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                <p>멀티존 지원: 여러 Cloudflare zone을 나란히 저장할 수 있습니다.</p>
                <p>비Cloudflare 도메인: 저장/드리프트/재동기화 대상에서 자동 제외되며, 진단 결과에 제외 사유가 표시됩니다.</p>
                <p>모든 영역을 비우고 저장하면 Cloudflare 자동 연동 설정이 완전히 초기화됩니다.</p>
              </div>

              {cloudflareErrorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {cloudflareErrorMessage}
                </div>
              ) : null}

              <SettingsActionRow>
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
              </SettingsActionRow>
            </div>
          ) : (
            <SettingsSummary>
              <p className={`text-sm font-medium ${cloudflareStatus?.enabled ? "text-green-700" : "text-gray-600"}`}>
                {cloudflareStatus?.enabled ? "활성화됨" : "비활성화됨"}
              </p>
              <p className="text-xs text-gray-500 mt-1">{cloudflareStatus?.message}</p>
              <div className="pt-1">
                <SettingsSummaryRow label="설정된 영역 수" value={`${cloudflareStatus?.zone_count ?? 0}개`} />
                <SettingsSummaryRow label="적용 범위" value="Cloudflare zone과 일치하는 도메인만 자동 연동" />
                <SettingsSummaryRow label="비Cloudflare 도메인" value="자동 제외 후 진단 결과에 표시" />
              </div>
              {cloudflareStatus?.zones?.length ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">설정된 영역 목록</p>
                  <div className="space-y-2">
                    {cloudflareStatus.zones.map((zone) => (
                      <div key={zone.zone_id} className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-900">{zone.zone_name || "(영역 이름 미확인)"}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {zone.proxied ? "프록시 활성" : "DNS only"}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-gray-500">{zone.zone_id}</p>
                        <p className="mt-2 text-[11px] text-gray-600">
                          대상: <span className="font-mono text-gray-700">{zone.record_target || "(서비스 업스트림 사용)"}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {canManage ? (
                <SettingsActionRow>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
                    onClick={handleTestCf}
                    disabled={testCloudflareConnection.isPending}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {testCloudflareConnection.isPending ? "테스트 중..." : "연결 테스트"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
                    onClick={handleDiagnoseCfDrift}
                    disabled={diagnoseCloudflareDnsDrift.isPending}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {diagnoseCloudflareDnsDrift.isPending ? "진단 중..." : "드리프트 진단"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
                    onClick={handleReconcileCf}
                    disabled={reconcileCloudflareDns.isPending}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {reconcileCloudflareDns.isPending ? "재동기화 중..." : "DNS 재동기화"}
                  </button>
                </SettingsActionRow>
              ) : null}
              <p className="text-xs text-gray-500">
                테스트, 드리프트 진단, 재동기화는 현재 저장된 Cloudflare zone 목록 기준으로 수행됩니다.
              </p>
              {!isSettingsTestHistoryLoading ? (
                <SettingsTestHistoryNotice
                  label="마지막 연결 테스트"
                  history={settingsTestHistory?.cloudflare}
                  timezone={timeDisplaySettings?.display_timezone}
                />
              ) : null}
              {!isSettingsTestHistoryLoading ? (
                <SettingsTestHistoryNotice
                  label="마지막 드리프트 진단"
                  history={settingsTestHistory?.cloudflare_drift}
                  timezone={timeDisplaySettings?.display_timezone}
                />
              ) : null}
              {!isSettingsTestHistoryLoading ? (
                <SettingsTestHistoryNotice
                  label="마지막 DNS 재동기화"
                  history={settingsTestHistory?.cloudflare_reconcile}
                  timezone={timeDisplaySettings?.display_timezone}
                />
              ) : null}
              <ActionResultNotice result={cloudflareTestResult} />
              <CloudflareDriftNotice result={cloudflareDriftResult} />
              <ActionResultNotice result={cloudflareReconcileResult} />
            </SettingsSummary>
          )}

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-medium">추가 권한 안내</p>
            <p className="mt-1">
              권한 구성 예시:
            </p>
            <ul className="mt-2 space-y-1 text-amber-800">
              <li>- 리소스: <strong>영역(Zone)</strong> / 권한: <strong>DNS 설정(Edit)</strong></li>
              <li>- 리소스: <strong>영역(Zone)</strong> / 권한: <strong>영역(Read)</strong></li>
              <li>- 리소스: <strong>영역(Zone)</strong> / 권한: <strong>DNS(Read)</strong></li>
            </ul>
            <p className="mt-1 text-amber-800">
              연결 테스트는 zone 접근만 확인하지만, 드리프트 진단은 DNS 레코드 목록까지 조회합니다.
              따라서 연결 테스트가 통과해도 <strong>DNS:Read</strong>가 없으면 드리프트 진단은 실패할 수
              있습니다.
            </p>
            <p className="mt-1 text-amber-800">
              드리프트 진단 결과가 <strong>드리프트 0개</strong>로 나오면, Cloudflare 관리 대상 도메인의
              DNS가 현재 목표 상태와 일치한다는 뜻입니다.
            </p>
          </div>
        </div>

        <div className="card p-6 h-full order-8">
          <SettingsCardHeader
            icon={<Settings className="w-5 h-5 text-indigo-600" />}
            title="백업 / 복원"
            description="현재 설정을 JSON으로 내보내거나, 백업 파일을 병합 또는 덮어쓰기 방식으로 복원합니다."
          />

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
                onChange={(e) => {
                  setBackupFile(e.target.files?.[0] || null);
                  setBackupValidationResult(null);
                  setBackupPreviewResult(null);
                  setImportResultMessage("");
                }}
              />

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="radio"
                    className="accent-blue-600"
                    checked={importMode === "merge"}
                    onChange={() => {
                      setImportMode("merge");
                      setBackupValidationResult(null);
                      setBackupPreviewResult(null);
                    }}
                  />
                  병합 (기존 데이터 유지)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="radio"
                    className="accent-blue-600"
                    checked={importMode === "overwrite"}
                    onChange={() => {
                      setImportMode("overwrite");
                      setBackupValidationResult(null);
                      setBackupPreviewResult(null);
                    }}
                  />
                  덮어쓰기 (기존 데이터 삭제 후 복원)
                </label>
              </div>

              <button
                type="button"
                className="btn-secondary w-full inline-flex items-center justify-center gap-2"
                onClick={handleValidateBackup}
                disabled={!backupFile || validateBackup.isPending}
              >
                <ShieldCheck className="w-4 h-4" />
                {validateBackup.isPending ? "검증 중..." : "JSON 사전 검증"}
              </button>

              <button
                type="button"
                className="btn-secondary w-full inline-flex items-center justify-center gap-2"
                onClick={handlePreviewBackup}
                disabled={!backupFile || previewBackup.isPending}
              >
                <Settings className="w-4 h-4" />
                {previewBackup.isPending ? "미리보기 계산 중..." : "복원 미리보기"}
              </button>

              {backupValidationResult ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <p className="font-medium">
                    검증 완료: 서비스 {backupValidationResult.service_count}개, 리다이렉트 {backupValidationResult.redirect_count}개
                  </p>
                  <p className="mt-1 text-xs">경고 {backupValidationResult.warning_count}개</p>
                  {backupValidationResult.warnings.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {backupValidationResult.warnings.map((warning) => (
                        <li key={warning}>- {warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <BackupPreviewNotice result={backupPreviewResult} />

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
      </div>
    </div>
  );
}
