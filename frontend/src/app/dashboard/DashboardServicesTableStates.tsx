import { Server } from "lucide-react";
import Link from "next/link";

export function DashboardServicesTableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

export function EmptyDashboardServicesState({ canManage }: { canManage: boolean }) {
  return (
    <div className="py-16 text-center text-gray-400">
      <Server className="mx-auto mb-3 h-10 w-10 opacity-30" />
      <p className="text-sm">등록된 서비스가 없습니다</p>
      {canManage ? (
        <Link href="/dashboard/services/new" className="mt-2 inline-block text-sm text-blue-500 hover:underline">
          첫 번째 서비스 추가하기
        </Link>
      ) : null}
    </div>
  );
}
