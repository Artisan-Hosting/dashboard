// src/pages/billing/index.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { fetchBilling, fetchWithAuth, postWithAuth } from '@/lib/api';
import { UsageSummary, BillingCosts, ProjectSummary } from '@/lib/types';
import { Sidebar } from '@/components/header';
import LoadingOverlay from '@/components/loading';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Button } from '@/components/ui';

interface BillingBlock {
  name: string;
  summary: UsageSummary;
  costs: BillingCosts;
  instanceIds: string[];
}

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<BillingBlock[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetchWithAuth('proxy/runners');
        const projects: ProjectSummary[] = res.data || [];

        const results = await Promise.all(
          projects.map(async (r) => {
            const name = r.name.replace('ais_', '');
            const usageRes = await fetchWithAuth(`proxy/usage/group/${name}`);
            const summary = usageRes.data as UsageSummary;
            console.log(summary);


            const costs = await fetchBilling(summary);
            console.log(costs);

            return {
              name,
              summary,
              costs,
              instanceIds: Array.isArray(summary.instance_id) ? summary.instance_id : []
            };
          })
        );

        setBlocks(results);
      } catch (err) {
        console.error('Billing load error', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="relative min-h-screen flex bg-page text-foreground">
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />


      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-brand mb-6">Billing Summary</h1>
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
            ))}
          </div>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );

}
