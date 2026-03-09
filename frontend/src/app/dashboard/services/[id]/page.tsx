"use client";
import { useParams, useRouter } from "next/navigation";
import { useService, useUpdateService } from "@/features/services/hooks/useServices";
import ServiceForm from "@/features/services/components/ServiceForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ServiceUpdate } from "@/features/services/api/serviceApi";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

export default function EditServicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const { data: service, isLoading } = useService(id);
  const updateService = useUpdateService(id);

  const handleSubmit = async (data: ServiceUpdate) => {
    await updateService.mutateAsync(data);
    router.push("/dashboard/services");
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="card p-6 animate-pulse h-80" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-8">
        <p className="text-gray-500">서비스를 찾을 수 없습니다</p>
        <Link href="/dashboard/services" className="text-blue-500 hover:underline text-sm mt-2 inline-block">
          서비스 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (role === "viewer") {
    return (
      <div className="p-8 max-w-2xl">
        <div className="card p-6">
          <h1 className="text-xl font-semibold text-gray-900">읽기 전용 계정</h1>
          <p className="mt-2 text-sm text-gray-500">viewer 계정은 서비스를 수정할 수 없습니다.</p>
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
        <h1 className="text-2xl font-bold text-gray-900">서비스 수정</h1>
        <p className="text-gray-500 text-sm mt-1">{service.domain}</p>
      </div>

      <div className="card p-6">
        {updateService.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-red-600 text-sm">
              {(updateService.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "수정 중 오류가 발생했습니다"}
            </p>
          </div>
        )}
        <ServiceForm
          defaultValues={{
            name: service.name,
            domain: service.domain,
            upstream_host: service.upstream_host,
            upstream_port: service.upstream_port,
            tls_enabled: service.tls_enabled,
            https_redirect_enabled: service.https_redirect_enabled,
            auth_mode: service.auth_mode,
            api_key: service.api_key,
            basic_auth_enabled: service.basic_auth_enabled,
            middleware_template_ids: service.middleware_template_ids,
            allowed_ips: service.allowed_ips,
            blocked_paths: service.blocked_paths,
            rate_limit_average: service.rate_limit_average,
            rate_limit_burst: service.rate_limit_burst,
            custom_headers: service.custom_headers,
            authentik_group_id: service.authentik_group_id,
          }}
          onSubmit={handleSubmit}
          loading={updateService.isPending}
          submitLabel="수정 완료"
        />
      </div>
    </div>
  );
}
