import type { DockerContainer, DockerContainerPort } from "@/features/docker/api/dockerApi";
import type { TraefikImportCandidate } from "./containerImportTypes";

const PROXY_NETWORK_NAME = "proxy_net";

export function formatDockerPortLabel(port: DockerContainerPort): string {
  const publicSuffix = port.public_port != null ? ` -> ${port.public_port}` : "";
  const protocolSuffix = port.type ? `/${port.type}` : "";
  return `${port.private_port}${publicSuffix}${protocolSuffix}`;
}

export function buildTraefikImportCandidates(containers: DockerContainer[]) {
  return containers.flatMap((container) =>
    container.traefik_candidates.map((candidate) => ({
      containerName: container.name,
      image: container.image,
      networks: container.networks,
      ...candidate,
    })),
  );
}

export function prioritizeProxyNetworkContainers(containers: DockerContainer[]) {
  return [...containers].sort(
    (left, right) =>
      Number(right.networks.includes(PROXY_NETWORK_NAME)) -
      Number(left.networks.includes(PROXY_NETWORK_NAME)),
  );
}

export function filterDockerContainers(containers: DockerContainer[], query: string) {
  if (!query) return containers;

  return containers.filter((container) => {
    const haystack = [
      container.name,
      container.image || "",
      container.state || "",
      container.status || "",
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
      String(candidate.upstream_port),
      ...candidate.networks,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
