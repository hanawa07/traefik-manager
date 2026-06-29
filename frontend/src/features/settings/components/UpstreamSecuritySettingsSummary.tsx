import type { UpstreamSecuritySettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";

interface UpstreamSecuritySettingsSummaryProps {
  settings?: UpstreamSecuritySettingsStatus;
}

export function UpstreamSecuritySettingsSummary({ settings }: UpstreamSecuritySettingsSummaryProps) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow label="정책 preset" value={settings?.preset_name ?? "사용자 정의"} />
      <SettingsSummaryRow label="DNS strict mode" value={settings?.dns_strict_mode ? "활성화" : "비활성화"} />
      <SettingsSummaryRow label="업스트림 allowlist" value={settings?.allowlist_enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow
        label="허용 suffix"
        value={settings?.allowed_domain_suffixes?.length ? `${settings.allowed_domain_suffixes.length}개` : "없음"}
      />
      <SettingsSummaryRow label="Docker 서비스명" value={settings?.allow_docker_service_names ? "허용" : "차단"} />
      <SettingsSummaryRow
        label="사설 IPv4 / Tailscale IP"
        value={settings?.allow_private_networks ? "허용" : "차단"}
      />
      {settings?.allowed_domain_suffixes?.length ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">허용 suffix 목록</p>
          <div className="flex flex-wrap gap-2">
            {settings.allowed_domain_suffixes.map((suffix) => (
              <span
                key={suffix}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-mono text-[11px] text-gray-700"
              >
                {suffix}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-gray-500">{settings?.preset_description}</p>
      <p className="text-xs text-gray-500 pt-1">
        allowlist는 저장 시점에 외부 FQDN, Docker 서비스명, IP 리터럴을 정책대로 제한합니다. strict mode는 도메인
        업스트림을 DNS 재해석해서 금지 주소 여부를 추가로 검사합니다.
      </p>
    </SettingsSummary>
  );
}
