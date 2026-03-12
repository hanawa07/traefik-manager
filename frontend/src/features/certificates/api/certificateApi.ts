import apiClient from "@/shared/lib/apiClient";

export type CertificateStatus = "active" | "warning" | "error" | "pending" | "inactive";
export type CertificateAcmeErrorKind = "dns" | "rate_limit" | "authorization" | "challenge" | "unknown";
export type CertificatePreflightStatus = "ok" | "warning" | "error";

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
  last_acme_error_at: string | null;
  last_acme_error_message: string | null;
  last_acme_error_kind: CertificateAcmeErrorKind | null;
}

export interface CertificateCheckResult {
  checked_at: string;
  total_count: number;
  warning_count: number;
  error_count: number;
  recorded_event_count: number;
}

export interface CertificatePreflightItem {
  key: "router_detected" | "cert_resolver" | "dns_public" | "http_challenge" | "https_certificate" | "recent_acme_failure";
  label: string;
  status: CertificatePreflightStatus;
  detail: string;
}

export interface CertificatePreflightResult {
  domain: string;
  checked_at: string;
  overall_status: CertificatePreflightStatus;
  recommendation: string;
  items: CertificatePreflightItem[];
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

  preflight: async (domain: string): Promise<CertificatePreflightResult> => {
    const res = await apiClient.post<CertificatePreflightResult>(`/certificates/preflight/${encodeURIComponent(domain)}`);
    return res.data;
  },
};
