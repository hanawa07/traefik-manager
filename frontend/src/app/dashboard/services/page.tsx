"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import DeleteServiceModal from "./DeleteServiceModal";
import { ServiceSaveDiagnosisBanner } from "./ServiceSaveDiagnosisBanner";
import ServicesListSection from "./ServicesListSection";
import ServicesToolbar from "./ServicesToolbar";
import { consumeServiceSaveDiagnosisNotice, type ServiceSaveDiagnosisNotice } from "./serviceSaveDiagnosis";
import { useServicesPageModel } from "./useServicesPageModel";

export default function ServicesPage() {
  const model = useServicesPageModel();
  const [saveDiagnosisNotice, setSaveDiagnosisNotice] = useState<ServiceSaveDiagnosisNotice | null>(null);

  useEffect(() => {
    setSaveDiagnosisNotice(consumeServiceSaveDiagnosisNotice());
  }, []);

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서비스</h1>
          <p className="text-gray-500 text-sm mt-1">
            Traefik 라우팅 서비스 관리 ({model.filteredServices.length}/{model.services.length}개)
          </p>
        </div>
        {model.canManage ? (
          <Link href="/dashboard/services/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            서비스 추가
          </Link>
        ) : null}
      </div>

      {saveDiagnosisNotice ? (
        <ServiceSaveDiagnosisBanner
          notice={saveDiagnosisNotice}
          onClose={() => setSaveDiagnosisNotice(null)}
        />
      ) : null}

      {/* 검색 + 정렬 툴바 */}
      <ServicesToolbar
        search={model.search}
        healthFilter={model.healthFilter}
        sortKey={model.sortKey}
        sortDir={model.sortDir}
        onSearchChange={model.setSearch}
        onHealthFilterChange={model.setHealthFilter}
        onSortKeyChange={model.setSortKey}
        onSortDirChange={model.setSortDir}
      />

      {/* 목록 */}
      <ServicesListSection
        isLoading={model.isLoading}
        services={model.filteredServices}
        search={model.search}
        canManage={model.canManage}
        routerStatus={model.routerStatus}
        healthMap={model.healthMap}
        healthHistory={model.healthHistory}
        certificateMap={model.certificateMap}
        displayTimeZone={model.displayTimeZone}
        onClearSearch={() => model.setSearch("")}
        onDelete={model.setDeleteTarget}
      />

      {/* 삭제 확인 모달 */}
      <DeleteServiceModal
        service={model.deleteTarget}
        isPending={model.deletePending}
        onClose={() => model.setDeleteTarget(null)}
        onConfirm={model.handleDelete}
      />
    </div>
  );
}
