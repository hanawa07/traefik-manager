export function CloudflareDnsEditNotice() {
  return (
    <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      <p>멀티존 지원: 여러 Cloudflare zone을 나란히 저장할 수 있습니다.</p>
      <p>
        비Cloudflare 도메인: 저장/드리프트/재동기화 대상에서 자동 제외되며,
        진단 결과에 제외 사유가 표시됩니다.
      </p>
      <p>모든 영역을 비우고 저장하면 Cloudflare 자동 연동 설정이 완전히 초기화됩니다.</p>
    </div>
  );
}
