import { useState } from "react";

import type {
  CloudflareDriftCheckResult,
  SettingsActionTestResult,
} from "@/features/settings/api/settingsApi";
import {
  buildCloudflareActionFailureResult,
  buildCloudflareDriftFailureResult,
} from "@/features/settings/hooks/cloudflareDnsSettingsModelHelpers";
import {
  useDiagnoseCloudflareDnsDrift,
  useReconcileCloudflareDns,
  useTestCloudflareConnection,
} from "@/features/settings/hooks/useSettings";

export function useCloudflareDnsActionResults() {
  const [testResult, setTestResult] = useState<SettingsActionTestResult | null>(null);
  const [driftResult, setDriftResult] = useState<CloudflareDriftCheckResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<SettingsActionTestResult | null>(null);
  const testCloudflareConnection = useTestCloudflareConnection();
  const diagnoseCloudflareDnsDrift = useDiagnoseCloudflareDnsDrift();
  const reconcileCloudflareDns = useReconcileCloudflareDns();

  const resetActionResults = () => {
    setTestResult(null);
    setDriftResult(null);
    setReconcileResult(null);
  };

  const handleTest = async () => {
    try {
      setTestResult(await testCloudflareConnection.mutateAsync());
    } catch (error) {
      setTestResult(
        buildCloudflareActionFailureResult(error, "Cloudflare 연결 테스트에 실패했습니다"),
      );
    }
  };

  const handleReconcile = async () => {
    try {
      setReconcileResult(await reconcileCloudflareDns.mutateAsync());
    } catch (error) {
      setReconcileResult(
        buildCloudflareActionFailureResult(error, "Cloudflare DNS 재동기화에 실패했습니다"),
      );
    }
  };

  const handleDiagnose = async () => {
    try {
      setDriftResult(await diagnoseCloudflareDnsDrift.mutateAsync());
    } catch (error) {
      setDriftResult(buildCloudflareDriftFailureResult(error));
    }
  };

  return {
    isTesting: testCloudflareConnection.isPending,
    isDiagnosing: diagnoseCloudflareDnsDrift.isPending,
    isReconciling: reconcileCloudflareDns.isPending,
    testResult,
    driftResult,
    reconcileResult,
    onTest: handleTest,
    onDiagnose: handleDiagnose,
    onReconcile: handleReconcile,
    resetActionResults,
  };
}
