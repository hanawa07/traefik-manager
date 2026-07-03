import { Pencil, Trash2, Wand2 } from "lucide-react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";

interface SharedMiddlewareTemplateActionsProps {
  onAssign: (template: MiddlewareTemplate) => void;
  onDelete: (template: MiddlewareTemplate) => void;
  onEdit: (template: MiddlewareTemplate) => void;
  template: MiddlewareTemplate;
}

export function SharedMiddlewareTemplateActions({
  onAssign,
  onDelete,
  onEdit,
  template,
}: SharedMiddlewareTemplateActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
        onClick={() => onAssign(template)}
      >
        <Wand2 className="h-4 w-4" />
        서비스에 적용
      </button>
      <button
        className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
        onClick={() => onEdit(template)}
      >
        <Pencil className="h-4 w-4" />
        수정
      </button>
      <button
        className={
          "btn-secondary inline-flex items-center gap-1.5 py-2 text-sm text-red-600 " +
          "hover:border-red-200 hover:bg-red-50"
        }
        onClick={() => onDelete(template)}
      >
        <Trash2 className="h-4 w-4" />
        삭제
      </button>
    </div>
  );
}
