import type { RedirectHost, RedirectHostCreate } from "@/features/redirects/api/redirectApi";
import RedirectForm from "@/features/redirects/components/RedirectForm";
import Modal from "@/shared/components/Modal";

import { RedirectErrorNotice } from "./RedirectErrorNotice";

interface RedirectEditModalProps {
  canManage: boolean;
  editTarget: RedirectHost | null;
  errorMessage: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: RedirectHostCreate) => Promise<void>;
}

export function RedirectEditModal({
  canManage,
  editTarget,
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
}: RedirectEditModalProps) {
  return (
    <Modal isOpen={canManage && !!editTarget} onClose={onClose} title="리다이렉트 수정">
      {editTarget ? (
        <>
          {errorMessage ? <RedirectErrorNotice message={errorMessage} /> : null}
          <RedirectForm
            defaultValues={editTarget}
            onSubmit={onSubmit}
            loading={isSubmitting}
            submitLabel="수정 완료"
          />
        </>
      ) : null}
    </Modal>
  );
}
