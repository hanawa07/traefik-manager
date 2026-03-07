import apiClient from "@/shared/lib/apiClient";

export interface DockerContainerCandidate {
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
  candidates: DockerContainerCandidate[];
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
