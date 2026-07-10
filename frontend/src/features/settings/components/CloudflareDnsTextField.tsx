import type { ReactNode } from "react";

interface CloudflareDnsTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  help?: ReactNode;
  labelSuffix?: string;
}

export function CloudflareDnsTextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  labelSuffix,
}: CloudflareDnsTextFieldProps) {
  return (
    <div>
      <label className="label">
        {label}{" "}
        {labelSuffix ? <span className="font-normal text-gray-400 dark:text-slate-500">{labelSuffix}</span> : null}
      </label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{help}</p> : null}
    </div>
  );
}
