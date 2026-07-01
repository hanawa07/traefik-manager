import type { UserRole } from "@/features/auth/store/useAuthStore";

interface SidebarUserPanelProps {
  username: string | null;
  role: UserRole | null;
}

export function SidebarUserPanel({ username, role }: SidebarUserPanelProps) {
  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl border border-white/20 bg-white/20 px-3 py-2.5 " +
        "dark:border-white/[0.05] dark:bg-white/[0.02]"
      }
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary shadow-lg">
        <span className="text-xs font-bold text-white">
          {username?.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
          {username}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {role === "admin" ? "ADMIN" : "VIEWER"}
        </p>
      </div>
    </div>
  );
}
