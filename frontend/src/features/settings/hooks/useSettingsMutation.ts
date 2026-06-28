import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

type SettingsMutationOptions<TData, TVariables, TOnMutateResult> = Omit<
  UseMutationOptions<TData, unknown, TVariables, TOnMutateResult>,
  "mutationFn"
> & {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: readonly QueryKey[];
};

export function useSettingsMutation<TData = unknown, TVariables = void, TOnMutateResult = unknown>({
  invalidateKeys = [],
  onSuccess,
  ...options
}: SettingsMutationOptions<TData, TVariables, TOnMutateResult>) {
  const queryClient = useQueryClient();

  return useMutation<TData, unknown, TVariables, TOnMutateResult>({
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context);
      await Promise.all(
        invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}
