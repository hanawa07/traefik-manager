interface RedirectStatusBadgeProps {
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  enabledClassName: string;
}

export function RedirectStatusBadge({
  enabled,
  enabledLabel,
  disabledLabel,
  enabledClassName,
}: RedirectStatusBadgeProps) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        enabled ? enabledClassName : "bg-gray-100 text-gray-600"
      }`}
    >
      {enabled ? enabledLabel : disabledLabel}
    </span>
  );
}
