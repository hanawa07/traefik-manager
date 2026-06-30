import type { CertificatePreflightItem } from "@/features/certificates/api/certificateApi";

import { ChecklistStateIcon } from "./certificatePageHelpers";

interface CertificatePreflightItemListProps {
  items: CertificatePreflightItem[];
}

export default function CertificatePreflightItemList({
  items,
}: CertificatePreflightItemListProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <ChecklistStateIcon state={getChecklistState(item.status)} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getChecklistState(status: CertificatePreflightItem["status"]) {
  if (status === "ok") return "ok";
  if (status === "warning") return "pending";
  return "fail";
}
