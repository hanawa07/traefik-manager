"use client";
import { useRouter } from "next/navigation";
import { useCreateService } from "@/features/services/hooks/useServices";
import ServiceForm from "@/features/services/components/ServiceForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

export default function NewServicePage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const createService = useCreateService();

  const handleSubmit = async (data: Parameters<typeof createService.mutateAsync>[0]) => {
    await createService.mutateAsync(data);
    router.push("/dashboard/services");
  };

  if (role === "viewer") {
    return (
      <div className="p-8 max-w-2xl">
        <div className="card p-6">
          <h1 className="text-xl font-semibold text-gray-900">읽기 전용 계정</h1>
          <p className="mt-2 text-sm text-gray-500">viewer 계정은 서비스를 추가할 수 없습니다.</p>
          <Link href="/dashboard/services" className="mt-4 inline-flex text-sm text-blue-600 hover:underline">
            서비스 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          서비스 목록
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">서비스 추가</h1>
        <p className="text-gray-500 text-sm mt-1">새 Traefik 라우팅 서비스를 등록합니다</p>
      </div>

      <div className="card p-6">
        {createService.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-red-600 text-sm">
              {(createService.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "서비스 추가 중 오류가 발생했습니다"}
            </p>
          </div>
        )}
        <ServiceForm
          onSubmit={handleSubmit}
          loading={createService.isPending}
          submitLabel="서비스 추가"
        />
      </div>
    </div>
  );
}
