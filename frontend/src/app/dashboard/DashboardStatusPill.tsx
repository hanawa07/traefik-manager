export function DashboardStatusPill({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
