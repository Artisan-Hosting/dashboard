// src/pages/billing/index.tsx
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/api';
import { UsageSummary, ProjectSummary } from '@/lib/types';
import { TopBar } from '@/components/topbar';
import LoadingOverlay from '@/components/loading';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Tabs, TabPanel } from '@/components/ui';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { isAdminRole } from '@/components/requireAdmin';
import { PlanSection } from '@/components/billing/PlanSection';
import { PaymentHistory } from '@/components/billing/PaymentHistory';
import { formatBytes } from '@/components/billing/format';

interface BillingBlock {
  name: string;
  summary: UsageSummary;
}

const usd = (cents: number) =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BillingPage() {
  const router = useRouter();
  const { orgId, role } = useUser();
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const projectsRes = await fetchWithAuth('proxy/projects');
      const projects = projectsRes.data as ProjectSummary[];
      
      const results = await Promise.all(
        projects.map(async (r) => {
          const name = r.name.replace('ais_', '');
          const usageRes = await fetchWithAuth(`proxy/usage/group/${name}`);
          const summary = usageRes.data as UsageSummary;
          return { name, summary };
        })
      );
      
      const blocksData: BillingBlock[] = results;
      
      setBlocks(blocksData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          <TabPanel tabKey="summary" active={tab}>
            <div className="mb-8">
              <PlanSection orgId={orgId} canChange={isAdminRole(role)} />
            </div>

            <div className="card p-6 mb-6">
              <h2 className="text-xl font-semibold text-brand mb-4">Overview</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                What each project has used. Your plan, what you owe and what you have paid are above and on the Payments tab. Usage
              above your plan is priced for the whole organization together, not per project, and shows on your invoice.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {blocks.map((block) => (
                <div key={block.name} className="card p-6">
                  <h2 className="text-xl font-semibold text-brand mb-4">{block.name}</h2>
                  <ul className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
                    <li>Memory (average): {block.summary.avg_memory.toFixed(1)} MB</li>
                    <li>Processor: {block.summary.total_cpu.toFixed(2)} hrs</li>
                    <li>
                      Traffic: {formatBytes(block.summary.total_tx)} out, {formatBytes(block.summary.total_rx)} in
                    </li>
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

          <TabPanel tabKey="usage" active={tab}>
            <UsagePage />
          </TabPanel>

          <TabPanel tabKey="credits" active={tab}>
            <CreditsTab />
          </TabPanel>

          <TabPanel tabKey="payments" active={tab}>
            <PaymentHistory orgId={orgId} />
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
        <a
          href="/billing/credits"
          className="btn btn-primary"
        >
          View Credit Balance & Top-Up
        </a>
      </div>
    </div>
  );
}
