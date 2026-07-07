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
            <h2 className="text-sm font-semibold text-gray-900">
              서비스 {notice.action === "created" ? "추가" : "수정"} 후 자동 게이트웨이 진단
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-700">
            {notice.domain}: {notice.error ?? diagnosis?.summary ?? "진단 결과가 없습니다."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/dashboard/services/${notice.serviceId}`}
            className="rounded-lg border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700"
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
            className="rounded-lg border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            닫기
          </button>
        </div>
      </div>
      {diagnosis ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {diagnosis.checks.map((check) => (
            <div key={check.key} className="rounded-lg bg-white/75 px-3 py-2 text-xs">
              <div className="flex items-start gap-2">
                <StatusIcon status={check.status} compact />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{check.label}</p>
                  <p className="mt-0.5 break-words text-slate-600">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {connectionMessage ? <p className="mt-3 text-xs font-semibold text-emerald-700">{connectionMessage}</p> : null}
      {connectionError ? <p className="mt-3 text-xs font-semibold text-rose-700">{connectionError}</p> : null}
    </div>
  );
}

function StatusIcon({ compact = false, status }: { compact?: boolean; status: string }) {
  const className = compact ? "mt-0.5 h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0";
  if (status === "ok") return <CheckCircle2 className={`${className} text-emerald-600`} />;
  if (status === "warning") return <AlertTriangle className={`${className} text-amber-600`} />;
  if (status === "fail") return <XCircle className={`${className} text-rose-600`} />;
  return <Stethoscope className={`${className} text-slate-600`} />;
}

function getBannerClassName(status: string) {
  const base = "mb-5 rounded-2xl border p-4 shadow-sm";
  if (status === "ok") return `${base} border-emerald-200 bg-emerald-50`;
  if (status === "fail") return `${base} border-rose-200 bg-rose-50`;
  return `${base} border-amber-200 bg-amber-50`;
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
