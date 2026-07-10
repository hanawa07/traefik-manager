import type { ReactNode } from "react";
import { Edit2 } from "lucide-react";

export function SettingsCardHeader({
  icon,
  title,
  description,
  action,
  canEdit,
  onEdit,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  return (
    <>
      <div className="mb-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <h2 className="font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        </div>
        {action ? (
          action
        ) : canEdit && onEdit ? (
          <button onClick={onEdit} className="btn-secondary flex w-full items-center justify-center gap-1.5 py-1.5 text-xs sm:w-auto">
            <Edit2 className="h-3.5 w-3.5" /> 편집
          </button>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-gray-400 dark:text-slate-500">{description}</p>
    </>
  );
}

export function SettingsSummary({ children }: { children: ReactNode }) {
  return <div className="space-y-2 text-sm">{children}</div>;
}

export function SettingsSummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-gray-500 dark:text-slate-400">{label}</span>
      <span className={`${mono ? "break-all font-mono " : "break-words "}min-w-0 text-left text-gray-700 dark:text-slate-200 sm:text-right`}>{value}</span>
    </div>
  );
}

export function SettingsActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 pt-2 [&>*]:justify-center sm:flex-row">{children}</div>;
}
