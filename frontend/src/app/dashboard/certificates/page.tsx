"use client";

import CertificateDetailDrawer from "./CertificateDetailDrawer";
import CertificateErrorBanner from "./CertificateErrorBanner";
import CertificateListErrorState from "./CertificateListErrorState";
import CertificateListCard from "./CertificateListCard";
import CertificatePageHeader from "./CertificatePageHeader";
import CertificateOverviewPanels from "./CertificateOverviewPanels";
import { useCertificatesPageModel } from "./useCertificatesPageModel";

export default function CertificatesPage() {
  const model = useCertificatesPageModel();

  return (
    <div>
      <CertificatePageHeader {...model.header} />

      {!model.loadError.isVisible ? <CertificateOverviewPanels {...model.overview} /> : null}

      {model.loadError.isVisible ? (
        <CertificateListErrorState
          error={model.loadError.error}
          isRetrying={model.loadError.isRetrying}
          onRetry={model.loadError.onRetry}
        />
      ) : null}

      {model.checkError.isVisible && (
        <CertificateErrorBanner
          title="인증서 경고 재검사에 실패했습니다"
          error={model.checkError.error}
          fallback="잠시 후 다시 시도해 주세요"
        />
      )}

      {!model.loadError.isVisible ? <CertificateListCard {...model.list} /> : null}
      {!model.loadError.isVisible && model.drawer ? (
        <CertificateDetailDrawer {...model.drawer} />
      ) : null}
    </div>
  );
}
