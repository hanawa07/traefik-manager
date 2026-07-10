"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import ToastNotice, { type ToastNoticeValue } from "@/shared/components/ToastNotice";
import DeleteServiceModal from "./DeleteServiceModal";
import { ServiceSaveDiagnosisBanner } from "./ServiceSaveDiagnosisBanner";
import ServicesListSection from "./ServicesListSection";
import ServicesToolbar from "./ServicesToolbar";
import type { ServiceDiagnosisHistoryMap } from "./serviceGatewayDiagnosisAuditSnapshots";
import {
  consumeServiceSaveDiagnosisNotice,
  readServiceDiagnosisSnapshots,
  type ServiceDiagnosisSnapshotMap,
  type ServiceSaveDiagnosisNotice,
} from "./serviceSaveDiagnosis";
import { useServicesPageModel } from "./useServicesPageModel";

export default function ServicesPage() {
  const model = useServicesPageModel();
  const [saveDiagnosisNotice, setSaveDiagnosisNotice] = useState<ServiceSaveDiagnosisNotice | null>(null);
  const [diagnosisSnapshots, setDiagnosisSnapshots] = useState<ServiceDiagnosisSnapshotMap>({});
  const [toastNotice, setToastNotice] = useState<ToastNoticeValue | null>(null);
  const combinedDiagnosisSnapshots = { ...model.diagnosisSnapshots, ...diagnosisSnapshots };
  const combinedDiagnosisHistories = mergeDiagnosisHistories(model.diagnosisHistories, diagnosisSnapshots);

  useEffect(() => {
    const notice = consumeServiceSaveDiagnosisNotice();
    setSaveDiagnosisNotice(notice);
    setToastNotice(notice ? buildServiceSaveToast(notice) : null);
    setDiagnosisSnapshots(readServiceDiagnosisSnapshots());
  }, []);

  const handleDiagnosisNoticeChange = (notice: ServiceSaveDiagnosisNotice) => {
    setSaveDiagnosisNotice(notice);
    setDiagnosisSnapshots((current) => ({ ...current, [notice.serviceId]: notice }));
  };

  return (
    <div>
      <ToastNotice notice={toastNotice} onClose={() => setToastNotice(null)} />
      {/* 헤더 */}
      <div className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">서비스</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Traefik 라우팅 서비스 관리 ({model.filteredServices.length}/{model.services.length}개)
          </p>
        </div>
        {model.canManage ? (
          <Link href="/dashboard/services/new" className="btn-primary flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            서비스 추가
          </Link>
        ) : null}
      </div>

      {saveDiagnosisNotice ? (
        <ServiceSaveDiagnosisBanner
          canManage={model.canManage}
          notice={saveDiagnosisNotice}
          onClose={() => setSaveDiagnosisNotice(null)}
          onNoticeChange={handleDiagnosisNoticeChange}
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
        diagnosisHistories={combinedDiagnosisHistories}
        diagnosisSnapshots={combinedDiagnosisSnapshots}
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

function buildServiceSaveToast(notice: ServiceSaveDiagnosisNotice): ToastNoticeValue {
  const actionText = notice.action === "created" ? "추가" : "수정";
  const diagnosisStatus = notice.error ? "진단 확인 필요" : getDiagnosisStatusLabel(notice.diagnosis?.status);
  return {
    tone: notice.diagnosis?.status === "fail" || notice.error ? "warning" : "success",
    message: `서비스 ${actionText} 저장 완료`,
    detail: `${notice.domain} · ${diagnosisStatus}`,
  };
}

function getDiagnosisStatusLabel(status?: string) {
  if (status === "ok") return "게이트웨이 진단 정상";
  if (status === "warning") return "게이트웨이 추가 확인 필요";
  if (status === "fail") return "게이트웨이 문제 감지";
  return "게이트웨이 진단 결과 없음";
}

function mergeDiagnosisHistories(
  serverHistories: ServiceDiagnosisHistoryMap,
  localSnapshots: ServiceDiagnosisSnapshotMap,
): ServiceDiagnosisHistoryMap {
  const histories: ServiceDiagnosisHistoryMap = { ...serverHistories };
  for (const notice of Object.values(localSnapshots)) {
    if (!notice.diagnosis) continue;
    const current = histories[notice.serviceId] ?? [];
    const alreadyFirst = current[0]?.checked_at === notice.diagnosis.checked_at;
    histories[notice.serviceId] = alreadyFirst ? current : [notice.diagnosis, ...current].slice(0, 3);
  }
  return histories;
}
