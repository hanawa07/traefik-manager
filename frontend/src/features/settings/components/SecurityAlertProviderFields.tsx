import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";
import { parseMultivalueText } from "@/features/settings/lib/settingsFormHelpers";

type SecurityAlertProvider = SecurityAlertSettingsInput["provider"];
type SecurityAlertProviderOption = (typeof SECURITY_ALERT_PROVIDER_OPTIONS)[number];

export function SecurityAlertProviderPicker({
  value,
  onChange,
}: {
  value: SecurityAlertProvider;
  onChange: (provider: SecurityAlertProvider) => void;
}) {
  return (
    <div>
      <label className="label">알림 채널</label>
      <div className="grid gap-2 md:grid-cols-2">
        {SECURITY_ALERT_PROVIDER_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`rounded-lg border p-3 text-sm cursor-pointer ${
              value === option.value
                ? "border-sky-500 bg-sky-50 text-sky-900"
                : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name="security-alert-provider"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="block font-medium">{option.label}</span>
            <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SecurityAlertProviderFields({
  formValue,
  settings,
  selectedProvider,
  updateForm,
}: {
  formValue: SecurityAlertSettingsInput;
  settings?: SecurityAlertSettingsStatus;
  selectedProvider: SecurityAlertProviderOption;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}) {
  if (formValue.provider === "telegram") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SecretField
          label="Bot Token"
          placeholder="123456:ABCDEF..."
          value={formValue.telegram_bot_token}
          help={
            settings?.telegram_bot_token_configured
              ? "비워두면 기존 bot token을 유지합니다."
              : "Telegram BotFather에서 발급한 bot token을 입력합니다."
          }
          onChange={(value) => updateForm({ telegram_bot_token: value })}
        />
        <TextField
          label="Chat ID"
          placeholder="123456789"
          value={formValue.telegram_chat_id}
          help="알림을 받을 개인/그룹 chat id를 입력합니다."
          onChange={(value) => updateForm({ telegram_chat_id: value })}
        />
      </div>
    );
  }

  if (formValue.provider === "email") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="SMTP Host"
            placeholder="smtp.example.com"
            value={formValue.email_host}
            className="md:col-span-2"
            onChange={(value) => updateForm({ email_host: value })}
          />
          <NumberField
            label="Port"
            value={formValue.email_port}
            onChange={(value) => updateForm({ email_port: value || 587 })}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">보안 모드</label>
            <select
              className="input"
              value={formValue.email_security}
              onChange={(event) =>
                updateForm({
                  email_security: event.target.value as SecurityAlertSettingsInput["email_security"],
                })
              }
            >
              <option value="starttls">STARTTLS</option>
              <option value="ssl">SSL/TLS</option>
              <option value="none">없음</option>
            </select>
          </div>
          <TextField
            label="SMTP Username"
            placeholder="alerts@example.com"
            value={formValue.email_username}
            onChange={(value) => updateForm({ email_username: value })}
          />
          <SecretField
            label="SMTP Password"
            placeholder="앱 비밀번호 또는 SMTP 비밀번호"
            value={formValue.email_password}
            help={
              settings?.email_password_configured
                ? "비워두면 기존 SMTP 비밀번호를 유지합니다."
                : "SMTP 인증이 필요하다면 비밀번호를 입력합니다."
            }
            onChange={(value) => updateForm({ email_password: value })}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="From"
            type="email"
            placeholder="alerts@example.com"
            value={formValue.email_from}
            onChange={(value) => updateForm({ email_from: value })}
          />
          <div>
            <label className="label">Recipients</label>
            <textarea
              className="input min-h-[88px]"
              placeholder={"ops@example.com\nadmin@example.com"}
              value={formValue.email_recipients.join("\n")}
              onChange={(event) =>
                updateForm({ email_recipients: parseMultivalueText(event.target.value) })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              줄바꿈 또는 쉼표로 여러 수신자를 구분할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (formValue.provider === "pagerduty") {
    return (
      <SecretField
        label="Routing Key"
        placeholder="PXXXXXXXXXXXXXXX"
        value={formValue.pagerduty_routing_key}
        help={
          settings?.pagerduty_routing_key_configured
            ? "비워두면 기존 routing key를 유지합니다."
            : "PagerDuty Events API v2 integration key를 입력합니다."
        }
        onChange={(value) => updateForm({ pagerduty_routing_key: value })}
      />
    );
  }

  return (
    <TextField
      label="Webhook URL"
      type="url"
      placeholder={selectedProvider.placeholder}
      value={formValue.webhook_url}
      help={selectedProvider.description}
      onChange={(value) => updateForm({ webhook_url: value })}
    />
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  help,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  help?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <p className="mt-1 text-xs text-gray-500">{help}</p> : null}
    </div>
  );
}

function SecretField(props: Omit<Parameters<typeof TextField>[0], "type">) {
  return <TextField {...props} type="password" />;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        min={1}
        max={65535}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
