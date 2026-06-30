import type { Certificate } from "@/features/certificates/api/certificateApi";

export function getCertificateChecklistAction(certificate: Certificate) {
  if (certificate.last_acme_error_kind === "dns") {
    return "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요.";
  }

  if (
    certificate.last_acme_error_kind === "authorization" ||
    certificate.last_acme_error_kind === "challenge"
  ) {
    return "80/443 공개 상태와 challenge 경로 응답을 먼저 확인하세요.";
  }

  if (certificate.last_acme_error_kind === "rate_limit") {
    return "반복 발급을 멈추고 잠시 뒤 다시 검사하세요.";
  }

  if (certificate.router_names.length === 0) {
    return "도메인 라우트가 실제로 생성됐는지 먼저 확인하세요.";
  }

  if (certificate.cert_resolvers.length === 0) {
    return "TLS 설정과 certResolver 연결부터 확인하세요.";
  }

  if (certificate.status === "pending") {
    return "도메인 요청 후 몇 분 뒤 경고 검사를 다시 실행하세요.";
  }

  if (certificate.status === "inactive") {
    return "자동 발급을 쓰려면 이 도메인 라우트에 certResolver를 붙여야 합니다.";
  }

  return "추가 조치 없이 현재 상태만 모니터링하면 됩니다.";
}
