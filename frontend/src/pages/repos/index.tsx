import { useEffect, useState, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { Sidebar } from '@/components/header';
import { RequireAdmin, isSuperRole } from '@/components/requireAdmin';
import LoadingOverlay from '@/components/loading';
import {
  fetchWithAuth,
  postWithAuth,
  fetchNodes,
  syncRepo,
  addRepoNodes,
  fetchGitConfig,
  updateNodeRepo,
  removeNodeRepo,
} from '@/lib/api';
import { useUser } from '@/hooks/useUser';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import {
  RepoCatalogEntry,
  RepoEntry,
  NodeInfo,
  GitServer,
  NodeHydrationStatus,
  syncStatusColorMap,
} from '@/lib/types';

interface ConfigBasics {
  build_command: string;
  install_command: string;
  run_command: string;
}

interface SecretDraft {
  key: string;
  value: string;
}

interface DeployResult {
  node_id: number;
  added: boolean;
  config_written: boolean;
  started: boolean;
  error?: string | null;
}

// Super-only edit form -- mirrors the per-node git-config editor that used
// to live on the Node detail page before Phase I5 centralized repo identity
// here. Token is prefilled with the real current value (fetched fresh via
// fetchGitConfig, since Super callers get it back in plaintext) rather than
// left blank: the backend does a full field replace on update, so a blank
// token would silently wipe a stored credential instead of leaving it alone.
const emptyRepoForm = {
  user: '',
  repo: '',
  branch: '',
  serverKind: 'GitHub' as 'GitHub' | 'GitLab' | 'Custom',
  customUrl: '',
  token: '',
};

function formToServer(form: typeof emptyRepoForm): GitServer {
  if (form.serverKind === 'Custom') return { Custom: form.customUrl };
  return form.serverKind;
}

export default function ReposPage() {
  const { role } = useUser();
  const isSuper = isSuperRole(role);

  const [repos, setRepos] = useState<RepoCatalogEntry[]>([]);
  const [reposError, setReposError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Per-row "add to node(s)" picker -- reuses the repo's already-stored
  // GitAuth server-side, so unlike the deploy wizard below it never needs
  // the repo's identity retyped.
  const [addNodesTargetId, setAddNodesTargetId] = useState<string | null>(null);
  const [addNodesSelected, setAddNodesSelected] = useState<number[]>([]);
  const [addingNodes, setAddingNodes] = useState(false);

  // Per-row "manage nodes" panel -- shows every node the repo is actually
  // deployed on (not just the 3-node preview), with Super-only Edit/Remove.
  const [manageTargetId, setManageTargetId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ repoId: string; nodeId: number } | null>(null);
  const [editForm, setEditForm] = useState(emptyRepoForm);
  const [editLoading, setEditLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removingAllId, setRemovingAllId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [user, setUser] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [serverKind, setServerKind] = useState<'GitHub' | 'GitLab' | 'Custom'>('GitHub');
  const [customUrl, setCustomUrl] = useState('');
  const [token, setToken] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [orgId, setOrgId] = useState('');
  const [config, setConfig] = useState<ConfigBasics>({
    build_command: '',
    install_command: '',
    run_command: '',
  });
  const [secrets, setSecrets] = useState<SecretDraft[]>([{ key: '', value: '' }]);
  const [deploying, setDeploying] = useState(false);
  const [deployResults, setDeployResults] = useState<DeployResult[] | null>(null);
  const [deployNote, setDeployNote] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    try {
      const res = await fetchWithAuth('proxy/repos');
      setRepos(res.data || []);
      setReposError(null);
    } catch (err) {
      setReposError('Failed to load the repo catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
    fetchNodes().then(setNodes).catch(() => setNodes([]));
  }, [loadRepos]);

  const handleSyncRepo = async (id: string) => {
    setSyncingId(id);
    try {
      const results = await syncRepo(id);
      const failures = results.filter((r) => !r.ok);
      if (failures.length === 0) {
        toast.success(`Synced on ${results.length} node${results.length === 1 ? '' : 's'}`);
      } else {
        failures.forEach((r) => toast.error(`Node ${r.node_id}: ${r.error || 'sync failed'}`));
        if (failures.length < results.length) {
          toast.success(`Synced on ${results.length - failures.length} of ${results.length} node(s)`);
        }
      }
      // Pick up the corrected state from the server rather than guessing it.
      await loadRepos();
    } catch (err) {
      toast.error('Sync failed -- check your access to this repo');
      console.error('Sync failed', err);
    } finally {
      setSyncingId(null);
    }
  };

  const openAddNodes = (id: string) => {
    setAddNodesTargetId(id);
    setAddNodesSelected([]);
  };

  const toggleAddNodeTarget = (id: number) => {
    setAddNodesSelected((cur) => (cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id]));
  };

  const handleAddNodes = async (repoId: string) => {
    if (addNodesSelected.length === 0) return;
    setAddingNodes(true);
    try {
      const results = await addRepoNodes(repoId, addNodesSelected);
      const failures = results.filter((r) => !r.added);
      if (failures.length === 0) {
        toast.success(`Added to ${results.length} node${results.length === 1 ? '' : 's'}`);
      } else {
        failures.forEach((r) => toast.error(`Node ${r.node_id}: ${r.error || 'add failed'}`));
      }
      const notStarted = results.filter((r) => r.added && !r.started);
      if (notStarted.length > 0) {
        // Config is copied in automatically when the existing nodes agree
        // on it (see addRepoNodes) -- if it still didn't start, either there
        // was no existing config anywhere to copy, or the app just isn't
        // built/ready on that node yet. Each node's own toast above (or its
        // `error` field) has the specific reason.
        toast(
          `${notStarted.length} node(s) have the repo but the app hasn't started yet -- check the Apps page`,
          { icon: '⚠️' }
        );
      }
      setAddNodesTargetId(null);
      setAddNodesSelected([]);
      await loadRepos();
    } catch (err) {
      // Includes the "configs already differ, unify them first" halt from
      // the server -- surface its actual message rather than a generic one.
      toast.error(err instanceof Error ? err.message : 'Failed to add repo to the selected node(s)');
      console.error('Add nodes failed', err);
    } finally {
      setAddingNodes(false);
    }
  };

  const openEdit = async (repoId: string, nodeId: number) => {
    setEditLoading(true);
    try {
      const envelope = await fetchGitConfig(nodeId);
      const entry = envelope.repos.find((r) => r.id === repoId);
      if (!entry) {
        toast.error('Could not find that repo on the node -- it may have just changed');
        return;
      }
      setEditForm({
        user: entry.user,
        repo: entry.repo,
        branch: entry.branch,
        serverKind: typeof entry.server === 'string' ? entry.server : 'Custom',
        customUrl: typeof entry.server === 'string' ? '' : entry.server.Custom,
        token: entry.token ?? '',
      });
      setEditing({ repoId, nodeId });
    } catch (err) {
      toast.error('Failed to load the current config for that node');
      console.error('fetchGitConfig failed', err);
    } finally {
      setEditLoading(false);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    const entry: RepoEntry = {
      user: editForm.user,
      repo: editForm.repo,
      branch: editForm.branch,
      server: formToServer(editForm),
      token: editForm.token || null,
    };
    setSavingEdit(true);
    try {
      const result = await updateNodeRepo(editing.nodeId, editing.repoId, entry);
      if (result.moved) {
        toast(result.moved.note, { icon: '⚠️', duration: 8000 });
      }
      toast(result.reload.ok ? 'Saved and reloaded git monitor' : `Saved, but reload: ${result.reload.message ?? 'failed'}`, {
        icon: result.reload.ok ? '✅' : '⚠️',
      });
      setEditing(null);
      await loadRepos();
    } catch (err) {
      toast.error('Failed to save repo');
      console.error('updateNodeRepo failed', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeFromNode = async (repoId: string, nodeId: number, hostname: string) => {
    if (!confirm(`Remove this repo from ${hostname}?`)) return;
    const key = `${repoId}:${nodeId}`;
    setRemovingKey(key);
    try {
      const result = await removeNodeRepo(nodeId, repoId);
      toast(result.reload.ok ? 'Removed and reloaded git monitor' : `Removed, but reload: ${result.reload.message ?? 'failed'}`, {
        icon: result.reload.ok ? '✅' : '⚠️',
      });
      await loadRepos();
    } catch (err) {
      toast.error('Failed to remove repo from that node');
      console.error('removeNodeRepo failed', err);
    } finally {
      setRemovingKey(null);
    }
  };

  const removeFromAllNodes = async (r: RepoCatalogEntry) => {
    if (r.nodes.length === 0) return;
    if (!confirm(`Remove ${r.user}/${r.repo} from all ${r.nodes.length} node(s)? This cannot be undone.`)) return;
    setRemovingAllId(r.id);
    try {
      const outcomes = await Promise.allSettled(r.nodes.map((n) => removeNodeRepo(n.node_id, r.id)));
      const failures = outcomes
        .map((outcome, i) => ({ outcome, node: r.nodes[i] }))
        .filter((x) => x.outcome.status === 'rejected');
      if (failures.length === 0) {
        toast.success(`Removed from all ${outcomes.length} node(s)`);
      } else {
        failures.forEach(({ node }) => toast.error(`Failed to remove from ${node.hostname}`));
        if (failures.length < outcomes.length) {
          toast.success(`Removed from ${outcomes.length - failures.length} of ${outcomes.length} node(s)`);
        }
      }
      await loadRepos();
    } finally {
      setRemovingAllId(null);
    }
  };

  // A repo the wizard's identity fields resolve to that isn't already in
  // the loaded catalog needs the config-basics step -- the deploy endpoint
  // enforces this server-side too, this is just so the UI shows it upfront.
  const matchesExisting = repos.some(
    (r) => r.user === user.trim() && r.repo === repo.trim() && r.branch === branch.trim()
  );
  const isNewRepo = user.trim() !== '' && repo.trim() !== '' && !matchesExisting;

  const toggleNode = (id: number) => {
    setSelectedNodeIds((cur) => (cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id]));
  };

  const resetWizard = () => {
    setUser('');
    setRepo('');
    setBranch('main');
    setServerKind('GitHub');
    setCustomUrl('');
    setToken('');
    setSelectedNodeIds([]);
    setOrgId('');
    setConfig({ build_command: '', install_command: '', run_command: '' });
    setSecrets([{ key: '', value: '' }]);
    setDeployResults(null);
    setDeployNote(null);
    setDeployError(null);
  };

  const submitDeploy = async () => {
    if (!user.trim() || !repo.trim() || !branch.trim() || selectedNodeIds.length === 0) return;
    setDeploying(true);
    setDeployError(null);
    setDeployResults(null);
    setDeployNote(null);
    try {
      const server: GitServer = serverKind === 'Custom' ? { Custom: customUrl } : serverKind;
      const body: Record<string, unknown> = {
        repo: { user: user.trim(), repo: repo.trim(), branch: branch.trim(), server, token: token || null },
        node_ids: selectedNodeIds,
        environment_id: 'production',
      };
      if (orgId) body.org_id = orgId;
      if (isNewRepo) {
        body.config = {
          build_command: config.build_command || null,
          install_command: config.install_command || null,
          run_command: config.run_command,
        };
        const cleanSecrets = secrets.filter((s) => s.key.trim() && s.value.trim());
        if (cleanSecrets.length) {
          body.secrets = cleanSecrets.map((s) => ({ key: s.key.trim(), value: s.value }));
        }
      }

      const res = await postWithAuth('proxy/repos/deploy', body);
      setDeployResults(res.data?.results || []);
      setDeployNote(res.data?.note || null);
      loadRepos();
    } catch (err) {
      setDeployError('Deploy failed -- check the repo details, node selection and your access level.');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <RequireAdmin>
      <div className="relative min-h-screen flex bg-page text-foreground">
        <Toaster position="bottom-right" />
        <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-brand">Repos</h1>
            <button
              onClick={() => {
                resetWizard();
                setWizardOpen(true);
              }}
              className="btn-brand px-4 py-2 rounded"
            >
              Deploy repo
            </button>
          </div>

          <div className="card p-6 space-y-4">
            {reposError && <p className="text-sm text-red-500">{reposError}</p>}
            {loading && <LoadingOverlay />}
            {!loading && (
              <div className="space-y-2">
                {repos.map((r) => (
                  <div key={r.id} className="card-hover p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {r.user}/{r.repo} @ {r.branch}
                        </p>
                        <p className="text-xs text-gray-400">
                          id: {r.id} -- {r.nodes.length} node{r.nodes.length === 1 ? '' : 's'}
                          {r.org_id ? ` -- org ${r.org_id}` : ' -- unassigned'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-sm font-medium ${syncStatusColorMap[r.sync_status]}`}
                        >
                          {r.sync_status}
                        </span>
                        <button
                          onClick={() => handleSyncRepo(r.id)}
                          disabled={syncingId === r.id}
                          className="btn-brand px-3 py-1 rounded text-sm disabled:opacity-50"
                        >
                          {syncingId === r.id ? 'Syncing...' : 'Sync now'}
                        </button>
                        <button
                          onClick={() => (addNodesTargetId === r.id ? setAddNodesTargetId(null) : openAddNodes(r.id))}
                          className="px-3 py-1 rounded text-sm border border-gray-500 hover:bg-gray-700"
                        >
                          Add to node{addNodesTargetId === r.id ? '...' : ''}
                        </button>
                        <button
                          onClick={() => setManageTargetId(manageTargetId === r.id ? null : r.id)}
                          className="px-3 py-1 rounded text-sm border border-gray-500 hover:bg-gray-700"
                        >
                          Manage nodes ({r.nodes.length})
                        </button>
                      </div>
                    </div>

                    {manageTargetId === r.id && (
                      <div className="mt-2 border-t border-gray-700 pt-3 space-y-2">
                        {isSuper && r.nodes.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => removeFromAllNodes(r)}
                              disabled={removingAllId === r.id}
                              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              {removingAllId === r.id ? 'Removing from all nodes...' : 'Remove from all nodes'}
                            </button>
                          </div>
                        )}
                        {r.nodes.length === 0 && (
                          <p className="text-sm text-gray-400">Not deployed on any node.</p>
                        )}
                        {r.nodes.map((node: NodeHydrationStatus) => (
                          <div key={node.node_id} className="bg-black/20 rounded p-2 space-y-2">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{node.hostname}</p>
                                <p className="text-xs text-gray-400 truncate">
                                  {node.branch}
                                  {node.commit_sha ? ` @ ${node.commit_sha.slice(0, 8)}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${syncStatusColorMap[node.sync_status]}`}>
                                  {node.sync_status}
                                </span>
                                {isSuper && (
                                  <>
                                    <button
                                      onClick={() => openEdit(r.id, node.node_id)}
                                      disabled={editLoading}
                                      className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs disabled:opacity-50"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => removeFromNode(r.id, node.node_id, node.hostname)}
                                      disabled={removingKey === `${r.id}:${node.node_id}`}
                                      className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs disabled:opacity-50"
                                    >
                                      {removingKey === `${r.id}:${node.node_id}` ? 'Removing...' : 'Remove'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {isSuper && editing?.repoId === r.id && editing.nodeId === node.node_id && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-gray-700 pt-2">
                                <input
                                  placeholder="user"
                                  value={editForm.user}
                                  onChange={(e) => setEditForm({ ...editForm, user: e.target.value })}
                                  className="bg-gray-800 rounded px-2 py-1 text-sm"
                                />
                                <input
                                  placeholder="repo"
                                  value={editForm.repo}
                                  onChange={(e) => setEditForm({ ...editForm, repo: e.target.value })}
                                  className="bg-gray-800 rounded px-2 py-1 text-sm"
                                />
                                <input
                                  placeholder="branch"
                                  value={editForm.branch}
                                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                                  className="bg-gray-800 rounded px-2 py-1 text-sm"
                                />
                                <select
                                  value={editForm.serverKind}
                                  onChange={(e) => setEditForm({ ...editForm, serverKind: e.target.value as any })}
                                  className="bg-gray-800 rounded px-2 py-1 text-sm"
                                >
                                  <option value="GitHub">GitHub</option>
                                  <option value="GitLab">GitLab</option>
                                  <option value="Custom">Custom</option>
                                </select>
                                {editForm.serverKind === 'Custom' && (
                                  <input
                                    placeholder="custom server URL"
                                    value={editForm.customUrl}
                                    onChange={(e) => setEditForm({ ...editForm, customUrl: e.target.value })}
                                    className="bg-gray-800 rounded px-2 py-1 text-sm sm:col-span-2"
                                  />
                                )}
                                <input
                                  placeholder="token (blank clears it)"
                                  value={editForm.token}
                                  onChange={(e) => setEditForm({ ...editForm, token: e.target.value })}
                                  className="bg-gray-800 rounded px-2 py-1 text-sm sm:col-span-2"
                                />
                                <div className="flex gap-2 sm:col-span-2">
                                  <button
                                    onClick={submitEdit}
                                    disabled={savingEdit}
                                    className="btn-brand px-3 py-1 rounded text-sm disabled:opacity-50"
                                  >
                                    {savingEdit ? 'Saving...' : 'Save changes'}
                                  </button>
                                  <button
                                    onClick={() => setEditing(null)}
                                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {addNodesTargetId === r.id && (() => {
                      const assignedIds = new Set(r.nodes.map((n) => n.node_id));
                      const candidates = nodes.filter((n) => !assignedIds.has(n.identity.id));
                      return (
                        <div className="mt-2 border-t border-gray-700 pt-3 space-y-2">
                          {candidates.length === 0 ? (
                            <p className="text-xs text-gray-500">Already on every known node.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {candidates.map((n) => (
                                <label key={n.identity.id} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={addNodesSelected.includes(n.identity.id)}
                                    onChange={() => toggleAddNodeTarget(n.identity.id)}
                                  />
                                  {n.hostname}
                                </label>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddNodes(r.id)}
                              disabled={addingNodes || addNodesSelected.length === 0}
                              className="btn-brand px-3 py-1 rounded text-sm disabled:opacity-50"
                            >
                              {addingNodes ? 'Adding...' : `Add to ${addNodesSelected.length || ''} node${addNodesSelected.length === 1 ? '' : 's'}`}
                            </button>
                            <button
                              onClick={() => setAddNodesTargetId(null)}
                              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
                {repos.length === 0 && !reposError && (
                  <p className="text-gray-500 text-sm">No repos deployed on any node yet.</p>
                )}
              </div>
            )}
          </div>

          {wizardOpen && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-brand">Deploy a repo</h2>
                <button onClick={() => setWizardOpen(false)} className="text-sm text-gray-400 hover:text-gray-200">
                  Close
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Git user/org"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                />
                <input
                  placeholder="Repo name"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                />
                <input
                  placeholder="Branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                />
                <select
                  value={serverKind}
                  onChange={(e) => setServerKind(e.target.value as 'GitHub' | 'GitLab' | 'Custom')}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                >
                  <option value="GitHub">GitHub</option>
                  <option value="GitLab">GitLab</option>
                  <option value="Custom">Custom</option>
                </select>
                {serverKind === 'Custom' && (
                  <input
                    placeholder="Custom git URL"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 sm:col-span-2"
                  />
                )}
                <input
                  placeholder="Access token (optional)"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 sm:col-span-2"
                />
                <input
                  placeholder="Org id to assign (optional)"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 sm:col-span-2"
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-brand mb-2">Deploy to nodes</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {nodes.map((n) => (
                    <label key={n.identity.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedNodeIds.includes(n.identity.id)}
                        onChange={() => toggleNode(n.identity.id)}
                      />
                      {n.hostname}
                    </label>
                  ))}
                  {nodes.length === 0 && <p className="text-gray-500 text-sm">No nodes available.</p>}
                </div>
              </div>

              {isNewRepo && (
                <div className="border-t border-gray-300 dark:border-gray-700 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-brand">
                    This repo hasn't been deployed anywhere yet -- config basics required
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      placeholder="Install command (optional)"
                      value={config.install_command}
                      onChange={(e) => setConfig({ ...config, install_command: e.target.value })}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                    />
                    <input
                      placeholder="Build command (optional)"
                      value={config.build_command}
                      onChange={(e) => setConfig({ ...config, build_command: e.target.value })}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                    />
                    <input
                      placeholder="Run command"
                      value={config.run_command}
                      onChange={(e) => setConfig({ ...config, run_command: e.target.value })}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                    />
                  </div>

                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Initial secrets (optional)
                  </h4>
                  {secrets.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        placeholder="Key"
                        value={s.key}
                        onChange={(e) => {
                          const next = [...secrets];
                          next[i] = { ...next[i], key: e.target.value };
                          setSecrets(next);
                        }}
                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                      />
                      <input
                        placeholder="Value"
                        value={s.value}
                        onChange={(e) => {
                          const next = [...secrets];
                          next[i] = { ...next[i], value: e.target.value };
                          setSecrets(next);
                        }}
                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setSecrets([...secrets, { key: '', value: '' }])}
                    className="text-sm text-blue-500 hover:text-blue-600"
                  >
                    + Add another secret
                  </button>
                </div>
              )}

              {deployError && <p className="text-sm text-red-500">{deployError}</p>}

              {deployResults && (
                <div className="border-t border-gray-300 dark:border-gray-700 pt-4 space-y-1">
                  <h3 className="text-sm font-semibold text-brand">Deploy results</h3>
                  {deployNote && <p className="text-xs text-yellow-500">{deployNote}</p>}
                  {deployResults.map((r) => (
                    <p key={r.node_id} className="text-sm text-gray-400">
                      Node {r.node_id}: added={String(r.added)}, config={String(r.config_written)}, started=
                      {String(r.started)}
                      {r.error ? ` -- ${r.error}` : ''}
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={submitDeploy}
                disabled={
                  deploying ||
                  !user.trim() ||
                  !repo.trim() ||
                  selectedNodeIds.length === 0 ||
                  (isNewRepo && !config.run_command.trim())
                }
                className="btn-brand px-4 py-2 rounded disabled:opacity-50"
              >
                {deploying ? 'Deploying...' : 'Deploy'}
              </button>
            </div>
          )}
        </main>
      </div>
    </RequireAdmin>
  );
}
