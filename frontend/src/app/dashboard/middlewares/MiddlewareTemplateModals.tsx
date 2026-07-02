import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type {
  useAssignMiddlewareTemplate,
  useCreateMiddlewareTemplate,
  useDeleteMiddlewareTemplate,
  useUpdateMiddlewareTemplate,
} from "@/features/middlewares/hooks/useMiddlewares";
import type { Service } from "@/features/services/api/serviceApi";

import MiddlewareAssignmentModal from "./MiddlewareAssignmentModal";
import MiddlewareTemplateCreateModal from "./MiddlewareTemplateCreateModal";
import MiddlewareTemplateDeleteModal from "./MiddlewareTemplateDeleteModal";
import MiddlewareTemplateEditModal from "./MiddlewareTemplateEditModal";

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
      <MiddlewareTemplateCreateModal
        createTemplate={createTemplate}
        isOpen={canManage && isCreateOpen}
        onClose={onCreateClose}
      />

      <MiddlewareTemplateEditModal
        editTarget={editTarget}
        isOpen={canManage && !!editTarget}
        onClose={onEditClose}
        updateTemplate={updateTemplate}
      />

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

      <MiddlewareTemplateDeleteModal
        deleteTarget={deleteTarget}
        deleteTemplate={deleteTemplate}
        isOpen={canManage && !!deleteTarget}
        onClose={onDeleteClose}
      />
    </>
  );
}
