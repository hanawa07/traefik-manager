import type { UseFormSetValue } from "react-hook-form";

import type { DockerContainer } from "@/features/docker/api/dockerApi";
import type { TraefikImportCandidate } from "./containerImportTypes";
import type { ServiceFormData } from "./serviceFormSchema";
import { getSuggestedUpstreamPort } from "./serviceFormUtils";

export function applyBasicContainerImport(
  setValue: UseFormSetValue<ServiceFormData>,
  container: DockerContainer,
) {
  setValue("name", container.name);
  setValue("upstream_host", container.name);
  setValue("upstream_port", getSuggestedUpstreamPort(container));
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
