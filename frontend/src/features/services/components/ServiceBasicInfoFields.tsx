import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Database } from "lucide-react";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceBasicInfoFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  errors: FieldErrors<ServiceFormData>;
  onOpenContainerImportModal: () => void;
}

export default function ServiceBasicInfoFields({
  register,
  errors,
  onOpenContainerImportModal,
}: ServiceBasicInfoFieldsProps) {
  return (
    <>
      <div>
        <label className="label">서비스 이름</label>
        <input className="input" placeholder="예: Portainer" {...register("name")} />
        {errors.name ? <p className="mt-1 text-xs text-red-500">{errors.name.message}</p> : null}
      </div>

      <div>
        <label className="label">도메인</label>
        <input className="input" placeholder="예: portainer.example.com" {...register("domain")} />
        {errors.domain ? <p className="mt-1 text-xs text-red-500">{errors.domain.message}</p> : null}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-200">컨테이너에서 값 가져오기</p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-slate-400">
            신규 서비스는 수동 입력이 기본이며, 기존 컨테이너 정보나 Traefik 라벨을 가져와 빠르게 채울 수
            있습니다
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex w-full shrink-0 items-center justify-center gap-1.5 py-1.5 text-sm sm:w-auto"
          onClick={onOpenContainerImportModal}
        >
          <Database className="h-3.5 w-3.5" />
          컨테이너 정보 가져오기
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)]">
        <div>
          <label className="label">업스트림 호스트</label>
          <input className="input" placeholder="예: 192.168.1.100" {...register("upstream_host")} />
          {errors.upstream_host ? (
            <p className="mt-1 text-xs text-red-500">{errors.upstream_host.message}</p>
          ) : null}
        </div>
        <div>
          <label className="label">포트</label>
          <input type="number" className="input" placeholder="8080" {...register("upstream_port")} />
          {errors.upstream_port ? (
            <p className="mt-1 text-xs text-red-500">{errors.upstream_port.message}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
