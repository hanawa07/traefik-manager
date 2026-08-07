import { AlertTriangle } from "lucide-react";

import { getCertificateErrorDetail } from "./certificatePageHelpers";

interface CertificateErrorBannerProps {
  title: string;
  error: unknown;
  fallback: string;
}

export default function CertificateErrorBanner({
  title,
  error,
  fallback,
}: CertificateErrorBannerProps) {
  return (
    <div className="card mb-6 border-red-200 bg-red-50 p-4 dark:border-red-500/50 dark:bg-red-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{title}</p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-200">
            {getCertificateErrorDetail(error, fallback)}
          </p>
        </div>
      </div>
    </div>
  );
}
