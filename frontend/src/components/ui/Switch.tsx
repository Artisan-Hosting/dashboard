// A11y toggle switch matching console.css's `.switch` (role="switch"), used
// in place of a raw checkbox input for boolean settings (e.g. domain
// auto-renew, watchdog flags).
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}
