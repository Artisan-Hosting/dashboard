import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast, Toaster } from 'react-hot-toast';
import { Sidebar } from '@/components/header';
import LoadingOverlay from '@/components/loading';
import { RequireAdmin } from '@/components/requireAdmin';
import { useUser } from '@/hooks/useUser';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import {
  fetchNodeDetails,
  reloadNode,
  fetchGitConfig,
  auditGitConfig,
  fetchWatchdogConfig,
  setWatchdogConfig,
} from '@/lib/api';
import {
  NodeDetails,
  RepoEntry,
  GitServer,
  WatchdogConfigKind,
} from '@/lib/types';
import { resolveRunnerLabel } from '@/lib/repoLabel';

function serverToDisplay(server: GitServer): string {
  return typeof server === 'string' ? server : `Custom (${server.Custom})`;
}

function NodeDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const nodeId = id ? Number(id) : NaN;
  const { role } = useUser();

  const [node, setNode] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const [repos, setRepos] = useState<RepoEntry[]>([]);
  const [gitLoading, setGitLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);

  const [application, setApplication] = useState('');
  const [kind, setKind] = useState<WatchdogConfigKind>('config');
  const [content, setContent] = useState('');
  const [sha256, setSha256] = useState<string | null>(null);
  const [watchdogLoading, setWatchdogLoading] = useState(false);
  const [watchdogSaving, setWatchdogSaving] = useState(false);
  const [runnerLabels, setRunnerLabels] = useState<Record<string, string>>({});

  const loadNode = useCallback(async () => {
    if (Number.isNaN(nodeId)) return;
    try {
      const data = await fetchNodeDetails(nodeId);
      setNode(data);
    } catch (err) {
      console.error('Failed to load node', err);
      toast.error('Failed to load node');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  const loadGitConfig = useCallback(async () => {
    if (Number.isNaN(nodeId)) return;
    setGitLoading(true);
    try {
      const envelope = await fetchGitConfig(nodeId);
      setRepos(envelope.repos);
    } catch (err) {
      console.error('Failed to load git config', err);
      toast.error('Failed to load git config');
    } finally {
      setGitLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    if (!router.isReady) return;
    loadNode();
    loadGitConfig();
  }, [router.isReady, loadNode, loadGitConfig]);

  useEffect(() => {
    if (!node) return;
    let cancelled = false;
    node.projects.forEach((r) => {
      const key = r.replace('ais_', '');
      if (runnerLabels[key]) return;
      resolveRunnerLabel(key).then((label) => {
        if (cancelled) return;
        setRunnerLabels((prev) => (prev[key] ? prev : { ...prev, [key]: label }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [node]);

  const handleReload = async () => {
    setReloading(true);
    try {
      const result = await reloadNode(nodeId);
      if (result.reloaded) {
        toast.success(`Node ${result.id} reloaded`);
      } else {
        toast.error(`Node ${result.id} did not reload`);
      }
    } catch (err) {
      toast.error('Reload failed — you may lack Super privileges');
      console.error('Reload failed', err);
    } finally {
      setReloading(false);
    }
  };

  const handleAudit = async () => {
    setAuditing(true);
    try {
      const outcome = await auditGitConfig(nodeId);
      toast(
        `Audit: ${outcome.repos_considered} repo(s) considered, ` +
          `${outcome.stale_checkouts_removed} stale checkout(s) removed, ` +
          `${outcome.stale_state_files_removed} stale state file(s) removed`,
        { icon: outcome.errors.length === 0 ? '✅' : '⚠️' },
      );
      outcome.errors.forEach((err) => toast.error(err));
    } catch (err) {
      console.error('Failed to run repo audit', err);
      toast.error('Failed to run repo audit');
    } finally {
      setAuditing(false);
    }
  };

  const loadWatchdogConfig = async () => {
    if (!application) {
      toast.error('Pick an application first');
      return;
    }
    setWatchdogLoading(true);
    try {
      const res = await fetchWatchdogConfig(nodeId, application, kind, true);
      setContent(res.content);
      setSha256(res.sha256);
    } catch (err) {
      console.error('Failed to load watchdog config', err);
      toast.error('Failed to load watchdog config');
    } finally {
      setWatchdogLoading(false);
    }
  };

  const saveWatchdogConfig = async () => {
    if (sha256 === null) {
      toast.error('Load the config before saving');
      return;
    }
    setWatchdogSaving(true);
    try {
      const res = await setWatchdogConfig(nodeId, application, kind, content, sha256);
      if (res.accepted) {
        toast.success(res.message || 'Saved');
        const refreshed = await fetchWatchdogConfig(nodeId, application, kind, false);
        setContent(refreshed.content);
        setSha256(refreshed.sha256);
      } else {
        toast.error(res.message || 'Save rejected');
      }
    } catch (err) {
      console.error('Failed to save watchdog config', err);
      toast.error('Failed to save watchdog config');
    } finally {
      setWatchdogSaving(false);
    }
  };

  const isSuper = role === 'SUPER';

  return (
    <div className="relative min-h-screen flex bg-page text-foreground">
      <Toaster position="bottom-right" />
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {!loading && node && (
          <>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-brand truncate">{node.manager_data.hostname}</h1>
                <p className="text-sm text-gray-300 mt-1 break-words">
                  ID {node.identity.id} · {node.status} · Uptime {node.manager_data.uptime}s
                </p>
                <p className="text-sm text-gray-300 break-words">
                  System apps: {node.manager_data.system_apps} · Client apps: {node.manager_data.client_apps} · Warnings: {node.manager_data.warning}
                </p>
              </div>
              {isSuper && (
                <button
                  onClick={handleReload}
                  disabled={reloading}
                  className="btn-brand px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 shrink-0"
                >
                  {reloading ? 'Reloading…' : 'Reload Node'}
                </button>
              )}
            </div>

            {/* Git config -- read-only per repo, centralized on the Repos page.
                Recent Repositories (audit) stays: it's hygiene/resync, not
                identity editing. */}
            <div className="card p-6 mb-8">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-brand">Git Config</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleAudit}
                    disabled={auditing}
                    title="Force a resync/clean of every configured checkout, and purge stale state files for repos no longer configured"
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-full text-sm disabled:opacity-50"
                  >
                    {auditing ? 'Auditing…' : 'Recent Repositories'}
                  </button>
                  <button
                    onClick={() => router.push('/repos')}
                    className="btn-brand px-3 py-1 rounded-full text-sm"
                  >
                    Manage Repos
                  </button>
                </div>
              </div>

              {!gitLoading && (
                <div className="space-y-2">
                  {repos.map((r) => (
                    <div key={r.id} className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-700 py-2 text-sm">
                      <div className="text-gray-300">
                        <span className="font-medium text-white">{r.user}/{r.repo}</span>{' '}
                        @ {r.branch} · {serverToDisplay(r.server)} · {r.token ? '•••• set' : 'no token'}
                        <span className="text-gray-500"> ({r.id})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.id && (
                          <button onClick={() => router.push(`/apps/${r.id}`)} className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs">Open Controls</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {repos.length === 0 && <p className="text-sm text-gray-400">No repos configured.</p>}
                </div>
              )}
            </div>

            {/* Watchdog config editor */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-brand mb-4">Watchdog Config</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                <select value={application} onChange={(e) => setApplication(e.target.value)} className="bg-gray-800 rounded px-2 py-1 text-sm">
                  <option value="">Select application…</option>
                  {node.projects.map((r) => {
                    const key = r.replace('ais_', '');
                    return (
                      <option key={r} value={key}>{runnerLabels[key] ?? key}</option>
                    );
                  })}
                </select>
                <select value={kind} onChange={(e) => setKind(e.target.value as WatchdogConfigKind)} className="bg-gray-800 rounded px-2 py-1 text-sm">
                  <option value="config">config</option>
                  <option value="overrides">overrides</option>
                </select>
                <button onClick={loadWatchdogConfig} disabled={watchdogLoading} className="btn-brand px-3 py-1 rounded text-sm disabled:opacity-50">
                  {watchdogLoading ? 'Loading…' : 'Load'}
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full bg-black text-green-400 text-xs p-2 rounded border border-gray-700 font-mono"
                placeholder="Load a config to edit it"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={saveWatchdogConfig}
                  disabled={watchdogSaving || sha256 === null}
                  className="btn-brand px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                  {watchdogSaving ? 'Saving…' : 'Save'}
                </button>
                {sha256 && <span className="text-xs text-gray-500">sha256: {sha256.slice(0, 12)}…</span>}
              </div>
            </div>
          </>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}

export default function GuardedNodeDetailPage() {
  return (
    <RequireAdmin>
      <NodeDetailPage />
    </RequireAdmin>
  );
}
