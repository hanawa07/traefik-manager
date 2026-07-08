import { AlertTriangle, CheckCircle2, Loader2, PlugZap, Stethoscope, XCircle } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import { useState } from "react";

import { useConnectServiceGatewayNetwork, useDiagnoseServiceGateway } from "../hooks/useServices";
import type { Service, ServiceGatewayDiagnosticCheck } from "../api/serviceApi";

interface ServiceGatewayDiagnosisPanelProps {
  service: Service;
  canManage: boolean;
}

export default function ServiceGatewayDiagnosisPanel({ canManage, service }: ServiceGatewayDiagnosisPanelProps) {
  const diagnosis = useDiagnoseServiceGateway();
  const connectNetwork = useConnectServiceGatewayNetwork();
  const [copiedCommand, setCopiedCommand] = useState(false);
  const targetNetwork = getTargetNetwork(diagnosis.data?.checks);
  const networkCommand = buildNetworkConnectCommand(service, diagnosis.data?.checks, targetNetwork);
  const canConnectNetwork = canManage && Boolean(networkCommand);
  const actionableChecks = diagnosis.data?.checks.filter((check) => check.status !== "ok") ?? [];

  const connectNetworkAction = () => {
    connectNetwork.mutate(service.id, {
      onSuccess: () => diagnosis.mutate(service.id),
    });
  };

  const copyNetworkCommand = async () => {
    if (!networkCommand) return;
    await navigator.clipboard.writeText(networkCommand);
    setCopiedCommand(true);
    window.setTimeout(() => setCopiedCommand(false), 2000);
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={diagnosis.isPending}
        onClick={() => diagnosis.mutate(service.id)}
      >
        {diagnosis.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5" />}
        {diagnosis.isPending ? "진단 중" : "Bad Gateway 진단"}
      </button>

      {diagnosis.isError ? (
        <p className="mt-2 text-xs text-rose-700">진단 정보를 가져오지 못했습니다.</p>
      ) : null}

      {diagnosis.data ? (
        <div className={clsx("mt-3 rounded-xl border p-3 text-xs", getPanelClassName(diagnosis.data.status))}>
          <div className="flex items-start gap-2">
            <StatusIcon status={diagnosis.data.status} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{diagnosis.data.summary}</p>
              <p className="mt-0.5 text-[11px] opacity-70">확인 대상: {diagnosis.data.domain}</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {diagnosis.data.checks.map((check) => (
              <DiagnosisCheckRow key={check.key} check={check} />
            ))}
          </div>
          {actionableChecks.length > 0 ? (
            <div className="mt-3 space-y-2">
              {actionableChecks.map((check) => (
                <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2" key={`action-${check.key}`}>
                  <p className="font-semibold text-slate-800">빠른 조치 · {check.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{getActionHint(check, targetNetwork)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      className="rounded-lg border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700"
                      href={`/dashboard/services/${service.id}`}
                    >
                      {getSettingsActionLabel(check.key)}
                    </Link>
                    {check.key === "docker_network" && networkCommand ? (
                      <button
                        className="rounded-lg border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700"
                        onClick={copyNetworkCommand}
                        type="button"
                      >
                        {copiedCommand ? "명령 복사됨" : "네트워크 연결 명령 복사"}
                      </button>
                    ) : null}
                    {check.key === "docker_network" && canConnectNetwork ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={connectNetwork.isPending}
                        onClick={connectNetworkAction}
                        type="button"
                      >
                        {connectNetwork.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PlugZap className="h-3.5 w-3.5" />
                        )}
                        {connectNetwork.isPending ? "연결 중" : `${targetNetwork} 연결 실행`}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {connectNetwork.data ? (
            <p className="mt-2 text-xs font-semibold text-emerald-700">{connectNetwork.data.message}</p>
          ) : null}
          {connectNetwork.isError ? (
            <p className="mt-2 text-xs font-semibold text-rose-700">Docker 네트워크 연결을 실행하지 못했습니다.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DiagnosisCheckRow({ check }: { check: ServiceGatewayDiagnosticCheck }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <div className="flex items-start gap-2">
        <StatusIcon status={check.status} compact />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">{check.label}</p>
          <p className="mt-0.5 break-words text-slate-600">{check.message}</p>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ compact = false, status }: { compact?: boolean; status: string }) {
  const className = compact ? "mt-0.5 h-3.5 w-3.5 shrink-0" : "mt-0.5 h-4 w-4 shrink-0";
  if (status === "ok") return <CheckCircle2 className={`${className} text-emerald-600`} />;
  if (status === "warning") return <AlertTriangle className={`${className} text-amber-600`} />;
  return <XCircle className={`${className} text-rose-600`} />;
}

function getPanelClassName(status: string) {
  if (status === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function getActionHint(check: ServiceGatewayDiagnosticCheck, targetNetwork: string) {
  if (check.key === "traefik_router") {
    return "도메인 라우터가 런타임에 없거나 비활성입니다. 서비스 저장값과 Traefik 반영 상태를 확인하세요.";
  }
  if (check.key === "upstream_http") return getUpstreamActionHint(check);
  if (check.key === "docker_network") {
    return `업스트림 컨테이너가 ${targetNetwork} 네트워크에서 Traefik과 통신 가능해야 합니다.`;
  }
  return "서비스 설정값을 확인하세요.";
}

function getUpstreamActionHint(check: ServiceGatewayDiagnosticCheck) {
  const errorKind = getDetailString(check.details, "error_kind");
  if (errorKind === "dns") return "업스트림 호스트명이 컨테이너 DNS나 외부 DNS에서 해석되는지 확인하세요.";
  if (errorKind === "connection_refused") return "호스트는 찾았지만 포트가 닫혀 있습니다. 컨테이너 내부 포트와 앱 실행 상태를 확인하세요.";
  if (errorKind === "connection_timeout") return "네트워크 연결 시간이 초과됐습니다. 방화벽, Docker 네트워크, 대상 컨테이너 응답을 확인하세요.";
  if (errorKind === "request_timeout") return "연결 후 응답이 늦습니다. 헬스 체크 경로와 타임아웃 값을 확인하세요.";
  if (errorKind === "unexpected_status") return "응답은 왔지만 기대 상태 코드와 다릅니다. 헬스 체크 경로나 기대 코드를 조정하세요.";
  return "업스트림 호스트, 포트, 프로토콜 또는 헬스 체크 경로가 맞는지 확인하세요.";
}

function getDetailString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : null;
}

function getSettingsActionLabel(key: string) {
  if (key === "traefik_router") return "라우팅 설정 열기";
  if (key === "upstream_http") return "업스트림 설정 열기";
  if (key === "docker_network") return "컨테이너 설정 열기";
  return "서비스 설정 열기";
}

function buildNetworkConnectCommand(service: Service, checks: ServiceGatewayDiagnosticCheck[] | undefined, targetNetwork: string) {
  const networkCheck = checks?.find((check) => check.key === "docker_network" && check.status === "fail");
  if (!networkCheck) return null;

  return `docker network connect ${targetNetwork} ${service.upstream_host}`;
}

function getTargetNetwork(checks?: ServiceGatewayDiagnosticCheck[]) {
  const networkCheck = checks?.find((check) => check.key === "docker_network");
  const value = networkCheck?.details.target_network;
  return typeof value === "string" && value.trim() ? value.trim() : "proxy_net";
}
