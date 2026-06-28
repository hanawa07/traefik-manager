import apiClient from "@/shared/lib/apiClient";

import type { SettingsActionTestResult } from "./settingsSharedTypes";

export interface CloudflareSettingsStatus {
  enabled: boolean;
  configured: boolean;
  zone_count: number;
  zones: CloudflareZoneStatus[];
  message: string;
}

export interface CloudflareZoneStatus {
  zone_id: string;
  zone_name: string | null;
  record_target: string | null;
  proxied: boolean;
}

export interface CloudflareSettingsInput {
  zones: CloudflareZoneInput[];
}

export interface CloudflareZoneInput {
  api_token: string;
  zone_id: string;
  record_target: string;
  proxied: boolean;
}

export interface CloudflareDriftRecord {
  domain: string;
  issue: "missing" | "mismatch" | "orphan";
  detail: string;
  expected_type: string | null;
  expected_content: string | null;
  expected_proxied: boolean | null;
  actual_type: string | null;
  actual_content: string | null;
  actual_proxied: boolean | null;
  record_id: string | null;
}

export interface CloudflareDriftCheckResult {
  success: boolean;
  message: string;
  detail: string | null;
  zone_count: number;
  total_services: number;
  eligible_services: number;
  skipped_services: number;
  healthy_services: number;
  zones: CloudflareDriftZone[];
  excluded_services: CloudflareExcludedService[];
  missing_records: CloudflareDriftRecord[];
  mismatched_records: CloudflareDriftRecord[];
  orphan_records: CloudflareDriftRecord[];
}

export interface CloudflareDriftZone {
  zone_name: string;
  eligible_services: number;
  healthy_services: number;
  missing_records: CloudflareDriftRecord[];
  mismatched_records: CloudflareDriftRecord[];
  orphan_records: CloudflareDriftRecord[];
}

export interface CloudflareExcludedService {
  domain: string;
  reason: string;
}

export const cloudflareSettingsApi = {
  getCloudflareStatus: async (): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.get<CloudflareSettingsStatus>("/settings/cloudflare");
    return res.data;
  },

  updateCloudflareSettings: async (payload: CloudflareSettingsInput): Promise<CloudflareSettingsStatus> => {
    const res = await apiClient.put<CloudflareSettingsStatus>("/settings/cloudflare", payload);
    return res.data;
  },

  testCloudflareConnection: async (): Promise<SettingsActionTestResult> => {
    const res = await apiClient.post<SettingsActionTestResult>("/settings/cloudflare/test");
    return res.data;
  },

  diagnoseCloudflareDnsDrift: async (): Promise<CloudflareDriftCheckResult> => {
    const res = await apiClient.post<CloudflareDriftCheckResult>("/settings/cloudflare/drift");
    return res.data;
  },

  reconcileCloudflareDns: async (): Promise<SettingsActionTestResult> => {
    const res = await apiClient.post<SettingsActionTestResult>("/settings/cloudflare/reconcile");
    return res.data;
  },
};
