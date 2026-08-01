interface ContainerImportNetworkNoticeProps {
  networks: string[];
}

export function ContainerImportNetworkNotice({
  networks,
}: ContainerImportNetworkNoticeProps) {
  if (networks.includes("proxy_net")) return null;

  return (
    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      Traefik이 직접 연결할 수 없는 내부 전용 후보입니다. 같은 Compose의 nginx 또는 gateway 중 proxy_net 연결 항목을 우선 선택하세요.
    </p>
  );
}
