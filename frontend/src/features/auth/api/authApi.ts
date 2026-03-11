import apiClient from "@/shared/lib/apiClient";
import { UserRole } from "../store/useAuthStore";

export interface LoginResponse {
  username: string;
  role: UserRole;
}

export interface CurrentSessionResponse extends LoginResponse {
  session_id: string;
  issued_at: string;
  expires_at: string;
  idle_expires_at: string;
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const res = await apiClient.post<LoginResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data;
  },

  me: async (): Promise<CurrentSessionResponse> => {
    const res = await apiClient.get<CurrentSessionResponse>("/auth/me");
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },
};
