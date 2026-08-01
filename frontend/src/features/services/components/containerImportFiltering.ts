import type { DockerContainer, DockerContainerPort } from "@/features/docker/api/dockerApi";
import type { TraefikImportCandidate } from "./containerImportTypes";

const PROXY_NETWORK_NAME = "proxy_net";
const GATEWAY_MARKERS = ["gateway", "nginx"];

export function formatDockerPortLabel(port: DockerContainerPort): string {
  const publicSuffix = port.public_port != null ? ` -> ${port.public_port}` : "";
  const protocolSuffix = port.type ? `/${port.type}` : "";
  return `${port.private_port}${publicSuffix}${protocolSuffix}`;
}

export function buildTraefikImportCandidates(containers: DockerContainer[]) {
  return containers.flatMap((container) =>
    container.traefik_candidates.map((candidate) => {
      const recommendedGateway = findRecommendedComposeGateway(container, containers);
      return {
        containerName: container.name,
        image: container.image,
        networks: container.networks,
        composeProject: container.compose_project,
        composeService: container.compose_service,
        isRecommendedGateway: isRecommendedComposeGateway(container, containers),
        recommendedGatewayName: recommendedGateway?.name ?? null,
        ...candidate,
      };
    }),
  );
}

export function prioritizeProxyNetworkContainers(containers: DockerContainer[]) {
  const recommendedNames = new Set(
    containers
      .filter((container) => !container.networks.includes(PROXY_NETWORK_NAME))
      .map((container) => findRecommendedComposeGateway(container, containers)?.name)
      .filter((name): name is string => Boolean(name)),
  );
  const score = (container: DockerContainer) =>
    recommendedNames.has(container.name)
      ? 2
      : Number(container.networks.includes(PROXY_NETWORK_NAME));
  return [...containers].sort((left, right) => score(right) - score(left));
}

export function findRecommendedComposeGateway(
  container: DockerContainer,
  containers: DockerContainer[],
) {
  if (!container.compose_project || container.networks.includes(PROXY_NETWORK_NAME)) {
    return undefined;
  }

  return containers
    .filter(
      (candidate) =>
        candidate.compose_project === container.compose_project &&
        candidate.networks.includes(PROXY_NETWORK_NAME) &&
        gatewayScore(candidate) > 0,
    )
    .sort((left, right) => gatewayScore(right) - gatewayScore(left))[0];
}

export function isRecommendedComposeGateway(
  container: DockerContainer,
  containers: DockerContainer[],
) {
  // ponytail: Docker 목록은 작으므로 프로젝트 맵은 실제 병목이 확인될 때만 도입합니다.
  return containers.some(
    (candidate) =>
      findRecommendedComposeGateway(candidate, containers)?.name === container.name,
  );
}

function gatewayScore(container: DockerContainer) {
  const identity = `${container.compose_service || ""} ${container.name}`.toLowerCase();
  const image = (container.image || "").toLowerCase();
  const identityIndex = GATEWAY_MARKERS.findIndex((marker) => identity.includes(marker));
  if (identityIndex >= 0) return GATEWAY_MARKERS.length - identityIndex + 1;
  return GATEWAY_MARKERS.some((marker) => image.includes(marker)) ? 1 : 0;
}

export function filterDockerContainers(containers: DockerContainer[], query: string) {
  if (!query) return containers;

  return containers.filter((container) => {
    const haystack = [
      container.name,
      container.image || "",
      container.state || "",
      container.status || "",
      container.compose_project || "",
      container.compose_service || "",
      ...container.networks,
      ...container.ports.map((port) => formatDockerPortLabel(port)),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function filterTraefikImportCandidates(candidates: TraefikImportCandidate[], query: string) {
  if (!query) return candidates;

  return candidates.filter((candidate) => {
    const haystack = [
      candidate.domain,
      candidate.containerName,
      candidate.image || "",
      candidate.router_name,
      candidate.composeProject || "",
      candidate.composeService || "",
      candidate.recommendedGatewayName || "",
      String(candidate.upstream_port),
      ...candidate.networks,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
