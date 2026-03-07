"use client";

import { useAudit } from "@/features/audit/hooks/useAudit";
import { 
  History, 
  Server, 
  ArrowRightLeft, 
  SlidersHorizontal, 
  User, 
  Search,
  AlertCircle,
  Loader2
} from "lucide-react";
import { clsx } from "clsx";

const resourceTypeConfig = {
  service: { icon: Server, label: "서비스", color: "text-blue-400 bg-blue-400/10" },
  redirect: { icon: ArrowRightLeft, label: "리다이렉트", color: "text-purple-400 bg-purple-400/10" },
  middleware: { icon: SlidersHorizontal, label: "미들웨어", color: "text-orange-400 bg-orange-400/10" },
  user: { icon: User, label: "사용자", color: "text-emerald-400 bg-emerald-400/10" },
};

const actionConfig = {
  create: { label: "생성", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  update: { label: "수정", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  delete: { label: "삭제", color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function AuditLogPage() {
  const { data: logs, isLoading, isError, error } = useAudit({ limit: 50 });

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(dateStr));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>감사 로그를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-red-400 px-6 text-center">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-semibold mb-2">로그 로딩 오류</h3>
        <p className="text-sm text-red-400/70 max-w-md">
          {error instanceof Error ? error.message : "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg border border-slate-700">
          <History className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">감사 로그</h1>
          <p className="text-slate-400 text-sm">시스템의 모든 변경 사항을 추적합니다.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">사용자</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">작업</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">대상 타입</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">대상 이름</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">발생 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    기록된 감사 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const resource = resourceTypeConfig[log.resource_type as keyof typeof resourceTypeConfig];
                  const action = actionConfig[log.action as keyof typeof actionConfig];
                  const ResourceIcon = resource?.icon || Server;

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <span className="text-xs text-slate-300 font-medium">
                              {log.actor.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-white font-medium">{log.actor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "px-2.5 py-1 rounded-md text-[11px] font-bold border",
                          action?.color || "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        )}>
                          {action?.label || log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={clsx("p-1.5 rounded-lg", resource?.color)}>
                            <ResourceIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm text-slate-300">{resource?.label || log.resource_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-white font-medium group-hover:text-blue-400 transition-colors">
                            {log.resource_name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5 opacity-60">
                            {log.resource_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-400">
                          {formatDate(log.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
