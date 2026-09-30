// Dark log/terminal panel — matches console.css's `.term`, which stays dark
// in both themes on purpose (a light-mode log viewer reads worse).
export function Term({ lines, tall, className }: { lines: string[]; tall?: boolean; className?: string }) {
  return (
    <div
      className={`term ${tall ? 'tall' : ''} ${className ?? ''}`}
      role="log"
      aria-label="Log output"
      tabIndex={0}
    >
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
