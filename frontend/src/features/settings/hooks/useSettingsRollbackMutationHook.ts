import {
  type SettingsRollbackActionResult,
  settingsApi,
} from "../api/settingsApi";
import { settingsRollbackInvalidationKeys } from "./settingsQueryKeys";
import { useSettingsMutation } from "./useSettingsMutation";

export function useRollbackSettingsChange() {
  return useSettingsMutation<SettingsRollbackActionResult, string>({
    mutationFn: (auditLogId) => settingsApi.rollbackSettingsChange(auditLogId),
    invalidateKeys: settingsRollbackInvalidationKeys,
  });
}
