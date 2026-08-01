export function getDockerErrorMessage(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { detail?: string } } })?.response;
  if (response?.status === 404) {
    return "컨테이너 조회 API를 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.";
  }

  const detail = response?.data?.detail;
  const message = error instanceof Error ? error.message : null;
  return detail || message || "컨테이너 목록을 가져오지 못했습니다.";
}
