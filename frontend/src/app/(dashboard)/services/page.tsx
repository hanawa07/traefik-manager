"use client";
import { useState } from "react";
import Link from "next/link";
import { useServices, useDeleteService } from "@/features/services/hooks/useServices";
import ServiceCard from "@/features/services/components/ServiceCard";
import Modal from "@/shared/components/Modal";
import { Service } from "@/features/services/api/serviceApi";
import { Server, Plus } from "lucide-react";

export default function ServicesPage() {
  const { data: services = [], isLoading } = useServices();
  const deleteService = useDeleteService();
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteService.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서비스</h1>
          <p className="text-gray-500 text-sm mt-1">
            Traefik 라우팅 서비스 관리 ({services.length}개)
          </p>
        </div>
        <Link href="/dashboard/services/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          서비스 추가
        </Link>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="card py-20 text-center">
          <Server className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">등록된 서비스가 없습니다</p>
          <p className="text-gray-400 text-sm mt-1">아래 버튼을 눌러 첫 번째 서비스를 추가하세요</p>
          <Link href="/dashboard/services/new" className="btn-primary inline-flex items-center gap-2 mt-4">
            <Plus className="w-4 h-4" />
            서비스 추가
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="서비스 삭제"
      >
        <p className="text-gray-600 text-sm mb-1">
          다음 서비스를 삭제합니다:
        </p>
        <p className="font-semibold text-gray-900 mb-1">{deleteTarget?.name}</p>
        <p className="text-sm text-gray-500 mb-4">{deleteTarget?.domain}</p>
        {deleteTarget?.auth_enabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-amber-700 text-sm">
              ⚠️ Authentik Provider/Application도 함께 삭제됩니다
            </p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            className="btn-danger"
            onClick={handleDelete}
            disabled={deleteService.isPending}
          >
            {deleteService.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
