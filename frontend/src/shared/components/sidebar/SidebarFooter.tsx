import { LogOut, Moon, Sun } from "lucide-react";

import type { UserRole } from "@/features/auth/store/useAuthStore";
import { SidebarThemeToggle } from "@/shared/components/sidebar/SidebarThemeToggle";
import { SidebarUserPanel } from "@/shared/components/sidebar/SidebarUserPanel";

interface SidebarFooterProps {
  isDark: boolean;
  username: string | null;
  role: UserRole | null;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export function SidebarFooter({
  isDark,
  username,
  role,
  onToggleTheme,
  onLogout,
}: SidebarFooterProps) {
  return (
    <div className="space-y-4 border-t border-sidebar-border/20 px-4 py-6 dark:border-slate-800">
      <SidebarThemeToggle
        isDark={isDark}
        icon={
          isDark ? (
            <Moon className="h-4 w-4 text-brand-primary" />
          ) : (
            <Sun className="h-4 w-4 text-orange-400" />
          )
        }
        onToggle={onToggleTheme}
      />
      <SidebarUserPanel username={username} role={role} />
      <button
        onClick={onLogout}
        className={
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-500 " +
          "transition-all duration-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
        }
      >
        <LogOut className="h-4 w-4" />
        로그아웃
      </button>
    </div>
  );
}
