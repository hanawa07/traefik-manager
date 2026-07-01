import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";

import type { RedirectHost } from "@/features/redirects/api/redirectApi";

interface RedirectsListCardProps {
  canManage: boolean;
  isLoading: boolean;
  redirects: RedirectHost[];
  onCreate: () => void;
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
}

export function RedirectsListCard({
  canManage,
  isLoading,
  redirects,
  onCreate,
  onEdit,
  onDelete,
}: RedirectsListCardProps) {
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <RedirectsLoadingRows />
      ) : redirects.length === 0 ? (
        <RedirectsEmptyState canManage={canManage} onCreate={onCreate} />
      ) : (
        <RedirectsTable
          canManage={canManage}
          redirects={redirects}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function RedirectsLoadingRows() {
  return (
    <div className="space-y-3 p-6">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

function RedirectsEmptyState({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="py-16 text-center text-gray-500">
      <ArrowRightLeft className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm">등록된 리다이렉트가 없습니다</p>
      {canManage ? (
        <button className="mt-2 text-sm text-blue-500 hover:underline" onClick={onCreate}>
          첫 번째 리다이렉트 추가하기
        </button>
      ) : null}
    </div>
  );
}

function RedirectsTable({
  canManage,
  redirects,
  onEdit,
  onDelete,
}: {
  canManage: boolean;
  redirects: RedirectHost[];
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
}) {
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
              <RedirectActions
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

function RedirectStatusBadge({
  enabled,
  enabledLabel,
  disabledLabel,
  enabledClassName,
}: {
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  enabledClassName: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        enabled ? enabledClassName : "bg-gray-100 text-gray-600"
      }`}
    >
      {enabled ? enabledLabel : disabledLabel}
    </span>
  );
}

function RedirectActions({
  redirect,
  onEdit,
  onDelete,
}: {
  redirect: RedirectHost;
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
}) {
  return (
    <td className="px-6 py-3">
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
          onClick={() => onEdit(redirect)}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          onClick={() => onDelete(redirect)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </td>
  );
}
