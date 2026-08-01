import type { UseFormSetValue } from "react-hook-form";

import type { DockerContainer } from "@/features/docker/api/dockerApi";
import type { TraefikImportCandidate } from "./containerImportTypes";
import type { ServiceFormData } from "./serviceFormSchema";

export function getSuggestedUpstreamPort(container: DockerContainer): number {
  return container.ports[0]?.private_port ?? 80;
}

export function applyBasicContainerImport(
  setValue: UseFormSetValue<ServiceFormData>,
  container: DockerContainer,
  upstreamContainer: DockerContainer = container,
) {
  setValue("name", container.name);
  setValue("upstream_host", upstreamContainer.name);
  setValue("upstream_port", getSuggestedUpstreamPort(upstreamContainer));
}

export function applyTraefikContainerImport(
  setValue: UseFormSetValue<ServiceFormData>,
  candidate: TraefikImportCandidate,
) {
  setValue("name", candidate.containerName);
  setValue("domain", candidate.domain);
  setValue("upstream_host", candidate.upstream_host);
  setValue("upstream_port", candidate.upstream_port);
  setValue("tls_enabled", candidate.tls_enabled);
}

export function withRecommendedGatewayUpstream(
  candidate: TraefikImportCandidate,
): TraefikImportCandidate {
  if (!candidate.recommendedGateway) return candidate;

  return {
    ...candidate,
    upstream_host: candidate.recommendedGateway.containerName,
    upstream_port: candidate.recommendedGateway.upstreamPort,
  };
}
