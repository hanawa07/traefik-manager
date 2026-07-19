import { CirclePause, Construction, RadioTower } from "lucide-react";

import type { Service } from "@/features/services/api/serviceApi";
import { countServiceRoutingModes } from "@/features/services/lib/serviceRouting";
import type { HealthFilter } from "./servicesPageTypes";

const STATUS_CARDS = [
  {
    mode: "active" as const,
    label: "정상 운영",
    icon: RadioTower,
    className: "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  {
    mode: "disabled" as const,
    label: "라우팅 비활성",
    icon: CirclePause,
    className: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
  },
  {
    mode: "maintenance" as const,
    label: "점검 안내 중",
    icon: Construction,
    className: "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  },
];

export default function ServiceRoutingSummary({
  services,
  activeFilter,
  onFilterChange,
}: {
  services: Service[];
  activeFilter: HealthFilter;
  onFilterChange: (filter: HealthFilter) => void;
}) {
  const counts = countServiceRoutingModes(services);

  return (
    <section className="mb-5" aria-label="서비스 운영 상태 요약">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">운영 상태</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">전체 {services.length}개</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STATUS_CARDS.map((card) => {
          const Icon = card.icon;
          const selected = activeFilter === card.mode;
          return (
            <button
              aria-pressed={selected}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${card.className} ${selected ? "ring-2 ring-blue-500/50" : ""}`}
              key={card.mode}
              onClick={() => onFilterChange(selected ? "all" : card.mode)}
              type="button"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" />
                {card.label}
              </span>
              <strong className="font-mono text-2xl leading-none">{counts[card.mode]}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
