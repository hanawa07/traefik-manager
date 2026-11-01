"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RedirectHostCreate } from "../api/redirectApi";
import { redirectFormSchema, type RedirectFormData } from "./redirectFormSchema";

interface RedirectFormDefaultValues {
  domain?: string;
  target_url?: string;
  permanent?: boolean;
  tls_enabled?: boolean;
}

interface RedirectFormProps {
  defaultValues?: RedirectFormDefaultValues;
  onSubmit: (data: RedirectHostCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

export default function RedirectForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: RedirectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RedirectFormData>({
    resolver: zodResolver(redirectFormSchema),
    defaultValues: {
      domain: defaultValues?.domain || "",
      target_url: defaultValues?.target_url || "",
      permanent: defaultValues?.permanent ?? true,
      tls_enabled: defaultValues?.tls_enabled ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-5">
      <div>
        <label className="label">원본 도메인</label>
        <input className="input" placeholder="예: old.example.com" {...register("domain")} />
        {errors.domain && <p className="text-xs text-red-500 mt-1">{errors.domain.message}</p>}
      </div>

      <div>
        <label className="label">대상 URL</label>
        <input className="input" placeholder="예: https://new.example.com" {...register("target_url")} />
        {errors.target_url && <p className="text-xs text-red-500 mt-1">{errors.target_url.message}</p>}
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">도메인만 입력하면 기본 HTTPS URL로 변환됩니다</p>
      </div>

      <div className="space-y-3 pt-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("tls_enabled")} />
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">HTTPS 엔트리포인트 사용</span>
            <p className="text-xs text-gray-500 dark:text-slate-400">활성화 시 HTTP 요청은 HTTPS로 먼저 전환됩니다</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("permanent")} />
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">영구 리다이렉트 (301)</span>
            <p className="text-xs text-gray-500 dark:text-slate-400">비활성화 시 임시 리다이렉트(302)로 동작합니다</p>
          </div>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary w-full justify-center sm:w-auto" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
