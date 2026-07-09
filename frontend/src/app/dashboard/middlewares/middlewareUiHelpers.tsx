import { Server } from "lucide-react";

export function Checkmark() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
    >
      <Server className="h-3 w-3" />
      적용
    </span>
  );
}
