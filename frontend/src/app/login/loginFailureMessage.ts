export function getLoginFailureMessage(turnstileRequired: boolean) {
  return turnstileRequired
    ? "아이디/비밀번호 또는 추가 로그인 검증이 올바르지 않습니다"
    : "아이디 또는 비밀번호가 올바르지 않습니다";
}
