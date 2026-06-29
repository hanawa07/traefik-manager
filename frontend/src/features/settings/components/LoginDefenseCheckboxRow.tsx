export function LoginDefenseCheckboxRow({
  checked,
  accentClassName,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  accentClassName: string;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={
        "flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 " +
        "text-sm text-gray-700 cursor-pointer"
      }
    >
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 rounded ${accentClassName}`}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-1">{description}</span>
      </span>
    </label>
  );
}
