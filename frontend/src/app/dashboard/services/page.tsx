"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import type { RoutingMode, Service } from "@/features/services/api/serviceApi";
import { useBulkUpdateServiceRoutingMode } from "@/features/services/hooks/useServices";
import ToastNotice, { type ToastNoticeValue } from "@/shared/components/ToastNotice";
import DeleteServiceModal from "./DeleteServiceModal";
import { ServiceSaveDiagnosisBanner } from "./ServiceSaveDiagnosisBanner";
import ServiceBulkRoutingActions from "./ServiceBulkRoutingActions";
import ServicesListSection from "./ServicesListSection";
import ServiceRoutingSummary from "./ServiceRoutingSummary";
import ServicesToolbar from "./ServicesToolbar";
import type { ServiceDiagnosisHistoryMap } from "./serviceGatewayDiagnosisAuditSnapshots";
import {
  consumeServiceSaveDiagnosisNotice,
  readServiceDiagnosisSnapshots,
  type ServiceDiagnosisSnapshotMap,
  type ServiceSaveDiagnosisNotice,
} from "./serviceSaveDiagnosis";
import { useServicesPageModel } from "./useServicesPageModel";

interface BulkRoutingFailure {
  operationId: string;
  routingMode: RoutingMode;
  serviceIds: string[];
  serviceNames: string[];
}

