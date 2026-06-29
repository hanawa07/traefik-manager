export function getDockerErrorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  const message = error instanceof Error ? error.message : null;
  return detail || message || "컨테이너 목록을 가져오지 못했습니다.";
}
