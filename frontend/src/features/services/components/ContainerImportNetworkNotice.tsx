interface ContainerImportNetworkNoticeProps {
  networks: string[];
  recommendedGatewayName?: string | null;
}

export function ContainerImportNetworkNotice({
  networks,
  recommendedGatewayName,
}: ContainerImportNetworkNoticeProps) {
  if (networks.includes("proxy_net")) return null;

  return (
    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      {recommendedGatewayName
        ? `Traefik이 직접 연결할 수 없습니다. 같은 Compose의 ${recommendedGatewayName} 컨테이너를 자동 추천합니다.`
        : "Traefik이 직접 연결할 수 없는 내부 전용 후보입니다. 같은 Compose의 proxy_net nginx 또는 gateway를 선택하세요."}
    </p>
  );
}
