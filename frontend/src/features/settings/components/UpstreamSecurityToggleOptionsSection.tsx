import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";

import { UpstreamSecurityCheckboxRow } from "./UpstreamSecurityCheckboxRow";

interface UpstreamSecurityToggleOptionsSectionProps {
  formValue: UpstreamSecurityForm;
  onFormChange: (value: UpstreamSecurityForm) => void;
}

export function UpstreamSecurityToggleOptionsSection({
  formValue,
  onFormChange,
}: UpstreamSecurityToggleOptionsSectionProps) {
  return (
    <div className="space-y-3">
      <UpstreamSecurityCheckboxRow
        checked={formValue.dns_strict_mode}
        title="DNS strict mode 활성화"
        description={
          "도메인 업스트림 저장 시 DNS를 다시 조회해서 loopback, link-local, 문서 예제 대역 같은 금지 주소로 해석되는지 검사합니다."
        }
        onChange={(checked) => onFormChange({ ...formValue, dns_strict_mode: checked })}
      />

      <UpstreamSecurityCheckboxRow
        checked={formValue.allow_docker_service_names}
        title="Docker 서비스명 허용"
        description="`vaultwarden`, `open-webui` 같은 점 없는 내부 호스트명을 허용합니다."
        onChange={(checked) => onFormChange({ ...formValue, allow_docker_service_names: checked })}
      />

      <UpstreamSecurityCheckboxRow
        checked={formValue.allow_private_networks}
        title="사설 IPv4 / Tailscale IP 허용"
        description="`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `100.64.0.0/10` 대역 IP 리터럴을 허용합니다."
        onChange={(checked) => onFormChange({ ...formValue, allow_private_networks: checked })}
      />

      <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
        <p>기본값은 비활성화입니다.</p>
        <p>권장 사용처: 외부 FQDN을 업스트림으로 자주 등록하는 환경</p>
        <p>주의: allowlist를 켠 상태에서 suffix 목록이 비어 있으면 외부 FQDN은 모두 차단됩니다.</p>
        <p>주의: DNS 조회 실패 시 strict mode가 켜져 있으면 서비스 저장이 차단됩니다.</p>
      </div>
    </div>
  );
}
