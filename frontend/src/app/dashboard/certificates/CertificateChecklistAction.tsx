interface CertificateChecklistActionProps {
  action: string;
}

export default function CertificateChecklistAction({
  action,
}: CertificateChecklistActionProps) {
  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <p className="text-[11px] font-medium text-blue-800">다음 조치</p>
      <p className="mt-1 text-xs leading-5 text-blue-700">{action}</p>
    </div>
  );
}
