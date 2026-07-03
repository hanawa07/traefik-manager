import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Shield } from "lucide-react";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceNetworkSecurityFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  setValue: UseFormSetValue<ServiceFormData>;
  tlsEnabled: boolean;
  upstreamScheme: "http" | "https";
}

export default function ServiceNetworkSecurityFields({
  register,
  setValue,
  tlsEnabled,
  upstreamScheme,
}: ServiceNetworkSecurityFieldsProps) {
  return (
    <div className="space-y-4 pt-2 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-600" />
        네트워크 및 보안
      </h3>

      <div className="space-y-3 pl-1">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("tls_enabled")} />
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-700">HTTPS (TLS) 활성화</span>
            <p className="text-xs text-gray-500">Let&apos;s Encrypt 인증서 자동 발급</p>
          </div>
        </label>

        <label className={`flex items-start gap-3 ${tlsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-blue-600"
            disabled={!tlsEnabled}
            {...register("https_redirect_enabled")}
          />
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-700">HTTP → HTTPS 자동 리다이렉트</span>
            <p className="text-xs text-gray-500">HTTP 요청을 HTTPS로 강제 전환합니다</p>
          </div>
        </label>

        <div className="pt-1">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-blue-600"
              checked={upstreamScheme === "https"}
              onChange={(event) => setValue("upstream_scheme", event.target.checked ? "https" : "http")}
            />
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-700">업스트림 HTTPS 사용</span>
              <p className="text-xs text-gray-500">백엔드 서비스가 자체 HTTPS를 사용하는 경우 체크</p>
            </div>
          </label>

          {upstreamScheme === "https" && (
            <label className="mt-3 ml-7 flex cursor-pointer items-start gap-3 animate-in fade-in slide-in-from-left-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-blue-600"
                {...register("skip_tls_verify")}
              />
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-700">TLS 인증서 검증 무시</span>
                <p className="text-xs text-gray-500">자체서명 인증서를 사용하는 경우 체크</p>
              </div>
            </label>
          )}
        </div>

        <div className="pt-2">
          <label className="label">프레임 정책</label>
          <select className="input" {...register("frame_policy")}>
            <option value="deny">DENY (기본 권장)</option>
            <option value="sameorigin">SAMEORIGIN (Cockpit/iframe 기반 앱)</option>
            <option value="off">OFF (특수한 임베드 환경만)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            전역 보안 헤더와 별도로 이 서비스가 어떤 X-Frame-Options 정책을 가질지 결정합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
