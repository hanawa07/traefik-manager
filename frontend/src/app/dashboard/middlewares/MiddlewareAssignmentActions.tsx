interface MiddlewareAssignmentActionsProps {
  isSaving: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export function MiddlewareAssignmentActions({
  isSaving,
  onClose,
  onSave,
}: MiddlewareAssignmentActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" className="btn-secondary" onClick={onClose}>
        취소
      </button>
      <button type="button" className="btn-primary" disabled={isSaving} onClick={onSave}>
        {isSaving ? "적용 중..." : "적용 저장"}
      </button>
    </div>
  );
}
