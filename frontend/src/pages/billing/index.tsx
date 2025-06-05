// src/pages/billing/index.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { fetchBilling, fetchWithAuth, postWithAuth } from '@/lib/api';
import { UsageSummary, BillingCosts, RunnerSummary } from '@/lib/types';
import { Sidebar } from '@/components/header';
import { handleLogout } from '@/lib/logout';

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
        const runners: RunnerSummary[] = res.data || [];

        const results = await Promise.all(
          runners.map(async (r) => {
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
    <div className="min-h-screen flex bg-gradient-to-tr from-[#0b0c10] via-[#161b22] to-[#1f2937] text-white">
      <Sidebar onLogout={handleLogout} />


      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold text-purple-400 mb-6">Billing Summary</h1>
        {loading ? (
          <p className="text-gray-400">Calculating billing…</p>
        ) : (
          <div className="space-y-6">
            {blocks.map((block) => (
              <div key={block.name} className="bg-[#1e1e2f] border border-gray-700 rounded-2xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-purple-300">{block.name}</h2>
                  <button
                    onClick={() =>
                      router.push({
                        pathname: `/billing/${block.name}`,
                        query: { instances: block.instanceIds.join(',') },
                      })
                    }
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-full"
                  >
                    View Daily Breakdown
                  </button>
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>RAM Usage: ${block.costs?.ram_cost?.toFixed(2) ?? 'N/A'}</li>
                  <li>CPU Usage: ${block.costs?.cpu_cost?.toFixed(2) ?? 'N/A'}</li>
                  <li>Bandwidth: ${block.costs?.bandwidth_cost?.toFixed(2) ?? 'N/A'}</li>
                  <li className="text-white font-medium mt-2">Total: ${block.costs?.total_cost?.toFixed(2) ?? 'N/A'}</li>
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );

}
