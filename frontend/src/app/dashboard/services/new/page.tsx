"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCreateService } from "@/features/services/hooks/useServices";
import ServiceForm from "@/features/services/components/ServiceForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { runServiceSaveDiagnosis, storeServiceSaveDiagnosisNotice } from "../serviceSaveDiagnosis";

export default function NewServicePage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const createService = useCreateService();
  const [isDiagnosingAfterSave, setIsDiagnosingAfterSave] = useState(false);

  const handleSubmit = async (data: Parameters<typeof createService.mutateAsync>[0]) => {
    const service = await createService.mutateAsync(data);
    setIsDiagnosingAfterSave(true);
    const notice = await runServiceSaveDiagnosis(service, "created");
    storeServiceSaveDiagnosisNotice(notice);
    router.push("/dashboard/services");
  };

  if (role === "viewer") {
    return (
      <div className="w-full max-w-5xl">
        <div className="card p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">읽기 전용 계정</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">viewer 계정은 서비스를 추가할 수 없습니다.</p>
          <Link href="/dashboard/services" className="mt-4 inline-flex text-sm text-blue-600 hover:underline">
            서비스 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl">
      <div className="mb-8">
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ChevronLeft className="w-4 h-4" />
          서비스 목록
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">서비스 추가</h1>
        <p className="text-gray-500 text-sm mt-1 dark:text-slate-400">새 Traefik 라우팅 서비스를 등록합니다</p>
      </div>

      <div className="card p-4 sm:p-6 lg:p-8">
        {createService.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-red-600 text-sm dark:text-red-200">
              {(createService.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "서비스 추가 중 오류가 발생했습니다"}
            </p>
          </div>
        )}
        <ServiceForm
          onSubmit={handleSubmit}
          loading={createService.isPending || isDiagnosingAfterSave}
          submitLabel="서비스 추가"
        />
      </div>
    </div>
  );
}
