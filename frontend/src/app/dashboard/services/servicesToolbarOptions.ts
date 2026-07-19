import type { HealthFilter, SortKey } from "./useServicesPageModel";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "이름" },
  { value: "domain", label: "도메인" },
  { value: "auth", label: "인증 여부" },
  { value: "router", label: "라우터 상태" },
  { value: "health", label: "업스트림 상태" },
  { value: "created_at", label: "생성일" },
];

export const HEALTH_FILTER_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: "all", label: "전체 상태" },
  { value: "down", label: "DOWN만" },
  { value: "up", label: "UP만" },
  { value: "unknown", label: "체크 안 함" },
  { value: "disabled", label: "라우팅 비활성" },
  { value: "maintenance", label: "점검 안내 중" },
  { value: "dns", label: "DNS 실패" },
  { value: "connection_refused", label: "연결 거부" },
  { value: "timeout", label: "타임아웃" },
  { value: "unexpected_status", label: "상태 코드 불일치" },
  { value: "other_error", label: "기타 오류" },
];
