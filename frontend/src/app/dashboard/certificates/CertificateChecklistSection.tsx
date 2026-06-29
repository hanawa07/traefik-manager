import { Loader2, RefreshCcw } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import {
  ChecklistStateIcon,
  getCertificateChecklist,
} from "./certificatePageHelpers";

interface CertificateChecklistSectionProps {
  certificate: Certificate;
  isRunning: boolean;
  onRunPreflight: () => void;
}

export default function CertificateChecklistSection({
  certificate,
  isRunning,
  onRunPreflight,
}: CertificateChecklistSectionProps) {
  const checklist = getCertificateChecklist(certificate);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">발급 체크리스트</h3>
          <p className="mt-1 text-xs text-gray-500">
            목록은 압축해서 보여주고, 상세 진단은 이 패널에서 확인합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onRunPreflight}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          disabled={isRunning}
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          {isRunning ? "진단 중..." : "사전 진단"}
        </button>
      </div>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-[11px] font-medium text-blue-800">다음 조치</p>
        <p className="mt-1 text-xs leading-5 text-blue-700">{checklist.action}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {checklist.items.map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <ChecklistStateIcon state={item.state} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
