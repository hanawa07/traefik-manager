import { clsx } from "clsx";

type Status = "active" | "inactive" | "warning" | "error" | "pending";

const variants: Record<Status, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  warning: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
};

const labels: Record<Status, string> = {
  active: "활성",
  inactive: "미설정",
  warning: "경고",
  error: "오류",
  pending: "대기",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", variants[status])}>
      <span className={clsx("w-1.5 h-1.5 rounded-full mr-1.5",
        status === "active" ? "bg-green-500" :
        status === "pending" ? "bg-blue-500" :
        status === "warning" ? "bg-yellow-500" :
        status === "error" ? "bg-red-500" : "bg-gray-400"
      )} />
      {labels[status]}
    </span>
  );
}
