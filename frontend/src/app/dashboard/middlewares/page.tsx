"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import Modal from "@/shared/components/Modal";
import MiddlewareForm from "@/features/middlewares/components/MiddlewareForm";
import { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import {
  useCreateMiddlewareTemplate,
  useDeleteMiddlewareTemplate,
  useMiddlewareTemplates,
  useUpdateMiddlewareTemplate,
} from "@/features/middlewares/hooks/useMiddlewares";

export default function MiddlewaresPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: templates = [], isLoading } = useMiddlewareTemplates();
  const createTemplate = useCreateMiddlewareTemplate();
  const deleteTemplate = useDeleteMiddlewareTemplate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MiddlewareTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MiddlewareTemplate | null>(null);
  const updateTemplate = useUpdateMiddlewareTemplate(editTarget?.id || "");

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [templates]
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">미들웨어</h1>
          <p className="text-gray-500 text-sm mt-1">공통 미들웨어 템플릿 관리 ({templates.length}개)</p>
        </div>
        {canManage ? (
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            템플릿 추가
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
        ) : sortedTemplates.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">등록된 미들웨어 템플릿이 없습니다</p>
            {canManage ? (
              <button className="text-blue-500 text-sm hover:underline mt-2" onClick={() => setIsCreateOpen(true)}>
                첫 번째 템플릿 추가하기
              </button>
            ) : null}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">이름</th>
                <th className="px-6 py-3 text-left font-medium">타입</th>
                <th className="px-6 py-3 text-left font-medium">공유 이름</th>
                <th className="px-6 py-3 text-left font-medium">설정</th>
                {canManage ? <th className="px-6 py-3 text-left font-medium">작업</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{template.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{template.type}</td>
                  <td className="px-6 py-3 text-xs text-gray-500 font-mono">{template.shared_name}</td>
                  <td className="px-6 py-3 text-xs text-gray-500 font-mono truncate max-w-md">
                    {JSON.stringify(template.config)}
                  </td>
                  {canManage ? (
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => setEditTarget(template)}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => setDeleteTarget(template)}
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

      <Modal isOpen={canManage && isCreateOpen} onClose={() => setIsCreateOpen(false)} title="미들웨어 템플릿 추가">
        {createTemplate.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-red-600 text-sm">
              {(createTemplate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                "템플릿 추가 중 오류가 발생했습니다"}
            </p>
          </div>
        )}
        <MiddlewareForm
          onSubmit={async (data) => {
            await createTemplate.mutateAsync(data);
            setIsCreateOpen(false);
          }}
          loading={createTemplate.isPending}
          submitLabel="템플릿 추가"
        />
      </Modal>

      <Modal isOpen={canManage && !!editTarget} onClose={() => setEditTarget(null)} title="미들웨어 템플릿 수정">
        {editTarget && (
          <>
            {updateTemplate.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                <p className="text-red-600 text-sm">
                  {(updateTemplate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                    "템플릿 수정 중 오류가 발생했습니다"}
                </p>
              </div>
            )}
            <MiddlewareForm
              defaultValues={editTarget}
              onSubmit={async (data) => {
                await updateTemplate.mutateAsync(data);
                setEditTarget(null);
              }}
              loading={updateTemplate.isPending}
              submitLabel="수정 완료"
            />
          </>
        )}
      </Modal>

      <Modal isOpen={canManage && !!deleteTarget} onClose={() => setDeleteTarget(null)} title="미들웨어 템플릿 삭제">
        <p className="text-gray-600 text-sm mb-1">다음 템플릿을 삭제합니다:</p>
        <p className="font-semibold text-gray-900 mb-1">{deleteTarget?.name}</p>
        <p className="text-sm text-gray-500 mb-4">{deleteTarget?.shared_name}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            className="btn-danger"
            disabled={deleteTemplate.isPending}
            onClick={async () => {
              if (!deleteTarget) return;
              await deleteTemplate.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            {deleteTemplate.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
