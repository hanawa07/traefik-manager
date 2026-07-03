import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface EditServicePageHeaderProps {
  domain: string;
}

export function EditServicePageHeader({ domain }: EditServicePageHeaderProps) {
  return (
    <div className="mb-8">
      <Link
        href="/dashboard/services"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        서비스 목록
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">서비스 수정</h1>
      <p className="text-gray-500 text-sm mt-1">{domain}</p>
    </div>
  );
}
