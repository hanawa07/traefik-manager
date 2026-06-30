export function extractErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
    (error as { message?: string })?.message ||
    fallback
  );
}
