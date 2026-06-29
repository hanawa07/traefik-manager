export function getHealthErrorKindLabel(errorKind: string | null | undefined) {
  switch (errorKind) {
    case "dns":
      return "DNS 실패";
    case "connection_refused":
      return "연결 거부";
    case "connection_timeout":
      return "연결 타임아웃";
    case "request_timeout":
      return "응답 타임아웃";
    case "unexpected_status":
      return "상태 코드 불일치";
    case "disabled":
      return "체크 비활성화";
    case "connect":
      return "연결 실패";
    case "unexpected_error":
      return "예상치 못한 오류";
    default:
      return null;
  }
}

export function getAcmeErrorKindLabel(errorKind: string | null | undefined) {
  switch (errorKind) {
    case "dns":
      return "DNS 검증 실패";
    case "rate_limit":
      return "발급 제한";
    case "authorization":
      return "도메인 인증 실패";
    case "challenge":
      return "챌린지 실패";
    case "unknown":
      return "발급 실패";
    default:
      return null;
  }
}
