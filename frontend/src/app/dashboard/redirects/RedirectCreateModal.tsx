import type { RedirectHostCreate } from "@/features/redirects/api/redirectApi";
import RedirectForm from "@/features/redirects/components/RedirectForm";
import Modal from "@/shared/components/Modal";

import { RedirectErrorNotice } from "./RedirectErrorNotice";

interface RedirectCreateModalProps {
  canManage: boolean;
  isOpen: boolean;
  errorMessage: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: RedirectHostCreate) => Promise<void>;
}

export function RedirectCreateModal({
  canManage,
  isOpen,
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
}: RedirectCreateModalProps) {
  return (
    <Modal isOpen={canManage && isOpen} onClose={onClose} title="리다이렉트 추가">
      {errorMessage ? <RedirectErrorNotice message={errorMessage} /> : null}
      <RedirectForm
        onSubmit={onSubmit}
        loading={isSubmitting}
        submitLabel="리다이렉트 추가"
      />
    </Modal>
  );
}
