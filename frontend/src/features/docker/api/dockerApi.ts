import apiClient from "@/shared/lib/apiClient";

export interface DockerContainerPort {
  private_port: number;
  public_port: number | null;
  type: string | null;
}

export interface DockerTraefikCandidate {
  router_name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  tls_enabled: boolean;
}

export interface DockerContainer {
  id: string | null;
  name: string;
  image: string | null;
  state: string | null;
  status: string | null;
  ports: DockerContainerPort[];
  networks: string[];
  traefik_candidates: DockerTraefikCandidate[];
}

export interface DockerContainerListResponse {
  enabled: boolean;
  socket_path: string;
  message: string;
  containers: DockerContainer[];
}

export const dockerApi = {
  listContainers: async (): Promise<DockerContainerListResponse> => {
    const res = await apiClient.get<DockerContainerListResponse>("/docker/containers");
    return res.data;
  },
};
