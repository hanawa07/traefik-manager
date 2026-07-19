import type { LucideIcon } from "lucide-react";
import { CirclePause, Construction, RadioTower } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { RoutingMode } from "../api/serviceApi";
import type { ServiceFormData } from "./serviceFormSchema";

const ROUTING_MODES: {
  value: RoutingMode;
  label: string;
  description: string;
  icon: LucideIcon;
  selectedClassName: string;
}[] = [
  {
    value: "active",
    label: "정상 운영",
    description: "원래 앱으로 연결하고 헬스 체크를 수행합니다.",
    icon: RadioTower,
    selectedClassName: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:ring-2 peer-checked:ring-emerald-500/15 dark:peer-checked:bg-emerald-500/10",
  },
  {
    value: "disabled",
    label: "라우팅 비활성",
    description: "설정은 보존하고 라우터와 장애 알림만 끕니다.",
    icon: CirclePause,
    selectedClassName: "peer-checked:border-slate-500 peer-checked:bg-slate-100 peer-checked:ring-2 peer-checked:ring-slate-500/15 dark:peer-checked:bg-slate-700/50",
  },
  {
    value: "maintenance",
    label: "점검 안내",
    description: "원래 앱 대신 공개 점검 안내 페이지를 표시합니다.",
    icon: Construction,
    selectedClassName: "peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:ring-2 peer-checked:ring-amber-500/15 dark:peer-checked:bg-amber-500/10",
  },
];

export default function ServiceRoutingModeFields({
  errors,
  register,
  routingMode,
}: {
  errors: FieldErrors<ServiceFormData>;
  register: UseFormRegister<ServiceFormData>;
  routingMode: ServiceFormData["routing_mode"];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">서비스 운영 상태</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          컨테이너를 중지해도 설정을 삭제하지 않고 외부 노출 방식만 바꿀 수 있습니다.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {ROUTING_MODES.map((option) => {
          const Icon = option.icon;
          return (
            <label className="cursor-pointer" key={option.value}>
              <input
                {...register("routing_mode")}
                className="peer sr-only"
                type="radio"
                value={option.value}
              />
              <span className={`flex h-full gap-3 rounded-xl border border-slate-200 bg-white p-3 transition peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 ${option.selectedClassName}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {routingMode === "maintenance" ? (
        <div className="mt-4 grid gap-4 border-t border-amber-200 pt-4 dark:border-amber-500/20 lg:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            점검 안내 문구
            <textarea
              {...register("maintenance_message")}
              className="input mt-1 min-h-24 resize-y"
              maxLength={300}
              placeholder="예: 서버 업데이트를 진행하고 있습니다."
            />
            {errors.maintenance_message ? (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-300">
                {errors.maintenance_message.message}
              </span>
            ) : null}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            점검 종료 예정 시각 (한국 시간)
            <input
              {...register("maintenance_until")}
              className="input mt-1"
              type="datetime-local"
            />
            {errors.maintenance_until ? (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-300">
                {errors.maintenance_until.message}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">선택 사항입니다.</span>
            )}
          </label>
        </div>
      ) : null}
    </section>
  );
}
