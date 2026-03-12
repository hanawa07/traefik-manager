import apiClient from "@/shared/lib/apiClient";

export type CertificateStatus = "active" | "warning" | "error";

export interface Certificate {
  domain: string;
  router_names: string[];
  cert_resolvers: string[];
  expires_at: string | null;
  days_remaining: number | null;
  status: CertificateStatus;
  status_message: string;
  status_started_at: string | null;
  alerts_suppressed: boolean;
}

export interface CertificateCheckResult {
  checked_at: string;
  total_count: number;
  warning_count: number;
  error_count: number;
  recorded_event_count: number;
}

export const certificateApi = {
  list: async (): Promise<Certificate[]> => {
    const res = await apiClient.get<Certificate[]>("/certificates/");
    return res.data;
  },

  check: async (): Promise<CertificateCheckResult> => {
    const res = await apiClient.post<CertificateCheckResult>("/certificates/check");
    return res.data;
  },
};
