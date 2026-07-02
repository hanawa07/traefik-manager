interface CertificateDiagnosticsSettingsNumberFieldProps {
  label: string;
  min: number;
  max: number;
  value: number;
  help: string;
  onChange: (value: number) => void;
}

export function CertificateDiagnosticsSettingsNumberField({
  label,
  min,
  max,
  value,
  help,
  onChange,
}: CertificateDiagnosticsSettingsNumberFieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        className="input"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || min))}
      />
      <p className="mt-1 text-xs text-gray-500">{help}</p>
    </div>
  );
}
