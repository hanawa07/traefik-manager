import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { useUpdateMiddlewareTemplate } from "@/features/middlewares/hooks/useMiddlewares";
import MiddlewareForm from "@/features/middlewares/components/MiddlewareForm";
import Modal from "@/shared/components/Modal";

import { extractErrorMessage } from "./middlewarePageHelpers";

interface MiddlewareTemplateEditModalProps {
  editTarget: MiddlewareTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  updateTemplate: ReturnType<typeof useUpdateMiddlewareTemplate>;
}

export default function MiddlewareTemplateEditModal({
  editTarget,
  isOpen,
  onClose,
  updateTemplate,
}: MiddlewareTemplateEditModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="미들웨어 템플릿 수정"
      maxWidthClass="max-w-2xl"
    >
      {editTarget ? (
        <>
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-700">수정 즉시 반영</p>
            <p className="mt-1 text-xs text-blue-600">
              이 템플릿을 사용하는 서비스가 있으면 저장과 동시에 해당 서비스 설정이 다시 생성됩니다.
            </p>
          </div>

          {updateTemplate.error ? (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">
                {extractErrorMessage(updateTemplate.error, "템플릿 수정 중 오류가 발생했습니다")}
              </p>
            </div>
          ) : null}

          <MiddlewareForm
            defaultValues={editTarget}
            onSubmit={async (data) => {
              await updateTemplate.mutateAsync(data);
              onClose();
            }}
            loading={updateTemplate.isPending}
            submitLabel="수정 완료"
          />
        </>
      ) : null}
    </Modal>
  );
}
