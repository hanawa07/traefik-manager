"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import Modal from "@/shared/components/Modal";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import { User } from "../api/userApi";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "../hooks/useUsers";
import UserForm, { UserFormValue } from "./UserForm";

export default function UserManagementSection({ className = "" }: { className?: string }) {
  const currentUsername = useAuthStore((state) => state.username);
  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const updateUser = useUpdateUser(editTarget?.id || "");

  return (
    <div className={`card p-6 h-full ${className}`.trim()}>
      <SettingsCardHeader
        icon={<Users className="h-5 w-5 text-emerald-600" />}
        title="사용자 관리"
        description="관리자와 뷰어 계정을 생성, 수정, 비활성화합니다."
        action={
          <button className="btn-primary inline-flex items-center gap-2 py-1.5 text-xs" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            사용자 추가
          </button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-3 py-3 font-medium">사용자 이름</th>
                <th className="px-3 py-3 font-medium">역할</th>
                <th className="px-3 py-3 font-medium">상태</th>
                <th className="px-3 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900">
                    {user.username}
                    {user.username === currentUsername ? (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        현재 로그인
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">{user.role}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => setEditTarget(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="사용자 추가">
        {createUser.error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">
              {(createUser.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                "사용자 추가 중 오류가 발생했습니다"}
            </p>
          </div>
        ) : null}
        <UserForm
          loading={createUser.isPending}
          submitLabel="사용자 추가"
          onSubmit={async (data) => {
            await createUser.mutateAsync({
              username: data.username,
              password: data.password || "",
              role: data.role,
              is_active: data.is_active,
            });
            setIsCreateOpen(false);
          }}
        />
      </Modal>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="사용자 수정">
        {editTarget ? (
          <>
            {updateUser.error ? (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">
                  {(updateUser.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                    "사용자 수정 중 오류가 발생했습니다"}
                </p>
              </div>
            ) : null}
            <UserForm
              defaultValues={editTarget}
              loading={updateUser.isPending}
              submitLabel="수정 완료"
              onSubmit={async (data: UserFormValue) => {
                await updateUser.mutateAsync({
                  username: data.username,
                  role: data.role,
                  is_active: data.is_active,
                  ...(data.password ? { password: data.password } : {}),
                });
                setEditTarget(null);
              }}
            />
          </>
        ) : null}
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="사용자 삭제">
        <p className="mb-1 text-sm text-gray-600">다음 사용자를 삭제합니다:</p>
        <p className="mb-4 font-semibold text-gray-900">{deleteTarget?.username}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            className="btn-danger"
            disabled={deleteUser.isPending}
            onClick={async () => {
              if (!deleteTarget) return;
              await deleteUser.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            {deleteUser.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
