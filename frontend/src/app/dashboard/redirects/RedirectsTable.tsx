import type { RedirectHost } from "@/features/redirects/api/redirectApi";

import { RedirectActionsCell } from "./RedirectActionsCell";
import { RedirectStatusBadge } from "./RedirectStatusBadge";

interface RedirectsTableProps {
  canManage: boolean;
  redirects: RedirectHost[];
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
}

export function RedirectsTable({
  canManage,
  redirects,
  onEdit,
  onDelete,
}: RedirectsTableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-400">
          <th className="px-6 py-3 text-left font-medium">원본 도메인</th>
          <th className="px-6 py-3 text-left font-medium">대상 URL</th>
          <th className="px-6 py-3 text-left font-medium">타입</th>
          <th className="px-6 py-3 text-left font-medium">TLS</th>
          {canManage ? <th className="px-6 py-3 text-left font-medium">작업</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {redirects.map((redirect) => (
          <tr key={redirect.id} className="transition-colors hover:bg-gray-50">
            <td className="px-6 py-3 text-sm font-medium text-gray-900">{redirect.domain}</td>
            <td className="px-6 py-3 text-sm text-gray-500">{redirect.target_url}</td>
            <td className="px-6 py-3">
              <RedirectStatusBadge
                enabled={redirect.permanent}
                enabledLabel="301 영구"
                disabledLabel="302 임시"
                enabledClassName="bg-blue-100 text-blue-700"
              />
            </td>
            <td className="px-6 py-3">
              <RedirectStatusBadge
                enabled={redirect.tls_enabled}
                enabledLabel="활성"
                disabledLabel="비활성"
                enabledClassName="bg-green-100 text-green-700"
              />
            </td>
            {canManage ? (
              <RedirectActionsCell
                redirect={redirect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
