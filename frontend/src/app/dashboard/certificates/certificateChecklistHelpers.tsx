import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";

import { getAcmeErrorKindLabel } from "./certificateAcmeHelpers";

export type ChecklistState = "ok" | "pending" | "fail";
export type CertificateChecklistItem = {
  label: string;
  state: ChecklistState;
  detail: string;
};

export function getCertificateChecklist(certificate: Certificate): {
  action: string;
  items: CertificateChecklistItem[];
} {
  const recentFailureLabel = getAcmeErrorKindLabel(certificate.last_acme_error_kind);
  const items: CertificateChecklistItem[] = [
    {
      label: "라우트 감지",
      state: certificate.router_names.length > 0 ? "ok" : "fail",
      detail:
        certificate.router_names.length > 0
          ? `${certificate.router_names.length}개 라우터가 도메인을 처리 중입니다`
          : "이 도메인을 처리하는 Traefik 라우터를 찾지 못했습니다",
    },
    {
      label: "자동 발급 설정",
      state: certificate.cert_resolvers.length > 0 ? "ok" : "fail",
      detail:
        certificate.cert_resolvers.length > 0
          ? `certResolver ${certificate.cert_resolvers.join(", ")} 사용`
          : "certResolver가 없어 Let’s Encrypt 자동 발급이 돌지 않습니다",
    },
    {
      label: "ACME 저장소",
      state: certificate.expires_at ? "ok" : certificate.status === "pending" ? "pending" : "fail",
      detail: certificate.expires_at
        ? "인증서가 ACME 저장소에 기록돼 있습니다"
        : certificate.status === "pending"
          ? "라우터는 준비됐지만 인증서가 아직 저장되지 않았습니다"
          : "저장된 인증서가 없어 기본 인증서 또는 미설정 상태일 수 있습니다",
    },
    {
      label: "최근 발급 실패",
      state: certificate.last_acme_error_message ? "fail" : "ok",
      detail: certificate.last_acme_error_message
        ? `${recentFailureLabel ? `${recentFailureLabel} · ` : ""}${certificate.last_acme_error_message}`
        : "최근 ACME 실패가 기록되지 않았습니다",
    },
  ];

  if (certificate.last_acme_error_kind === "dns") {
    return {
      action: "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요.",
      items,
    };
  }

  if (certificate.last_acme_error_kind === "authorization" || certificate.last_acme_error_kind === "challenge") {
    return {
      action: "80/443 공개 상태와 challenge 경로 응답을 먼저 확인하세요.",
      items,
    };
  }

  if (certificate.last_acme_error_kind === "rate_limit") {
    return {
      action: "반복 발급을 멈추고 잠시 뒤 다시 검사하세요.",
      items,
    };
  }

  if (certificate.router_names.length === 0) {
    return {
      action: "도메인 라우트가 실제로 생성됐는지 먼저 확인하세요.",
      items,
    };
  }

  if (certificate.cert_resolvers.length === 0) {
    return {
      action: "TLS 설정과 certResolver 연결부터 확인하세요.",
      items,
    };
  }

  if (certificate.status === "pending") {
    return {
      action: "도메인 요청 후 몇 분 뒤 경고 검사를 다시 실행하세요.",
      items,
    };
  }

  if (certificate.status === "inactive") {
    return {
      action: "자동 발급을 쓰려면 이 도메인 라우트에 certResolver를 붙여야 합니다.",
      items,
    };
  }

  return {
    action: "추가 조치 없이 현재 상태만 모니터링하면 됩니다.",
    items,
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
