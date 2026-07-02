import { certificateDiagnosticsSettingsApi } from "./settings-policy-api/certificateDiagnosticsSettingsApi";
import { loginDefenseSettingsApi } from "./settings-policy-api/loginDefenseSettingsApi";
import { timeDisplaySettingsApi } from "./settings-policy-api/timeDisplaySettingsApi";
import { traefikDashboardSettingsApi } from "./settings-policy-api/traefikDashboardSettingsApi";
import { upstreamSecuritySettingsApi } from "./settings-policy-api/upstreamSecuritySettingsApi";

export type {
  CertificateDiagnosticsSettingsInput,
  CertificateDiagnosticsSettingsStatus,
} from "./settings-policy-api/certificateDiagnosticsSettingsApi";
export type {
  LoginDefenseSettingsInput,
  LoginDefenseSettingsStatus,
} from "./settings-policy-api/loginDefenseSettingsApi";
export type {
  TimeDisplaySettingsInput,
  TimeDisplaySettingsStatus,
} from "./settings-policy-api/timeDisplaySettingsApi";
export type {
  TraefikDashboardSettingsInput,
  TraefikDashboardSettingsStatus,
} from "./settings-policy-api/traefikDashboardSettingsApi";
export type {
  UpstreamSecurityPreset,
  UpstreamSecuritySettingsInput,
  UpstreamSecuritySettingsStatus,
} from "./settings-policy-api/upstreamSecuritySettingsApi";

export const policySettingsApi = {
  ...timeDisplaySettingsApi,
  ...certificateDiagnosticsSettingsApi,
  ...traefikDashboardSettingsApi,
  ...upstreamSecuritySettingsApi,
  ...loginDefenseSettingsApi,
};
