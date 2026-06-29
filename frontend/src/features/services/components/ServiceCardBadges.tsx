import { Activity, Globe, Lock, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import type { Service, UpstreamHealth } from "../api/serviceApi";

interface ServiceCardBadgesProps {
  service: Service;
  routerActive?: boolean;
  upstreamHealth?: UpstreamHealth;
  certificate?: Certificate;
}

export default function ServiceCardBadges({
  service,
  routerActive,
  upstreamHealth,
  certificate,
}: ServiceCardBadgesProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
      <span
        className={clsx(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          service.tls_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
        )}
      >
        <Globe className="h-3 w-3" />
        {service.tls_enabled ? "TLS 설정" : "TLS 없음"}
      </span>

      <CertificateBadge service={service} certificate={certificate} />
      <AuthBadge service={service} />
      <RouterBadge routerActive={routerActive} />
      <UpstreamHealthBadge upstreamHealth={upstreamHealth} />
    </div>
  );
}

function CertificateBadge({ service, certificate }: { service: Service; certificate?: Certificate }) {
  if (!service.tls_enabled) return null;
  if (!certificate) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        인증서 미확인
      </span>
    );
  }

  const baseClass = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border";
  switch (certificate.status) {
    case "active":
      return <span className={`${baseClass} border-green-200 bg-green-50 text-green-700`}>인증서 정상</span>;
    case "warning":
      return <span className={`${baseClass} border-yellow-200 bg-yellow-50 text-yellow-700`}>인증서 만료 임박</span>;
    case "error":
      return <span className={`${baseClass} border-red-200 bg-red-50 text-red-700`}>인증서 만료</span>;
    case "pending":
      return <span className={`${baseClass} border-blue-200 bg-blue-50 text-blue-700`}>인증서 발급 대기</span>;
    case "inactive":
    default:
      return <span className={`${baseClass} border-slate-200 bg-slate-100 text-slate-600`}>자동 발급 미설정</span>;
  }
}

function AuthBadge({ service }: { service: Service }) {
  if (service.auth_mode === "authentik") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <ShieldCheck className="h-3 w-3" />
        Authentik
      </span>
    );
  }

  if (service.auth_mode === "token") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
        <Lock className="h-3 w-3" />
        Token
      </span>
    );
  }

  if (service.basic_auth_enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <Lock className="h-3 w-3" />
        Basic Auth ({service.basic_auth_user_count})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      <Lock className="h-3 w-3" />
      인증 없음
    </span>
  );
}

function RouterBadge({ routerActive }: { routerActive?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        routerActive === undefined
          ? "bg-gray-100 text-gray-500"
          : routerActive
            ? "bg-emerald-100 text-emerald-700"
            : "bg-rose-100 text-rose-700",
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          routerActive === undefined ? "bg-gray-400" : routerActive ? "bg-emerald-500" : "bg-rose-500",
        )}
      />
      {routerActive === undefined ? "라우터 확인 중" : routerActive ? "라우터 연결됨" : " 라우터 미연결"}
    </span>
  );
}

function UpstreamHealthBadge({ upstreamHealth }: { upstreamHealth?: UpstreamHealth }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        !upstreamHealth
          ? "border-slate-200 bg-slate-50 text-slate-500"
          : upstreamHealth.status === "up"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : upstreamHealth.status === "unknown"
              ? "border-slate-200 bg-slate-50 text-slate-600"
              : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      <Activity
        className={clsx(
          "h-3 w-3",
          !upstreamHealth
            ? "text-slate-400"
            : upstreamHealth.status === "up"
              ? "text-emerald-500"
              : upstreamHealth.status === "unknown"
                ? "text-slate-500"
                : "text-rose-500",
        )}
      />
      {!upstreamHealth ? (
        "업스트림 확인 중"
      ) : upstreamHealth.status === "up" ? (
        <span className="flex items-center gap-0.5">
          UP
          {upstreamHealth.latency_ms !== null && (
            <span className="text-[10px] opacity-60">({upstreamHealth.latency_ms}ms)</span>
          )}
        </span>
      ) : upstreamHealth.status === "unknown" ? (
        "체크 안 함"
      ) : (
        "DOWN"
      )}
    </span>
  );
}
