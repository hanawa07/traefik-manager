import Modal from "@/shared/components/Modal";

import type { User } from "../api/userApi";
import { useDeleteUser } from "../hooks/useUsers";

interface UserDeleteModalProps {
  user: User | null;
  onClose: () => void;
}

export function UserDeleteModal({ user, onClose }: UserDeleteModalProps) {
  const deleteUser = useDeleteUser();

  return (
    <Modal isOpen={!!user} onClose={onClose} title="사용자 삭제">
      <p className="mb-1 text-sm text-gray-600 dark:text-slate-300">다음 사용자를 삭제합니다:</p>
      <p className="mb-4 font-semibold text-gray-900 dark:text-slate-100">{user?.username}</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary justify-center" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="btn-danger justify-center"
          disabled={deleteUser.isPending}
          onClick={async () => {
            if (!user) return;
            await deleteUser.mutateAsync(user.id);
            onClose();
          }}
        >
          {deleteUser.isPending ? "삭제 중..." : "삭제"}
        </button>
      </div>
    </Modal>
  );
}
