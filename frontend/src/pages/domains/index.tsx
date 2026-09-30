import { useEffect, useState, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { TopBar } from '@/components/topbar';
import { isSuperRole } from '@/components/requireAdmin';
import LoadingOverlay from '@/components/loading';
import { useUser } from '@/hooks/useUser';
import { useElevatedSession } from '@/hooks/useElevatedSession';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { resolveRunnerLabel } from '@/lib/repoLabel';
import { formatExpiry } from '@/lib/format';
import {
  fetchWithAuth,
  fetchDomains,
  fetchDomainFindings,
  fetchAdoptedVhosts,
  assignDomain,
  attachDomain,
  rescanDomains,
  fetchNodes,
} from '@/lib/api';
import { AdoptedVhost, DomainEntry, DomainFinding, NodeInfo } from '@/lib/types';
import { Button, Field, Pill, Panel, SelectField, Switch } from '@/components/ui';

interface Organization {
  id: string;
  name: string;
}

const PAGE_SIZE = 50;

// Per-row "assign" / "attach" editor. Kept as one component so its draft
// state resets cleanly whenever a different domain's panel is opened.
function AssignForm({
  domain,
  orgs,
  isSuper,
  myOrgId,
  elevatedToken,
  onDone,
}: {
  domain: DomainEntry;
  orgs: Organization[];
  isSuper: boolean;
  myOrgId: string;
  elevatedToken: string | null;
  onDone: () => void;
}) {
  const [orgId, setOrgId] = useState(domain.organization_id || myOrgId);
  const [runnerId, setRunnerId] = useState(domain.runner_id);
  const [clearOrg, setClearOrg] = useState(false);
  const [clearRunner, setClearRunner] = useState(false);
  const [saving, setSaving] = useState(false);

  const isUnassigned = !domain.organization_id;
  // Claiming an unassigned domain is Super only; moving one that already
  // belongs to an organization needs the elevated token.
  const needsElevation = !isUnassigned;
  const blocked = isUnassigned && !isSuper;

  const submit = async () => {
    setSaving(true);
    try {
      await assignDomain({
        id_or_fqdn: domain.id,
        organization_id: clearOrg ? '' : orgId,
        runner_id: clearRunner ? '' : runnerId,
        clear_org: clearOrg,
        clear_runner: clearRunner,
        elevated_token: needsElevation ? elevatedToken ?? undefined : undefined,
      });
      toast.success(`Updated ${domain.fqdn}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign domain');
    } finally {
      setSaving(false);
    }
  };

  if (blocked) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Claiming an unassigned domain needs a Super. Ask a Super to assign it first.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {isSuper ? (
        <SelectField value={clearOrg ? '' : orgId} disabled={clearOrg} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">Unassigned</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </SelectField>
      ) : (
        <Field sans disabled value={orgId} />
      )}
      <Field sans placeholder="runner id (blank = not attached)" value={clearRunner ? '' : runnerId} disabled={clearRunner} onChange={(e) => setRunnerId(e.target.value)} />

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Switch checked={clearOrg} onChange={setClearOrg} label="Clear organization" />
        Clear organization (unassign)
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Switch checked={clearRunner} onChange={setClearRunner} label="Clear runner" />
        Clear runner (detach)
      </label>

      {needsElevation && !elevatedToken && (
        <p className="text-xs sm:col-span-2" style={{ color: 'var(--warn)' }}>
          Moving a domain that already belongs to an organization needs an elevated session --
          unlock one below first.
        </p>
      )}

      <div className="sm:col-span-2">
        <Button small onClick={submit} disabled={saving || (needsElevation && !elevatedToken)}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function AttachForm({
  domain,
  nodes,
  onDone,
}: {
  domain: DomainEntry;
  nodes: NodeInfo[];
  onDone: () => void;
}) {
  const [runnerId, setRunnerId] = useState(domain.runner_id);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [port, setPort] = useState('3000');
  const [extraNames, setExtraNames] = useState('');
  const [noHttpRedirect, setNoHttpRedirect] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleNode = (id: number) => {
    setSelectedNodeIds((cur) => (cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id]));
  };

  const submit = async () => {
    const portNum = Number(port);
    if (!runnerId.trim() || selectedNodeIds.length === 0 || !Number.isInteger(portNum)) return;
    setSaving(true);
    try {
      await attachDomain({
        id_or_fqdn: domain.id,
        runner_id: runnerId.trim(),
        backends: selectedNodeIds.map((nodeId) => ({ node_id: String(nodeId), port: portNum })),
        extra_names: extraNames.split(',').map((s) => s.trim()).filter(Boolean),
        no_http_redirect: noHttpRedirect,
      });
      toast.success(`Attached ${domain.fqdn}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach domain');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Needs Write on the runner and ownership of the domain. Selecting more than one node
        makes a balanced upstream.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field sans placeholder="runner id" value={runnerId} onChange={(e) => setRunnerId(e.target.value)} />
        <Field sans placeholder="port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
        <Field sans placeholder="extra names (comma-separated, e.g. www.example.com)" value={extraNames} onChange={(e) => setExtraNames(e.target.value)} className="sm:col-span-2" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((n) => (
          <label key={n.identity.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedNodeIds.includes(n.identity.id)} onChange={() => toggleNode(n.identity.id)} />
            {n.hostname}
          </label>
        ))}
        {nodes.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>No nodes available.</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={noHttpRedirect} onChange={setNoHttpRedirect} label="Suppress HTTP redirect" />
        Suppress the port-80 redirect to HTTPS
      </label>
      <Button small onClick={submit} disabled={saving || !runnerId.trim() || selectedNodeIds.length === 0}>
        {saving ? 'Attaching...' : 'Attach'}
      </Button>
    </div>
  );
}

export default function DomainsPage() {
  const { role, orgId: myOrgId } = useUser();
  const isSuper = isSuperRole(role);
  const elevated = useElevatedSession();

  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgFilter, setOrgFilter] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [runnerLabels, setRunnerLabels] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<{ id: string; mode: 'assign' | 'attach' } | null>(null);

  const [findings, setFindings] = useState<DomainFinding[]>([]);
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [findingsSeverity, setFindingsSeverity] = useState<'' | 'info' | 'warn' | 'error'>('');
  const [findingsOpenOnly, setFindingsOpenOnly] = useState(true);

  const [vhosts, setVhosts] = useState<AdoptedVhost[]>([]);
  const [vhostsError, setVhostsError] = useState<string | null>(null);

  const [rescanning, setRescanning] = useState(false);
  const [checkDns, setCheckDns] = useState(false);
  const [checkCloudflare, setCheckCloudflare] = useState(false);

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchDomains({
        organizationId: isSuper && orgFilter ? orgFilter : undefined,
        unassignedOnly,
        limit: PAGE_SIZE,
        offset,
      });
      setDomains(page.entries ?? []);
      setTotal(page.total ?? 0);
      setUnassignedCount(page.unassigned ?? 0);
      setDomainsError(null);
    } catch (err) {
      setDomainsError(err instanceof Error ? err.message : 'Failed to load domains');
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [isSuper, orgFilter, unassignedOnly, offset]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    if (!isSuper) return;
    fetchWithAuth('proxy/admin/organizations')
      .then((res) => setOrgs(res.data || []))
      .catch(() => setOrgs([]));
  }, [isSuper]);

  useEffect(() => {
    fetchNodes().then(setNodes).catch(() => setNodes([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    domains.forEach((d) => {
      if (!d.runner_id || runnerLabels[d.runner_id]) return;
      resolveRunnerLabel(d.runner_id).then((label) => {
        if (cancelled) return;
        setRunnerLabels((prev) => (prev[d.runner_id] ? prev : { ...prev, [d.runner_id]: label }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [domains]);

  const loadFindings = useCallback(async () => {
    if (!isSuper) return;
    try {
      const rows = await fetchDomainFindings({
        severity: findingsSeverity || undefined,
        openOnly: findingsOpenOnly,
        limit: 200,
      });
      setFindings(rows);
      setFindingsError(null);
    } catch (err) {
      setFindingsError(err instanceof Error ? err.message : 'Failed to load findings');
      setFindings([]);
    }
  }, [isSuper, findingsSeverity, findingsOpenOnly]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const loadVhosts = useCallback(async () => {
    if (!isSuper) return;
    try {
      setVhosts(await fetchAdoptedVhosts());
      setVhostsError(null);
    } catch (err) {
      setVhostsError(err instanceof Error ? err.message : 'Failed to load adopted vhosts');
      setVhosts([]);
    }
  }, [isSuper]);

  useEffect(() => {
    loadVhosts();
  }, [loadVhosts]);

  const handleRescan = async () => {
    setRescanning(true);
    try {
      const result = await rescanDomains({ checkDns, checkCloudflare });
      toast.success(
        `Scan #${result.scan_id}: ${result.domain_count} domain(s), ${result.finding_count} finding(s), ${result.server_count} server(s)`,
      );
      loadDomains();
      loadFindings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rescan failed');
    } finally {
      setRescanning(false);
    }
  };

  const toggleExpand = (id: string, mode: 'assign' | 'attach') => {
    setExpanded((cur) => (cur?.id === id && cur.mode === mode ? null : { id, mode }));
  };

  const closeExpand = () => {
    setExpanded(null);
    loadDomains();
  };

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <Toaster position="bottom-right" />
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-3xl font-bold text-brand">Domains</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {total} domain{total === 1 ? '' : 's'}{isSuper ? ` -- ${unassignedCount} unassigned` : ''}
          </p>
        </div>

        {/* Step-up auth -- only assigning a domain that already belongs to
            an organization needs this; attaching never does. */}
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
                placeholder="Re-enter your password to unlock write actions"
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

        {/* Filters */}
        <div className="card p-6 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            {isSuper && (
              <SelectField value={orgFilter} onChange={(e) => { setOffset(0); setOrgFilter(e.target.value); }} className="w-full sm:w-64">
                <option value="">All organizations</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </SelectField>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={unassignedOnly} onChange={(v) => { setOffset(0); setUnassignedOnly(v); }} label="Unassigned only" />
              Unassigned only
            </label>
            {isSuper && (
              <div className="ml-auto flex flex-wrap gap-3 items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checkDns} onChange={(e) => setCheckDns(e.target.checked)} />
                  check DNS
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checkCloudflare} onChange={(e) => setCheckCloudflare(e.target.checked)} />
                  check Cloudflare
                </label>
                <Button small variant="ghost" onClick={handleRescan} disabled={rescanning} title="Read-only, but walks every config file on the host">
                  {rescanning ? 'Rescanning...' : 'Rescan'}
                </Button>
              </div>
            )}
          </div>
          {domainsError && <p className="text-sm text-red-500">{domainsError}</p>}
        </div>

        {/* Domain list */}
        <div className="card p-6 space-y-2 relative">
          {loading && <LoadingOverlay />}
          {!loading && domains.length === 0 && !domainsError && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No domains found.</p>
          )}
          {domains.map((d) => (
            <div key={d.id} className="card-hover p-3 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" style={{ fontFamily: 'var(--font-mono)' }}>{d.fqdn}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                    {d.organization_id ? `org ${d.organization_id}` : 'unassigned'}
                    {' -- '}
                    {d.runner_id ? (runnerLabels[d.runner_id] ?? d.runner_id) : 'not attached'}
                    {' -- '}
                    {formatExpiry(d.expires_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Pill status={d.status} />
                  <Pill status={d.serves_tls ? 'active' : 'idle'} label={d.serves_tls ? 'TLS' : 'no TLS'} />
                  {d.findings.length > 0 && <Pill status="warning" label={`${d.findings.length} finding${d.findings.length === 1 ? '' : 's'}`} />}
                  <Button small variant="ghost" onClick={() => toggleExpand(d.id, 'assign')}>
                    Assign
                  </Button>
                  <Button small variant="ghost" onClick={() => toggleExpand(d.id, 'attach')}>
                    Attach
                  </Button>
                </div>
              </div>

              {expanded?.id === d.id && expanded.mode === 'assign' && (
                <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--line)' }}>
                  <AssignForm
                    domain={d}
                    orgs={orgs}
                    isSuper={isSuper}
                    myOrgId={myOrgId}
                    elevatedToken={elevated.token}
                    onDone={closeExpand}
                  />
                </div>
              )}
              {expanded?.id === d.id && expanded.mode === 'attach' && (
                <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--line)' }}>
                  <AttachForm domain={d} nodes={nodes} onDone={closeExpand} />
                </div>
              )}
            </div>
          ))}

          {(offset > 0 || domains.length === PAGE_SIZE) && (
            <div className="flex justify-between pt-2">
              <Button small variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </Button>
              <Button small variant="ghost" disabled={domains.length < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Super-only hygiene panels */}
        {isSuper && (
          <Panel title="Findings">
            <div className="flex flex-wrap gap-3 items-center">
              <SelectField value={findingsSeverity} onChange={(e) => setFindingsSeverity(e.target.value as any)} className="w-auto">
                <option value="">All severities</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </SelectField>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={findingsOpenOnly} onChange={setFindingsOpenOnly} label="Open only" />
                Open only
              </label>
            </div>
            {findingsError && <p className="text-sm text-red-500">{findingsError}</p>}
            <div className="space-y-2">
              {findings.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" style={{ borderBottom: '1px solid var(--line)' }}>
                  <div className="min-w-0">
                    <p className="truncate"><span className="font-medium" style={{ color: 'var(--strong)' }}>{f.code}</span> -- {f.subject}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{f.message}</p>
                  </div>
                  <Pill status={f.severity} />
                </div>
              ))}
              {findings.length === 0 && !findingsError && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No findings.</p>
              )}
            </div>
          </Panel>
        )}

        {isSuper && (
          <Panel title="Adopted vhosts">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Hand-written vhosts the service adopted. Surfaced, never acted on -- these are
              files people are expected to edit. "Drifted" means the file changed on disk
              since it was adopted.
            </p>
            {vhostsError && <p className="text-sm text-red-500">{vhostsError}</p>}
            <div className="space-y-2">
              {vhosts.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" style={{ borderBottom: '1px solid var(--line)' }}>
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: 'var(--strong)' }}>{v.domain_fqdn}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{v.path} -- {v.server_names.join(', ')}</p>
                  </div>
                  {v.drifted && <Pill status="warning" label="drifted" />}
                </div>
              ))}
              {vhosts.length === 0 && !vhostsError && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No adopted vhosts.</p>
              )}
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}