export default function ServicesPage() {
  const model = useServicesPageModel();
  const [saveDiagnosisNotice, setSaveDiagnosisNotice] = useState<ServiceSaveDiagnosisNotice | null>(null);
  const [diagnosisSnapshots, setDiagnosisSnapshots] = useState<ServiceDiagnosisSnapshotMap>({});
  const [toastNotice, setToastNotice] = useState<ToastNoticeValue | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [bulkRoutingMode, setBulkRoutingMode] = useState<RoutingMode>("active");
  const [bulkRoutingFailure, setBulkRoutingFailure] = useState<BulkRoutingFailure | null>(null);
  const bulkRoutingUpdate = useBulkUpdateServiceRoutingMode();
  const combinedDiagnosisSnapshots = { ...model.diagnosisSnapshots, ...diagnosisSnapshots };
  const combinedDiagnosisHistories = mergeDiagnosisHistories(model.diagnosisHistories, diagnosisSnapshots);
  const visibleServiceIds = model.filteredServices.map((service) => service.id);
  const allVisibleSelected =
    visibleServiceIds.length > 0 && visibleServiceIds.every((id) => selectedServiceIds.includes(id));

  useEffect(() => {
    const notice = consumeServiceSaveDiagnosisNotice();
    setSaveDiagnosisNotice(notice);
    setToastNotice(notice ? buildServiceSaveToast(notice) : null);
    setDiagnosisSnapshots(readServiceDiagnosisSnapshots());
  }, []);

  useEffect(() => {
    const existingIds = new Set(model.services.map((service) => service.id));
    setSelectedServiceIds((current) => {
      const next = current.filter((id) => existingIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [model.services]);

  const handleDiagnosisNoticeChange = (notice: ServiceSaveDiagnosisNotice) => {
    setSaveDiagnosisNotice(notice);
    setDiagnosisSnapshots((current) => ({ ...current, [notice.serviceId]: notice }));
  };

  const handleServiceSelection = (service: Service, selected: boolean) => {
    setBulkRoutingFailure(null);
    setSelectedServiceIds((current) =>
      selected
        ? Array.from(new Set([...current, service.id]))
        : current.filter((id) => id !== service.id),
    );
  };

  const handleToggleVisibleSelection = () => {
    setBulkRoutingFailure(null);
    const visibleIds = new Set(visibleServiceIds);
    setSelectedServiceIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.has(id))
        : Array.from(new Set([...current, ...visibleServiceIds])),
    );
  };

  const executeBulkRoutingUpdate = async (
    serviceIds: string[],
    routingMode: RoutingMode,
    operationId?: string,
    confirmChange = true,
  ) => {
    const label = getRoutingModeLabel(routingMode);
    const consequence = getRoutingModeConsequence(routingMode);
    if (
      confirmChange &&
      !window.confirm(`${serviceIds.length}개 서비스를 '${label}' 상태로 변경합니까?\n\n${consequence}`)
    ) return;

    try {
      const result = await bulkRoutingUpdate.mutateAsync({
        services: model.services,
        selectedServiceIds: serviceIds,
        routingMode,
        bulkOperationId: operationId,
      });
      if (result.failedServiceIds.length > 0) {
        const serviceNames = result.failedServiceIds.map(
          (id) => model.services.find((service) => service.id === id)?.name ?? id,
        );
        setSelectedServiceIds(result.failedServiceIds);
        setBulkRoutingFailure({
          operationId: result.operationId,
          routingMode,
          serviceIds: result.failedServiceIds,
          serviceNames,
        });
        setToastNotice({
          tone: "warning",
          message: "운영 상태 일부 변경 실패",
          detail: `${result.successCount}개 적용, ${serviceNames.length}개 실패: ${serviceNames.join(", ")}${result.notificationCompleted ? "" : " · 묶음 알림 요청 실패"}`,
        });
        return;
      }
      setSelectedServiceIds([]);
      setBulkRoutingFailure(null);
      setToastNotice({
        tone: result.notificationCompleted ? "success" : "warning",
        message: result.notificationCompleted
          ? "운영 상태 일괄 변경 완료"
          : "운영 상태 변경 완료, 묶음 알림 요청 실패",
        detail: result.successCount > 0 ? `${result.successCount}개 서비스를 ${label} 상태로 변경했습니다.` : "이미 같은 상태여서 변경된 서비스가 없습니다.",
      });
    } catch (error) {
      setToastNotice({
        tone: "warning",
        message: "운영 상태 일부 변경 실패",
        detail: error instanceof Error ? error.message : "목록을 새로고침한 뒤 다시 시도해 주세요.",
      });
    }
  };

  const handleBulkRoutingApply = () =>
    executeBulkRoutingUpdate(selectedServiceIds, bulkRoutingMode);

  const handleBulkRoutingRetry = () => {
    if (!bulkRoutingFailure) return;
    return executeBulkRoutingUpdate(
      bulkRoutingFailure.serviceIds,
      bulkRoutingFailure.routingMode,
      bulkRoutingFailure.operationId,
      false,
    );
  };

  const handleBulkRoutingModeChange = (mode: RoutingMode) => {
    setBulkRoutingMode(mode);
    setBulkRoutingFailure(null);
  };

  const handleClearSelection = () => {
    setSelectedServiceIds([]);
    setBulkRoutingFailure(null);
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

      {!model.isLoading ? (
        <ServiceRoutingSummary
          services={model.services}
          activeFilter={model.healthFilter}
          onFilterChange={model.setHealthFilter}
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

      {model.canManage && !model.isLoading ? (
        <ServiceBulkRoutingActions
          allVisibleSelected={allVisibleSelected}
          failureNames={bulkRoutingFailure?.serviceNames ?? []}
          isPending={bulkRoutingUpdate.isPending}
          onApply={handleBulkRoutingApply}
          onClear={handleClearSelection}
          onRetry={handleBulkRoutingRetry}
          onRoutingModeChange={handleBulkRoutingModeChange}
          onToggleVisible={handleToggleVisibleSelection}
          routingMode={bulkRoutingMode}
          selectedCount={selectedServiceIds.length}
          visibleCount={visibleServiceIds.length}
        />
      ) : null}

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
        selectedServiceIds={selectedServiceIds}
        onClearSearch={() => model.setSearch("")}
        onDelete={model.setDeleteTarget}
        onSelectionChange={handleServiceSelection}
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

function getRoutingModeLabel(mode: RoutingMode) {
  if (mode === "disabled") return "라우팅 비활성";
  if (mode === "maintenance") return "점검 안내";
  return "정상 운영";
}

function getRoutingModeConsequence(mode: RoutingMode) {
  if (mode === "disabled") return "선택한 도메인의 Traefik 라우터가 제거되어 외부 요청은 404로 응답합니다.";
  if (mode === "maintenance") return "선택한 도메인은 원래 앱 대신 공개 점검 안내 화면을 제공합니다.";
  return "선택한 도메인이 원래 업스트림 앱으로 다시 연결됩니다.";
}

function buildServiceSaveToast(notice: ServiceSaveDiagnosisNotice): ToastNoticeValue {
  const actionText = notice.action === "created" ? "추가" : "수정";
  const routingModeNotice = notice.diagnosis?.checks.some((check) => check.key === "routing_mode");
  const diagnosisStatus = notice.error
    ? "진단 확인 필요"
    : routingModeNotice
      ? notice.diagnosis?.summary
      : getDiagnosisStatusLabel(notice.diagnosis?.status);
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
