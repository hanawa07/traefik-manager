import { Shield } from "lucide-react";

export default function CertificateListEmpty() {
  return (
    <div className="py-16 text-center text-gray-500">
      <Shield className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm">표시할 인증서가 없습니다</p>
    </div>
  );
}
