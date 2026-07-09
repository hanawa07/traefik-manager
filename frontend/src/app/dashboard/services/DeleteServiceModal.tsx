import type { Service } from "@/features/services/api/serviceApi";
import Modal from "@/shared/components/Modal";

interface DeleteServiceModalProps {
  service: Service | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteServiceModal({
  service,
  isPending,
  onClose,
  onConfirm,
}: DeleteServiceModalProps) {
  return (
    <Modal isOpen={!!service} onClose={onClose} title="서비스 삭제">
      <p className="mb-1 text-sm text-gray-600 dark:text-slate-300">다음 서비스를 삭제합니다:</p>
      <p className="mb-1 font-semibold text-gray-900 dark:text-slate-100">{service?.name}</p>
      <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">{service?.domain}</p>
      {service?.auth_mode === "authentik" ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm text-amber-700 dark:text-amber-200">Authentik Provider/Application도 함께 삭제됩니다</p>
        </div>
      ) : null}
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onClose}>
          취소
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={isPending}>
          {isPending ? "삭제 중..." : "삭제"}
        </button>
      </div>
    </Modal>
  );
}
