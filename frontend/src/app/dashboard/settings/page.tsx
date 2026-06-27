"use client";
// PONYTAIL-DEBT(settings-page): split this oversized settings page into focused section components.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Settings,
  ShieldCheck,
  Upload,
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
  SettingsCardHeader,
} from "@/features/settings/components/SettingsCardPrimitives";
import { CertificateDiagnosticsSettingsCard } from "@/features/settings/components/CertificateDiagnosticsSettingsCard";
import {
  BackupPreviewNotice,
} from "@/features/settings/components/SettingsNotices";
import { CloudflareDnsSettingsCard } from "@/features/settings/components/CloudflareDnsSettingsCard";
import { LoginDefenseSettingsCard } from "@/features/settings/components/LoginDefenseSettingsCard";
import { SecurityAlertSettingsCard } from "@/features/settings/components/SecurityAlertSettingsCard";
import { SessionManagementCard } from "@/features/settings/components/SessionManagementCard";
import { TimeDisplaySettingsCard } from "@/features/settings/components/TimeDisplaySettingsCard";
import { TraefikDashboardSettingsCard } from "@/features/settings/components/TraefikDashboardSettingsCard";
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
import { getDefaultDisplayTimezone } from "@/shared/lib/dateTimeFormat";

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

        <SessionManagementCard
          isLoading={isSessionsLoading}
          sessions={sessionData?.sessions}
          timezone={timeDisplaySettings?.display_timezone}
          isLoggingOutAll={logoutAllSessions.isPending}
          isRevokingSession={revokeSession.isPending}
          onLogoutAll={handleLogoutAllSessions}
          onRevokeSession={handleRevokeSession}
        />

        {canManage ? <UserManagementSection className="order-6" /> : null}

        <TraefikDashboardSettingsCard
          canManage={canManage}
          isLoading={isTraefikDashboardLoading}
          isEditing={isEditingTraefikDashboard}
          settings={traefikDashboardSettings}
          formValue={traefikDashboardForm}
          errorMessage={traefikDashboardErrorMessage}
          isSaving={updateTraefikDashboard.isPending}
          onEdit={handleEditTraefikDashboard}
          onSave={handleSaveTraefikDashboard}
          onCancel={() => setIsEditingTraefikDashboard(false)}
          onFormChange={setTraefikDashboardForm}
        />

        <CloudflareDnsSettingsCard
          canManage={canManage}
          isLoading={isCloudflareLoading}
          isEditing={isEditingCf}
          status={cloudflareStatus}
          formValue={cfForm}
          errorMessage={cloudflareErrorMessage}
          isSaving={updateCloudflare.isPending}
          isTesting={testCloudflareConnection.isPending}
          isDiagnosing={diagnoseCloudflareDnsDrift.isPending}
          isReconciling={reconcileCloudflareDns.isPending}
          isHistoryLoading={isSettingsTestHistoryLoading}
          timezone={timeDisplaySettings?.display_timezone}
          testHistory={settingsTestHistory?.cloudflare}
          driftHistory={settingsTestHistory?.cloudflare_drift}
          reconcileHistory={settingsTestHistory?.cloudflare_reconcile}
          testResult={cloudflareTestResult}
          driftResult={cloudflareDriftResult}
          reconcileResult={cloudflareReconcileResult}
          onEdit={handleEditCf}
          onSave={handleSaveCf}
          onCancel={() => setIsEditingCf(false)}
          onTest={handleTestCf}
          onDiagnose={handleDiagnoseCfDrift}
          onReconcile={handleReconcileCf}
          onFormChange={setCfForm}
        />

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
