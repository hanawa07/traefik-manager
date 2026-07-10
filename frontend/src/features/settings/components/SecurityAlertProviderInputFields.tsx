export function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  help,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  help?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{help}</p> : null}
    </div>
  );
}

export function SecretField(props: Omit<Parameters<typeof TextField>[0], "type">) {
  return <TextField {...props} type="password" />;
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        min={1}
        max={65535}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
