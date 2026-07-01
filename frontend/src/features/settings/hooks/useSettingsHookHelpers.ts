import { useQuery, type QueryKey } from "@tanstack/react-query";

import { useSettingsMutation } from "./useSettingsMutation";

const SETTINGS_STALE_TIME_MS = 30_000;
export const TEST_HISTORY_STALE_TIME_MS = 10_000;

export function useSettingsQuery<TData>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  staleTime = SETTINGS_STALE_TIME_MS,
) {
  return useQuery<TData>({
    queryKey,
    queryFn,
    staleTime,
  });
}

export function useSettingsMutationForQuery<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKey: QueryKey,
) {
  return useSettingsMutation<TData, TVariables>({
    mutationFn,
    invalidateKeys: [invalidateKey],
  });
}
