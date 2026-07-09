import type { Service } from "@/features/services/api/serviceApi";

export function getDashboardServiceAuthLabel(service: Service) {
  if (service.auth_mode === "authentik") return "Authentik";
  if (service.auth_mode === "token") return "Token";
  if (service.basic_auth_enabled) return `Basic(${service.basic_auth_user_count})`;
  return "없음";
}

export function getDashboardServiceAuthClassName(service: Service) {
  if (service.auth_mode === "token") return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200";
  if (service.auth_mode !== "none" || service.basic_auth_enabled) return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200";
  return "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400";
}

export function getDashboardRouterStatusLabel(active: boolean | undefined) {
  if (active === undefined) return "확인 중";
  return active ? "연결됨" : "미연결";
}

export function getDashboardRouterStatusClassName(active: boolean | undefined) {
  if (active === undefined) return "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400";
  return active
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
    : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
}
