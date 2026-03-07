import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "../api/authApi";

export type UserRole = "admin" | "viewer";

interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  login: (token: string, username: string, role: UserRole) => void;
  logout: () => Promise<void>;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      role: null,
      isAuthenticated: false,
      _hydrated: false,
      login: (token, username, role) => {
        localStorage.setItem("access_token", token);
        set({ token, username, role, isAuthenticated: true });
      },
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // 서버 오류 시에도 로컬 상태는 초기화
        }
        localStorage.removeItem("access_token");
        set({ token: null, username: null, role: null, isAuthenticated: false });
      },
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
