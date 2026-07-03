"use client";

import { useState } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import type { User } from "../api/userApi";
import { useUsers } from "../hooks/useUsers";
import { UserCreateModal } from "./UserCreateModal";
import { UserDeleteModal } from "./UserDeleteModal";
import { UserEditModal } from "./UserEditModal";
import { UserManagementEmptyState } from "./UserManagementEmptyState";
import { UserManagementHeader } from "./UserManagementHeader";
import { UserManagementLoadingRows } from "./UserManagementLoadingRows";
import { UserManagementTable } from "./UserManagementTable";

export default function UserManagementSection({ className = "" }: { className?: string }) {
  const currentUsername = useAuthStore((state) => state.username);
  const { data: users = [], isLoading } = useUsers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

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

      <UserCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <UserEditModal user={editTarget} onClose={() => setEditTarget(null)} />
      <UserDeleteModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
