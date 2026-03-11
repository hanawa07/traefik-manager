"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
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
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import {
  BackupValidateResult,
  BackupPayload,
  BackupPreviewGroup,
  BackupPreviewResult,
  LoginDefenseSettingsInput,
  SecurityAlertSettingsInput,
  SettingsActionTestResult,
  UpstreamSecurityPreset,
  UpstreamSecuritySettingsInput,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import {
  useCloudflareStatus,
  useUpdateCloudflareSettings,
  useExportBackup,
  useImportBackup,
  useLoginDefenseSettings,
  useSecurityAlertSettings,
  useTimeDisplaySettings,
  useTestCloudflareConnection,
  useTestSecurityAlertSettings,
  useUpstreamSecuritySettings,
  useUpdateSecurityAlertSettings,
  useUpdateTimeDisplaySettings,
  useUpdateLoginDefenseSettings,
  useUpdateUpstreamSecuritySettings,
  useValidateBackup,
  usePreviewBackup,
} from "@/features/settings/hooks/useSettings";
import UserManagementSection from "@/features/users/components/UserManagementSection";
import { formatDateTime, getDefaultDisplayTimezone, getSupportedTimeZones } from "@/shared/lib/dateTimeFormat";

function createDefaultUpstreamSecurityForm(): UpstreamSecuritySettingsInput & { allowed_domain_suffixes_text: string } {
  return {
    dns_strict_mode: false,
    allowlist_enabled: false,
    allowed_domain_suffixes: [],
    allowed_domain_suffixes_text: "",
    allow_docker_service_names: true,
    allow_private_networks: true,
  };
}

function createDefaultLoginDefenseForm(): LoginDefenseSettingsInput & { suspicious_trusted_networks_text: string } {
  return {
    suspicious_block_enabled: true,
    suspicious_trusted_networks: [],
    suspicious_trusted_networks_text: "",
    suspicious_block_escalation_enabled: false,
    suspicious_block_escalation_window_minutes: 1440,
    suspicious_block_escalation_multiplier: 2,
    suspicious_block_max_minutes: 1440,
    turnstile_mode: "off",
    turnstile_site_key: "",
    turnstile_secret_key: "",
  };
}

function createDefaultSecurityAlertForm(): SecurityAlertSettingsInput {
  return {
    enabled: false,
    provider: "generic",
    webhook_url: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
    pagerduty_routing_key: "",
    email_host: "",
    email_port: 587,
    email_security: "starttls",
    email_username: "",
    email_password: "",
    email_from: "",
    email_recipients: [],
  };
}

const SECURITY_ALERT_PROVIDER_OPTIONS = [
  {
    value: "generic",
    label: "Generic Webhook",
    description: "임의의 JSON webhook endpoint로 원본 이벤트를 전송합니다.",
    placeholder: "https://hooks.example.com/security-alerts",
  },
  {
    value: "slack",
    label: "Slack",
    description: "Slack Incoming Webhook 형식으로 전송합니다.",
    placeholder: "https://hooks.slack.com/services/XXX/YYY/ZZZ",
  },
  {
    value: "discord",
    label: "Discord",
    description: "Discord webhook embed 형식으로 전송합니다.",
    placeholder: "https://discord.com/api/webhooks/123/abc",
  },
  {
    value: "telegram",
    label: "Telegram",
    description: "Bot API sendMessage로 전송합니다.",
    placeholder: "",
  },
  {
    value: "teams",
    label: "Microsoft Teams",
    description: "Teams Incoming Webhook의 Adaptive Card 형식으로 전송합니다.",
    placeholder: "https://example.webhook.office.com/webhookb2/...",
  },
  {
    value: "pagerduty",
    label: "PagerDuty",
    description: "PagerDuty Events API v2 trigger 이벤트로 전송합니다.",
    placeholder: "",
  },
  {
    value: "email",
    label: "Email",
    description: "SMTP를 통해 이메일 경고를 전송합니다.",
    placeholder: "",
  },
] as const;

function parseMultivalueText(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

function ActionResultNotice({ result }: { result: SettingsActionTestResult | null }) {
  if (!result) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        result.success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <p className="font-medium">{result.message}</p>
      {result.detail ? <p className="mt-1 text-xs opacity-90">{result.detail}</p> : null}
    </div>
  );
}

function BackupPreviewGroupList({
  title,
  colorClass,
  items,
}: {
  title: string;
  colorClass: string;
  items: BackupPreviewGroup["creates"];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-700">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colorClass}`}>{items.length}개</span>
      </div>
      {items.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-2">
          <ul className="space-y-1 text-xs text-gray-700">
            {items.map((item) => (
              <li key={`${title}-${item.domain}`} className="flex flex-col">
                <span className="font-medium">{item.name ?? item.domain}</span>
                {item.name ? <span className="font-mono text-[11px] text-gray-500">{item.domain}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-400">없음</p>
      )}
    </div>
  );
}

function BackupPreviewNotice({ result }: { result: BackupPreviewResult | null }) {
  if (!result) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-4">
      <div>
        <p className="font-medium">
          복원 미리보기: 서비스 {result.service_count}개, 리다이렉트 {result.redirect_count}개
        </p>
        <p className="mt-1 text-xs text-blue-800">
          {result.mode === "overwrite"
            ? "덮어쓰기 모드라 기존 항목 삭제 후 백업 내용을 새로 생성합니다."
            : "병합 모드라 기존 항목은 유지하고 같은 도메인만 수정합니다."}
        </p>
      </div>

      {result.warning_count ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <p className="text-xs font-medium">사전 경고 {result.warning_count}개</p>
          <ul className="mt-2 space-y-1 text-xs">
            {result.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-100/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-blue-900">서비스 변경</p>
          <BackupPreviewGroupList
            title="생성"
            colorClass="bg-green-100 text-green-700"
            items={result.services.creates}
          />
          <BackupPreviewGroupList
            title="수정"
            colorClass="bg-amber-100 text-amber-700"
            items={result.services.updates}
          />
          <BackupPreviewGroupList
            title="삭제"
            colorClass="bg-red-100 text-red-700"
            items={result.services.deletes}
          />
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-100/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-blue-900">리다이렉트 변경</p>
          <BackupPreviewGroupList
            title="생성"
            colorClass="bg-green-100 text-green-700"
            items={result.redirect_hosts.creates}
          />
          <BackupPreviewGroupList
            title="수정"
            colorClass="bg-amber-100 text-amber-700"
            items={result.redirect_hosts.updates}
          />
          <BackupPreviewGroupList
            title="삭제"
            colorClass="bg-red-100 text-red-700"
            items={result.redirect_hosts.deletes}
          />
        </div>
      </div>
    </div>
  );
}

function getTurnstileModeLabel(mode: "off" | "always" | "risk_based"): string {
  switch (mode) {
    case "always":
      return "항상 적용";
    case "risk_based":
      return "위험 기반 적용";
    default:
      return "비활성화";
  }
}

function inferUpstreamPresetKey(
  presets: UpstreamSecurityPreset[],
  form: UpstreamSecuritySettingsInput,
): string {
  const matched = presets.find(
    (preset) =>
      preset.dns_strict_mode === form.dns_strict_mode &&
      preset.allowlist_enabled === form.allowlist_enabled &&
      preset.allow_docker_service_names === form.allow_docker_service_names &&
      preset.allow_private_networks === form.allow_private_networks,
  );
  return matched?.key ?? "custom";
}

function applyUpstreamPreset(
  current: UpstreamSecuritySettingsInput & { allowed_domain_suffixes_text: string },
  preset: UpstreamSecurityPreset,
): UpstreamSecuritySettingsInput & { allowed_domain_suffixes_text: string } {
  return {
    ...current,
    dns_strict_mode: preset.dns_strict_mode,
    allowlist_enabled: preset.allowlist_enabled,
    allow_docker_service_names: preset.allow_docker_service_names,
    allow_private_networks: preset.allow_private_networks,
  };
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
  const [cloudflareTestResult, setCloudflareTestResult] = useState<SettingsActionTestResult | null>(null);
  const [securityAlertTestResult, setSecurityAlertTestResult] = useState<SettingsActionTestResult | null>(null);
  const [backupValidationResult, setBackupValidationResult] = useState<BackupValidateResult | null>(null);
  const [backupPreviewResult, setBackupPreviewResult] = useState<BackupPreviewResult | null>(null);

  const [isEditingCf, setIsEditingCf] = useState(false);
  const [cfForm, setCfForm] = useState({ api_token: "", zone_id: "", record_target: "", proxied: false });
  const [isEditingTimeDisplay, setIsEditingTimeDisplay] = useState(false);
  const [timeDisplayForm, setTimeDisplayForm] = useState(getDefaultDisplayTimezone());
  const [timeDisplayErrorMessage, setTimeDisplayErrorMessage] = useState("");
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
  const { data: upstreamSecuritySettings, isLoading: isUpstreamSecurityLoading } = useUpstreamSecuritySettings();
  const { data: loginDefenseSettings, isLoading: isLoginDefenseLoading } = useLoginDefenseSettings();
  const { data: securityAlertSettings, isLoading: isSecurityAlertLoading } = useSecurityAlertSettings();
  const { data: sessionData, isLoading: isSessionsLoading } = useSessions();
  const updateCloudflare = useUpdateCloudflareSettings();
  const testCloudflareConnection = useTestCloudflareConnection();
  const updateTimeDisplay = useUpdateTimeDisplaySettings();
  const updateUpstreamSecurity = useUpdateUpstreamSecuritySettings();
  const updateLoginDefense = useUpdateLoginDefenseSettings();
  const updateSecurityAlert = useUpdateSecurityAlertSettings();
  const testSecurityAlertSettings = useTestSecurityAlertSettings();
  const logoutAllSessions = useLogoutAllSessions();
  const revokeSession = useRevokeSession();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const validateBackup = useValidateBackup();
  const previewBackup = usePreviewBackup();
  const supportedTimeZones = getSupportedTimeZones();
  const upstreamPresets = upstreamSecuritySettings?.available_presets ?? [];
  const selectedUpstreamPresetKey = inferUpstreamPresetKey(upstreamPresets, upstreamSecurityForm);

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
    setCloudflareTestResult(null);
    setIsEditingCf(false);
  };

  const handleTestCf = async () => {
    try {
      setCloudflareTestResult(await testCloudflareConnection.mutateAsync());
    } catch (error) {
      setCloudflareTestResult(buildActionFailure("Cloudflare 연결 테스트에 실패했습니다", getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다")));
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
    });
    setSecurityAlertErrorMessage("");
    setIsEditingSecurityAlert(true);
  };

  const handleSaveSecurityAlert = async () => {
    setSecurityAlertErrorMessage("");
    try {
      await updateSecurityAlert.mutateAsync({
        enabled: securityAlertForm.enabled,
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

  const selectedSecurityAlertProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === securityAlertForm.provider) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];
  const currentSecurityAlertProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === (securityAlertSettings?.provider ?? "generic")) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 text-sm mt-1">시스템 설정</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <SettingsCardHeader
            icon={<Clock3 className="w-5 h-5 text-emerald-600" />}
            title="시간 표시 설정"
            description="저장/토큰/감사로그 원본 시각은 UTC로 유지하고, 화면 표시만 선택한 IANA 타임존으로 변환합니다."
            canEdit={canManage && !isEditingTimeDisplay && !isTimeDisplayLoading}
            onEdit={handleEditTimeDisplay}
          />

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

              <SettingsActionRow>
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
              </SettingsActionRow>
            </div>
          ) : (
            <SettingsSummary>
              <SettingsSummaryRow
                label="현재 표시 시간대"
                value={timeDisplaySettings?.display_timezone || "(미설정)"}
                mono
              />
              <SettingsSummaryRow label="저장 기준" value={`${timeDisplaySettings?.storage_timezone} (고정)`} mono />
              <SettingsSummaryRow
                label="서버 시간대"
                value={`${timeDisplaySettings?.server_timezone_label} (${timeDisplaySettings?.server_timezone_offset})`}
                mono
              />
              <p className="text-xs text-gray-500 pt-1">
                저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로,
                `docker compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
              </p>
            </SettingsSummary>
          )}
        </div>

        <div className="card p-6">
          <SettingsCardHeader
            icon={<ShieldCheck className="w-5 h-5 text-rose-600" />}
            title="업스트림 보안"
            description="DNS strict mode와 allowlist를 조합해 업스트림 저장 정책을 명시적으로 제한합니다. 외부 FQDN은 suffix 기준으로, 내부 서비스명과 사설 IP는 별도 옵션으로 제어합니다."
            canEdit={canManage && !isEditingUpstreamSecurity && !isUpstreamSecurityLoading}
            onEdit={handleEditUpstreamSecurity}
          />

          {isUpstreamSecurityLoading ? (
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingUpstreamSecurity ? (
            <div className="space-y-4">
              <div>
                <label className="label">정책 preset</label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  {upstreamPresets.map((preset) => {
                    const isSelected = selectedUpstreamPresetKey === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        className={`rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? "border-rose-300 bg-rose-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                        onClick={() =>
                          setUpstreamSecurityForm((current) => applyUpstreamPreset(current, preset))
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-gray-900">{preset.name}</span>
                          {isSelected ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                              현재 조합
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  preset을 누르면 권장 조합이 바로 적용됩니다. 이후 세부 옵션을 직접 바꾸면 조합은 자동으로 `사용자 정의`
                  상태가 됩니다.
                </p>
                {selectedUpstreamPresetKey === "custom" ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    현재 조합은 preset과 다르게 직접 조정된 사용자 정의 상태입니다.
                  </p>
                ) : null}
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-rose-600"
                  checked={upstreamSecurityForm.dns_strict_mode}
                  onChange={(e) =>
                    setUpstreamSecurityForm((current) => ({
                      ...current,
                      dns_strict_mode: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">DNS strict mode 활성화</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    도메인 업스트림 저장 시 DNS를 다시 조회해서 loopback, link-local, 문서 예제 대역 같은 금지
                    주소로 해석되는지 검사합니다.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-rose-600"
                  checked={upstreamSecurityForm.allowlist_enabled}
                  onChange={(e) =>
                    setUpstreamSecurityForm((current) => ({
                      ...current,
                      allowlist_enabled: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">업스트림 allowlist 활성화</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    외부 FQDN은 아래 suffix 목록과 일치해야만 저장할 수 있습니다. strict mode와는 별개로 동작합니다.
                  </span>
                </span>
              </label>

              <div>
                <label className="label">허용 도메인 suffix</label>
                <textarea
                  className="input min-h-28 py-3 font-mono text-sm"
                  placeholder={"예:\nexample.com\nhanadays.co.kr"}
                  value={upstreamSecurityForm.allowed_domain_suffixes_text}
                  onChange={(e) =>
                    setUpstreamSecurityForm((current) => ({
                      ...current,
                      allowed_domain_suffixes_text: e.target.value,
                    }))
                  }
                />
                <p className="mt-1 text-xs text-gray-500">줄바꿈 또는 쉼표로 구분합니다. `*.example.com` 입력도 허용됩니다.</p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-rose-600"
                  checked={upstreamSecurityForm.allow_docker_service_names}
                  onChange={(e) =>
                    setUpstreamSecurityForm((current) => ({
                      ...current,
                      allow_docker_service_names: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">Docker 서비스명 허용</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    `vaultwarden`, `open-webui` 같은 점 없는 내부 호스트명을 허용합니다.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-rose-600"
                  checked={upstreamSecurityForm.allow_private_networks}
                  onChange={(e) =>
                    setUpstreamSecurityForm((current) => ({
                      ...current,
                      allow_private_networks: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">사설 IPv4 / Tailscale IP 허용</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `100.64.0.0/10` 대역 IP 리터럴을 허용합니다.
                  </span>
                </span>
              </label>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                <p>기본값은 비활성화입니다.</p>
                <p>권장 사용처: 외부 FQDN을 업스트림으로 자주 등록하는 환경</p>
                <p>주의: allowlist를 켠 상태에서 suffix 목록이 비어 있으면 외부 FQDN은 모두 차단됩니다.</p>
                <p>주의: DNS 조회 실패 시 strict mode가 켜져 있으면 서비스 저장이 차단됩니다.</p>
              </div>

              <SettingsActionRow>
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
              </SettingsActionRow>
            </div>
          ) : (
            <SettingsSummary>
              <SettingsSummaryRow label="정책 preset" value={upstreamSecuritySettings?.preset_name ?? "사용자 정의"} />
              <SettingsSummaryRow
                label="DNS strict mode"
                value={upstreamSecuritySettings?.dns_strict_mode ? "활성화" : "비활성화"}
              />
              <SettingsSummaryRow
                label="업스트림 allowlist"
                value={upstreamSecuritySettings?.allowlist_enabled ? "활성화" : "비활성화"}
              />
              <SettingsSummaryRow
                label="허용 suffix"
                value={
                  upstreamSecuritySettings?.allowed_domain_suffixes?.length
                    ? `${upstreamSecuritySettings.allowed_domain_suffixes.length}개`
                    : "없음"
                }
              />
              <SettingsSummaryRow
                label="Docker 서비스명"
                value={upstreamSecuritySettings?.allow_docker_service_names ? "허용" : "차단"}
              />
              <SettingsSummaryRow
                label="사설 IPv4 / Tailscale IP"
                value={upstreamSecuritySettings?.allow_private_networks ? "허용" : "차단"}
              />
              {upstreamSecuritySettings?.allowed_domain_suffixes?.length ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-600">허용 suffix 목록</p>
                  <div className="flex flex-wrap gap-2">
                    {upstreamSecuritySettings.allowed_domain_suffixes.map((suffix) => (
                      <span
                        key={suffix}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-mono text-[11px] text-gray-700"
                      >
                        {suffix}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-gray-500">{upstreamSecuritySettings?.preset_description}</p>
              <p className="text-xs text-gray-500 pt-1">
                allowlist는 저장 시점에 외부 FQDN, Docker 서비스명, IP 리터럴을 정책대로 제한합니다. strict mode는
                도메인 업스트림을 DNS 재해석해서 금지 주소 여부를 추가로 검사합니다.
              </p>
            </SettingsSummary>
          )}
        </div>

        <div className="card p-6 h-full">
          <SettingsCardHeader
            icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
            title="로그인 방어"
            description="사용자별 계정 잠금은 항상 유지하고, 반복 실패 IP 자동 차단과 선택형 Turnstile 로그인 검증을 함께 조정합니다."
            canEdit={canManage && !isEditingLoginDefense && !isLoginDefenseLoading}
            onEdit={handleEditLoginDefense}
          />

          {isLoginDefenseLoading ? (
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingLoginDefense ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p>
                  계정 잠금 정책: {loginDefenseSettings?.failure_window_minutes}분 동안 {loginDefenseSettings?.max_failed_attempts}
                  회 실패 시 {loginDefenseSettings?.lockout_minutes}분 잠금
                </p>
                <p>
                  이상 징후 기준: {loginDefenseSettings?.suspicious_window_minutes}분 동안 {loginDefenseSettings?.suspicious_failure_count}
                  회 실패 + 서로 다른 사용자명 {loginDefenseSettings?.suspicious_username_count}개 이상
                </p>
                <p>
                  자동 차단 기간: {loginDefenseSettings?.suspicious_block_minutes}분
                </p>
                <p>
                  반복 차단 상승: {loginDefenseSettings?.suspicious_block_escalation_enabled
                    ? `${loginDefenseSettings?.suspicious_block_escalation_window_minutes}분 창 / x${loginDefenseSettings?.suspicious_block_escalation_multiplier} / 최대 ${loginDefenseSettings?.suspicious_block_max_minutes}분`
                    : "비활성화"}
                </p>
                <p>
                  추가 로그인 검증: {getTurnstileModeLabel(loginDefenseSettings?.turnstile_mode ?? "off")}
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-amber-600"
                  checked={loginDefenseForm.suspicious_block_enabled}
                  onChange={(e) =>
                    setLoginDefenseForm((current) => ({
                      ...current,
                      suspicious_block_enabled: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">이상 징후 IP 자동 차단 활성화</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    `login_suspicious`가 기록된 IP는 일정 시간 로그인 단계에서 바로 차단합니다.
                  </span>
                </span>
              </label>

              <div>
                <label className="label">신뢰 네트워크 예외 (CIDR / IP)</label>
                <textarea
                  className="input min-h-28 py-3 font-mono text-sm"
                  placeholder={"예:\n10.0.0.0/8\n192.168.0.0/16\n203.0.113.10"}
                  value={loginDefenseForm.suspicious_trusted_networks_text}
                  onChange={(e) =>
                    setLoginDefenseForm((current) => ({
                      ...current,
                      suspicious_trusted_networks_text: e.target.value,
                    }))
                  }
                />
                <p className="mt-1 text-xs text-gray-500">
                  줄바꿈 또는 쉼표로 구분합니다. 여기에 포함된 IP는 이상 징후 기록과 자동 차단에서 제외됩니다. 사용자별
                  계정 잠금은 그대로 적용됩니다.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-amber-600"
                  checked={loginDefenseForm.suspicious_block_escalation_enabled}
                  onChange={(e) =>
                    setLoginDefenseForm((current) => ({
                      ...current,
                      suspicious_block_escalation_enabled: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">반복 차단 시간 자동 상승</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    같은 IP가 반복해서 다시 차단되면 차단 시간을 자동으로 늘립니다.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label">상승 계산 창 (분)</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={loginDefenseForm.suspicious_block_escalation_window_minutes}
                    onChange={(e) =>
                      setLoginDefenseForm((current) => ({
                        ...current,
                        suspicious_block_escalation_window_minutes: Number(e.target.value || 1),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">반복 배수</label>
                  <input
                    type="number"
                    min={2}
                    className="input"
                    value={loginDefenseForm.suspicious_block_escalation_multiplier}
                    onChange={(e) =>
                      setLoginDefenseForm((current) => ({
                        ...current,
                        suspicious_block_escalation_multiplier: Number(e.target.value || 2),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">최대 차단 시간 (분)</label>
                  <input
                    type="number"
                    min={loginDefenseSettings?.suspicious_block_minutes ?? 30}
                    className="input"
                    value={loginDefenseForm.suspicious_block_max_minutes}
                    onChange={(e) =>
                      setLoginDefenseForm((current) => ({
                        ...current,
                        suspicious_block_max_minutes: Number(e.target.value || (loginDefenseSettings?.suspicious_block_minutes ?? 30)),
                      }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                기본 차단 시간은 {loginDefenseSettings?.suspicious_block_minutes ?? 30}분이며, 반복 차단 시 배수만큼 늘어나되 최대 시간에서 멈춥니다.
              </p>

              <div>
                <label className="label">Cloudflare Turnstile 적용 모드</label>
                <select
                  className="input"
                  value={loginDefenseForm.turnstile_mode}
                  onChange={(e) =>
                    setLoginDefenseForm((current) => ({
                      ...current,
                      turnstile_mode: e.target.value as "off" | "always" | "risk_based",
                    }))
                  }
                >
                  <option value="off">비활성화</option>
                  <option value="always">항상 적용</option>
                  <option value="risk_based">위험 기반 적용</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  위험 기반 적용은 최근 실패가 누적된 IP에서만 Turnstile 검증을 요구합니다.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Turnstile Site Key</label>
                  <input
                    type="text"
                    className="input font-mono text-sm"
                    placeholder="0x4AAAAA..."
                    value={loginDefenseForm.turnstile_site_key}
                    onChange={(e) =>
                      setLoginDefenseForm((current) => ({
                        ...current,
                        turnstile_site_key: e.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">로그인 페이지에 공개로 노출되는 site key입니다.</p>
                </div>
                <div>
                  <label className="label">Turnstile Secret Key</label>
                  <input
                    type="password"
                    className="input font-mono text-sm"
                    placeholder={loginDefenseSettings?.turnstile_secret_key_configured ? "기존 secret 유지" : "secret key 입력"}
                    value={loginDefenseForm.turnstile_secret_key}
                    onChange={(e) =>
                      setLoginDefenseForm((current) => ({
                        ...current,
                        turnstile_secret_key: e.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {loginDefenseSettings?.turnstile_secret_key_configured
                      ? "비워두면 기존 secret key를 유지합니다."
                      : "Cloudflare Turnstile secret key를 입력합니다."}
                  </p>
                </div>
              </div>

              {loginDefenseErrorMessage && <p className="text-xs text-red-600">{loginDefenseErrorMessage}</p>}

              <SettingsActionRow>
                <button
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={handleSaveLoginDefense}
                  disabled={updateLoginDefense.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateLoginDefense.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={() => setIsEditingLoginDefense(false)}
                >
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </SettingsActionRow>
            </div>
          ) : (
            <SettingsSummary>
              <SettingsSummaryRow
                label="계정 잠금 정책"
                value={`${loginDefenseSettings?.failure_window_minutes}분 / ${loginDefenseSettings?.max_failed_attempts}회 실패 시 ${loginDefenseSettings?.lockout_minutes}분 잠금`}
              />
              <SettingsSummaryRow
                label="이상 징후 감지"
                value={`${loginDefenseSettings?.suspicious_window_minutes}분 / ${loginDefenseSettings?.suspicious_failure_count}회 실패 / 사용자명 ${loginDefenseSettings?.suspicious_username_count}개`}
              />
              <SettingsSummaryRow
                label="자동 차단"
                value={
                  loginDefenseSettings?.suspicious_block_enabled
                    ? `${loginDefenseSettings.suspicious_block_minutes}분 활성화`
                    : "비활성화"
                }
              />
              <SettingsSummaryRow
                label="반복 차단 상승"
                value={
                  loginDefenseSettings?.suspicious_block_escalation_enabled
                    ? `${loginDefenseSettings.suspicious_block_escalation_window_minutes}분 창 / x${loginDefenseSettings.suspicious_block_escalation_multiplier} / 최대 ${loginDefenseSettings.suspicious_block_max_minutes}분`
                    : "비활성화"
                }
              />
              <SettingsSummaryRow
                label="추가 로그인 검증"
                value={getTurnstileModeLabel(loginDefenseSettings?.turnstile_mode ?? "off")}
              />
              {loginDefenseSettings?.turnstile_mode !== "off" ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                  <p>모드: {getTurnstileModeLabel(loginDefenseSettings?.turnstile_mode ?? "off")}</p>
                  <p>Site Key: {loginDefenseSettings?.turnstile_site_key || "(미설정)"}</p>
                  <p>Secret Key: {loginDefenseSettings?.turnstile_secret_key_configured ? "설정됨" : "(미설정)"}</p>
                </div>
              ) : null}
              {loginDefenseSettings?.suspicious_trusted_networks?.length ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-600">신뢰 네트워크 예외</p>
                  <div className="flex flex-wrap gap-2">
                    {loginDefenseSettings.suspicious_trusted_networks.map((network) => (
                      <span
                        key={network}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-mono text-[11px] text-gray-700"
                      >
                        {network}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">등록된 신뢰 네트워크 예외가 없습니다.</p>
              )}
              <p className="text-xs text-gray-500">
                신뢰 네트워크 예외는 내부 NAT, VPN, 사내망처럼 반복 실패가 운영 노이즈로 잡힐 수 있는 경로에만 제한적으로
                사용하세요.
              </p>
            </SettingsSummary>
          )}
        </div>

        <div className="card p-6 h-full">
          <SettingsCardHeader
            icon={<Cloud className="w-5 h-5 text-sky-600" />}
            title="보안 알림"
            description="계정 잠금, 이상 징후 로그인, IP 자동 차단 이벤트를 외부 webhook으로 전달합니다."
            canEdit={canManage && !isEditingSecurityAlert && !isSecurityAlertLoading}
            onEdit={handleEditSecurityAlert}
          />

          {isSecurityAlertLoading ? (
            <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ) : isEditingSecurityAlert ? (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded accent-sky-600"
                  checked={securityAlertForm.enabled}
                  onChange={(e) =>
                    setSecurityAlertForm((current) => ({
                      ...current,
                      enabled: e.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">보안 웹훅 알림 활성화</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    보안 경고 이벤트가 발생하면 JSON payload를 webhook endpoint로 전송합니다.
                  </span>
                </span>
              </label>

              <div>
                <label className="label">알림 채널</label>
                <div className="grid gap-2 md:grid-cols-2">
                  {SECURITY_ALERT_PROVIDER_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`rounded-lg border p-3 text-sm cursor-pointer ${
                        securityAlertForm.provider === option.value
                          ? "border-sky-500 bg-sky-50 text-sky-900"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="security-alert-provider"
                        checked={securityAlertForm.provider === option.value}
                        onChange={() =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            provider: option.value,
                          }))
                        }
                      />
                      <span className="block font-medium">{option.label}</span>
                      <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              {securityAlertForm.provider === "telegram" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Bot Token</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="123456:ABCDEF..."
                      value={securityAlertForm.telegram_bot_token}
                      onChange={(e) =>
                        setSecurityAlertForm((current) => ({
                          ...current,
                          telegram_bot_token: e.target.value,
                        }))
                      }
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {securityAlertSettings?.telegram_bot_token_configured
                        ? "비워두면 기존 bot token을 유지합니다."
                        : "Telegram BotFather에서 발급한 bot token을 입력합니다."}
                    </p>
                  </div>
                  <div>
                    <label className="label">Chat ID</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="123456789"
                      value={securityAlertForm.telegram_chat_id}
                      onChange={(e) =>
                        setSecurityAlertForm((current) => ({
                          ...current,
                          telegram_chat_id: e.target.value,
                        }))
                      }
                    />
                    <p className="mt-1 text-xs text-gray-500">알림을 받을 개인/그룹 chat id를 입력합니다.</p>
                  </div>
                </div>
              ) : securityAlertForm.provider === "email" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="label">SMTP Host</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="smtp.example.com"
                        value={securityAlertForm.email_host}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_host: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Port</label>
                      <input
                        type="number"
                        className="input"
                        min={1}
                        max={65535}
                        value={securityAlertForm.email_port}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_port: Number(e.target.value) || 587,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="label">보안 모드</label>
                      <select
                        className="input"
                        value={securityAlertForm.email_security}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_security: e.target.value as "none" | "starttls" | "ssl",
                          }))
                        }
                      >
                        <option value="starttls">STARTTLS</option>
                        <option value="ssl">SSL/TLS</option>
                        <option value="none">없음</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">SMTP Username</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="alerts@example.com"
                        value={securityAlertForm.email_username}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_username: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">SMTP Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="앱 비밀번호 또는 SMTP 비밀번호"
                        value={securityAlertForm.email_password}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_password: e.target.value,
                          }))
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {securityAlertSettings?.email_password_configured
                          ? "비워두면 기존 SMTP 비밀번호를 유지합니다."
                          : "SMTP 인증이 필요하다면 비밀번호를 입력합니다."}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">From</label>
                      <input
                        type="email"
                        className="input"
                        placeholder="alerts@example.com"
                        value={securityAlertForm.email_from}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_from: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Recipients</label>
                      <textarea
                        className="input min-h-[88px]"
                        placeholder={"ops@example.com\nadmin@example.com"}
                        value={securityAlertForm.email_recipients.join("\n")}
                        onChange={(e) =>
                          setSecurityAlertForm((current) => ({
                            ...current,
                            email_recipients: parseMultivalueText(e.target.value),
                          }))
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">줄바꿈 또는 쉼표로 여러 수신자를 구분할 수 있습니다.</p>
                    </div>
                  </div>
                </div>
              ) : securityAlertForm.provider === "pagerduty" ? (
                <div>
                  <label className="label">Routing Key</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="PXXXXXXXXXXXXXXX"
                    value={securityAlertForm.pagerduty_routing_key}
                    onChange={(e) =>
                      setSecurityAlertForm((current) => ({
                        ...current,
                        pagerduty_routing_key: e.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {securityAlertSettings?.pagerduty_routing_key_configured
                      ? "비워두면 기존 routing key를 유지합니다."
                      : "PagerDuty Events API v2 integration key를 입력합니다."}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="label">Webhook URL</label>
                  <input
                    type="url"
                    className="input"
                    placeholder={selectedSecurityAlertProvider.placeholder}
                    value={securityAlertForm.webhook_url}
                    onChange={(e) =>
                      setSecurityAlertForm((current) => ({
                        ...current,
                        webhook_url: e.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedSecurityAlertProvider.description}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p>전송 이벤트: {(securityAlertSettings?.alert_events ?? []).join(", ")}</p>
                <p>전송 타임아웃: {securityAlertSettings?.timeout_seconds ?? 5}초</p>
                <p>알림 실패는 로그인/차단 동작을 막지 않고 서버 로그에만 남습니다.</p>
              </div>

              {securityAlertErrorMessage && <p className="text-xs text-red-600">{securityAlertErrorMessage}</p>}

              <SettingsActionRow>
                <button
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={handleSaveSecurityAlert}
                  disabled={updateSecurityAlert.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateSecurityAlert.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
                  onClick={() => setIsEditingSecurityAlert(false)}
                >
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
              </SettingsActionRow>
            </div>
          ) : (
            <SettingsSummary>
              <SettingsSummaryRow
                label="상태"
                value={securityAlertSettings?.enabled ? "활성화" : "비활성화"}
              />
              <SettingsSummaryRow label="채널" value={currentSecurityAlertProvider.label} />
              {securityAlertSettings?.provider === "telegram" ? (
                <>
                  <SettingsSummaryRow
                    label="Bot Token"
                    value={securityAlertSettings.telegram_bot_token_configured ? "설정됨" : "(미설정)"}
                  />
                  <SettingsSummaryRow
                    label="Chat ID"
                    value={securityAlertSettings.telegram_chat_id || "(미설정)"}
                    mono
                  />
                </>
              ) : securityAlertSettings?.provider === "email" ? (
                <>
                  <SettingsSummaryRow
                    label="SMTP"
                    value={
                      securityAlertSettings.email_host
                        ? `${securityAlertSettings.email_host}:${securityAlertSettings.email_port}`
                        : "(미설정)"
                    }
                    mono
                  />
                  <SettingsSummaryRow label="보안" value={securityAlertSettings.email_security} />
                  <SettingsSummaryRow
                    label="SMTP 계정"
                    value={securityAlertSettings.email_username || "(미설정)"}
                    mono
                  />
                  <SettingsSummaryRow
                    label="비밀번호"
                    value={securityAlertSettings.email_password_configured ? "설정됨" : "(미설정)"}
                  />
                  <SettingsSummaryRow
                    label="From"
                    value={securityAlertSettings.email_from || "(미설정)"}
                    mono
                  />
                  <SettingsSummaryRow
                    label="Recipients"
                    value={
                      securityAlertSettings.email_recipients.length > 0
                        ? securityAlertSettings.email_recipients.join(", ")
                        : "(미설정)"
                    }
                    mono
                  />
                </>
              ) : securityAlertSettings?.provider === "pagerduty" ? (
                <SettingsSummaryRow
                  label="Routing Key"
                  value={securityAlertSettings.pagerduty_routing_key_configured ? "설정됨" : "(미설정)"}
                />
              ) : (
                <SettingsSummaryRow
                  label="Webhook URL"
                  value={securityAlertSettings?.webhook_url || "(미설정)"}
                  mono
                />
              )}
              <SettingsSummaryRow label="포맷" value={currentSecurityAlertProvider.description} />
              <SettingsSummaryRow
                label="전송 이벤트"
                value={(securityAlertSettings?.alert_events ?? []).join(", ")}
              />
              <SettingsSummaryRow label="타임아웃" value={`${securityAlertSettings?.timeout_seconds ?? 5}초`} />
              {canManage ? (
                <SettingsActionRow>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
                    onClick={handleTestSecurityAlert}
                    disabled={testSecurityAlertSettings.isPending}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {testSecurityAlertSettings.isPending ? "전송 중..." : "테스트 알림 전송"}
                  </button>
                </SettingsActionRow>
              ) : null}
              <p className="text-xs text-gray-500">테스트는 현재 저장된 provider 설정 기준으로 즉시 전송됩니다.</p>
              <ActionResultNotice result={securityAlertTestResult} />
              <p className="text-xs text-gray-500">
                알림 실패는 운영 가시성에만 영향을 주고, 로그인 차단/잠금 로직 자체는 중단하지 않습니다.
              </p>
            </SettingsSummary>
          )}
        </div>

        <div className="card p-6 h-full">
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

        {canManage ? <UserManagementSection /> : null}

        <div className="card p-6 h-full">
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
                <SettingsSummaryRow label="Zone ID" value={cloudflareStatus?.zone_id || "(미설정)"} mono />
                <SettingsSummaryRow
                  label="기본 대상"
                  value={cloudflareStatus?.record_target || "(서비스 업스트림 사용)"}
                  mono
                />
                <SettingsSummaryRow
                  label="프록시 모드"
                  value={cloudflareStatus?.proxied ? "활성" : "비활성"}
                />
              </div>
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
                </SettingsActionRow>
              ) : null}
              <p className="text-xs text-gray-500">테스트는 현재 저장된 Cloudflare 설정 기준으로 수행됩니다.</p>
              <ActionResultNotice result={cloudflareTestResult} />
            </SettingsSummary>
          )}
        </div>

        <div className="card p-6 h-full">
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
