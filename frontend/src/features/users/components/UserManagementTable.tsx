import { Pencil, Trash2 } from "lucide-react";

import type { User } from "../api/userApi";

interface UserManagementTableProps {
  currentUsername: string | null;
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserManagementTable({
  currentUsername,
  users,
  onEdit,
  onDelete,
}: UserManagementTableProps) {
  return (
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
                <UserStatusBadge isActive={user.is_active} />
              </td>
              <td className="px-3 py-3">
                <UserActions user={user} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {isActive ? "활성" : "비활성"}
    </span>
  );
}

function UserActions({
  user,
  onEdit,
  onDelete,
}: {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${user.username} 사용자 수정`}
        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
        onClick={() => onEdit(user)}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`${user.username} 사용자 삭제`}
        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        onClick={() => onDelete(user)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
