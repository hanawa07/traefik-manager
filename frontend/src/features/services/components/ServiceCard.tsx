"use client";
import { Service } from "../api/serviceApi";
import { Lock, Globe, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface ServiceCardProps {
  service: Service;
  onDelete: (service: Service) => void;
}

export default function ServiceCard({ service, onDelete }: ServiceCardProps) {
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
      </div>

      {/* 상태 배지 */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        <span className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          service.tls_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        )}>
          <Globe className="w-3 h-3" />
          {service.tls_enabled ? "HTTPS" : "HTTP"}
        </span>
        <span className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          service.auth_enabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
        )}>
          <Lock className="w-3 h-3" />
          {service.auth_enabled ? "인증 활성" : "인증 없음"}
        </span>
      </div>
    </div>
  );
}
