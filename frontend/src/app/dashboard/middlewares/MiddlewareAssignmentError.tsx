import { extractErrorMessage } from "./middlewarePageHelpers";

interface MiddlewareAssignmentErrorProps {
  error: unknown;
}

export function MiddlewareAssignmentError({ error }: MiddlewareAssignmentErrorProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-600">
        {extractErrorMessage(error, "서비스 적용 중 오류가 발생했습니다")}
      </p>
    </div>
  );
}
