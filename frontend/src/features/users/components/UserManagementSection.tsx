"use client";

import { useState } from "react";

import Modal from "@/shared/components/Modal";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import type { User } from "../api/userApi";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "../hooks/useUsers";
import UserForm, { type UserFormValue } from "./UserForm";
import { UserManagementEmptyState } from "./UserManagementEmptyState";
import { UserManagementHeader } from "./UserManagementHeader";
import { UserManagementLoadingRows } from "./UserManagementLoadingRows";
import { UserManagementTable } from "./UserManagementTable";

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
      <UserManagementHeader onCreate={() => setIsCreateOpen(true)} />

      {isLoading ? (
        <UserManagementLoadingRows />
      ) : users.length === 0 ? (
        <UserManagementEmptyState onCreate={() => setIsCreateOpen(true)} />
      ) : (
        <UserManagementTable
          currentUsername={currentUsername}
          users={users}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
        />
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
          <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            type="button"
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
