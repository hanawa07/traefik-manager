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
      <p className="mb-1 text-sm text-gray-600">다음 사용자를 삭제합니다:</p>
      <p className="mb-4 font-semibold text-gray-900">{user?.username}</p>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="btn-danger"
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
