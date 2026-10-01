import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Panel, Pill, Seg } from '@/components/ui';
import { useElevatedSession } from '@/hooks/useElevatedSession';
import {
  cancelSubscription,
  fetchInvoices,
  fetchPlans,
  fetchSubscriptions,
  retryInvoicePayment,
  scheduleDowngrade,
  upgradeSubscription,
} from '@/lib/api';
import { Invoice, Plan, Subscription } from '@/lib/types';
import { PaySheet } from './PaySheet';
import { allowanceText, fmtDate, overageText, STOREFRONTS, usd } from './format';

type Sheet =
  | { kind: 'buy'; plan: Plan }
  | { kind: 'switch'; plan: Plan }
  | { kind: 'cancel' }
  | { kind: 'pay'; invoice: Invoice };

const PERIOD_SECONDS = 30 * 24 * 60 * 60;

// What an upgrade costs today, for the dialog's wording only: Billing works out
// and charges the real amount, this just tells the customer what to expect.
function proratedToday(sub: Subscription, from: Plan, to: Plan): number {
  const left = Math.max(0, sub.current_period_end - Math.floor(Date.now() / 1000));
  return Math.round(((to.price_cents - from.price_cents) * Math.min(left, PERIOD_SECONDS)) / PERIOD_SECONDS);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The plan picker and current plan, one storefront at a time. `canChange` is
// false for a viewer the org has opted in: they can look, never spend.
export function PlanSection({ orgId, canChange }: { orgId: string; canChange: boolean }) {
  const elevated = useElevatedSession();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState<Invoice[]>([]);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sf, setSf] = useState('developer');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, inv] = await Promise.all([
        fetchSubscriptions(orgId || undefined),
        fetchPlans(),
        fetchInvoices({ organizationId: orgId || undefined, limit: 50 }),
      ]);
      setSubs(s);
      setPlans(p);
      setOpen(inv.invoices.filter((i) => i.status === 'open'));
      setLocked(false);
    } catch {
      // Billing answers permission_denied for a role the org hasn't opted in.
      setLocked(true);
    } finally {
      setLoaded(true);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // A charge is only real once Stripe's webhook reaches Billing, a few seconds
  // after the card is accepted: wait for the subscription to show it.
  const waitForPayment = async (done: (s: Subscription[]) => boolean) => {
    setBusy(true);
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      try {
        const latest = await fetchSubscriptions(orgId || undefined);
        if (done(latest)) {
          setBusy(false);
          setSheet(null);
          toast.success('Payment received.');
          await load();
          return;
        }
      } catch {
        // a transient read failure is not a failed payment
      }
    }
    setBusy(false);
    setSheet(null);
    toast('Your payment went through. It can take a minute to show here.');
    await load();
  };

  if (!loaded) return null;
  if (locked) {
    return (
      <Panel title="Billing is limited to admins">
        <p className="text-sm">Ask an admin of your organization if you need to see plans and payments.</p>
      </Panel>
    );
  }

  const catalog = plans.filter((p) => p.storefront === sf);
  const sub = subs.find((s) => s.storefront === sf);
  // A cancellation that has run out is shown as "no plan": buying again restarts it.
  const live = sub && sub.status !== 'canceled' && sub.status !== 'deleted' ? sub : undefined;
  const current = live ? plans.find((p) => p.plan_code === live.plan_code) : undefined;
  const pending = live?.pending_plan_code ? plans.find((p) => p.plan_code === live.pending_plan_code) : undefined;
  const owed = live ? open.find((i) => i.subscription_id === live.id) : undefined;
  const storefrontName = STOREFRONTS.find((s) => s.value === sf)?.label ?? sf;
  const pickable = canChange;

  const sheetBody = () => {
    if (!sheet) return null;
    if (sheet.kind === 'buy') {
      const p = sheet.plan;
      const today = live && current ? proratedToday(live, current, p) : p.price_cents;
      return (
        <Panel title={`${live ? 'Upgrade to' : 'Start'} ${p.display_name}`}>
          <p className="text-sm">
            {live
              ? `Takes effect as soon as the payment goes through. You pay the difference for the days left, then ${usd(p.price_cents)} a month from ${fmtDate(live.current_period_end)}.`
              : `Your plan starts as soon as the payment goes through, then renews at ${usd(p.price_cents)} a month until you cancel.`}
          </p>
          {busy ? (
            <p className="text-sm">Payment received. Waiting for it to show...</p>
          ) : (
            <PaySheet
              amountCents={today}
              elevated={elevated}
              begin={(token) =>
                upgradeSubscription({ storefront: sf, planCode: p.plan_code, elevatedToken: token, organizationId: orgId || undefined })
              }
              onPaid={() => waitForPayment((s) => s.some((x) => x.storefront === sf && x.plan_code === p.plan_code && x.status === 'active'))}
              onCancel={() => setSheet(null)}
            />
          )}
        </Panel>
      );
    }
    if (sheet.kind === 'pay' && live) {
      return (
        <Panel title={`Pay for ${current?.display_name ?? 'your plan'}`}>
          <p className="text-sm">This pays the payment that is already waiting. It does not make a second one.</p>
          {busy ? (
            <p className="text-sm">Payment received. Waiting for it to show...</p>
          ) : (
            <PaySheet
              amountCents={sheet.invoice.total_cents}
              amountLabel="Amount due"
              elevated={elevated}
              begin={(token) =>
                retryInvoicePayment({ invoiceId: sheet.invoice.id, elevatedToken: token, organizationId: orgId || undefined })
              }
              onPaid={() => waitForPayment((s) => s.some((x) => x.id === live.id && x.status === 'active'))}
              onCancel={() => setSheet(null)}
            />
          )}
        </Panel>
      );
    }
    if (sheet.kind === 'switch' && live) {
      const p = sheet.plan;
      return (
        <Panel title={`Switch to ${p.display_name}`}>
          <p className="text-sm">
            Nothing is charged and nothing changes today. You keep {current?.display_name} until {fmtDate(live.current_period_end)}, then
            move to {p.display_name} at {usd(p.price_cents)} a month.
          </p>
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await scheduleDowngrade({ storefront: sf, planCode: p.plan_code, organizationId: orgId || undefined });
                  toast.success('Switch scheduled.');
                  setSheet(null);
                  await load();
                } catch (err: any) {
                  toast.error(err?.message ?? 'Could not schedule the switch.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Schedule the switch
            </Button>
            <Button variant="ghost" onClick={() => setSheet(null)}>
              Keep my plan
            </Button>
          </div>
        </Panel>
      );
    }
    if (sheet.kind === 'cancel' && live) {
      return (
        <Panel title={`Cancel ${current?.display_name ?? 'your plan'}`}>
          <p className="text-sm">
            Everything keeps working until {fmtDate(live.current_period_end)}. You have already paid for it. After that the plan ends and you
            are not charged again. Your data stays yours.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await cancelSubscription({ storefront: sf, organizationId: orgId || undefined });
                  toast.success('Cancelled at the end of the period.');
                  setSheet(null);
                  await load();
                } catch (err: any) {
                  toast.error(err?.message ?? 'Could not cancel the plan.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancel at the end of the period
            </Button>
            <Button variant="ghost" onClick={() => setSheet(null)}>
              Keep my plan
            </Button>
          </div>
        </Panel>
      );
    }
    return null;
  };

  const status = live ? (live.cancel_at_period_end ? 'ending' : live.status) : 'none';
  const statusLabel: Record<string, string> = {
    active: 'Active',
    past_due: 'Payment due',
    grace_period: 'Overdue',
    suspended: 'Suspended',
    ending: 'Ending',
    none: 'No plan',
  };

  return (
    <div className="stack">
      <Seg value={sf} onChange={(v) => { setSf(v); setSheet(null); }} options={STOREFRONTS} label="Product" />

      <Panel title={`Your ${storefrontName} plan`}>
        <div className="subhead">
          <h2>{live ? (current?.display_name ?? live.plan_code) : 'No plan yet'}</h2>
          <Pill status={status} label={statusLabel[status] ?? status} />
        </div>
        {live && current && (
          <p>
            <span className="big" style={{ fontSize: '2rem' }}>{usd(current.price_cents)}</span>{' '}
            <span className="sub">a month. Renews {fmtDate(live.current_period_end)}.</span>
          </p>
        )}
        {!live && <p className="sub">You do not have a plan for this yet. Pick one below.</p>}
        {live && live.status === 'past_due' && owed && (
          <p className="note bad">
            The {usd(owed.total_cents)} payment for this period is waiting. Your plan stays on for now, but pay it to keep it.
          </p>
        )}
        {pending && (
          <p className="note">
            You are moving to <b>{pending.display_name}</b> on {live ? fmtDate(live.current_period_end) : ''}. Until then you keep{' '}
            {current?.display_name}.
          </p>
        )}
        {live?.cancel_at_period_end && (
          <p className="note">Cancelled. Your plan stays on until {fmtDate(live.current_period_end)}, then ends.</p>
        )}
        {live && current && current.units.some((u) => u.overage_billed) && (
          <p className="sub text-sm">
            Above your plan, billed on the next payment:{' '}
            {current.units.filter((u) => u.overage_billed).map((u) => overageText(u.unit_code, u.overage_rate_cents_per_unit)).join(', ')}.
          </p>
        )}
        {pickable && live && (
          <div className="flex gap-2 flex-wrap">
            {owed && live.status === 'past_due' && (
              <Button onClick={() => setSheet({ kind: 'pay', invoice: owed })}>Pay {usd(owed.total_cents)} now</Button>
            )}
            {!live.cancel_at_period_end && (
              <Button variant="danger" onClick={() => setSheet({ kind: 'cancel' })}>
                Cancel plan
              </Button>
            )}
          </div>
        )}
      </Panel>

      {sheetBody()}

      <div>
        <h2 style={{ marginBottom: 14 }}>{live ? 'Change plan' : 'Plans'}</h2>
        {catalog.length === 0 ? (
          <p className="sub">No plans are on sale here right now.</p>
        ) : (
          <div className="plans">
            {catalog.map((p) => {
              const isCurrent = live?.plan_code === p.plan_code;
              const up = current ? p.price_cents > current.price_cents : true;
              let action: React.ReactNode;
              if (isCurrent) action = <Button variant="ghost" disabled>Your plan</Button>;
              else if (!pickable) action = null;
              else if (!live) action = <Button onClick={() => setSheet({ kind: 'buy', plan: p })}>Choose {p.display_name}</Button>;
              else if (up) action = <Button onClick={() => setSheet({ kind: 'buy', plan: p })}>Upgrade to {p.display_name}</Button>;
              else
                action = (
                  <Button variant="ghost" onClick={() => setSheet({ kind: 'switch', plan: p })}>
                    Switch on {fmtDate(live.current_period_end)}
                  </Button>
                );
              return (
                <div key={p.plan_code} className="plan" aria-current={isCurrent ? 'true' : undefined}>
                  <h3>{p.display_name}</h3>
                  <div className="price">
                    {usd(p.price_cents)} <small>a month</small>
                  </div>
                  <ul>
                    {p.units.map((u) => (
                      <li key={u.unit_code}>{allowanceText(u.unit_code, u.included_qty)}</li>
                    ))}
                  </ul>
                  {action}
                </div>
              );
            })}
          </div>
        )}
        {live && (
          <p className="sub" style={{ marginTop: 12 }}>
            Going up takes effect now and you pay only the difference for the days left. Going down waits for the end of the period, so you
            never lose something you have paid for.
          </p>
        )}
      </div>
    </div>
  );
}
