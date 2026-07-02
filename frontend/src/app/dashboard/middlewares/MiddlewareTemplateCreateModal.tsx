import type { useCreateMiddlewareTemplate } from "@/features/middlewares/hooks/useMiddlewares";
import MiddlewareForm from "@/features/middlewares/components/MiddlewareForm";
import Modal from "@/shared/components/Modal";

import { extractErrorMessage } from "./middlewarePageHelpers";

interface MiddlewareTemplateCreateModalProps {
  createTemplate: ReturnType<typeof useCreateMiddlewareTemplate>;
  isOpen: boolean;
  onClose: () => void;
}

export default function MiddlewareTemplateCreateModal({
  createTemplate,
  isOpen,
  onClose,
}: MiddlewareTemplateCreateModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="미들웨어 템플릿 추가">
      {createTemplate.error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">
            {extractErrorMessage(createTemplate.error, "템플릿 추가 중 오류가 발생했습니다")}
          </p>
        </div>
      ) : null}

      <MiddlewareForm
        onSubmit={async (data) => {
          await createTemplate.mutateAsync(data);
          onClose();
        }}
        loading={createTemplate.isPending}
        submitLabel="템플릿 추가"
      />
    </Modal>
  );
}
