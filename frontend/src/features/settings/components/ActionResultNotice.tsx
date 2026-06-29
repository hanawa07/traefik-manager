import type { SettingsActionTestResult } from "@/features/settings/api/settingsApi";

export default function ActionResultNotice({ result }: { result: SettingsActionTestResult | null }) {
  if (!result) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        result.success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <p className="font-medium">{result.message}</p>
      {result.detail ? <p className="mt-1 text-xs opacity-90">{result.detail}</p> : null}
    </div>
  );
}
