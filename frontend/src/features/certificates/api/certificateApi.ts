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
}

export const certificateApi = {
  list: async (): Promise<Certificate[]> => {
    const res = await apiClient.get<Certificate[]>("/certificates/");
    return res.data;
  },
};
