import apiClient from "@/shared/lib/apiClient";

export type UserRole = "admin" | "viewer";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

export interface UserUpdate {
  username?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}

export const userApi = {
  list: async (): Promise<User[]> => {
    const res = await apiClient.get<{ users: User[] }>("/users");
    return res.data.users;
  },

  create: async (data: UserCreate): Promise<User> => {
    const res = await apiClient.post<User>("/users", data);
    return res.data;
  },

  update: async (id: string, data: UserUpdate): Promise<User> => {
    const res = await apiClient.put<User>(`/users/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },
};
