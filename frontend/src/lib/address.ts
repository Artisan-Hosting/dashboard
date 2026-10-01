// An address for a deployed app: a free `<name>.<zone>`, a hostname on a domain the customer has,
// or (through the domains page) a bought one. Portal answers in its standard envelope; errors arrive
// as `API Error: <status> <body>`, so the sentence is pulled back out of the body.
import { fetchWithAuth, postWithAuth } from './api';

export type AddressState =
  | 'reserving'
  | 'dns'
  | 'certificate'
  | 'live'
  | 'app_down'
  | 'not_attached'
  | 'failed'
  | 'checking';

export interface AddressView {
  fqdn: string;
  status: string;
  state: AddressState;
  message: string;
}

export interface AddressList {
  app_running: boolean;
  addresses: AddressView[];
}

export interface RecordToAdd {
  type: string;
  name: string;
  content: string;
  note: string;
}

export interface SetAddressResult {
  fqdn: string;
  status: string;
  has_vhost: boolean;
  outcome: string;
  notes: string[];
  required_records: RecordToAdd[];
}

export interface FreeNameAnswer {
  available: boolean;
  fqdn: string;
  reason: string;
  free_zone: string;
}

export interface ReservedRule {
  id: number;
  kind: 'exact' | 'prefix' | 'range';
  prefix: string;
  digits: number;
  min_value: number;
  max_value: number;
  note: string;
  created_by: string;
  created_at: number;
}

export class AddressError extends Error {}

function messageFrom(err: any, fallback: string): string {
  const raw = String(err?.message ?? '');
  const brace = raw.indexOf('{');
  if (brace >= 0) {
    try {
      const body = JSON.parse(raw.slice(brace));
      const first = Array.isArray(body?.errors) ? body.errors[0] : undefined;
      if (first?.message) return String(first.message);
    } catch {
      /* not JSON */
    }
  }
  return fallback;
}

async function call<T>(run: () => Promise<any>, fallback: string): Promise<T> {
  try {
    const res = await run();
    if (res?.status && res.status !== 'success') {
      throw new AddressError((res.errors ?? []).map((e: any) => e.message).join('; ') || fallback);
    }
    return (res?.data ?? res) as T;
  } catch (err: any) {
    if (err instanceof AddressError) throw err;
    throw new AddressError(messageFrom(err, fallback));
  }
}

export const checkFreeName = (name: string) =>
  call<FreeNameAnswer>(() => fetchWithAuth(`proxy/address/free?name=${encodeURIComponent(name)}`), 'Could not check that name');

export const setAddress = (projectId: string, body: { mode: 'free'; name: string } | { mode: 'custom'; fqdn: string }) =>
  call<SetAddressResult>(() => postWithAuth(`proxy/projects/${projectId}/address`, body), 'We could not set that address up');

export const fetchAddresses = (projectId: string) =>
  call<AddressList>(() => fetchWithAuth(`proxy/projects/${projectId}/address`), 'Could not read this app’s addresses');

export const checkAddress = (projectId: string, fqdn: string) =>
  call<AddressView>(() => postWithAuth(`proxy/projects/${projectId}/address/check`, { fqdn }), 'Could not check that address');

// Super only; ais_domains refuses everyone else.
export const listReserved = () =>
  call<{ free_zone: string; rules: ReservedRule[] }>(() => fetchWithAuth('proxy/domains/reserved'), 'Could not load the reserved names');

export const addReserved = (rule: {
  kind: string;
  prefix: string;
  digits?: number;
  min_value?: number;
  max_value?: number;
  note?: string;
}) => call<ReservedRule>(() => postWithAuth('proxy/domains/reserved', rule), 'Could not add that rule');

export const removeReserved = (id: number) =>
  call<{ removed: boolean }>(() => postWithAuth('proxy/domains/reserved/remove', { id }), 'Could not remove that rule');

/** Human words for a reservation, e.g. `c` + 8 digits 0 to 99999999 -> "c00000000 to c99999999". */
export function describeRule(r: ReservedRule): string {
  if (r.kind === 'exact') return r.prefix;
  if (r.kind === 'prefix') return `${r.prefix}…`;
  const pad = (n: number) => String(n).padStart(r.digits, '0');
  return `${r.prefix}${pad(r.min_value)} to ${r.prefix}${pad(r.max_value)}`;
}

/** The step list the live panel shows, from where the address has got to. */
export const LIVE_STEPS: { key: AddressState[]; label: string }[] = [
  { key: ['reserving'], label: 'Reserve the name' },
  { key: ['dns'], label: 'Point it at us' },
  { key: ['not_attached'], label: 'Connect it to your app' },
  { key: ['certificate'], label: 'Get a certificate' },
  { key: ['live', 'app_down'], label: 'Check it answers' },
];
