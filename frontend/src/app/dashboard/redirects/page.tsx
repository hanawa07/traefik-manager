"use client";

import { useState } from "react";
import { ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import Modal from "@/shared/components/Modal";
import RedirectForm from "@/features/redirects/components/RedirectForm";
import { RedirectHost } from "@/features/redirects/api/redirectApi";
import {
  useCreateRedirectHost,
  useDeleteRedirectHost,
  useRedirectHosts,
  useUpdateRedirectHost,
} from "@/features/redirects/hooks/useRedirects";

export default function RedirectsPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: redirects = [], isLoading } = useRedirectHosts();
  const createRedirect = useCreateRedirectHost();
  const deleteRedirect = useDeleteRedirectHost();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RedirectHost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RedirectHost | null>(null);

  const updateRedirect = useUpdateRedirectHost(editTarget?.id || "");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">리다이렉트</h1>
          <p className="text-gray-500 text-sm mt-1">도메인 리다이렉트 호스트 관리 ({redirects.length}개)</p>
        </div>
        {canManage ? (
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            리다이렉트 추가
          </button>
        ) : null}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : redirects.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">등록된 리다이렉트가 없습니다</p>
            {canManage ? (
              <button className="text-blue-500 text-sm hover:underline mt-2" onClick={() => setIsCreateOpen(true)}>
                첫 번째 리다이렉트 추가하기
              </button>
            ) : null}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">원본 도메인</th>
                <th className="px-6 py-3 text-left font-medium">대상 URL</th>
                <th className="px-6 py-3 text-left font-medium">타입</th>
                <th className="px-6 py-3 text-left font-medium">TLS</th>
                {canManage ? <th className="px-6 py-3 text-left font-medium">작업</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {redirects.map((redirect) => (
                <tr key={redirect.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{redirect.domain}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{redirect.target_url}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        redirect.permanent ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {redirect.permanent ? "301 영구" : "302 임시"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        redirect.tls_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {redirect.tls_enabled ? "활성" : "비활성"}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => setEditTarget(redirect)}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => setDeleteTarget(redirect)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={canManage && isCreateOpen} onClose={() => setIsCreateOpen(false)} title="리다이렉트 추가">
        {createRedirect.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-red-600 text-sm">
              {(createRedirect.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                "리다이렉트 추가 중 오류가 발생했습니다"}
            </p>
          </div>
        )}
        <RedirectForm
          onSubmit={async (data) => {
            await createRedirect.mutateAsync(data);
            setIsCreateOpen(false);
          }}
          loading={createRedirect.isPending}
          submitLabel="리다이렉트 추가"
        />
      </Modal>

      <Modal isOpen={canManage && !!editTarget} onClose={() => setEditTarget(null)} title="리다이렉트 수정">
        {editTarget && (
          <>
            {updateRedirect.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                <p className="text-red-600 text-sm">
                  {(updateRedirect.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                    "리다이렉트 수정 중 오류가 발생했습니다"}
                </p>
              </div>
            )}
            <RedirectForm
              defaultValues={editTarget}
              onSubmit={async (data) => {
                await updateRedirect.mutateAsync(data);
                setEditTarget(null);
              }}
              loading={updateRedirect.isPending}
              submitLabel="수정 완료"
            />
          </>
        )}
      </Modal>

      <Modal isOpen={canManage && !!deleteTarget} onClose={() => setDeleteTarget(null)} title="리다이렉트 삭제">
        <p className="text-gray-600 text-sm mb-1">다음 리다이렉트를 삭제합니다:</p>
        <p className="font-semibold text-gray-900 mb-1">{deleteTarget?.domain}</p>
        <p className="text-sm text-gray-500 mb-4">→ {deleteTarget?.target_url}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            className="btn-danger"
            disabled={deleteRedirect.isPending}
            onClick={async () => {
              if (!deleteTarget) return;
              await deleteRedirect.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            {deleteRedirect.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
