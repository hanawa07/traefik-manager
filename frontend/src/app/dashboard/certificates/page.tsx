"use client";

import CertificateDetailDrawer from "./CertificateDetailDrawer";
import CertificateErrorBanner from "./CertificateErrorBanner";
import CertificateListCard from "./CertificateListCard";
import CertificatePageHeader from "./CertificatePageHeader";
import CertificateOverviewPanels from "./CertificateOverviewPanels";
import { useCertificatesPageModel } from "./useCertificatesPageModel";

export default function CertificatesPage() {
  const model = useCertificatesPageModel();

  return (
    <div>
      <CertificatePageHeader {...model.header} />

      <CertificateOverviewPanels {...model.overview} />

      {model.loadError.isVisible && (
        <CertificateErrorBanner
          title="인증서 정보를 가져오지 못했습니다"
          error={model.loadError.error}
          fallback="잠시 후 다시 시도해 주세요"
        />
      )}

      {model.checkError.isVisible && (
        <CertificateErrorBanner
          title="인증서 경고 재검사에 실패했습니다"
          error={model.checkError.error}
          fallback="잠시 후 다시 시도해 주세요"
        />
      )}

      <CertificateListCard {...model.list} />
      {model.drawer ? <CertificateDetailDrawer {...model.drawer} /> : null}
    </div>
  );
}
