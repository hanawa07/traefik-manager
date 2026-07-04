import type { Service, ServiceGatewayDiagnosis } from "@/features/services/api/serviceApi";
import { serviceApi } from "@/features/services/api/serviceApi";

const RETRY_DELAY_MS = 1000;
const MAX_ATTEMPTS = 3;

export const SERVICE_SAVE_DIAGNOSIS_STORAGE_KEY = "traefik-manager:service-save-diagnosis";

export interface ServiceSaveDiagnosisNotice {
  action: "created" | "updated";
  checkedAt: string;
  diagnosis: ServiceGatewayDiagnosis | null;
  domain: string;
  error: string | null;
  serviceId: string;
}

export async function runServiceSaveDiagnosis(
  service: Service,
  action: ServiceSaveDiagnosisNotice["action"],
): Promise<ServiceSaveDiagnosisNotice> {
  let lastDiagnosis: ServiceGatewayDiagnosis | null = null;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await delay(RETRY_DELAY_MS);
      lastDiagnosis = await serviceApi.diagnoseGateway(service.id);
      if (!shouldRetryDiagnosis(lastDiagnosis) || attempt === MAX_ATTEMPTS) {
        break;
      }
    }

    return buildNotice({ action, diagnosis: lastDiagnosis, error: null, service });
  } catch (error) {
    return buildNotice({
      action,
      diagnosis: lastDiagnosis,
      error: getDiagnosisErrorMessage(error),
      service,
    });
  }
}

export function storeServiceSaveDiagnosisNotice(notice: ServiceSaveDiagnosisNotice) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SERVICE_SAVE_DIAGNOSIS_STORAGE_KEY, JSON.stringify(notice));
}

export function consumeServiceSaveDiagnosisNotice(): ServiceSaveDiagnosisNotice | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SERVICE_SAVE_DIAGNOSIS_STORAGE_KEY);
  window.sessionStorage.removeItem(SERVICE_SAVE_DIAGNOSIS_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ServiceSaveDiagnosisNotice;
  } catch {
    return null;
  }
}

function buildNotice({
  action,
  diagnosis,
  error,
  service,
}: {
  action: ServiceSaveDiagnosisNotice["action"];
  diagnosis: ServiceGatewayDiagnosis | null;
  error: string | null;
  service: Service;
}): ServiceSaveDiagnosisNotice {
  return {
    action,
    checkedAt: new Date().toISOString(),
    diagnosis,
    domain: service.domain,
    error,
    serviceId: service.id,
  };
}

function shouldRetryDiagnosis(diagnosis: ServiceGatewayDiagnosis) {
  const routerCheck = diagnosis.checks.find((check) => check.key === "traefik_router");
  return routerCheck?.status === "fail" && routerCheck.message.includes("활성 Traefik 라우터를 찾지 못했습니다");
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getDiagnosisErrorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  if (detail) return detail;
  return "서비스 저장 후 게이트웨이 진단을 실행하지 못했습니다.";
}
