interface MiddlewareAssignmentSummaryProps {
  selectedCount: number;
  servicesCount: number;
}

export function MiddlewareAssignmentSummary({
  selectedCount,
  servicesCount,
}: MiddlewareAssignmentSummaryProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-medium text-gray-900">
        선택한 서비스에 이 템플릿을 바로 적용하거나 해제할 수 있습니다.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        저장하면 각 서비스 YAML이 즉시 다시 생성됩니다. 현재 선택: {selectedCount} / {servicesCount}
      </p>
    </div>
  );
}
