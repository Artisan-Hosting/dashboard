import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast, Toaster } from 'react-hot-toast';
import { TopBar } from '@/components/topbar';
import LoadingOverlay from '@/components/loading';
import { RequireAdmin, isSuperRole } from '@/components/requireAdmin';
import { useUser } from '@/hooks/useUser';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import {
  fetchNodeDetails,
  reloadNode,
  fetchGitConfig,
  auditGitConfig,
  fetchWatchdogConfig,
  setWatchdogConfig,
  fetchProjects,
} from '@/lib/api';
import {
  NodeDetails,
  RepoEntry,
  GitServer,
  WatchdogConfigKind,
  ProjectSummary,
} from '@/lib/types';
import { resolveRunnerLabel, systemAppLabel } from '@/lib/repoLabel';
import { Button, Pill, SelectField } from '@/components/ui';

function serverToDisplay(server: GitServer): string {
  return typeof server === 'string' ? server : `Custom (${server.Custom})`;
}

function NodeDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const nodeId = id ? Number(id) : NaN;
  const { role } = useUser();
  const isSuper = isSuperRole(role);

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
  const [projectLabels, setProjectLabels] = useState<Record<string, string>>({});

  // Fleet-wide, not scoped to this node -- Portal has no per-node linkage
  // for the platform's own system apps (see the ProjectSummary.nodes doc
  // comment), so this is the best available view of their status/version.
  const [systemApps, setSystemApps] = useState<ProjectSummary[]>([]);
  const [systemAppsLoading, setSystemAppsLoading] = useState(true);

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
    if (!isSuper) {
      setSystemAppsLoading(false);
      return;
    }
    setSystemAppsLoading(true);
    fetchProjects()
      .then((all) => setSystemApps(all.filter((p) => systemAppLabel(p.name) !== null)))
      .catch((err) => {
        console.error('Failed to load system app status', err);
        setSystemApps([]);
      })
      .finally(() => setSystemAppsLoading(false));
  }, [isSuper]);

  useEffect(() => {
    if (!node) return;
    let cancelled = false;
    node.projects.forEach((r) => {
      const key = r.replace('ais_', '');
      if (projectLabels[key]) return;
      resolveRunnerLabel(key).then((label) => {
        if (cancelled) return;
        setProjectLabels((prev) => (prev[key] ? prev : { ...prev, [key]: label }));
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

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <Toaster position="bottom-right" />
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="overflow-y-auto p-4 sm:p-6 lg:p-8">
        {!loading && node && (
          <>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-brand truncate">{node.manager_data.hostname}</h1>
                <p className="text-sm mt-1 break-words" style={{ color: 'var(--muted)' }}>
                  ID {node.identity.id} · {node.status} · Uptime {node.manager_data.uptime}s
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    System apps: {node.manager_data.system_apps} · Client apps: {node.manager_data.client_apps}
                  </span>
                  <Pill
                    status={node.manager_data.warning > 0 ? 'error' : 'active'}
                    label={node.manager_data.warning > 0 ? 'Security trip detected' : 'No security trips'}
                  />
                </div>
                {node.manager_data.warning > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    Sticky since the manager process last started -- stays flagged even after the
                    underlying issue clears, until manager restarts.
                  </p>
                )}
              </div>
              {isSuper && (
                <Button onClick={handleReload} disabled={reloading} className="shrink-0">
                  {reloading ? 'Reloading…' : 'Reload Node'}
                </Button>
              )}
            </div>

            {/* Versions -- this node's own manager, application vs the
                ais_library (artisan_middleware) it's built against. */}
            <div className="card p-6 mb-8">
              <h2 className="text-xl font-bold text-brand mb-4">Versions</h2>
              <dl className="kv">
                <dt>Application</dt>
                <dd>{node.manager_data.version.application.number} ({node.manager_data.version.application.code})</dd>
                <dt>Library (ais_library)</dt>
                <dd>{node.manager_data.version.library.number} ({node.manager_data.version.library.code})</dd>
              </dl>
            </div>

            {/* System apps -- fleet-wide, not scoped to this node. Portal has
                no per-node linkage for manager/gitmon/mailler (see the
                ProjectSummary.nodes doc comment), so this is the best
                available view rather than a per-node breakdown. */}
            {isSuper && (
              <div className="card p-6 mb-8">
                <h2 className="text-xl font-bold text-brand mb-1">System Apps</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  Fleet-wide status, not scoped to this node -- Portal doesn't currently track which
                  node runs which system-app instance.
                </p>
                {!systemAppsLoading && (
                  <div className="space-y-2">
                    {systemApps.map((app) => (
                      <div
                        key={app.name}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                        style={{ borderBottom: '1px solid var(--line)' }}
                      >
                        <span className="font-medium" style={{ color: 'var(--strong)' }}>
                          {systemAppLabel(app.name) ?? app.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <Pill status={app.status} />
                          <span style={{ color: 'var(--muted)' }}>
                            app {app.version.application.number} · lib {app.version.library.number}
                          </span>
                        </div>
                      </div>
                    ))}
                    {systemApps.length === 0 && (
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>No system apps reported.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Git config -- read-only per repo, centralized on the Repos page.
                Recent Repositories (audit) stays: it's hygiene/resync, not
                identity editing. */}
            <div className="card p-6 mb-8">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-brand">Git Config</h2>
                <div className="flex gap-2">
                  <Button
                    small
                    variant="ghost"
                    onClick={handleAudit}
                    disabled={auditing}
                    title="Force a resync/clean of every configured checkout, and purge stale state files for repos no longer configured"
                  >
                    {auditing ? 'Auditing…' : 'Recent Repositories'}
                  </Button>
                  <Button small onClick={() => router.push('/repos')}>
                    Manage Repos
                  </Button>
                </div>
              </div>

              {!gitLoading && (
                <div className="space-y-2">
                  {repos.map((r) => (
                    <div key={r.id} className="flex flex-wrap justify-between items-center gap-2 py-2 text-sm" style={{ borderBottom: '1px solid var(--line)' }}>
                      <div style={{ color: 'var(--text)' }}>
                        <span className="font-medium" style={{ color: 'var(--strong)' }}>{r.user}/{r.repo}</span>{' '}
                        @ {r.branch} · {serverToDisplay(r.server)} · {r.token ? '•••• set' : 'no token'}
                        <span style={{ color: 'var(--muted)' }}> ({r.id})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.id && (
                          <Button small variant="ghost" onClick={() => router.push(`/apps/${r.id}`)}>Open Controls</Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {repos.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>No repos configured.</p>}
                </div>
              )}
            </div>

            {/* Watchdog config editor */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-brand mb-4">Watchdog Config</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                <SelectField value={application} onChange={(e) => setApplication(e.target.value)} style={{ width: 'auto' }}>
                  <option value="">Select application…</option>
                  {node.projects.map((r) => {
                    const key = r.replace('ais_', '');
                    return (
                      <option key={r} value={key}>{projectLabels[key] ?? key}</option>
                    );
                  })}
                </SelectField>
                <SelectField value={kind} onChange={(e) => setKind(e.target.value as WatchdogConfigKind)} style={{ width: 'auto' }}>
                  <option value="config">config</option>
                  <option value="overrides">overrides</option>
                </SelectField>
                <Button small onClick={loadWatchdogConfig} disabled={watchdogLoading}>
                  {watchdogLoading ? 'Loading…' : 'Load'}
                </Button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="code"
                placeholder="Load a config to edit it"
              />
              <div className="mt-3 flex items-center gap-3">
                <Button small onClick={saveWatchdogConfig} disabled={watchdogSaving || sha256 === null}>
                  {watchdogSaving ? 'Saving…' : 'Save'}
                </Button>
                {sha256 && <span className="text-xs" style={{ color: 'var(--muted)' }}>sha256: {sha256.slice(0, 12)}…</span>}
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
