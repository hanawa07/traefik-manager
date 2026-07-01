interface RedirectErrorNoticeProps {
  message: string;
}

export function RedirectErrorNotice({ message }: RedirectErrorNoticeProps) {
  return (
    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
