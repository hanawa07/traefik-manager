import { CloudflareDnsTextField } from "@/features/settings/components/CloudflareDnsTextField";

interface CloudflareZoneApiTokenFieldProps {
  value: string;
  onChange: (apiToken: string) => void;
}

export function CloudflareZoneApiTokenField({
  value,
  onChange,
}: CloudflareZoneApiTokenFieldProps) {
  return (
    <CloudflareDnsTextField
      label="API Token"
      type="password"
      placeholder="새 토큰 입력 (비워두면 기존 값 유지가 아니라 이 영역 저장 자체가 비활성화됩니다)"
      value={value}
      help={
        <>
          Cloudflare → My Profile → API Tokens → Create Token →{" "}
          <strong>Zone:DNS:Edit</strong>, <strong>Zone:Zone:Read</strong> 권한이 필요합니다.
        </>
      }
      onChange={onChange}
    />
  );
}
