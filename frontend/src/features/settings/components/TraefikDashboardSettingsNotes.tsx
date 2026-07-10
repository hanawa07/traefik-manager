export function TraefikDashboardSettingsNotes() {
  return (
    <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
      <p>전제 조건: 외부 Traefik 정적 설정에서 `api.dashboard=true`가 켜져 있어야 합니다.</p>
      <p>보호 방식: 공개 도메인 + HTTPS + Traefik Basic Auth</p>
      <p>도메인 제약: 기존 서비스 또는 리다이렉트에서 사용하는 도메인과 중복될 수 없습니다.</p>
      <p>권장 운영: 디버깅 후 즉시 비활성화</p>
    </div>
  );
}
