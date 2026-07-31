import { useEffect, useState } from "react";

import type { RoutingMode, Service } from "@/features/services/api/serviceApi";
import { useBulkUpdateServiceRoutingMode } from "@/features/services/hooks/useServices";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";

interface BulkRoutingFailure {
  operationId: string;
  routingMode: RoutingMode;
  serviceIds: string[];
  serviceNames: string[];
}

interface UseServicesBulkRoutingOptions {
  onNotice: (notice: ToastNoticeValue) => void;
  services: Service[];
  visibleServices: Service[];
}

export function useServicesBulkRouting({
  onNotice,
  services,
  visibleServices,
}: UseServicesBulkRoutingOptions) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [routingMode, setRoutingMode] = useState<RoutingMode>("active");
  const [failure, setFailure] = useState<BulkRoutingFailure | null>(null);
  const update = useBulkUpdateServiceRoutingMode();
  const visibleServiceIds = visibleServices.map((service) => service.id);
  const allVisibleSelected =
    visibleServiceIds.length > 0 && visibleServiceIds.every((id) => selectedServiceIds.includes(id));

  useEffect(() => {
    const existingIds = new Set(services.map((service) => service.id));
    setSelectedServiceIds((current) => {
      const next = current.filter((id) => existingIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [services]);

  const execute = async (
    serviceIds: string[],
    nextRoutingMode: RoutingMode,
    operationId?: string,
    confirmChange = true,
  ) => {
    const label = getRoutingModeLabel(nextRoutingMode);
    if (
      confirmChange &&
      !window.confirm(
        `${serviceIds.length}개 서비스를 '${label}' 상태로 변경합니까?\n\n${getRoutingModeConsequence(nextRoutingMode)}`,
      )
    ) {
      return;
    }

    try {
      const result = await update.mutateAsync({
        services,
        selectedServiceIds: serviceIds,
        routingMode: nextRoutingMode,
        bulkOperationId: operationId,
      });
      if (result.failedServiceIds.length > 0) {
        const serviceNames = result.failedServiceIds.map(
          (id) => services.find((service) => service.id === id)?.name ?? id,
        );
        setSelectedServiceIds(result.failedServiceIds);
        setFailure({
          operationId: result.operationId,
          routingMode: nextRoutingMode,
          serviceIds: result.failedServiceIds,
          serviceNames,
        });
        onNotice({
          tone: "warning",
          message: "운영 상태 일부 변경 실패",
          detail: `${result.successCount}개 적용, ${serviceNames.length}개 실패: ${serviceNames.join(", ")}${result.notificationCompleted ? "" : " · 묶음 알림 요청 실패"}`,
        });
        return;
      }

      setSelectedServiceIds([]);
      setFailure(null);
      onNotice({
        tone: result.notificationCompleted ? "success" : "warning",
        message: result.notificationCompleted
          ? "운영 상태 일괄 변경 완료"
          : "운영 상태 변경 완료, 묶음 알림 요청 실패",
        detail:
          result.successCount > 0
            ? `${result.successCount}개 서비스를 ${label} 상태로 변경했습니다.`
            : "이미 같은 상태여서 변경된 서비스가 없습니다.",
      });
    } catch (error) {
      onNotice({
        tone: "warning",
        message: "운영 상태 일부 변경 실패",
        detail: error instanceof Error ? error.message : "목록을 새로고침한 뒤 다시 시도해 주세요.",
      });
    }
  };

  const clear = () => {
    setSelectedServiceIds([]);
    setFailure(null);
  };

  return {
    allVisibleSelected,
    apply: () => execute(selectedServiceIds, routingMode),
    clear,
    failureNames: failure?.serviceNames ?? [],
    isPending: update.isPending,
    retry: () =>
      failure
        ? execute(failure.serviceIds, failure.routingMode, failure.operationId, false)
        : undefined,
    routingMode,
    selectedCount: selectedServiceIds.length,
    selectedServiceIds,
    selectService: (service: Service, selected: boolean) => {
      setFailure(null);
      setSelectedServiceIds((current) =>
        selected
          ? Array.from(new Set([...current, service.id]))
          : current.filter((id) => id !== service.id),
      );
    },
    setRoutingMode: (mode: RoutingMode) => {
      setRoutingMode(mode);
      setFailure(null);
    },
    toggleVisible: () => {
      setFailure(null);
      const visibleIds = new Set(visibleServiceIds);
      setSelectedServiceIds((current) =>
        allVisibleSelected
          ? current.filter((id) => !visibleIds.has(id))
          : Array.from(new Set([...current, ...visibleServiceIds])),
      );
    },
    visibleCount: visibleServiceIds.length,
  };
}

function getRoutingModeLabel(mode: RoutingMode) {
  if (mode === "disabled") return "라우팅 비활성";
  if (mode === "maintenance") return "점검 안내";
  return "정상 운영";
}

function getRoutingModeConsequence(mode: RoutingMode) {
  if (mode === "disabled") {
    return "선택한 도메인의 Traefik 라우터가 제거되어 외부 요청은 404로 응답합니다.";
  }
  if (mode === "maintenance") {
    return "선택한 도메인은 원래 앱 대신 공개 점검 안내 화면을 제공합니다.";
  }
  return "선택한 도메인이 원래 업스트림 앱으로 다시 연결됩니다.";
}
