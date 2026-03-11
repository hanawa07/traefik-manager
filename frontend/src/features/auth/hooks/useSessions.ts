import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "../api/authApi";

const QUERY_KEY = ["auth", "sessions"];

export function useSessions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: authApi.listSessions,
  });
}

export function useLogoutAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
