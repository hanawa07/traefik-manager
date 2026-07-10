import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { useDeleteMiddlewareTemplate } from "@/features/middlewares/hooks/useMiddlewares";
import Modal from "@/shared/components/Modal";

interface MiddlewareTemplateDeleteModalProps {
  deleteTarget: MiddlewareTemplate | null;
  deleteTemplate: ReturnType<typeof useDeleteMiddlewareTemplate>;
  isOpen: boolean;
  onClose: () => void;
}

export default function MiddlewareTemplateDeleteModal({
  deleteTarget,
  deleteTemplate,
  isOpen,
  onClose,
}: MiddlewareTemplateDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="미들웨어 템플릿 삭제">
      <p className="mb-1 text-sm text-gray-600 dark:text-slate-300">다음 템플릿을 삭제합니다:</p>
      <p className="mb-1 font-semibold text-gray-900 dark:text-slate-100">{deleteTarget?.name}</p>
      <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">{deleteTarget?.shared_name}</p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn-secondary" onClick={onClose}>
          취소
        </button>
        <button
          className="btn-danger"
          disabled={deleteTemplate.isPending}
          onClick={async () => {
            if (!deleteTarget) return;
            await deleteTemplate.mutateAsync(deleteTarget.id);
            onClose();
          }}
        >
          {deleteTemplate.isPending ? "삭제 중..." : "삭제"}
        </button>
      </div>
    </Modal>
  );
}
