import { Pencil, Trash2 } from "lucide-react";

import type { RedirectHost } from "@/features/redirects/api/redirectApi";

interface RedirectActionsCellProps {
  redirect: RedirectHost;
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
}

export function RedirectActionsCell({
  redirect,
  onEdit,
  onDelete,
}: RedirectActionsCellProps) {
  return (
    <td className="px-6 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${redirect.domain} 리다이렉트 수정`}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
          onClick={() => onEdit(redirect)}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`${redirect.domain} 리다이렉트 삭제`}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          onClick={() => onDelete(redirect)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </td>
  );
}
