interface ContainerImportBasicEmptyStateProps {
  normalizedSearchQuery: string;
}

export function ContainerImportBasicEmptyState({
  normalizedSearchQuery,
}: ContainerImportBasicEmptyStateProps) {
  return (
    <p className="py-10 text-center text-sm text-gray-500">
      {normalizedSearchQuery ? "검색 조건과 일치하는 컨테이너가 없습니다." : "실행 중인 컨테이너가 없습니다."}
    </p>
  );
}
