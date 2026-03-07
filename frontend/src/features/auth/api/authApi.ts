import apiClient from "@/shared/lib/apiClient";

export const authApi = {
  login: async (username: string, password: string): Promise<string> => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const res = await apiClient.post<{ access_token: string }>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data.access_token;
  },
};
