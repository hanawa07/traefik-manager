import { Check, Copy, RefreshCw } from "lucide-react";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceApiKeyPanelProps {
  authMode: ServiceFormData["auth_mode"];
  apiKeyValue: string | null | undefined;
  copied: boolean;
  onRegenerateApiKey: () => void;
  onCopyApiKey: (value: string) => void;
}

export default function ServiceApiKeyPanel({
  authMode,
  apiKeyValue,
  copied,
  onRegenerateApiKey,
  onCopyApiKey,
}: ServiceApiKeyPanelProps) {
  if (authMode !== "token" || !apiKeyValue) return null;

  return (
    <div className="animate-in zoom-in-95 rounded-xl border border-purple-100 bg-purple-50 p-4 duration-200 dark:border-purple-500/30 dark:bg-purple-500/10">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-200">
          서비스 전용 API Key
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRegenerateApiKey}
            className={
              "inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 " +
              "transition-colors hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            }
          >
            <RefreshCw className="h-3 w-3" />
            새로 고침
          </button>
          <button
            type="button"
            onClick={() => onCopyApiKey(apiKeyValue)}
            className={
              "inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 " +
              "transition-colors hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200"
            }
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "복사됨" : "복사하기"}
          </button>
        </div>
      </div>
      <div
        className={
          "select-all break-all rounded-lg border border-purple-200 bg-white/60 px-3 " +
          "py-2 font-mono text-xs text-purple-900 dark:border-purple-500/30 dark:bg-slate-950/60 dark:text-purple-100"
        }
      >
        {apiKeyValue}
      </div>
      <p className="mt-2 text-[10px] italic leading-relaxed text-purple-600 dark:text-purple-300">
        * [저장] 버튼을 눌러야 최종적으로 이 키가 활성화됩니다.
      </p>
    </div>
  );
}
