import {
  ArrowRightLeft,
  Server,
  Shield,
  SlidersHorizontal,
  User,
  type LucideIcon,
} from "lucide-react";

interface BadgeConfig {
  label: string;
  color: string;
}

interface ResourceTypeConfig extends BadgeConfig {
  icon: LucideIcon;
}

export const fallbackResourceIcon = Server;

export const resourceTypeConfig: Record<string, ResourceTypeConfig> = {
  service: { icon: Server, label: "서비스", color: "border border-blue-200 bg-blue-50 text-blue-700" },
  redirect: { icon: ArrowRightLeft, label: "리다이렉트", color: "border border-purple-200 bg-purple-50 text-purple-700" },
  middleware: {
    icon: SlidersHorizontal,
    label: "미들웨어",
    color: "border border-orange-200 bg-orange-50 text-orange-700",
  },
  user: { icon: User, label: "사용자", color: "border border-emerald-200 bg-emerald-50 text-emerald-700" },
  settings: { icon: SlidersHorizontal, label: "설정", color: "border border-cyan-200 bg-cyan-50 text-cyan-700" },
  certificate: { icon: Shield, label: "인증서", color: "border border-amber-200 bg-amber-50 text-amber-700" },
};

export const actionConfig: Record<string, BadgeConfig> = {
  create: { label: "생성", color: "bg-green-50 text-green-700 border-green-200" },
  update: { label: "수정", color: "bg-blue-50 text-blue-700 border-blue-200" },
  delete: { label: "삭제", color: "bg-red-50 text-red-700 border-red-200" },
  test: { label: "테스트", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  alert: { label: "경고", color: "bg-amber-50 text-amber-700 border-amber-200" },
  rollback: { label: "롤백", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export const securityEventConfig: Record<string, BadgeConfig> = {
  login_failure: { label: "로그인 실패", color: "bg-slate-100 text-slate-700 border-slate-200" },
  login_locked: { label: "계정 잠금", color: "bg-amber-50 text-amber-700 border-amber-200" },
  login_suspicious: { label: "이상 징후", color: "bg-orange-50 text-orange-700 border-orange-200" },
  login_blocked_ip: { label: "IP 차단", color: "bg-red-50 text-red-700 border-red-200" },
  settings_update_cloudflare: { label: "Cloudflare 설정 변경", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  settings_update_time_display: { label: "시간 표시 설정 변경", color: "bg-sky-50 text-sky-700 border-sky-200" },
  settings_update_certificate_diagnostics: {
    label: "인증서 진단 설정 변경",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  settings_update_upstream_security: {
    label: "업스트림 보안 설정 변경",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  settings_update_login_defense: { label: "로그인 방어 설정 변경", color: "bg-violet-50 text-violet-700 border-violet-200" },
  settings_update_security_alert: { label: "보안 알림 설정 변경", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  settings_rollback_time_display: { label: "시간 표시 설정 롤백", color: "bg-amber-50 text-amber-700 border-amber-200" },
  settings_rollback_upstream_security: {
    label: "업스트림 보안 설정 롤백",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  settings_test_cloudflare: { label: "Cloudflare 테스트", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  settings_test_cloudflare_drift: { label: "Cloudflare 드리프트 진단", color: "bg-sky-50 text-sky-700 border-sky-200" },
  settings_test_cloudflare_reconcile: { label: "Cloudflare 재동기화", color: "bg-blue-50 text-blue-700 border-blue-200" },
  settings_test_security_alert: { label: "보안 알림 테스트", color: "bg-sky-50 text-sky-700 border-sky-200" },
  security_alert_delivery_success: { label: "보안 알림 전송 성공", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  security_alert_delivery_failure: { label: "보안 알림 전송 실패", color: "bg-rose-50 text-rose-700 border-rose-200" },
  change_alert_delivery_success: { label: "운영 변경 알림 전송 성공", color: "bg-teal-50 text-teal-700 border-teal-200" },
  change_alert_delivery_failure: { label: "운영 변경 알림 전송 실패", color: "bg-red-50 text-red-700 border-red-200" },
  service_create: { label: "서비스 생성", color: "bg-sky-50 text-sky-700 border-sky-200" },
  service_update: { label: "서비스 변경", color: "bg-blue-50 text-blue-700 border-blue-200" },
  service_delete: { label: "서비스 삭제", color: "bg-red-50 text-red-700 border-red-200" },
  service_rollback: { label: "서비스 롤백", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  service_docker_network_connect: { label: "서비스 Docker 네트워크 연결", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  redirect_create: { label: "리다이렉트 생성", color: "bg-violet-50 text-violet-700 border-violet-200" },
  redirect_update: { label: "리다이렉트 변경", color: "bg-purple-50 text-purple-700 border-purple-200" },
  redirect_delete: { label: "리다이렉트 삭제", color: "bg-pink-50 text-pink-700 border-pink-200" },
  redirect_rollback: { label: "리다이렉트 롤백", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  middleware_create: { label: "미들웨어 생성", color: "bg-orange-50 text-orange-700 border-orange-200" },
  middleware_update: { label: "미들웨어 변경", color: "bg-orange-50 text-orange-700 border-orange-200" },
  middleware_delete: { label: "미들웨어 삭제", color: "bg-red-50 text-red-700 border-red-200" },
  middleware_rollback: { label: "미들웨어 롤백", color: "bg-amber-50 text-amber-700 border-amber-200" },
  user_create: { label: "사용자 생성", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  user_update: { label: "사용자 변경", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  user_delete: { label: "사용자 삭제", color: "bg-rose-50 text-rose-700 border-rose-200" },
  user_rollback: { label: "사용자 롤백", color: "bg-lime-50 text-lime-700 border-lime-200" },
  certificate_warning: { label: "인증서 만료 임박", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  certificate_error: { label: "인증서 만료", color: "bg-red-50 text-red-700 border-red-200" },
  certificate_recovered: { label: "인증서 복구", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  certificate_preflight: { label: "인증서 사전 진단", color: "bg-blue-50 text-blue-700 border-blue-200" },
  certificate_preflight_repeated_failure: { label: "인증서 반복 실패", color: "bg-rose-50 text-rose-700 border-rose-200" },
};
