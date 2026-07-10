import type { RedirectHost } from "@/features/redirects/api/redirectApi";
import Modal from "@/shared/components/Modal";

interface RedirectDeleteModalProps {
  canManage: boolean;
  deleteTarget: RedirectHost | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RedirectDeleteModal({
  canManage,
  deleteTarget,
  isDeleting,
  onClose,
  onConfirm,
}: RedirectDeleteModalProps) {
  return (
    <Modal isOpen={canManage && !!deleteTarget} onClose={onClose} title="리다이렉트 삭제">
      <p className="mb-1 text-sm text-gray-600 dark:text-slate-300">다음 리다이렉트를 삭제합니다:</p>
      <p className="mb-1 font-semibold text-gray-900 dark:text-slate-100">{deleteTarget?.domain}</p>
      <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">→ {deleteTarget?.target_url}</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn-secondary justify-center" onClick={onClose}>
          취소
        </button>
        <button className="btn-danger justify-center" disabled={isDeleting} onClick={onConfirm}>
          {isDeleting ? "삭제 중..." : "삭제"}
        </button>
      </div>
    </Modal>
  );
}
