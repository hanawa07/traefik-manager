import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";

import { getCertificateChecklistAction } from "./certificateChecklistActions";
import { getCertificateChecklistItems } from "./certificateChecklistItems";
import type { CertificateChecklist, ChecklistState } from "./certificateChecklistTypes";

export type {
  CertificateChecklist,
  CertificateChecklistItem,
  ChecklistState,
} from "./certificateChecklistTypes";

export function getCertificateChecklist(certificate: Certificate): CertificateChecklist {
  return {
    action: getCertificateChecklistAction(certificate),
    items: getCertificateChecklistItems(certificate),
  };
}

export function ChecklistStateIcon({ state }: { state: ChecklistState }) {
  if (state === "ok") {
    return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  }
  if (state === "pending") {
    return <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />;
  }
  return <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />;
}
