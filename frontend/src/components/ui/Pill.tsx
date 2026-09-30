// A colored status dot + label, backed by the `.pill[data-s=...]` rules in
// globals.css. `status` is matched case-insensitively against the states
// console.css already maps to a dot color (running/live/active = ok,
// starting/building/syncing = info, stopped/idle/unknown = muted,
// warning/outdated = warn, error/failed = bad); anything else falls back to
// muted rather than throwing, since new backend states shouldn't break the UI.
export function Pill({ status, label }: { status: string; label?: string }) {
  return (
    <span className="pill" data-s={status.toLowerCase()}>
      {label ?? status}
    </span>
  );
}
