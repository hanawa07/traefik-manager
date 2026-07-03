import apiClient from "@/shared/lib/apiClient";

export interface DeploymentComponent {
  name: string;
  container_name: string;
  status: string;
  container_id: string | null;
  image: string | null;
  image_id: string | null;
  image_created: string | null;
  version: string | null;
  revision: string | null;
  build_date: string | null;
  source: string | null;
  oci_labels: Record<string, string>;
}

export interface DeploymentInfo {
  enabled: boolean;
  message: string;
  version: string | null;
  revision: string | null;
  build_date: string | null;
  components: DeploymentComponent[];
}

export const deploymentApi = {
  getInfo: async (): Promise<DeploymentInfo> => {
    const res = await apiClient.get<DeploymentInfo>("/docker/deployment");
    return res.data;
  },
};
