import { NumberField, SecretField, TextField } from "@/features/settings/components/SecurityAlertProviderInputFields";
import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";
import type { SecurityAlertProviderFieldProps } from "@/features/settings/components/securityAlertProviderFieldTypes";
import { parseMultivalueText } from "@/features/settings/lib/settingsFormHelpers";

export function SecurityAlertEmailFields({
  formValue,
  settings,
  updateForm,
}: SecurityAlertProviderFieldProps) {
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
