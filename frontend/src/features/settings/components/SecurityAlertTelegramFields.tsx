import { SecretField, TextField } from "@/features/settings/components/SecurityAlertProviderInputFields";
import type { SecurityAlertProviderFieldProps } from "@/features/settings/components/securityAlertProviderFieldTypes";

export function SecurityAlertTelegramFields({
  formValue,
  settings,
  updateForm,
}: SecurityAlertProviderFieldProps) {
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
