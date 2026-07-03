import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import Modal from "@/shared/components/Modal";
import { MiddlewareAssignmentActions } from "./MiddlewareAssignmentActions";
import { MiddlewareAssignmentError } from "./MiddlewareAssignmentError";
import { MiddlewareAssignmentSearchField } from "./MiddlewareAssignmentSearchField";
import { MiddlewareAssignmentServiceList } from "./MiddlewareAssignmentServiceList";
import { MiddlewareAssignmentSummary } from "./MiddlewareAssignmentSummary";

interface MiddlewareAssignmentModalProps {
  isOpen: boolean;
  assignmentTarget: MiddlewareTemplate | null;
  assignmentSearch: string;
  selectedServiceIds: string[];
  servicesCount: number;
  filteredServices: Service[];
  error: unknown;
  isSaving: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onToggleService: (serviceId: string) => void;
  onSave: () => Promise<void>;
}

export default function MiddlewareAssignmentModal({
  isOpen,
  assignmentTarget,
  assignmentSearch,
  selectedServiceIds,
  servicesCount,
  filteredServices,
  error,
  isSaving,
  onClose,
  onSearchChange,
  onToggleService,
  onSave,
}: MiddlewareAssignmentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assignmentTarget ? `${assignmentTarget.name} 적용 서비스 관리` : "적용 서비스 관리"}
      maxWidthClass="max-w-3xl"
    >
      {assignmentTarget ? (
        <div className="space-y-4">
          <MiddlewareAssignmentSummary
            selectedCount={selectedServiceIds.length}
            servicesCount={servicesCount}
          />
          <MiddlewareAssignmentError error={error} />
          <MiddlewareAssignmentSearchField value={assignmentSearch} onChange={onSearchChange} />
          <MiddlewareAssignmentServiceList
            filteredServices={filteredServices}
            selectedServiceIds={selectedServiceIds}
            onToggleService={onToggleService}
          />
          <MiddlewareAssignmentActions isSaving={isSaving} onClose={onClose} onSave={onSave} />
        </div>
      ) : null}
    </Modal>
  );
}
