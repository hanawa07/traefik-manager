import apiClient from "@/shared/lib/apiClient";
import { UserRole } from "../store/useAuthStore";

export interface LoginResponse {
  username: string;
  role: UserRole;
}

export interface LoginProtectionResponse {
  turnstile_enabled: boolean;
  turnstile_site_key: string | null;
}

export interface CurrentSessionResponse extends LoginResponse {
  session_id: string;
  issued_at: string;
  expires_at: string;
  idle_expires_at: string;
}

export interface SessionInfoResponse {
  session_id: string;
  issued_at: string;
  last_seen_at: string | null;
  expires_at: string;
  idle_expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  is_current: boolean;
}

export interface SessionListResponse {
  sessions: SessionInfoResponse[];
}

export const authApi = {
  login: async (username: string, password: string, turnstileToken?: string): Promise<LoginResponse> => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    if (turnstileToken) {
      form.append("cf-turnstile-response", turnstileToken);
    }

    const res = await apiClient.post<LoginResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data;
  },

  getLoginProtection: async (): Promise<LoginProtectionResponse> => {
    const res = await apiClient.get<LoginProtectionResponse>("/auth/login-protection");
    return res.data;
  },

  me: async (): Promise<CurrentSessionResponse> => {
    const res = await apiClient.get<CurrentSessionResponse>("/auth/me");
    return res.data;
  },

  listSessions: async (): Promise<SessionListResponse> => {
    const res = await apiClient.get<SessionListResponse>("/auth/sessions");
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  logoutAll: async (): Promise<void> => {
    await apiClient.post("/auth/logout-all");
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  },
};
