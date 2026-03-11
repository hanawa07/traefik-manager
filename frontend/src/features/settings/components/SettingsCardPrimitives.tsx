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
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="font-semibold text-gray-900">{title}</h2>
        </div>
        {action ? (
          action
        ) : canEdit && onEdit ? (
          <button onClick={onEdit} className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs">
            <Edit2 className="h-3.5 w-3.5" /> 편집
          </button>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-gray-400">{description}</p>
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
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className={`${mono ? "font-mono " : ""}text-right text-gray-700`}>{value}</span>
    </div>
  );
}

export function SettingsActionRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 pt-2">{children}</div>;
}
