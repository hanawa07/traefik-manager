import { AlertTriangle, CheckCircle2, Stethoscope, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { serviceApi } from "@/features/services/api/serviceApi";
import { storeServiceDiagnosisSnapshot, type ServiceSaveDiagnosisNotice } from "./serviceSaveDiagnosis";

interface ServiceSaveDiagnosisBannerProps {
  canManage: boolean;
  notice: ServiceSaveDiagnosisNotice;
  onClose: () => void;
  onNoticeChange: (notice: ServiceSaveDiagnosisNotice) => void;
}

export function ServiceSaveDiagnosisBanner({
  canManage,
  notice,
  onClose,
  onNoticeChange,
}: ServiceSaveDiagnosisBannerProps) {
  const queryClient = useQueryClient();
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const diagnosis = notice.diagnosis;
  const isRoutingModeNotice = diagnosis?.checks.some((check) => check.key === "routing_mode") ?? false;
  const status = notice.error || connectionError ? "warning" : diagnosis?.status ?? "warning";
  const targetNetwork = getTargetNetwork(diagnosis);
  const canConnectNetwork = canManage && Boolean(targetNetwork) && !connectionError;

  const handleConnectNetwork = async () => {
    if (!targetNetwork) return;
    setIsConnecting(true);
    setConnectionMessage(null);
    setConnectionError(null);
    try {
      const connectResult = await serviceApi.connectGatewayNetwork(notice.serviceId);
      const nextDiagnosis = await serviceApi.recordGatewayDiagnosis(notice.serviceId);
      const nextNotice = {
        ...notice,
        checkedAt: new Date().toISOString(),
        diagnosis: nextDiagnosis,
        error: null,
      };
      setConnectionMessage(connectResult.message);
      storeServiceDiagnosisSnapshot(nextNotice);
      onNoticeChange(nextNotice);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "health-all"] }),
        queryClient.invalidateQueries({ queryKey: ["traefik-router-status"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
    } catch (error) {
      setConnectionError(getNetworkConnectErrorMessage(error));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={getBannerClassName(status)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              서비스 {notice.action === "created" ? "추가" : "수정"} 후 {isRoutingModeNotice ? "운영 상태 적용" : "자동 게이트웨이 진단"}
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-700 dark:text-slate-200">
            {notice.domain}: {notice.error ?? diagnosis?.summary ?? "진단 결과가 없습니다."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/dashboard/services/${notice.serviceId}`}
            className="rounded-lg border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:text-blue-300"
          >
            서비스 설정 열기
          </Link>
          {canConnectNetwork ? (
            <button
              type="button"
              onClick={handleConnectNetwork}
              disabled={isConnecting}
              className="rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? "연결 중..." : `${targetNetwork} 연결 실행`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:text-slate-100"
          >
            닫기
          </button>
        </div>
      </div>
      {diagnosis ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {diagnosis.checks.map((check) => (
            <div key={check.key} className="rounded-lg bg-white/75 px-3 py-2 text-xs dark:bg-slate-950/70">
              <div className="flex items-start gap-2">
                <StatusIcon status={check.status} compact />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{check.label}</p>
                  <p className="mt-0.5 break-words text-slate-600 dark:text-slate-300">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {connectionMessage ? <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-200">{connectionMessage}</p> : null}
      {connectionError ? <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-200">{connectionError}</p> : null}
    </div>
  );
}

function StatusIcon({ compact = false, status }: { compact?: boolean; status: string }) {
  const className = compact ? "mt-0.5 h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0";
  if (status === "ok") return <CheckCircle2 className={`${className} text-emerald-600 dark:text-emerald-300`} />;
  if (status === "warning") return <AlertTriangle className={`${className} text-amber-600 dark:text-amber-300`} />;
  if (status === "fail") return <XCircle className={`${className} text-rose-600 dark:text-rose-300`} />;
  return <Stethoscope className={`${className} text-slate-600 dark:text-slate-300`} />;
}

function getBannerClassName(status: string) {
  const base = "mb-5 rounded-2xl border p-4 shadow-sm";
  if (status === "ok") return `${base} border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10`;
  if (status === "fail") return `${base} border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10`;
  return `${base} border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10`;
}

function getTargetNetwork(diagnosis: ServiceSaveDiagnosisNotice["diagnosis"]) {
  const networkCheck = diagnosis?.checks.find((check) => check.key === "docker_network" && check.status === "fail");
  const value = networkCheck?.details.target_network;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNetworkConnectErrorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  if (detail) return detail;
  return "Docker 네트워크 연결을 실행하지 못했습니다.";
}
