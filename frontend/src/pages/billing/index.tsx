// src/pages/billing/index.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { fetchBilling, fetchWithAuth, postWithAuth } from '@/lib/api';
import { UsageSummary, BillingCosts, ProjectSummary } from '@/lib/types';
import { TopBar } from '@/components/topbar';
import LoadingOverlay from '@/components/loading';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Button, Tabs, TabPanel } from '@/components/ui';
import Link from 'next/link';

interface BillingBlock {
  name: string;
  summary: UsageSummary;
  costs: BillingCosts;
  instanceIds: string[];
}

const usd = (cents: number) =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<BillingBlock[]>([]);
  const [tab, setTab] = useState('summary');

  useEffect(() => {
    // Check URL hash for tab
    const hashTab = router.asPath.split('#')[1];
    if (hashTab && ['summary', 'usage', 'credits', 'payments'].includes(hashTab)) {
      setTab(hashTab);
    }
  }, [router.asPath]);

  useEffect(() => {
    load(storefront);
    setSelectedPlan('');
  }, [storefront, load]);

        const results = await Promise.all(
          projects.map(async (r) => {
            const name = r.name.replace('ais_', '');
            const usageRes = await fetchWithAuth(`proxy/usage/group/${name}`);
            const summary = usageRes.data as UsageSummary;

            const costs = await fetchBilling(summary);

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

  const handleTabChange = (key: string) => {
    setTab(key);
    router.push(`#${key}`, undefined, { shallow: true });
  };

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-brand mb-2">Billing</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Your plan, your credit, and everything you have paid. Amounts are in US dollars.
          </p>
        </div>

        <Tabs
          tabs={[
            { key: 'summary', label: 'Summary' },
            { key: 'usage', label: 'Usage' },
            { key: 'credits', label: 'Credits' },
            { key: 'payments', label: 'Payments' },
          ]}
          active={tab}
          onChange={handleTabChange}
        >
          <TabPanel tabKey="summary">
            <div className="card p-6 mb-6">
              <h2 className="text-xl font-semibold text-brand mb-4">Overview</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                This shows your current billing period and total costs across all projects.
              </p>
            </div>

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
              ))}
            </div>
            {blocks.length === 0 && !loading && (
              <div className="card p-8 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No active projects found.</p>
              </div>
            )}
          </TabPanel>

          <TabPanel tabKey="usage">
            <UsagePage />
          </TabPanel>

          <TabPanel tabKey="credits">
            <CreditsTab />
          </TabPanel>

          <TabPanel tabKey="payments">
            <PaymentsTab />
          </TabPanel>
        </Tabs>
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}

// Sub-components for tabs

function UsagePage() {
  return (
    <div className="max-w-4xl">
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-brand mb-4">How Usage is Billed</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          A small base per environment, then only what you use above it. Move the knobs to see how a busy week changes the month. 
          Prices are on the <Link href="https://artisanhosting.net/run/pricing.html" className="text-brand hover:underline">pricing page</Link>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-brand mb-4">Daily Tracking</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            1. We record it every day — Memory, processor and traffic, for each of your projects.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-brand mb-4">Monthly Averaging</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            2. We average the month — A busy hour or a single bad day barely moves an average.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-brand mb-4">Plan Allowance</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            3. You pay for what is above your plan — Anything at or below what your plan includes costs nothing extra.
          </p>
        </div>
      </div>

      <div className="card p-6 mt-6">
        <h2 className="text-xl font-semibold text-brand mb-4">Leave Policy</h2>
        <div className="border-t pt-4">
          <p className="font-medium" style={{ color: 'var(--strong)' }}>
            What does it cost to leave? Nothing.
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            You own your domain, your code and your content.
          </p>
        </div>
      </div>
    </div>
  );
}

function CreditsTab() {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-brand mb-4">Credit Balance</h2>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Your credit is used for pay-as-you-go services like GPU sessions and virtual machines.
        It's separate from your monthly plan charges.
      </p>
      <div className="mt-4">
        <Button as={Link} href="/billing/credits" variant="primary">
          View Credit Balance & Top-Up
        </Button>
      </div>
    </div>
  );
}

function PaymentsTab() {
  const planRates = {
    builder: { name: 'Builder', price: '$8/mo', includes: '0.5 GB memory, 0.25 processor, 10 GB traffic, 1,000 emails' },
    pro: { name: 'Pro', price: '$32/mo', includes: '2 GB memory, 1 processor, 50 GB traffic, 5,000 emails' },
    team: { name: 'Team', price: '$95/mo', includes: '6 GB memory, 3 processors, 200 GB traffic, 25,000 emails' },
    essentials: { name: 'Essentials Care', price: '$30/mo', includes: '0.25 GB memory, 0.25 processor, We look after it' },
    business: { name: 'Business Care', price: '$99/mo', includes: '1 GB memory, 1 processor, We look after it' },
    managed: { name: 'Managed Platform', price: '$300/mo', includes: '4 GB memory, 2 processors, We look after it' },
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-brand mb-4">Current Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-brand mb-2">Developer Plans</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>{planRates.builder.name}</span>
                <span className="font-medium">{planRates.builder.price}</span>
              </li>
              <li style={{ color: 'var(--muted)' }}>{planRates.builder.includes}</li>
              <li className="flex justify-between">
                <span>{planRates.pro.name}</span>
                <span className="font-medium">{planRates.pro.price}</span>
              </li>
              <li style={{ color: 'var(--muted)' }}>{planRates.pro.includes}</li>
              <li className="flex justify-between">
                <span>{planRates.team.name}</span>
                <span className="font-medium">{planRates.team.price}</span>
              </li>
              <li style={{ color: 'var(--muted)' }}>{planRates.team.includes}</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-brand mb-2">Business Plans</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>{planRates.essentials.name}</span>
                <span className="font-medium">{planRates.essentials.price}</span>
              </li>
              <li style={{ color: 'var(--muted)' }}>{planRates.essentials.includes}</li>
              <li className="flex justify-between">
                <span>{planRates.business.name}</span>
                <span className="font-medium">{planRates.business.price}</span>
              </li>
              <li style={{ color: 'var(--muted)' }}>{planRates.business.includes}</li>
              <li className="flex justify-between">
                <span>{planRates.managed.name}</span>
                <span className="font-medium">{planRates.managed.price}</span>
              </li>
              <li style={{ color: 'var(--muted)' }}>{planRates.managed.includes}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold text-brand mb-4">Payment History</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Payment history and billing statements are available on the Credit page.
        </p>
      </div>
    </div>
  );
}
