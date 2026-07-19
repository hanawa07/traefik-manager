import apiClient from "@/shared/lib/apiClient";

import type {
  BulkRoutingNotificationResult,
  Service,
  ServiceCreate,
  ServiceUpdate,
} from "./serviceTypes";

export const serviceCrudApi = {
  list: async (): Promise<Service[]> => {
    const res = await apiClient.get<Service[]>("/services");
    return res.data;
  },

  get: async (id: string): Promise<Service> => {
    const res = await apiClient.get<Service>(`/services/${id}`);
    return res.data;
  },

  create: async (data: ServiceCreate): Promise<Service> => {
    const res = await apiClient.post<Service>("/services", data);
    return res.data;
  },

  update: async (
    id: string,
    data: ServiceUpdate,
    options?: { bulkOperationId?: string },
  ): Promise<Service> => {
    const res = await apiClient.patch<Service>(`/services/${id}`, data, {
      headers: options?.bulkOperationId
        ? { "X-Bulk-Operation-ID": options.bulkOperationId }
        : undefined,
    });
    return res.data;
  },

  completeBulkRoutingOperation: async (
    operationId: string,
  ): Promise<BulkRoutingNotificationResult> => {
    const res = await apiClient.post<BulkRoutingNotificationResult>(
      `/services/bulk-routing/${operationId}/complete`,
    );
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/services/${id}`);
  },
};
