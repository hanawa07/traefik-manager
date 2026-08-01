"use client";

import { useState } from "react";

import { buildAuditExportUrl, type AuditLogQueryParams } from "@/features/audit/api/auditApi";
import { useAuditPage } from "@/features/audit/hooks/useAudit";

export const ROTATION_CSV_PERIODS = [
  { label: "전체 기간", value: "all" },
  { label: "최근 7일", value: "7" },
  { label: "최근 30일", value: "30" },
  { label: "최근 90일", value: "90" },
  { label: "사용자 지정", value: "custom" },
] as const;
export type RotationCsvPeriod = (typeof ROTATION_CSV_PERIODS)[number]["value"];

export function useAuditRotationExportModel() {
  const [rotationCsvPeriod, setRotationCsvPeriod] = useState<RotationCsvPeriod>("all");
  const [rotationStartDate, setRotationStartDate] = useState("");
  const [rotationEndDate, setRotationEndDate] = useState("");
  const isCustomRotationRange = rotationCsvPeriod === "custom";
  const isRotationRangeValid =
    !isCustomRotationRange ||
    Boolean(rotationStartDate && rotationEndDate && rotationStartDate <= rotationEndDate);
  const smokeRotationFilters: AuditLogQueryParams = {
    event: "smoke_rotation_result",
    period_days:
      rotationCsvPeriod === "all" || isCustomRotationRange
        ? undefined
        : Number(rotationCsvPeriod) as 7 | 30 | 90,
    start_date: isCustomRotationRange ? rotationStartDate || undefined : undefined,
    end_date: isCustomRotationRange ? rotationEndDate || undefined : undefined,
  };
  const smokeRotationExportUrl = buildAuditExportUrl(smokeRotationFilters);
  const rotationCountQuery = useAuditPage(
    { ...smokeRotationFilters, limit: 1, offset: 0 },
    isRotationRangeValid,
  );
  const rotationCount = rotationCountQuery.data?.total;
  const rotationCountStatus = !isRotationRangeValid
    ? "waiting"
    : rotationCountQuery.isFetching
      ? "loading"
      : rotationCountQuery.isError
        ? "error"
        : rotationCount === undefined
          ? "loading"
          : "ready";
  const rotationCountLabel = rotationCountStatus === "waiting"
    ? "시작일과 종료일을 순서대로 선택하세요."
    : rotationCountStatus === "error"
      ? "다운로드 대상 건수를 확인하지 못했습니다."
      : rotationCountStatus === "loading"
        ? "다운로드 대상 건수 확인 중..."
        : rotationCount === 0
          ? "다운로드 대상 0건 · CSV에는 헤더만 포함됩니다."
          : `다운로드 대상 ${(rotationCount ?? 0).toLocaleString("ko-KR")}건`;
  const isEmptyRotationExport = rotationCountStatus === "ready" && rotationCount === 0;
  const latestRotationQuery = useAuditPage(
    { event: "smoke_rotation_result", limit: 1, offset: 0 },
    isEmptyRotationExport,
  );
  const latestRotationFailureQuery = useAuditPage(
    { event: "smoke_rotation_failed", limit: 1, offset: 0 },
    isEmptyRotationExport,
  );
  const latestRotation = latestRotationQuery.data?.items[0];
  const latestRotationDate = latestRotation?.created_at.slice(0, 10);
  const latestRotationStatus = latestRotation?.event === "smoke_rotation_succeeded"
    ? "success"
    : latestRotation?.event === "smoke_rotation_failed"
      ? "failure"
      : null;
  const latestRotationStatusLabel = latestRotationStatus === "success"
    ? "성공"
    : latestRotationStatus === "failure"
      ? "실패"
      : null;
  const latestRotationFailure = latestRotationFailureQuery.data?.items[0];
  const rawLatestRotationFailureStep = latestRotationFailure?.detail?.step;
  const latestRotationFailureStep = latestRotationFailure
    ? typeof rawLatestRotationFailureStep === "string" && rawLatestRotationFailureStep.trim()
      ? rawLatestRotationFailureStep.trim()
      : "알 수 없는 단계"
    : null;
  const latestRotationFailureDate = latestRotationFailure?.created_at.slice(0, 10);
  const latestRotationFailureExportUrl = latestRotationFailureDate
    ? buildAuditExportUrl({
        event: "smoke_rotation_failed",
        start_date: latestRotationFailureDate,
        end_date: latestRotationFailureDate,
      })
    : null;
  const latestRotationFailureDateCountQuery = useAuditPage(
    {
      event: "smoke_rotation_failed",
      start_date: latestRotationFailureDate,
      end_date: latestRotationFailureDate,
      limit: 1,
      offset: 0,
    },
    Boolean(isEmptyRotationExport && latestRotationFailureDate),
  );
  const latestRotationFailureDateCount = latestRotationFailureDateCountQuery.data?.total;
  const latestRotationFailureListUrl = latestRotationFailureDate
    ? `/dashboard/audit?filter=smoke_rotation_failed&start_date=${encodeURIComponent(latestRotationFailureDate)}&end_date=${encodeURIComponent(latestRotationFailureDate)}`
    : null;
  const setRotationRange = (date: string) => {
    setRotationCsvPeriod("custom");
    setRotationStartDate(date);
    setRotationEndDate(date);
  };

  return {
    isCustomRotationRange,
    isEmptyRotationExport,
    isLatestRotationFetching: latestRotationQuery.isFetching,
    isRotationRangeValid,
    latestRotationDate,
    latestRotationFailure,
    latestRotationFailureDate,
    latestRotationFailureDateCount,
    latestRotationFailureExportUrl,
    latestRotationFailureListUrl,
    latestRotationFailureStep,
    latestRotationStatus,
    latestRotationStatusLabel,
    rotationCount,
    rotationCountLabel,
    rotationCountStatus,
    rotationCsvPeriod,
    rotationEndDate,
    rotationStartDate,
    setRotationCsvPeriod,
    setRotationEndDate,
    setRotationRange,
    setRotationStartDate,
    smokeRotationExportUrl,
  };
}
