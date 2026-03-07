import apiClient from "@/shared/lib/apiClient";
import { UserRole } from "../store/useAuthStore";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: UserRole;
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

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },
};
