import type { UserSystemdIssue } from "@/features/deployment/api/deploymentApi";

const issueLabels: Record<UserSystemdIssue["code"], string> = {
  "baseline-invalid": "기준선 파일 오류",
  "systemctl-unavailable": "systemd 상태 조회 실패",
  "unexpected-timer": "기준선에 없는 타이머 활성",
  "unit-not-loaded": "unit 로드 실패",
  "timer-disabled": "타이머 사용 중지",
  "timer-inactive": "타이머 비활성",
  "service-failed": "서비스 실패",
  "service-result": "서비스 실행 결과 실패",
  "unit-drift": "unit 설정 변경",
  "unit-unreadable": "unit 설정 읽기 실패",
};

export function formatUserSystemdIssue(issue: UserSystemdIssue) {
  return issue.unit ? `${issueLabels[issue.code]} · ${issue.unit}` : issueLabels[issue.code];
}
