"use client";
import { useServices, useAllServicesHealth } from "@/features/services/hooks/useServices";
import { Server, Lock, Shield, AlertTriangle, Activity } from "lucide-react";
import Link from "next/link";
import { useTraefikHealth, useTraefikRouterStatus } from "@/features/traefik/hooks/useTraefik";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useAuditCertificateSummary, useAuditSecuritySummary } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { useCertificates } from "@/features/certificates/hooks/useCertificates";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: services = [], isLoading } = useServices();
  const { data: healthData = {} } = useAllServicesHealth();
  const { data: traefikHealth } = useTraefikHealth();
  const { data: routerStatus } = useTraefikRouterStatus();
  const { data: securitySummary } = useAuditSecuritySummary({ recent_limit: 3 });
  const { data: certificateSummary } = useAuditCertificateSummary({ recent_limit: 3 });
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const { data: certificates = [] } = useCertificates();

  const totalServices = services.length;
  const authEnabled = services.filter((s) => s.auth_mode !== "none" || s.basic_auth_enabled).length;
  const tlsEnabled = services.filter((s) => s.tls_enabled).length;
  const noAuth = services.filter((s) => s.auth_mode === "none" && !s.basic_auth_enabled).length;
  const upStreamUpCount = Object.values(healthData).filter((h) => h.status === "up").length;
  const certificateWarningCount = certificates.filter((item) => item.status === "warning").length;
  const certificateErrorCount = certificates.filter((item) => item.status === "error").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">Traefik 서비스 현황</p>
      </div>

      <div
        className={`mb-6 rounded-lg border px-4 py-3 ${
          traefikHealth?.connected
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <p className={`text-sm font-medium ${traefikHealth?.connected ? "text-green-700" : "text-red-700"}`}>
          Traefik 상태: {traefikHealth?.connected ? "연결됨" : "연결 안 됨"}
        </p>
        <p className={`text-xs mt-1 ${traefikHealth?.connected ? "text-green-600" : "text-red-600"}`}>
          {traefikHealth?.message || "Traefik 상태를 확인하는 중입니다"}
          {traefikHealth?.version ? ` · 버전 ${traefikHealth.version}` : ""}
        </p>
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">보안 경고 요약</h2>
            <p className="mt-1 text-xs text-gray-500">
              최근 {securitySummary?.window_minutes ?? 1440}분 기준 로그인 방어 이벤트 요약입니다.
            </p>
          </div>
          <Link href="/dashboard/audit" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            감사 로그 보기
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={AlertTriangle} label="로그인 실패" value={securitySummary?.failed_login_count ?? 0} color="bg-slate-500" />
          <StatCard icon={Lock} label="계정 잠금" value={securitySummary?.locked_login_count ?? 0} color="bg-amber-500" />
          <StatCard icon={Shield} label="이상 징후" value={securitySummary?.suspicious_ip_count ?? 0} color="bg-orange-500" />
          <StatCard icon={Server} label="IP 차단" value={securitySummary?.blocked_ip_count ?? 0} color="bg-rose-500" />
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-gray-900">최근 보안 이벤트</h3>
            <span className="text-xs text-gray-500">잠금/이상 징후/IP 차단만 표시</span>
          </div>
          {!securitySummary?.recent_events?.length ? (
            <p className="text-sm text-gray-500">최근 보안 경고가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {securitySummary.recent_events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {event.event === "login_blocked_ip"
                        ? "IP 차단"
                        : event.event === "login_suspicious"
                          ? "이상 징후"
                          : "계정 잠금"}
                      <span className="ml-2 font-normal text-gray-600">{event.resource_name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      actor {event.actor}
                      {event.client_ip ? ` · IP ${event.client_ip}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDateTime(event.created_at, timeDisplaySettings?.display_timezone)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">운영 경고 요약</h2>
            <p className="mt-1 text-xs text-gray-500">
              현재 인증서 상태와 최근 {certificateSummary?.window_minutes ?? 43200}분 기준 경고 전환입니다.
            </p>
          </div>
          <Link href="/dashboard/certificates" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            인증서 보기
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Shield} label="전체 인증서" value={certificates.length} color="bg-slate-500" />
          <StatCard icon={AlertTriangle} label="만료 임박" value={certificateWarningCount} color="bg-amber-500" />
          <StatCard icon={Shield} label="만료됨" value={certificateErrorCount} color="bg-rose-500" />
          <StatCard
            icon={Activity}
            label="최근 경고 전환"
            value={certificateSummary?.recent_events.length ?? 0}
            color="bg-indigo-500"
          />
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-gray-900">최근 인증서 경고</h3>
            <span className="text-xs text-gray-500">만료 임박/만료 전환만 표시</span>
          </div>
          {!certificateSummary?.recent_events?.length ? (
            <p className="text-sm text-gray-500">최근 인증서 경고 전환이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {certificateSummary.recent_events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {event.event === "certificate_error" ? "인증서 만료" : "인증서 만료 임박"}
                      <span className="ml-2 font-normal text-gray-600">{event.resource_name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.days_remaining === null
                        ? "남은 기간 정보 없음"
                        : event.days_remaining < 0
                          ? "이미 만료됨"
                          : `${event.days_remaining}일 남음`}
                      {event.expires_at
                        ? ` · 만료 ${formatDateTime(event.expires_at, timeDisplaySettings?.display_timezone)}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDateTime(event.created_at, timeDisplaySettings?.display_timezone)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard icon={Server} label="전체 서비스" value={totalServices} color="bg-blue-500" />
          <StatCard icon={Activity} label="업스트림 정상" value={upStreamUpCount} color="bg-emerald-500" />
          <StatCard icon={Lock} label="인증 활성" value={authEnabled} color="bg-green-500" />
          <StatCard icon={Shield} label="HTTPS 활성" value={tlsEnabled} color="bg-indigo-500" />
          <StatCard icon={AlertTriangle} label="인증 없는 서비스" value={noAuth} color="bg-amber-500" />
        </div>
      )}

      {/* 최근 서비스 목록 */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">서비스 목록</h2>
          {canManage ? (
            <Link href="/dashboard/services/new" className="btn-primary text-sm py-1.5">
              + 서비스 추가
            </Link>
          ) : null}
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 서비스가 없습니다</p>
            {canManage ? (
              <Link href="/dashboard/services/new" className="text-blue-500 text-sm hover:underline mt-2 inline-block">
                첫 번째 서비스 추가하기
              </Link>
            ) : null}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">서비스</th>
                <th className="px-6 py-3 text-left font-medium">도메인</th>
                <th className="px-6 py-3 text-left font-medium">업스트림</th>
                <th className="px-6 py-3 text-left font-medium">TLS</th>
                <th className="px-6 py-3 text-left font-medium">인증</th>
                <th className="px-6 py-3 text-left font-medium">라우터 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-sm text-gray-900">{service.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{service.domain}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">
                    {service.upstream_host}:{service.upstream_port}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${service.tls_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {service.tls_enabled ? "HTTPS" : "HTTP"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      (service.auth_mode !== "none" || service.basic_auth_enabled) 
                        ? (service.auth_mode === "token" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700") 
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {service.auth_mode === "authentik"
                        ? "Authentik"
                        : service.auth_mode === "token"
                          ? "Token"
                          : service.basic_auth_enabled
                            ? `Basic(${service.basic_auth_user_count})`
                            : "없음"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        routerStatus?.domains?.[service.domain]?.active === undefined
                          ? "bg-gray-100 text-gray-500"
                          : routerStatus?.domains?.[service.domain]?.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {routerStatus?.domains?.[service.domain]?.active === undefined
                        ? "확인 중"
                        : routerStatus?.domains?.[service.domain]?.active
                          ? "연결됨"
                          : "미연결"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
