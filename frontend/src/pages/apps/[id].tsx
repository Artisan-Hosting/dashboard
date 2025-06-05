// src/pages/dashboard/[id].tsx
import { Sidebar } from '@/components/header';
import { fetchWithAuth, fetchBilling, postWithAuth } from '@/lib/api';
import { handleLogout } from '@/lib/logout';
import { FullInstance, RunnerDetails, UsageSummary, BillingCosts, LogEntry, statusColorMap, StatusType } from '@/lib/types';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}


export default function ProjectPage() {
  const router = useRouter();
  const { id: runnerId } = router.query as { id?: string };

  const [instances, setInstances] = useState<FullInstance[]>([]);
  const [detailsList, setDetailsList] = useState<RunnerDetails[]>([]);
  const [groupUsage, setGroupUsage] = useState<UsageSummary | null>(null);
  const [instanceCosts, setInstanceCosts] = useState<Record<string, BillingCosts>>({});
  const [groupCosts, setGroupCosts] = useState<BillingCosts | null>(null);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const previousStatusRef = useRef<Record<string, string>>({});

  const handleCommand = async (instanceId: string, command: string) => {
    try {
      const res = await fetchWithAuth(`proxy/control/${instanceId}/${command}`);
      toast.success(`${command} sent to ${instanceId}`);
      console.log(`${command} sent to ${instanceId}`, res);
    } catch (e) {
      toast.error(`Failed to send ${command} to ${instanceId}`);
      console.error(`Failed to send command '${command}' to ${instanceId}`, e);
    }
  };

  useEffect(() => {
    if (!router.isReady || !runnerId) return;

    (async () => {
      try {

        const runnersRes = await fetchWithAuth(`proxy/runner/${runnerId}`);
        const details: RunnerDetails[] = runnersRes.data || [];
        setDetailsList(details);

        const grpRes = await fetchWithAuth(`proxy/usage/group/${runnerId}`);
        const grpUsage: UsageSummary = grpRes.data;
        setGroupUsage(grpUsage);

        const full: FullInstance[] = await Promise.all(
          details.map(async (inst) => {
            const uxRes = await fetchWithAuth(`proxy/usage/single/${inst.id}`);
            return {
              details: inst,
              usage: uxRes.data as UsageSummary,
            };
          })
        );
        setInstances(full);

        // const costMap: Record<string, BillingCosts> = {};
        // await Promise.all(
        //   full.map(async ({ details, usage }) => {
        //     try {
        //       const costs = await fetchBilling(usage);
        //       costMap[details.id] = costs;
        //     } catch (e) {
        //       console.error(`Failed billing for ${details.id}`, e);
        //     }
        //   })
        // );
        // setInstanceCosts(costMap);

        // const gc = await fetchBilling(grpUsage);
        // setGroupCosts(gc);

        const logMap: Record<string, LogEntry[]> = {};
        await Promise.all(
          details.map(async (inst) => {
            try {
              const logRes = await fetchWithAuth(`proxy/logs/${inst.id}/500`);
              logMap[inst.id] = logRes.data?.lines || [];
            } catch (e) {
              console.error(`Failed logs for ${inst.id}`, e);
            }
          })
        );
        setLogs(logMap);
      } catch (err) {
        console.error("Error loading runner + usage:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router.isReady, runnerId]);

  useEffect(() => {
    const pollInterval = 5_000;
    let poller: NodeJS.Timeout;

    const poll = async () => {
      // if (!runnerId || detailsList.length === 0) return;

      try {
        const updated: FullInstance[] = await Promise.all(
          detailsList.map(async (inst) => {
            const latestDetailsRes = await fetchWithAuth(`proxy/runner/${runnerId}`);
            const latestDetailsList: RunnerDetails[] = latestDetailsRes.data || [];
            const updatedDetails = latestDetailsList.find(d => d.id === inst.id) || inst;

            const uxRes = await fetchWithAuth(`proxy/usage/single/${inst.id}`);
            return {
              details: updatedDetails,
              usage: uxRes.data as UsageSummary,
            };
          })
        );


        const previous = previousStatusRef.current;
        updated.forEach(({ details }) => {
          const prevStatus = previous[details.id];
          if (prevStatus && prevStatus !== details.status) {
            toast(`Status changed: ${details.id} is now ${details.status}`, {
              icon: details.status === 'Running' ? '✅' : '⚠️',
            });
          }
          previous[details.id] = details.status;
        });

        setInstances(updated);
        setLastUpdated(new Date().toLocaleTimeString());

        const logMap: Record<string, LogEntry[]> = {};
        await Promise.all(
          detailsList.map(async (inst) => {
            try {
              const logRes = await fetchWithAuth(`proxy/logs/${inst.id}/100`);
              logMap[inst.id] = logRes.data?.lines || [];
            } catch (e) {
              console.error(`Polling failed logs for ${inst.id}`, e);
            }
          })
        );
        setLogs(logMap);
      } catch (e) {
        console.error('Polling error:', e);
      }
    };

    poll();
    poller = setInterval(poll, pollInterval);
    return () => clearInterval(poller);
  }, [runnerId, detailsList]);


  return (
    <div className="min-h-screen flex bg-page text-foreground">
      <Toaster position="bottom-right" />
      <Sidebar onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="text-3xl font-bold text-purple-400 mb-6">Project: {runnerId}</h1>

        {loading ? (
          <p className="text-gray-400">Loading instances…</p>
        ) : (
          <div className="grid gap-6">
            {instances.map(({ details, usage }) => {
              const costs = instanceCosts[details.id];
              const instanceLogs = logs[details.id] || [];
              return (
                <div
                  key={details.id}
                  className="card p-4"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h2 className="text-xl font-semibold text-purple-200">
                        {details.id}
                      </h2>
                      <p className={`text-sm ${statusColorMap[details.status as StatusType] || 'text-black'}`}>
                        {details.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleCommand(details.id, 'start')} className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-white text-sm">Start</button>
                      <button onClick={() => handleCommand(details.id, 'stop')} className="bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded text-white text-sm">Stop</button>
                      <button onClick={() => handleCommand(details.id, 'restart')} className="bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-white text-sm">Restart</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-gray-300">

                    <div className="space-y-1">
                      <h3 className="font-semibold text-purple-300">Health</h3>
                      <p>CPU Usage: {details.health?.cpu_usage ?? 'N/A'}</p>
                      <p>RAM Usage: {details.health?.ram_usage ?? 'N/A'}</p>
                      <p>TX: {formatBytes(details.health?.tx_bytes ?? 0)}</p>
                      <p>RX: {formatBytes(details.health?.rx_bytes ?? 0)}</p>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-semibold text-purple-300">Usage</h3>
                      <p>Total CPU Time: {usage.total_cpu.toFixed(3)} hrs</p>
                      <p>Avg Memory: {usage.avg_memory.toFixed(3)} MB</p>
                      <p>Peak Memory: {usage.peak_memory.toFixed(3)} MB</p>
                    </div>

                    {/* {costs && (
                      <div className="space-y-1">
                        <h3 className="font-semibold text-purple-300">Billing</h3>
                        <p>CPU Cost: ${costs.cpu_cost.toFixed(3)}</p>
                        <p>RAM Cost: ${costs.ram_cost.toFixed(3)}</p>
                        <p>Bandwidth: ${costs.bandwidth_cost.toFixed(2)}</p>
                      </div>
                    )} */}
                  </div>


                  {instanceLogs.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-semibold text-sm mb-2 text-purple-400">
                        Recent Logs
                      </summary>
                      <div className="max-h-40 overflow-y-auto bg-black text-green-400 text-xs p-2 rounded border border-gray-700">
                        {instanceLogs.map((log, i) => (
                          <pre key={i} className="whitespace-pre-wrap">[{log.timestamp}] {log.message}</pre>
                        ))}
                      </div>
                    </details>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {groupUsage && !loading && groupCosts && (
          <div className="mt-10 card p-6">
            <h2 className="text-xl font-bold mb-4 text-purple-300">
              Overall Usage & Billing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 text-gray-300">
                <p>Total CPU Time: {groupUsage.total_cpu.toFixed(2)} hrs</p>
                <p>Avg Memory:       {groupUsage.avg_memory.toFixed(2)} MB</p>
                <p>Total Instances:  {instances.length}</p>
                <p>Samples:          {groupUsage.total_samples}</p>
              </div>
              <div className="space-y-1 text-gray-300">
                <p>CPU Cost:      ${groupCosts.cpu_cost.toFixed(2)}</p>
                <p>RAM Cost:      ${groupCosts.ram_cost.toFixed(2)}</p>
                <p>Bandwidth:     ${groupCosts.bandwidth_cost.toFixed(2)}</p>
                <p className="font-semibold text-white">
                  Total Cost:    ${groupCosts.total_cost.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
