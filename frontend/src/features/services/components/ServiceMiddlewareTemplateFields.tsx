import type { UseFormRegister } from "react-hook-form";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceMiddlewareTemplateFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  middlewareTemplates: MiddlewareTemplate[];
  isMiddlewareLoading: boolean;
}

export default function ServiceMiddlewareTemplateFields({
  register,
  middlewareTemplates,
  isMiddlewareLoading,
}: ServiceMiddlewareTemplateFieldsProps) {
  return (
    <div>
      <label className="label">미들웨어 템플릿 (선택)</label>
      {isMiddlewareLoading ? (
        <div className="h-20 animate-pulse rounded-lg bg-gray-50" />
      ) : middlewareTemplates.length === 0 ? (
        <p className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-500">
          등록된 템플릿이 없습니다.
        </p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
          {middlewareTemplates.map((template) => (
            <label key={template.id} className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                value={template.id}
                {...register("middleware_template_ids")}
              />
              <span className="text-sm text-gray-700">
                {template.name} ({template.type})
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
