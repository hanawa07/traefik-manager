const CHECKLIST_ITEMS = [
  {
    title: "1. 라우트 감지",
    detail: "Traefik이 이 도메인을 처리하는 라우터를 실제로 읽고 있는지 확인합니다.",
  },
  {
    title: "2. 자동 발급 설정",
    detail: "TLS만 켜져 있어도 충분하지 않습니다. certResolver가 있어야 ACME가 발급을 시도합니다.",
  },
  {
    title: "3. ACME 저장소",
    detail: "인증서가 실제로 저장됐는지, 아직 대기 중인지, 아예 없는지를 구분합니다.",
  },
  {
    title: "4. 최근 실패 사유",
    detail: "DNS timeout, challenge 실패, rate limit 같은 마지막 ACME 실패 원인을 바로 보여줍니다.",
  },
];

export default function CertificateChecklistGuide() {
  return (
    <div className="card mb-6 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">발급 체크리스트 기준</h2>
        <p className="mt-1 text-xs text-gray-500">
          각 인증서 행은 같은 4단계 체크리스트로 읽습니다. 초록은 정상, 파랑은 대기,
          빨강은 바로 확인해야 할 항목입니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
        {CHECKLIST_ITEMS.map((item) => (
          <div key={item.title} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
