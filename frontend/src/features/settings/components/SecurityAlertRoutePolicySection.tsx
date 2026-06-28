import type { SecurityAlertRouteTarget } from "@/features/settings/api/settingsApi";
import { SECURITY_ALERT_ROUTE_OPTIONS } from "@/features/settings/lib/settingsDefaults";

export function SecurityAlertRoutePolicySection<T extends string>({
  title,
  description,
  events,
  routes,
  providerLabel,
  onChange,
}: {
  title: string;
  description: string;
  events: Array<{ key: T; label: string }>;
  routes: Record<T, SecurityAlertRouteTarget>;
  providerLabel: string;
  onChange: (key: T, route: SecurityAlertRouteTarget) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <div className="grid gap-3">
        {events.map((eventOption) => (
          <div key={eventOption.key} className="grid gap-2 md:grid-cols-[140px_1fr] md:items-center">
            <label className="label mb-0">{eventOption.label}</label>
            <select
              className="input"
              value={routes[eventOption.key]}
              onChange={(event) => onChange(eventOption.key, event.target.value as SecurityAlertRouteTarget)}
            >
              {SECURITY_ALERT_ROUTE_OPTIONS.map((option) => (
                <option key={`${eventOption.key}-${option.value}`} value={option.value}>
                  {option.value === "default" ? `${option.label} (${providerLabel})` : option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
