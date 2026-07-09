interface ServiceFormSubmitActionsProps {
  loading?: boolean;
  submitLabel: string;
}

export default function ServiceFormSubmitActions({
  loading,
  submitLabel,
}: ServiceFormSubmitActionsProps) {
  return (
    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
      <button type="submit" className="btn-primary min-w-[100px]" disabled={loading}>
        {loading ? "처리 중..." : submitLabel}
      </button>
    </div>
  );
}
