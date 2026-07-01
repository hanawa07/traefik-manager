import type { ReactNode } from "react";
import { clsx } from "clsx";

interface SidebarThemeToggleProps {
  isDark: boolean;
  icon: ReactNode;
  onToggle: () => void;
}

export function SidebarThemeToggle({
  isDark,
  icon,
  onToggle,
}: SidebarThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={
        "flex w-full items-center justify-between rounded-2xl border border-white/60 bg-white/40 " +
        "px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 " +
        "hover:bg-white/60 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-200 " +
        "dark:hover:bg-white/[0.08]"
      }
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{isDark ? "다크 모드" : "라이트 모드"}</span>
      </div>
      <div
        className={clsx(
          "relative h-4 w-8 rounded-full transition-colors duration-300",
          isDark ? "bg-brand-primary" : "bg-slate-300",
        )}
      >
        <div
          className={clsx(
            "absolute top-0.5 h-3 w-3 rounded-full !bg-white transition-transform duration-300",
            isDark ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </div>
    </button>
  );
}
