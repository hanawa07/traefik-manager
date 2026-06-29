import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type {
  useAssignMiddlewareTemplate,
  useCreateMiddlewareTemplate,
  useDeleteMiddlewareTemplate,
  useUpdateMiddlewareTemplate,
} from "@/features/middlewares/hooks/useMiddlewares";
import type { Service } from "@/features/services/api/serviceApi";
import MiddlewareForm from "@/features/middlewares/components/MiddlewareForm";
import Modal from "@/shared/components/Modal";
import MiddlewareAssignmentModal from "./MiddlewareAssignmentModal";
import { extractErrorMessage } from "./middlewarePageHelpers";

interface MiddlewareTemplateModalsProps {
  canManage: boolean;
  isCreateOpen: boolean;
  editTarget: MiddlewareTemplate | null;
  deleteTarget: MiddlewareTemplate | null;
  assignmentTarget: MiddlewareTemplate | null;
  assignmentSearch: string;
  selectedServiceIds: string[];
  services: Service[];
  filteredServicesForAssignment: Service[];
  createTemplate: ReturnType<typeof useCreateMiddlewareTemplate>;
  updateTemplate: ReturnType<typeof useUpdateMiddlewareTemplate>;
  deleteTemplate: ReturnType<typeof useDeleteMiddlewareTemplate>;
  assignTemplate: ReturnType<typeof useAssignMiddlewareTemplate>;
  onCreateClose: () => void;
  onEditClose: () => void;
  onDeleteClose: () => void;
  onAssignmentClose: () => void;
  onAssignmentSearchChange: (value: string) => void;
  onToggleService: (serviceId: string) => void;
}

export default function MiddlewareTemplateModals({
  canManage,
  isCreateOpen,
  editTarget,
  deleteTarget,
  assignmentTarget,
  assignmentSearch,
  selectedServiceIds,
  services,
  filteredServicesForAssignment,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  assignTemplate,
  onCreateClose,
  onEditClose,
  onDeleteClose,
  onAssignmentClose,
  onAssignmentSearchChange,
  onToggleService,
}: MiddlewareTemplateModalsProps) {
  return (
    <>
      <Modal isOpen={canManage && isCreateOpen} onClose={onCreateClose} title="미들웨어 템플릿 추가">
        {createTemplate.error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">
              {extractErrorMessage(createTemplate.error, "템플릿 추가 중 오류가 발생했습니다")}
            </p>
          </div>
        )}
        <MiddlewareForm
          onSubmit={async (data) => {
            await createTemplate.mutateAsync(data);
            onCreateClose();
          }}
          loading={createTemplate.isPending}
          submitLabel="템플릿 추가"
        />
      </Modal>

      <Modal
        isOpen={canManage && !!editTarget}
        onClose={onEditClose}
        title="미들웨어 템플릿 수정"
        maxWidthClass="max-w-2xl"
      >
        {editTarget && (
          <>
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-700">수정 즉시 반영</p>
              <p className="mt-1 text-xs text-blue-600">
                이 템플릿을 사용하는 서비스가 있으면 저장과 동시에 해당 서비스 설정이 다시 생성됩니다.
              </p>
            </div>
            {updateTemplate.error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">
                  {extractErrorMessage(updateTemplate.error, "템플릿 수정 중 오류가 발생했습니다")}
                </p>
              </div>
            )}
            <MiddlewareForm
              defaultValues={editTarget}
              onSubmit={async (data) => {
                await updateTemplate.mutateAsync(data);
                onEditClose();
              }}
              loading={updateTemplate.isPending}
              submitLabel="수정 완료"
            />
          </>
        )}
      </Modal>

      <MiddlewareAssignmentModal
        isOpen={canManage && !!assignmentTarget}
        assignmentTarget={assignmentTarget}
        assignmentSearch={assignmentSearch}
        selectedServiceIds={selectedServiceIds}
        servicesCount={services.length}
        filteredServices={filteredServicesForAssignment}
        error={assignTemplate.error}
        isSaving={assignTemplate.isPending}
        onClose={onAssignmentClose}
        onSearchChange={onAssignmentSearchChange}
        onToggleService={onToggleService}
        onSave={async () => {
          if (!assignmentTarget) return;
          await assignTemplate.mutateAsync({
            services,
            selectedServiceIds,
          });
          onAssignmentClose();
        }}
      />

      <Modal isOpen={canManage && !!deleteTarget} onClose={onDeleteClose} title="미들웨어 템플릿 삭제">
        <p className="mb-1 text-sm text-gray-600">다음 템플릿을 삭제합니다:</p>
        <p className="mb-1 font-semibold text-gray-900">{deleteTarget?.name}</p>
        <p className="mb-4 text-sm text-gray-500">{deleteTarget?.shared_name}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onDeleteClose}>
            취소
          </button>
          <button
            className="btn-danger"
            disabled={deleteTemplate.isPending}
            onClick={async () => {
              if (!deleteTarget) return;
              await deleteTemplate.mutateAsync(deleteTarget.id);
              onDeleteClose();
            }}
          >
            {deleteTemplate.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </>
  );
}
