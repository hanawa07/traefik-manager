import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "../api/authApi";

export type UserRole = "admin" | "viewer";

interface AuthState {
  username: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  _initialized: boolean;
  login: (username: string, role: UserRole) => void;
  logout: () => Promise<void>;
  syncSession: () => Promise<void>;
  clearSession: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      username: null,
      role: null,
      isAuthenticated: false,
      _hydrated: false,
      _initialized: false,
      login: (username, role) => {
        localStorage.removeItem("access_token");
        set({ username, role, isAuthenticated: true, _initialized: true });
      },
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // 서버 오류 시에도 로컬 상태는 초기화
        }
        localStorage.removeItem("access_token");
        localStorage.removeItem("auth");
        set({ username: null, role: null, isAuthenticated: false, _initialized: true });
      },
      syncSession: async () => {
        try {
          const session = await authApi.me();
          localStorage.removeItem("access_token");
          set({
            username: session.username,
            role: session.role,
            isAuthenticated: true,
            _initialized: true,
          });
        } catch {
          localStorage.removeItem("access_token");
          set({
            username: null,
            role: null,
            isAuthenticated: false,
            _initialized: true,
          });
        }
      },
      clearSession: () => {
        localStorage.removeItem("access_token");
        set({ username: null, role: null, isAuthenticated: false, _initialized: true });
      },
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "auth",
      onRehydrateStorage: () => (state) => {
        localStorage.removeItem("access_token");
        state?.setHydrated();
      },
    }
  )
);
