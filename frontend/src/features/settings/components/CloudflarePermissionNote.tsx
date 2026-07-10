export function CloudflarePermissionNote() {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="font-medium">추가 권한 안내</p>
      <p className="mt-1">권한 구성 예시:</p>
      <ul className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
        <li>
          - 리소스: <strong>영역(Zone)</strong> / 권한: <strong>DNS 설정(Edit)</strong>
        </li>
        <li>
          - 리소스: <strong>영역(Zone)</strong> / 권한: <strong>영역(Read)</strong>
        </li>
        <li>
          - 리소스: <strong>영역(Zone)</strong> / 권한: <strong>DNS(Read)</strong>
        </li>
      </ul>
      <p className="mt-1 text-amber-800 dark:text-amber-200">
        연결 테스트는 zone 접근만 확인하지만, 드리프트 진단은 DNS 레코드 목록까지 조회합니다.
        따라서 연결 테스트가 통과해도 <strong>DNS:Read</strong>가 없으면 드리프트 진단은 실패할 수 있습니다.
      </p>
      <p className="mt-1 text-amber-800 dark:text-amber-200">
        드리프트 진단 결과가 <strong>드리프트 0개</strong>로 나오면, Cloudflare 관리 대상 도메인의
        DNS가 현재 목표 상태와 일치한다는 뜻입니다.
      </p>
    </div>
  );
}
