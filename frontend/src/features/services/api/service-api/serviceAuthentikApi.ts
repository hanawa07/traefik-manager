import apiClient from "@/shared/lib/apiClient";

import type { AuthentikGroup } from "./serviceTypes";

export const serviceAuthentikApi = {
  listAuthentikGroups: async (): Promise<AuthentikGroup[]> => {
    const res = await apiClient.get<AuthentikGroup[]>("/services/authentik/groups");
    return res.data;
  },
};
