import { clsx } from "clsx";

interface AuditBadgeConfig {
  color: string;
  label: string;
}

interface AuditBadgeCellProps {
  config?: AuditBadgeConfig | null;
  fallbackLabel?: string;
}

export function AuditBadgeCell({ config, fallbackLabel = "-" }: AuditBadgeCellProps) {
  if (!config) {
    return <span className="text-xs text-slate-500">{fallbackLabel}</span>;
  }

  return (
    <span className={clsx("rounded-md border px-2.5 py-1 text-[11px] font-black", config.color)}>
      {config.label}
    </span>
  );
}
