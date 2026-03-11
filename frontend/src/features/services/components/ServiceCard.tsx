"use client";
import { Service, UpstreamHealth } from "../api/serviceApi";
import { Lock, Globe, ExternalLink, Pencil, Trash2, Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface ServiceCardProps {
  service: Service;
  onDelete: (service: Service) => void;
  routerActive?: boolean;
  canManage?: boolean;
  upstreamHealth?: UpstreamHealth;
}

export default function ServiceCard({
  service,
  onDelete,
  routerActive,
  canManage = true,
  upstreamHealth,
}: ServiceCardProps) {
  const getAuthBadge = () => {
    if (service.auth_mode === "authentik") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <ShieldCheck className="w-3 h-3" />
          Authentik
        </span>
      );
    }
    
    if (service.auth_mode === "token") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
          <Lock className="w-3 h-3" />
          Token
        </span>
      );
    }

    if (service.basic_auth_enabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Lock className="w-3 h-3" />
          Basic Auth ({service.basic_auth_user_count})
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <Lock className="w-3 h-3" />
        인증 없음
      </span>
    );
  };

  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* 도메인 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{service.name}</h3>
            <a
              href={`${service.tls_enabled ? "https" : "http"}://${service.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-500 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="text-sm text-gray-500 truncate">{service.domain}</p>
          <p className="text-xs text-gray-400 mt-1">
            → {service.upstream_host}:{service.upstream_port}
          </p>
        </div>

        {/* 액션 버튼 */}
        {canManage ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              href={`/dashboard/services/${service.id}`}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>
            <button
              onClick={() => onDelete(service)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>

      {/* 상태 배지 */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        <span className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          service.tls_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        )}>
          <Globe className="w-3 h-3" />
          {service.tls_enabled ? "HTTPS" : "HTTP"}
        </span>
        
        {getAuthBadge()}

        <span
          className={clsx(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
            routerActive === undefined
              ? "bg-gray-100 text-gray-500"
              : routerActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
          )}
        >
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              routerActive === undefined
                ? "bg-gray-400"
                : routerActive
                  ? "bg-emerald-500"
                  : "bg-rose-500"
            )}
          />
          {routerActive === undefined ? "라우터 확인 중" : routerActive ? "라우터 연결됨" : " 라우터 미연결"}
          </span>
          <span
          className={clsx(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
            !upstreamHealth
              ? "bg-slate-50 text-slate-500 border-slate-200"
              : upstreamHealth.status === "up"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
          )}
          >
          <Activity className={clsx("w-3 h-3", !upstreamHealth ? "text-slate-400" : upstreamHealth.status === "up" ? "text-emerald-500" : "text-rose-500")} />
          {!upstreamHealth ? (
            "업스트림 확인 중"
          ) : upstreamHealth.status === "up" ? (
            <span className="flex items-center gap-0.5">
              UP
              {upstreamHealth.latency_ms !== null && (
                <span className="opacity-60 text-[10px]">({upstreamHealth.latency_ms}ms)</span>
              )}
            </span>
          ) : (
            "DOWN"
          )}
          </span>
      </div>

      {upstreamHealth?.status === "down" && upstreamHealth.error ? (
        <p className="mt-2 text-[11px] leading-4 text-rose-700 break-words">
          원인: {upstreamHealth.error}
        </p>
      ) : null}
    </div>
  );
}
