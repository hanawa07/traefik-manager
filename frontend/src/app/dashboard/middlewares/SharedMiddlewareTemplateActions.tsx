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
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      <button
        className="btn-secondary col-span-2 inline-flex items-center justify-center gap-1.5 py-2 text-sm sm:col-auto"
        onClick={() => onAssign(template)}
      >
        <Wand2 className="h-4 w-4" />
        서비스에 적용
      </button>
      <button
        className="btn-secondary inline-flex items-center justify-center gap-1.5 py-2 text-sm"
        onClick={() => onEdit(template)}
      >
        <Pencil className="h-4 w-4" />
        수정
      </button>
      <button
        className={
          "btn-secondary inline-flex items-center justify-center gap-1.5 py-2 text-sm text-red-600 " +
          "hover:border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:border-red-500/60 dark:hover:bg-red-950/30"
        }
        onClick={() => onDelete(template)}
      >
        <Trash2 className="h-4 w-4" />
        삭제
      </button>
    </div>
  );
}
