interface UserMutationErrorProps {
  error: unknown;
  fallbackMessage: string;
}

export function UserMutationError({ error, fallbackMessage }: UserMutationErrorProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-600">{getUserMutationErrorMessage(error, fallbackMessage)}</p>
    </div>
  );
}

function getUserMutationErrorMessage(error: unknown, fallbackMessage: string) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallbackMessage;
}
