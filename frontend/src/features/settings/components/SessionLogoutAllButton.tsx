import { LogOut } from "lucide-react";

interface SessionLogoutAllButtonProps {
  disabled: boolean;
  isLoggingOutAll: boolean;
  onLogoutAll: () => void;
}

export function SessionLogoutAllButton({
  disabled,
  isLoggingOutAll,
  onLogoutAll,
}: SessionLogoutAllButtonProps) {
  return (
    <button
      type="button"
      className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
      onClick={onLogoutAll}
      disabled={disabled}
    >
      <LogOut className="h-3.5 w-3.5" />
      {isLoggingOutAll ? "로그아웃 중..." : "모든 세션 로그아웃"}
    </button>
  );
}
