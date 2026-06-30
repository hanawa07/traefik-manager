export type ChecklistState = "ok" | "pending" | "fail";

export type CertificateChecklistItem = {
  label: string;
  state: ChecklistState;
  detail: string;
};

export type CertificateChecklist = {
  action: string;
  items: CertificateChecklistItem[];
};
