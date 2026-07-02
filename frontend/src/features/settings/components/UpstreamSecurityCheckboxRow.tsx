interface UpstreamSecurityCheckboxRowProps {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}

export function UpstreamSecurityCheckboxRow({
  checked,
  title,
  description,
  onChange,
}: UpstreamSecurityCheckboxRowProps) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 " +
        "text-sm text-gray-700"
      }
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded accent-rose-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-gray-900">{title}</span>
        <span className="mt-1 block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  );
}
