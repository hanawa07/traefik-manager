import type { ElementType } from "react";

interface DashboardStatCardProps {
  className?: string;
  icon: ElementType;
  label: string;
  value: number | string;
  color: string;
}

export function DashboardStatCard({
  className = "",
  icon: Icon,
  label,
  value,
  color,
}: DashboardStatCardProps) {
  return (
    <div className={`card p-3 sm:p-4 ${className}`}>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl ${color}`}>
          <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
}
