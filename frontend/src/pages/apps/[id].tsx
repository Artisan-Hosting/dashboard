// src/pages/dashboard/[id].tsx
import LoadingOverlay from '@/components/loading';
import {
  fetchGroupUsage,
  fetchInstanceLogs,
  fetchInstanceUsage,
  fetchProjectDetails,
  fetchProjectGitInfo,
  fetchMultiNodeConfig,
  setMultiNodeConfig,
  sendProjectControl,
  fetchDomains,
} from '@/lib/api';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { FullInstance, ProjectDetails, UsageSummary, BillingCosts, LogEntry, MultiNodeConfigResponse, NodeConfigEntry, WatchdogConfigKind } from '@/lib/types';
import { resolveRunnerLabel } from '@/lib/repoLabel';
import { formatExpiry } from '@/lib/format';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { Button, Pill, SelectField, Term } from '@/components/ui';

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

const TABS = [
  { key: 'config', label: 'Config' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'logs', label: 'Logs' },
  { key: 'source', label: 'Source' },
];

export default function ProjectPage() {
  const router = useRouter();
  const { id: projectId } = router.query as { id?: string };

  const [instances, setInstances] = useState<FullInstance[]>([]);
  const [detailsList, setDetailsList] = useState<ProjectDetails[]>([]);
  const [groupUsage, setGroupUsage] = useState<UsageSummary | null>(null);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const previousStatusRef = useRef<Record<string, string>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<Record<string, LogEntry[]>>({});
  const [historicalLoading, setHistoricalLoading] = useState<Record<string, boolean>>({});
  const [runnerLabel, setRunnerLabel] = useState<string>('');
  const [activeTab, setActiveTab] = useState('config');
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!router.isReady || !projectId) return;
    let cancelled = false;
    resolveRunnerLabel(projectId).then((label) => {
      if (!cancelled) setRunnerLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, projectId]);

  // --- source info (repo/branch), for the Source tab ---
  const [gitInfo, setGitInfo] = useState<{ user: string; repo: string; branch: string } | null>(null);

  useEffect(() => {
    if (!router.isReady || !projectId) return;
    let cancelled = false;
    fetchProjectGitInfo(projectId).then((info) => {
      if (!cancelled) setGitInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, projectId]);

  // --- domains attached to this project, for the Domains panel ---
  const [domains, setDomains] = useState<DomainEntry[]>([]);

  useEffect(() => {
    if (!router.isReady || !projectId) return;
    let cancelled = false;
    // /domains has no runner_id filter, so this fetches the caller's
    // visible page of domains and filters client-side -- fine at the scale
    // one org's domain count actually reaches.
    fetchDomains({ limit: 500 })
      .then((page) => {
        if (!cancelled) setDomains((page.entries ?? []).filter((d) => d.runner_id === projectId));
      })
      .catch(() => {
        if (!cancelled) setDomains([]);
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, projectId]);

  // --- application config, applied across every node running this app ---
  const [configKind, setConfigKind] = useState<WatchdogConfigKind>('config');
  const [configData, setConfigData] = useState<MultiNodeConfigResponse | null>(null);
  const [configContent, setConfigContent] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const loadAppConfig = async () => {
    if (!projectId) return;
    setConfigLoading(true);
    try {
      const data = await fetchMultiNodeConfig(projectId, configKind);
      setConfigData(data);
      if (data.all_match) {
        setConfigContent(data.nodes.find((n) => n.found)?.content ?? '');
      } else {
        setConfigContent('');
      }
    } catch (err) {
      console.error('Failed to load app config', err);
      toast.error('Failed to load app config');
    } finally {
      setConfigLoading(false);
    }
  };

  const useNodeVersion = (node: NodeConfigEntry) => {
    setConfigContent(node.content ?? '');
  };

  const saveAppConfig = async () => {
    if (!projectId || !configData) return;
    const targets = configData.nodes.filter((n) => n.found && n.sha256);
    if (targets.length === 0) {
      toast.error('No nodes available to save to');
      return;
    }

    if (!configData.all_match) {
      const names = targets.map((n) => n.hostname).join(', ');
      if (
        !confirm(
          `Configs currently differ across nodes. Saving will overwrite ${targets.length} node(s): ${names}. Continue?`,
        )
      ) {
        return;
      }
    }

    const expectedShas: Record<string, string> = {};
    targets.forEach((n) => {
      expectedShas[String(n.node_id)] = n.sha256 as string;
    });

    setConfigSaving(true);
    try {
      const result = await setMultiNodeConfig(projectId, configKind, configContent, expectedShas);
      const failed = result.results.filter((r) => !r.accepted);
      if (failed.length === 0) {
        toast.success(`Config applied to ${result.results.length} node(s)`);
      } else {
        toast.error(`${failed.length} of ${result.results.length} node(s) rejected the update`);
        failed.forEach((f) => toast.error(`${f.hostname}: ${f.message}`));
      }
      await loadAppConfig();
    } catch (err) {
      console.error('Failed to save app config', err);
      toast.error('Failed to save app config');
    } finally {
      setConfigSaving(false);
    }
  };

  const HISTORICAL_LOG_LINES = 1000;

  const loadHistoricalLogs = async (instanceId: string) => {
    setHistoricalLoading((prev) => ({ ...prev, [instanceId]: true }));
    try {
      const lines = await fetchInstanceLogs(instanceId, HISTORICAL_LOG_LINES);
      setHistoricalLogs((prev) => ({ ...prev, [instanceId]: lines }));
    } catch (e) {
      toast.error(`Failed to load historical logs for ${instanceId}`);
      console.error(`Failed to load historical logs for ${instanceId}`, e);
    } finally {
      setHistoricalLoading((prev) => ({ ...prev, [instanceId]: false }));
    }
  };

  const handleCommand = async (instanceId: string, command: string) => {
    try {
      const res = await sendProjectControl(instanceId, command);
      toast.success(`${command} sent to ${instanceId}`);
      console.log(`${command} sent to ${instanceId}`, res);
    } catch (e) {
      toast.error(`Failed to send ${command} to ${instanceId}`);
      console.error(`Failed to send command '${command}' to ${instanceId}`, e);
    }
  };

  // Project-level start/stop/restart -- `/control/{runner_or_instance}/{command}`
  // accepts either id, so this is one call against the project itself rather
  // than looping every instance client-side.
  const handleBulkCommand = async (command: string) => {
    if (!projectId) return;
    setBulkBusy(true);
    try {
      await sendProjectControl(projectId, command);
      toast.success(`${command} sent to every instance`);
    } catch (e) {
      toast.error(`Failed to ${command} the project`);
      console.error(`Failed to send bulk command '${command}'`, e);
    } finally {
      setBulkBusy(false);
    }
  };

  useEffect(() => {
    if (!router.isReady || !projectId) return;

    (async () => {
      try {
        const details = await fetchProjectDetails(projectId!);
        setDetailsList(details);

        const grpUsage = await fetchGroupUsage(projectId!);
        setGroupUsage(grpUsage);

        const full: FullInstance[] = await Promise.all(
          details.map(async (inst) => ({
            details: inst,
            usage: await fetchInstanceUsage(inst.id),
          }))
        );
        setInstances(full);

        const logMap: Record<string, LogEntry[]> = {};
        await Promise.all(
          details.map(async (inst) => {
            try {
              logMap[inst.id] = await fetchInstanceLogs(inst.id, 500);
            } catch (e) {
              console.error(`Failed logs for ${inst.id}`, e);
            }
          })
        );
        setLogs(logMap);
      } catch (err) {
        console.error("Error loading project + usage:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router.isReady, projectId]);

  const pollInFlight = useRef(false);

  useEffect(() => {
    const pollInterval = 5_000;
    let poller: NodeJS.Timeout;

    const poll = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;

      try {
        const updated: FullInstance[] = await Promise.all(
          detailsList.map(async (inst) => {
            const latestDetailsList = await fetchProjectDetails(String(projectId!));
            const updatedDetails = latestDetailsList.find(d => d.id === inst.id) || inst;

            return {
              details: updatedDetails,
              usage: await fetchInstanceUsage(inst.id),
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

        const logMap: Record<string, LogEntry[]> = {};
        await Promise.all(
          detailsList.map(async (inst) => {
            try {
              logMap[inst.id] = await fetchInstanceLogs(inst.id, 100);
            } catch (e) {
              console.error(`Polling failed logs for ${inst.id}`, e);
            }
          })
        );
        setLogs(logMap);
      } catch (e) {
        console.error('Polling error:', e);
      } finally {
        pollInFlight.current = false;
      }
    };

    poll();
    poller = setInterval(poll, pollInterval);
    return () => clearInterval(poller);
  }, [projectId, detailsList]);

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <Toaster position="bottom-right" />
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="overflow-y-auto p-4 sm:p-6 lg:p-8">
        {!loading && (
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                      <h2 className="text-xl font-semibold text-brand text-pretty">
                        {runnerLabel || projectId}
                      </h2>
                      <p className="text-xs text-gray-500 truncate" title={String(details.id)}>
                        Instance {String(details.id).slice(-8)}
                      </p>
                      <div className="mt-1">
                        <Pill status={details.status} />
                      </div>
                    </div>
                    <div className="hidden sm:flex gap-2">
                      <Button small variant="ghost" onClick={() => handleCommand(details.id, 'start')}>Start</Button>
                      <Button small variant="danger" onClick={() => handleCommand(details.id, 'stop')}>Stop</Button>
                      <Button small variant="ghost" onClick={() => handleCommand(details.id, 'restart')}>Restart</Button>
                    </div>
                    <div className="hidden sm:flex gap-2 shrink-0">
                      <Button small variant="ghost" onClick={() => handleCommand(details.id, 'start')}>Start</Button>
                      <Button small variant="danger" onClick={() => handleCommand(details.id, 'stop')}>Stop</Button>
                      <Button small variant="ghost" onClick={() => handleCommand(details.id, 'restart')}>Restart</Button>
                    </div>
                    <div className="relative sm:hidden shrink-0">
                      <button onClick={() => setOpenMenu(openMenu === details.id ? null : details.id)} className="p-2 btn-brand rounded">
                        <Menu className="w-4 h-4" />
                      </button>
                      {openMenu === details.id && (
                        <div className="absolute right-0 mt-2 p-2 rounded shadow-lg space-y-1 z-20 panel">
                          <button onClick={() => {handleCommand(details.id, 'start'); setOpenMenu(null);}} className="block w-full text-left px-2 py-1 rounded hover:bg-[color:var(--surface-2)] text-sm">Start</button>
                          <button onClick={() => {handleCommand(details.id, 'stop'); setOpenMenu(null);}} className="block w-full text-left px-2 py-1 rounded hover:bg-[color:var(--surface-2)] text-sm">Stop</button>
                          <button onClick={() => {handleCommand(details.id, 'restart'); setOpenMenu(null);}} className="block w-full text-left px-2 py-1 rounded hover:bg-[color:var(--surface-2)] text-sm">Restart</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {instances.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No instances running.</p>
                )}
              </Panel>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 text-sm" style={{ color: 'var(--text)' }}>

              {/* Domains */}
              <Panel title="Domains">
                {domains.map((d) => (
                  <div key={d.id} className="py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{d.fqdn}</span>
                      <Pill status={d.status} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{formatExpiry(d.expires_at)}</p>
                  </div>
                ))}
                {domains.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No domains attached.</p>
                )}
                <Link href="/domains" className="text-sm text-brand hover:underline">
                  Manage domains
                </Link>
              </Panel>
            </div>

            <div className="mt-10">
              <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
                <TabPanel tabKey="config" active={activeTab}>
                  <p className="help mb-3" style={{ color: 'var(--muted)' }}>
                    Reads and writes the watchdog config for every instance of this app at once.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3 items-center">
                    <SelectField value={configKind} onChange={(e) => setConfigKind(e.target.value as WatchdogConfigKind)} style={{ width: 'auto' }}>
                      <option value="config">config</option>
                      <option value="overrides">overrides</option>
                    </SelectField>
                    <Button small onClick={loadAppConfig} disabled={configLoading}>
                      {configLoading ? 'Loading…' : 'Load Config'}
                    </Button>
                  </div>


                  {instanceLogs.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-semibold text-sm mb-2 text-brand">
                        Recent Logs
                      </summary>
                      <Term lines={instanceLogs.map((log) => `[${log.timestamp}] ${log.message}`)} />
                    </details>
                  )}

                  {configData && configData.nodes.length === 0 && (
                    <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>No nodes are currently running this app.</p>
                  )}

                  <textarea
                    value={configContent}
                    onChange={(e) => setConfigContent(e.target.value)}
                    rows={14}
                    className="code"
                    placeholder="Load a config to edit it"
                  />
                  <div className="mt-3">
                    <Button
                      small
                      variant="ghost"
                      onClick={() => loadHistoricalLogs(details.id)}
                      disabled={!!historicalLoading[details.id]}
                    >
                      {historicalLoading[details.id] ? 'Loading…' : `Load last ${HISTORICAL_LOG_LINES} lines`}
                    </Button>

                    {historicalLogs[details.id] && (
                      <details className="mt-2" open>
                        <summary className="cursor-pointer font-semibold text-sm mb-2 text-brand flex items-center justify-between">
                          <span>Historical Logs ({historicalLogs[details.id].length} lines)</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setHistoricalLogs((prev) => {
                                const next = { ...prev };
                                delete next[details.id];
                                return next;
                              });
                            }}
                            className="text-xs ml-2 hover:underline"
                            style={{ color: 'var(--muted)' }}
                          >
                            Close
                          </button>
                        </summary>
                        <Term tall lines={historicalLogs[details.id].map((log) => `[${log.timestamp}] ${log.message}`)} />
                      </details>
                    )}
                  </div>
                </TabPanel>

                <TabPanel tabKey="secrets" active={activeTab}>
                  {projectId && <SecretsManager projectId={projectId} />}
                </TabPanel>

        {!loading && (
          <div className="mt-10 card p-6">
            <h2 className="text-xl font-bold mb-4 text-brand">Application Config</h2>
            <p className="text-sm text-gray-400 mb-3">
              Reads and writes the watchdog config for every instance of this app at once.
            </p>
            <div className="flex flex-wrap gap-2 mb-3 items-center">
              <SelectField
                value={configKind}
                onChange={(e) => setConfigKind(e.target.value as WatchdogConfigKind)}
                style={{ width: 'auto' }}
              >
                <option value="config">config</option>
                <option value="overrides">overrides</option>
              </SelectField>
              <Button small onClick={loadAppConfig} disabled={configLoading}>
                {configLoading ? 'Loading…' : 'Load Config'}
              </Button>
            </div>

            {configData && !configData.all_match && (
              <div
                className="mb-3 p-3 rounded text-sm"
                style={{ border: '1px solid var(--warn)', background: 'color-mix(in srgb, var(--warn) 10%, transparent)' }}
              >
                <p className="font-semibold mb-2" style={{ color: 'var(--warn)' }}>
                  Configs differ across nodes — pick a version below before saving.
                </p>
                <div className="space-y-2">
                  {configData.nodes.map((node) => (
                    <div key={node.node_id} className="flex flex-wrap items-center justify-between gap-2 pb-2" style={{ borderBottom: '1px solid var(--line)' }}>
                      <div style={{ color: 'var(--text)' }}>
                        <span className="font-medium" style={{ color: 'var(--strong)' }}>{node.hostname}</span>{' '}
                        {node.found ? (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>({(node.content ?? '').length} bytes)</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--bad)' }}>{node.error ?? 'unavailable'}</span>
                        )}
                        <div className="mt-2">
                          <Button small variant="ghost" onClick={() => loadHistoricalLogs(details.id)} disabled={!!historicalLoading[details.id]}>
                            {historicalLoading[details.id] ? 'Loading…' : `Load last ${HISTORICAL_LOG_LINES} lines`}
                          </Button>
                          {historicalLogs[details.id] && (
                            <details className="mt-2" open>
                              <summary className="cursor-pointer font-semibold text-sm mb-2 text-brand flex items-center justify-between">
                                <span>Historical Logs ({historicalLogs[details.id].length} lines)</span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setHistoricalLogs((prev) => { const next = { ...prev }; delete next[details.id]; return next; });
                                  }}
                                  className="text-xs hover:underline ml-2"
                                  style={{ color: 'var(--muted)' }}
                                >
                                  Close
                                </button>
                              </summary>
                              <Term tall lines={historicalLogs[details.id].map((log) => `[${log.timestamp}] ${log.message}`)} />
                            </details>
                          )}
                        </div>
                      </div>
                      {node.found && (
                        <Button small variant="ghost" onClick={() => useNodeVersion(node)}>
                          Use this version
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {configData && configData.nodes.length === 0 && (
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>No nodes are currently running this app.</p>
            )}

            <textarea
              value={configContent}
              onChange={(e) => setConfigContent(e.target.value)}
              rows={14}
              className="code"
              placeholder="Load a config to edit it"
            />
            <div className="mt-3">
              <Button
                small
                onClick={saveAppConfig}
                disabled={configSaving || !configData || configData.nodes.every((n) => !n.found)}
              >
                {configSaving ? 'Saving…' : 'Save to all instances'}
              </Button>
            </div>
          </div>
        )}

        {groupUsage && !loading && groupCosts && (
          <div className="mt-10 card p-6">
            <h2 className="text-xl font-bold mb-4 text-brand">
              Overall Usage & Billing
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1" style={{ color: 'var(--text)' }}>
                <p>Total CPU Time: {groupUsage.total_cpu.toFixed(2)} hrs</p>
                <p>Avg Memory:       {groupUsage.avg_memory.toFixed(2)} MB</p>
                <p>Total Instances:  {instances.length}</p>
                <p>Samples:          {groupUsage.total_samples}</p>
              </div>
              <div className="space-y-1" style={{ color: 'var(--text)' }}>
                <p>CPU Cost:      ${groupCosts.cpu_cost.toFixed(2)}</p>
                <p>RAM Cost:      ${groupCosts.ram_cost.toFixed(2)}</p>
                <p>Bandwidth:     ${groupCosts.bandwidth_cost.toFixed(2)}</p>
                <p className="font-semibold" style={{ color: 'var(--strong)' }}>
                  Total Cost:    ${groupCosts.total_cost.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}
