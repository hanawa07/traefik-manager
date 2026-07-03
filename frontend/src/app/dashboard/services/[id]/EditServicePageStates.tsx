import Link from "next/link";

export function EditServiceLoadingState() {
  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="card p-6 animate-pulse h-80" />
    </div>
  );
}

export function EditServiceNotFoundState() {
  return (
    <div className="p-8">
      <p className="text-gray-500">서비스를 찾을 수 없습니다</p>
      <Link href="/dashboard/services" className="text-blue-500 hover:underline text-sm mt-2 inline-block">
        서비스 목록으로 돌아가기
      </Link>
    </div>
  );
}

export function EditServiceReadOnlyState() {
  return (
    <div className="w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-gray-900">읽기 전용 계정</h1>
        <p className="mt-2 text-sm text-gray-500">viewer 계정은 서비스를 수정할 수 없습니다.</p>
        <Link href="/dashboard/services" className="mt-4 inline-flex text-sm text-blue-600 hover:underline">
          서비스 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
