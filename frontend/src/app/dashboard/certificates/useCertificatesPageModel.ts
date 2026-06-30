"use client";

import { useCertificatesDrawerModel } from "./useCertificatesDrawerModel";
import { useCertificatesOverviewModel } from "./useCertificatesOverviewModel";
import { useCertificatesPageData } from "./useCertificatesPageData";

export function useCertificatesPageModel() {
  const data = useCertificatesPageData();
  const drawer = useCertificatesDrawerModel({
    certificates: data.certificates,
    displayTimezone: data.displayTimezone,
    preflightData: data.runCertificatePreflight.data,
    preflightError: data.runCertificatePreflight.error,
    isPreflightError: data.runCertificatePreflight.isError,
    isPreflightPending: data.runCertificatePreflight.isPending,
    resetPreflight: data.runCertificatePreflight.reset,
    runPreflight: data.runCertificatePreflight.mutate,
  });
  const overview = useCertificatesOverviewModel({
    certificates: data.certificates,
    certificateSummary: data.certificateSummary,
    checkResult: data.runCertificateCheck.isSuccess ? data.runCertificateCheck.data : null,
    displayTimezone: data.displayTimezone,
  });

  return {
    checkError: {
      error: data.runCertificateCheck.error,
      isVisible: data.runCertificateCheck.isError,
    },
    drawer: drawer.drawer,
    header: {
      isRefreshing: data.isFetching,
      isRunningCheck: data.runCertificateCheck.isPending,
      onRefresh: () => {
        void data.refetch();
      },
      onRunCheck: () => data.runCertificateCheck.mutate(),
    },
    list: {
      certificates: data.certificates,
      isLoading: data.isLoading,
      onOpenCertificate: drawer.openCertificateDrawer,
      timezone: data.displayTimezone,
    },
    loadError: {
      error: data.error,
      isVisible: data.isError,
    },
    overview,
  };
}
