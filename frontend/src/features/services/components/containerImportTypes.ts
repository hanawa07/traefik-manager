import type { DockerTraefikCandidate } from "@/features/docker/api/dockerApi";

export type ContainerImportMode = "basic" | "traefik";

export type TraefikImportCandidate = DockerTraefikCandidate & {
  containerName: string;
  image: string | null;
  networks: string[];
};
