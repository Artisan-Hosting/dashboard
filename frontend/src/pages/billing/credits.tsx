import { useCallback, useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { TopBar } from '@/components/topbar';
import { isAdminRole } from '@/components/requireAdmin';
import LoadingOverlay from '@/components/loading';
import { useUser } from '@/hooks/useUser';
import { useElevatedSession } from '@/hooks/useElevatedSession';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import {
  fetchCreditBalance,
  fetchCreditLedger,
  fetchViewerBillingAccess,
  setViewerBillingAccess,
  topUpCredit,
} from '@/lib/api';
import { loadStripe, StripeJs } from '@/lib/stripe';
import { CreditBalance, CreditLedgerEntry } from '@/lib/types';
import { Button, Field, Panel, Pill, Switch } from '@/components/ui';

const PAGE_SIZE = 25;
const MIN_TOPUP_CENTS = 2500;
const CHIPS = [2500, 5000, 10000, 25000];

const usd = (cents: number) =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ENTRY_LABEL: Record<string, string> = { topup: 'Top-up', debit: 'Usage', adjustment: 'Adjustment' };

type Phase = 'pick' | 'card' | 'confirming' | 'waiting';

function TopUp({
  orgId,
  startBalance,
  elevated,
  onLanded,
}: {
  orgId: string;
  startBalance: number;
  elevated: ReturnType<typeof useElevatedSession>;
  onLanded: () => void;
}) {
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState('');
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const stripeRef = useRef<{ stripe: StripeJs; elements: any } | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  const cents = custom ? Math.round(parseFloat(custom) * 100) : amount;
  const valid = Number.isFinite(cents) && cents >= MIN_TOPUP_CENTS;

  const begin = async () => {
    if (!valid || !elevated.token) return;
    setError(null);
    try {
      const checkout = await topUpCredit({ amountCents: cents, elevatedToken: elevated.token, organizationId: orgId });
      const stripe = await loadStripe(checkout.stripe_publishable_key);
      const elements = stripe.elements({ clientSecret: checkout.stripe_client_secret });
      stripeRef.current = { stripe, elements };
      setPhase('card');
      // The mount node renders with the card phase, so wait a tick for it.
      setTimeout(() => {
        if (mountRef.current) elements.create('payment').mount(mountRef.current);
      }, 0);
    } catch (err: any) {
      setError(err?.message ?? 'Could not start the top-up.');
    }
  };

  const pay = async () => {
    const held = stripeRef.current;
    if (!held) return;
    setPhase('confirming');
    setError(null);
    const result = await held.stripe.confirmPayment({ elements: held.elements, redirect: 'if_required' });
    if (result.error) {
      setError(result.error.message ?? 'The payment did not go through.');
      setPhase('card');
      return;
    }
    // Stripe accepted the card; the credit is written when Stripe's webhook
    // reaches Billing, which takes a few seconds. Poll until the balance moves.
    setPhase('waiting');
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const latest = await fetchCreditBalance(orgId);
        if (latest.balance_cents !== startBalance) {
          toast.success('Credit added.');
          setPhase('pick');
          onLanded();
          return;
        }
      } catch {
        // keep polling; a transient read failure is not a failed payment
      }
    }
    toast('Your payment went through. The credit can take a minute to appear.');
    setPhase('pick');
    onLanded();
  };

  if (phase === 'card' || phase === 'confirming') {
    return (
      <div className="space-y-4">
        <div ref={mountRef} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={pay} disabled={phase === 'confirming'}>
          {phase === 'confirming' ? 'Paying...' : `Pay ${usd(cents)}`}
        </Button>
      </div>
    );
  }
  if (phase === 'waiting') {
    return <p className="text-sm">Payment received. Waiting for it to show in your balance...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={!custom && amount === c}
            onClick={() => {
              setAmount(c);
              setCustom('');
            }}
          >
            {usd(c)}
          </button>
        ))}
        <Field
          sans
          inputMode="decimal"
          placeholder="Other amount"
          aria-label="Other amount in dollars"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          style={{ width: '9rem' }}
        />
      </div>
      {!valid && <p className="text-sm" style={{ color: 'var(--muted)' }}>The minimum top-up is {usd(MIN_TOPUP_CENTS)}.</p>}
      {!elevated.isElevated ? (
        <div className="flex gap-2 items-center flex-wrap">
          <Field
            sans
            type="password"
            placeholder="Re-enter your password to pay"
            value={elevated.password}
            onChange={(e) => elevated.setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && elevated.elevate()}
          />
          <Button onClick={elevated.elevate} disabled={elevated.busy || !elevated.password}>
            {elevated.busy ? 'Checking...' : 'Unlock'}
          </Button>
          {elevated.error && <span className="text-sm text-red-500">{elevated.error}</span>}
        </div>
      ) : (
        <Button onClick={begin} disabled={!valid}>
          Continue to payment
        </Button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

export default function CreditsPage() {
  const { role, orgId, isLoading: userLoading } = useUser();
  const elevated = useElevatedSession();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [viewersSee, setViewersSee] = useState(false);

  const isAdmin = isAdminRole(role);

  const load = useCallback(
    async (at: number) => {
      try {
        const [b, page] = await Promise.all([
          fetchCreditBalance(orgId || undefined),
          fetchCreditLedger({ organizationId: orgId || undefined, limit: PAGE_SIZE, offset: at }),
        ]);
        setBalance(b);
        setEntries(page.entries);
        setTotal(page.total);
        setLocked(false);
      } catch (err: any) {
        // Billing answers permission_denied for a role the org hasn't opted in.
        setLocked(true);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  useEffect(() => {
    if (userLoading) return;
    load(offset);
  }, [userLoading, offset, load]);

  useEffect(() => {
    if (userLoading || !isAdmin || !orgId) return;
    fetchViewerBillingAccess(orgId).then(setViewersSee).catch(() => {});
  }, [userLoading, isAdmin, orgId]);

  const toggleViewers = async (next: boolean) => {
    if (!elevated.token) {
      toast.error('Unlock with your password first.');
      return;
    }
    try {
      await setViewerBillingAccess(orgId, next, elevated.token);
      setViewersSee(next);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not change the setting.');
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
      <Toaster />
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <h1 className="text-3xl font-bold text-brand">Credit</h1>

        {locked ? (
          <Panel title="Billing is limited to admins">
            <p className="text-sm">Ask an admin of your organization if you need to see credit and payments.</p>
          </Panel>
        ) : (
          balance && (
            <>
              <Panel title="Balance">
                <div className="text-4xl font-semibold" style={{ color: 'var(--strong)' }}>
                  {usd(balance.balance_cents)}
                </div>
                {balance.balance_cents < 0 && (
                  <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                    Usage went past your balance. Top up to bring it back above zero.
                  </p>
                )}
              </Panel>

              {isAdmin && (
                <Panel title="Add credit">
                  <TopUp
                    orgId={orgId}
                    startBalance={balance.balance_cents}
                    elevated={elevated}
                    onLanded={() => {
                      setOffset(0);
                      load(0);
                    }}
                  />
                </Panel>
              )}

              <Panel title="History">
                {entries.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No credit activity yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th className="r">Amount</th>
                          <th className="r">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.id}>
                            <td>{new Date(e.created_at * 1000).toLocaleString()}</td>
                            <td>
                              <Pill status={e.entry_type === "debit" ? "idle" : "active"} label={ENTRY_LABEL[e.entry_type] ?? e.entry_type} />
                            </td>
                            <td className={`amt ${e.amount_cents > 0 ? 'plus' : ''}`}>
                              {e.amount_cents > 0 ? '+' : ''}
                              {usd(e.amount_cents)}
                            </td>
                            <td className="amt">{usd(e.balance_after_cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                    <span>
                      Page {page} of {pages}
                    </span>
                    <span className="flex gap-2">
                      <Button small variant="ghost" disabled={offset === 0} onClick={() => setOffset(offset - PAGE_SIZE)}>
                        Newer
                      </Button>
                      <Button small variant="ghost" disabled={page >= pages} onClick={() => setOffset(offset + PAGE_SIZE)}>
                        Older
                      </Button>
                    </span>
                  </div>
                )}
              </Panel>

              {isAdmin && orgId && (
                <Panel title="Who can see billing">
                  <div className="flex items-center gap-3">
                    <Switch checked={viewersSee} onChange={toggleViewers} label="Let viewers see billing" />
                    <span className="text-sm">Let viewers see billing</span>
                  </div>
                  <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                    Off by default. Viewers can look but never spend. Changing this needs your password.
                  </p>
                  {!elevated.isElevated && (
                    <div className="flex gap-2 items-center mt-3 flex-wrap">
                      <Field
                        sans
                        type="password"
                        placeholder="Password"
                        value={elevated.password}
                        onChange={(e) => elevated.setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && elevated.elevate()}
                      />
                      <Button small onClick={elevated.elevate} disabled={elevated.busy || !elevated.password}>
                        Unlock
                      </Button>
                    </div>
                  )}
                </Panel>
              )}
            </>
          )
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}
