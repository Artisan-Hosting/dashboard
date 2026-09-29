// src/pages/billing/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import {
  fetchSubscription,
  fetchInvoices,
  upgradeSubscription,
  scheduleDowngrade,
  cancelSubscription,
} from '@/lib/api';
import { SubscriptionSummary, InvoiceSummary } from '@/lib/types';
import { PLAN_CATALOG, STOREFRONTS, Storefront, findPlan } from '@/lib/plans';
import { TopBar } from '@/components/topbar';
import LoadingOverlay from '@/components/loading';
import { useUser } from '@/hooks/useUser';
import { useElevatedSession } from '@/hooks/useElevatedSession';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Button } from '@/components/ui';

function formatCents(cents: number, currency = 'usd'): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: currency.toUpperCase() || 'USD',
  });
}

function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return '--';
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

export default function BillingPage() {
  const { orgId } = useUser();
  const elevated = useElevatedSession();

  const [storefront, setStorefront] = useState<Storefront>('developer');
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (sf: Storefront) => {
    setLoading(true);
    try {
      const [sub, inv] = await Promise.all([
        fetchSubscription(sf, orgId),
        fetchInvoices(sf, orgId).catch(() => []),
      ]);
      setSubscription(sub);
      setInvoices(inv);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load(storefront);
    setSelectedPlan('');
  }, [storefront, load]);

  const plans = PLAN_CATALOG[storefront];
  const currentPlan = subscription ? findPlan(storefront, subscription.plan_code) : undefined;
  const targetPlan = selectedPlan ? findPlan(storefront, selectedPlan) : undefined;
  const isUpgrade = !subscription || (targetPlan && currentPlan && targetPlan.priceCents > currentPlan.priceCents) || (targetPlan && !currentPlan);
  const isDowngrade = !!(subscription && targetPlan && currentPlan && targetPlan.priceCents < currentPlan.priceCents);

  const handleUpgrade = async () => {
    if (!targetPlan) return;
    if (!elevated.isElevated) {
      toast.error('Unlock the elevated session first -- an upgrade charges the card now.');
      return;
    }
    setBusy(true);
    try {
      await upgradeSubscription(storefront, targetPlan.code, elevated.token!, orgId);
      toast.success(`Switched to ${targetPlan.name}`);
      setSelectedPlan('');
      load(storefront);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upgrade');
    } finally {
      setBusy(false);
    }
  };

  const handleDowngrade = async () => {
    if (!targetPlan) return;
    setBusy(true);
    try {
      await scheduleDowngrade(storefront, targetPlan.code, orgId);
      toast.success(`Downgrade to ${targetPlan.name} scheduled for the end of the period`);
      setSelectedPlan('');
      load(storefront);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule downgrade');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this subscription at the end of the current period?')) return;
    setBusy(true);
    try {
      await cancelSubscription(storefront, orgId);
      toast.success('Subscription set to cancel at period end');
      load(storefront);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <Toaster position="bottom-right" />
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="page-head">
          <div>
            <h1 className="text-3xl font-bold text-brand">Billing</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Subscription and invoices, by product line.
            </p>
          </div>
          <Seg value={storefront} onChange={(v) => setStorefront(v)} label="Storefront" options={STOREFRONTS.map((s) => ({ value: s.key, label: s.label }))} />
        </div>

        {/* Step-up auth -- only an upgrade (charges now) needs this;
            downgrade/cancel take effect at period end and charge nothing. */}
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-brand">Elevated session</h2>
          {elevated.isElevated ? (
            <p className="text-sm" style={{ color: 'var(--ok)' }}>
              Unlocked -- expires in {elevated.secondsLeft}s.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Field
                sans
                type="password"
                placeholder="Re-enter your password to unlock upgrades"
                value={elevated.password}
                onChange={(e) => elevated.setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && elevated.elevate()}
                className="w-full sm:w-96"
              />
              <Button onClick={elevated.elevate} disabled={elevated.busy || !elevated.password}>
                {elevated.busy ? 'Checking...' : 'Unlock'}
              </Button>
            </div>
          )}
          {elevated.error && <p className="text-sm text-red-500">{elevated.error}</p>}
        </div>

        {!loading && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {blocks.map((block) => (
              <div key={block.name} className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-brand">{block.name}</h2>
                  <Button
                    small
                    onClick={() =>
                      router.push({
                        pathname: `/billing/${block.name}`,
                        query: { instances: block.instanceIds.join(',') },
                      })
                    }
                  >
                    View Daily Breakdown
                  </Button>
                </div>
                <ul className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
                  <li>RAM Usage: ${block.costs?.ram_cost?.toFixed(2) ?? 'N/A'}</li>
                  <li>CPU Usage: ${block.costs?.cpu_cost?.toFixed(2) ?? 'N/A'}</li>
                  <li>Bandwidth: ${block.costs?.bandwidth_cost?.toFixed(2) ?? 'N/A'}</li>
                  <li className="font-medium mt-2" style={{ color: 'var(--strong)' }}>Total: ${block.costs?.total_cost?.toFixed(2) ?? 'N/A'}</li>
                </ul>
              </div>
            </Panel>

            <Panel title="Invoices">
              {invoices.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No invoices yet.</p>
              )}
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <details key={inv.id} className="text-sm" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
                    <summary className="flex items-center justify-between gap-2 cursor-pointer py-1">
                      <span style={{ color: 'var(--strong)' }}>
                        {formatDate(inv.period_start)} -- {formatDate(inv.period_end)}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Pill status={inv.status} />
                        <span className="font-medium" style={{ color: 'var(--strong)' }}>{formatCents(inv.total_cents, inv.currency)}</span>
                      </span>
                    </summary>
                    <ul className="mt-2 pl-4 space-y-1" style={{ color: 'var(--muted)' }}>
                      {inv.line_items.map((item, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{item.description}{item.quantity !== 1 ? ` x${item.quantity}` : ''}</span>
                          <span className="shrink-0">{formatCents(item.amount_cents, inv.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}
