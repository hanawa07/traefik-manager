"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useLogoutAllSessions, useRevokeSession, useSessions } from "@/features/auth/hooks/useSessions";
import { useAuditRetryDelivery } from "@/features/audit/hooks/useAudit";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import {
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { BackupRestoreSettingsCard } from "@/features/settings/components/BackupRestoreSettingsCard";
import { CertificateDiagnosticsSettingsCard } from "@/features/settings/components/CertificateDiagnosticsSettingsCard";
import { CloudflareDnsSettingsCard } from "@/features/settings/components/CloudflareDnsSettingsCard";
import { LoginDefenseSettingsCard } from "@/features/settings/components/LoginDefenseSettingsCard";
import { SecurityAlertSettingsCard } from "@/features/settings/components/SecurityAlertSettingsCard";
import { SessionManagementCard } from "@/features/settings/components/SessionManagementCard";
import { TimeDisplaySettingsCard } from "@/features/settings/components/TimeDisplaySettingsCard";
import { TraefikDashboardSettingsCard } from "@/features/settings/components/TraefikDashboardSettingsCard";
import { UpstreamSecuritySettingsCard } from "@/features/settings/components/UpstreamSecuritySettingsCard";
import {
  useCertificateDiagnosticsSettings,
  useLoginDefenseSettings,
  useSecurityAlertSettings,
  useTraefikDashboardSettings,
  useTimeDisplaySettings,
  useTestSecurityAlertSettings,
  useSettingsTestHistory,
  useUpdateCertificateDiagnosticsSettings,
  useUpdateTraefikDashboardSettings,
  useUpstreamSecuritySettings,
  useUpdateSecurityAlertSettings,
  useUpdateTimeDisplaySettings,
  useUpdateLoginDefenseSettings,
  useUpdateUpstreamSecuritySettings,
} from "@/features/settings/hooks/useSettings";
import { useBackupRestoreSettings } from "@/features/settings/hooks/useBackupRestoreSettings";
import { useCloudflareDnsSettingsSection } from "@/features/settings/hooks/useCloudflareDnsSettingsSection";
import {
  createDefaultCertificateDiagnosticsForm,
  createDefaultLoginDefenseForm,
  createDefaultSecurityAlertForm,
  createDefaultTraefikDashboardForm,
  createDefaultUpstreamSecurityForm,
} from "@/features/settings/lib/settingsDefaults";
import {
  parseMultivalueText,
} from "@/features/settings/lib/settingsFormHelpers";
import { buildActionFailure, getApiErrorDetail } from "@/features/settings/lib/settingsErrors";
import UserManagementSection from "@/features/users/components/UserManagementSection";
import { getDefaultDisplayTimezone } from "@/shared/lib/dateTimeFormat";
import SettingsPageHeader from "./SettingsPageHeader";

export default function SettingsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clearSession);
  const canManage = role === "admin";
  const [securityAlertTestResult, setSecurityAlertTestResult] = useState<SettingsActionTestResult | null>(null);
  const [securityAlertDeliveryRetryResult, setSecurityAlertDeliveryRetryResult] = useState<SettingsActionTestResult | null>(null);
  const [changeAlertDeliveryRetryResult, setChangeAlertDeliveryRetryResult] = useState<SettingsActionTestResult | null>(null);
  const [retryTargetAuditId, setRetryTargetAuditId] = useState<string | null>(null);

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

  const { data: timeDisplaySettings, isLoading: isTimeDisplayLoading } = useTimeDisplaySettings();
  const { data: certificateDiagnosticsSettings, isLoading: isCertificateDiagnosticsLoading } =
    useCertificateDiagnosticsSettings();
  const { data: traefikDashboardSettings, isLoading: isTraefikDashboardLoading } = useTraefikDashboardSettings();
  const { data: upstreamSecuritySettings, isLoading: isUpstreamSecurityLoading } = useUpstreamSecuritySettings();
  const { data: loginDefenseSettings, isLoading: isLoginDefenseLoading } = useLoginDefenseSettings();
  const { data: securityAlertSettings, isLoading: isSecurityAlertLoading } = useSecurityAlertSettings();
  const { data: settingsTestHistory, isLoading: isSettingsTestHistoryLoading } = useSettingsTestHistory();
  const { data: sessionData, isLoading: isSessionsLoading } = useSessions();
  const backupRestore = useBackupRestoreSettings(canManage);
  const cloudflareDns = useCloudflareDnsSettingsSection(timeDisplaySettings?.display_timezone);
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
      <SettingsPageHeader />

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

        <CloudflareDnsSettingsCard canManage={canManage} {...cloudflareDns} />

        <BackupRestoreSettingsCard canManage={canManage} {...backupRestore} />
      </div>
    </div>
  );
}
