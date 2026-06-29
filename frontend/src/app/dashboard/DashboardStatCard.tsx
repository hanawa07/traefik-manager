import type { ElementType } from "react";

interface DashboardStatCardProps {
  icon: ElementType;
  label: string;
  value: number | string;
  color: string;
}

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  color,
}: DashboardStatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
