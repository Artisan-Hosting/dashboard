// Shared money/date/plan formatting for the billing pages.

export const usd = (cents: number) =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const STOREFRONTS: { value: string; label: string }[] = [
  { value: 'developer', label: 'Developer' },
  { value: 'business', label: 'Business' },
  { value: 'email', label: 'Email' },
];

const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

// What a plan includes, in the words the pricing page uses. An unknown unit
// shows its own code rather than disappearing, so a new unit is visible.
export function allowanceText(unitCode: string, qty: number): string {
  switch (unitCode) {
    case 'ram_gb_month':
      return `${n(qty)} GB memory`;
    case 'vcpu_month':
      return `${n(qty)} ${qty === 1 ? 'processor' : 'processors'}`;
    case 'egress_gb':
      return `${n(qty)} GB traffic`;
    case 'email_1k':
      return `${n(qty * 1000)} emails`;
    default:
      return `${n(qty)} ${unitCode}`;
  }
}

// Rates are cents per unit above the allowance.
export function overageText(unitCode: string, rateCents: number): string {
  const price = usd(rateCents);
  switch (unitCode) {
    case 'ram_gb_month':
      return `memory ${price} per GB`;
    case 'vcpu_month':
      return `processor ${price} each`;
    case 'egress_gb':
      return `traffic ${price} per GB`;
    case 'email_1k':
      return `email ${price} per 1,000`;
    default:
      return `${unitCode} ${price}`;
  }
}

export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (!bytes) return '0 B';
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
