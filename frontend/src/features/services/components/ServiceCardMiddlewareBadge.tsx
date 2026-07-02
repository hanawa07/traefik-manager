import { SlidersHorizontal } from "lucide-react";

import type { Service } from "../api/serviceApi";

export function ServiceCardMiddlewareBadge({ service }: { service: Service }) {
  const middlewareCount = service.middleware_template_ids.length;

  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium " +
        (middlewareCount > 0
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : "border-gray-200 bg-gray-100 text-gray-500")
      }
    >
      <SlidersHorizontal className="h-3 w-3" />
      {middlewareCount > 0 ? `미들웨어 ${middlewareCount}개` : "미들웨어 없음"}
    </span>
  );
}
