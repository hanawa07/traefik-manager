import apiClient from "@/shared/lib/apiClient";

export interface CertificateDiagnosticsSettingsStatus {
  auto_check_interval_minutes: number;
  repeat_alert_threshold: number;
  repeat_alert_window_minutes: number;
  repeat_alert_cooldown_minutes: number;
}

export interface CertificateDiagnosticsSettingsInput {
  auto_check_interval_minutes: number;
  repeat_alert_threshold: number;
  repeat_alert_window_minutes: number;
  repeat_alert_cooldown_minutes: number;
}

export const certificateDiagnosticsSettingsApi = {
  getCertificateDiagnosticsSettings: async (): Promise<CertificateDiagnosticsSettingsStatus> => {
    const res = await apiClient.get<CertificateDiagnosticsSettingsStatus>(
      "/settings/certificate-diagnostics",
    );
    return res.data;
  },

  updateCertificateDiagnosticsSettings: async (
    payload: CertificateDiagnosticsSettingsInput,
  ): Promise<CertificateDiagnosticsSettingsStatus> => {
    const res = await apiClient.put<CertificateDiagnosticsSettingsStatus>(
      "/settings/certificate-diagnostics",
      payload,
    );
    return res.data;
  },
};
