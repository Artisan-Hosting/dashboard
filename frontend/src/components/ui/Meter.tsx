// Usage bar with an "included" tick mark, matching console.css's `.meter-*`
// classes (see redesign-and-blend/project.html's Memory/Processor/Traffic
// bars). `value`/`included` are in the same unit; `pctOfIncluded` drives the
// filled width and switches to the "over" color past 100%.
export function Meter({
  label,
  value,
  valueLabel,
  included,
  includedLabel,
  capNote,
}: {
  label: string;
  value: number;
  valueLabel: string;
  included: number;
  includedLabel: string;
  capNote?: string;
}) {
  const pct = included > 0 ? (value / included) * 100 : 0;
  const barPct = Math.min(pct, 100);
  const over = pct > 100;
  const tickPct = included > 0 ? Math.min((included / Math.max(value, included)) * 100, 100) : 100;

  return (
    <div
      className="meter"
      role="img"
      aria-label={`${label}, ${valueLabel}. Included: ${includedLabel}.`}
    >
      <div className="meter-top">
        <span>{label}</span>
        <span className="v">{valueLabel}</span>
      </div>
      <div className="meter-bar">
        <i className={over ? 'over' : ''} style={{ width: `${barPct}%` }} />
        <b style={{ left: `${tickPct}%` }} />
      </div>
      <div className="meter-cap">{capNote ?? `Included: ${includedLabel}.`}</div>
    </div>
  );
}
