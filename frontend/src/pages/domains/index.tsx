import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast, Toaster } from 'react-hot-toast';
import { TopBar } from '@/components/topbar';
import { isAdminRole, isSuperRole } from '@/components/requireAdmin';
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
  listDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
  listCertificates,
  forceRenewCertificate,
  listOrders,
  listDomainMembers,
  inviteDomainMember,
  removeDomainMember,
  validateFreeformVhost,
  applyFreeformVhost,
} from '@/lib/api';
import {
  AdoptedVhost,
  DomainEntry,
  DomainFinding,
  NodeInfo,
  DnsRecord,
  Certificate,
  Order,
  DomainMember,
  FreeformLintFinding,
  ValidateFreeformVhostResponse,
  ApplyFreeformVhostResponse,
} from '@/lib/types';
import { Button, Field, Pill, Panel, SelectField, Switch, Tabs, TabPanel } from '@/components/ui';
import { ORDER_LABEL, ORDER_PILL } from '@/components/domains/orderLabels';
import { BuyDomain } from '@/components/domains/BuyDomain';

interface Organization {
  id: string;
  name: string;
}

const PAGE_SIZE = 50;

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

function DnsRecordsSection({ domain }: { domain: DomainEntry }) {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<DnsRecord>>({
    type: 'A',
    name: '',
    content: '',
    ttl: 300,
    proxied: false,
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDnsRecords(domain.id);
      setRecords(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DNS records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [domain.id]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleCreate = async () => {
    try {
      const record = await createDnsRecord(domain.id, newRecord as any);
      toast.success(`Created ${record.type} record for ${record.name}`);
      setNewRecord({ type: 'A', name: '', content: '', ttl: 300, proxied: false });
      setShowCreate(false);
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create DNS record');
    }
  };

  const elevated = useElevatedSession();
  const handleDelete = async (recordId: string) => {
    try {
      await deleteDnsRecord(domain.id, recordId, elevated.token ?? '');
      toast.success('Record deleted');
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete DNS record');
    }
  };

  const handleDeleteConfirm = (recordId: string) => {
    if (confirm('Are you sure you want to delete this DNS record? This requires an elevated session.')) {
      handleDelete(recordId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">DNS Records</h3>
        <Button small onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Record'}
        </Button>
      </div>

      {showCreate && (
        <div className="card p-4 space-y-3">
          <h4 className="font-medium">Create New Record</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                className="w-full p-2 border rounded bg-background text-foreground"
                value={newRecord.type}
                onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as any })}
              >
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="TXT">TXT</option>
                <option value="MX">MX</option>
                <option value="SRV">SRV</option>
                <option value="NS">NS</option>
                <option value="CAA">CAA</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Field
                value={newRecord.name}
                onChange={(e: any) => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder="e.g. www or @ for root"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <Field
                value={newRecord.content}
                onChange={(e: any) => setNewRecord({ ...newRecord, content: e.target.value })}
                placeholder="IP address, domain, or text value"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">TTL (seconds)</label>
              <Field
                type="number"
                value={newRecord.ttl ?? 300}
                onChange={(e: any) => setNewRecord({ ...newRecord, ttl: parseInt(e.target.value) || 300 })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRecord.proxied ?? false}
                  onChange={(e) => setNewRecord({ ...newRecord, proxied: e.target.checked })}
                />
                Proxy through Cloudflare
              </label>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="note bad">{error}</p>}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading DNS records...</p>
        ) : records.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No DNS records found.</p>
        ) : (
          records.map((record) => (
            <div key={record.id} className="card-hover p-3 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                    {record.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                    {record.type} — TTL: {record.ttl}s
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded text-sm" style={{ background: 'var(--muted)', color: 'var(--bg)' }}>
                    {record.content}
                  </span>
                  <Pill status={record.proxied ? 'active' : 'idle'} label={record.proxied ? 'Proxied' : 'DNS Only'} />
                  <Button small variant="ghost" onClick={() => handleDeleteConfirm(record.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CertificateSection({ domain }: { domain: DomainEntry }) {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);
  const [daysToExpiry, setDaysToExpiry] = useState(30);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [keyType, setKeyType] = useState<'ecc' | 'rsa'>('ecc');
  const elevated = useElevatedSession();

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCertificates(
        domain.organization_id || undefined,
        showExpiringOnly ? daysToExpiry : undefined
      );
      setCerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates');
      setCerts([]);
    } finally {
      setLoading(false);
    }
  }, [domain.organization_id, showExpiringOnly, daysToExpiry]);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const handleForceRenew = async (domainId: string) => {
    setRenewing(domainId);
    try {
      await forceRenewCertificate(domainId, keyType, elevated.token ?? '');
      toast.success(`Certificate renewal initiated for ${domainId}`);
      loadCerts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to force certificate renewal');
    } finally {
      setRenewing(null);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold">Certificates</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExpiringOnly}
              onChange={(e) => setShowExpiringOnly(e.target.checked)}
            />
            Show expiring within
          </label>
          <Field
            type="number"
            value={daysToExpiry}
            onChange={(e: any) => setDaysToExpiry(parseInt(e.target.value) || 30)}
            className="w-20"
          />
          <span className="text-sm">days</span>
          <Button small onClick={loadCerts}>Refresh</Button>
        </div>
      </div>

      {error && <p className="note bad">{error}</p>}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading certificates...</p>
        ) : certs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No certificates found.</p>
        ) : (
          certs.map((cert, i) => (
            <div key={i} className="card-hover p-3 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">Domain: {cert.domain_id}</p>
                  <div className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
                    <p>Serial: {cert.serial}</p>
                    <p>Key Type: {cert.key_type.toUpperCase()}</p>
                    <p>Valid from: {formatTimestamp(cert.not_before)}</p>
                    <p>Expires: {formatTimestamp(cert.not_after)}</p>
                    {cert.last_error && <p style={{ color: 'var(--warn)' }}>Last Error: {cert.last_error}</p>}
                    <p>Fail Count: {cert.fail_count}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--muted)', color: 'var(--bg)' }}>
                    Renew after: {formatTimestamp(cert.renew_after)}
                  </span>
                  <Button
                    small
                    onClick={() => handleForceRenew(domain.id)}
                    disabled={!!renewing}
                  >
                    {renewing === domain.id ? 'Renewing...' : 'Force Renew'}
                  </Button>
                </div>
              </div>
              {i < certs.length - 1 && <div className="h-px bg-line" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OrdersSection({ domain }: { domain: DomainEntry }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordersOffset, setOrdersOffset] = useState(0);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listOrders(
        domain.organization_id || undefined,
        PAGE_SIZE,
        ordersOffset
      );
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [domain.organization_id, ordersOffset]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const formatCurrency = (amountCents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amountCents / 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Domain Orders</h3>
        <Button small onClick={loadOrders}>Refresh</Button>
      </div>

      {error && <p className="note bad">{error}</p>}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No orders found.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="card-hover p-3">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{order.fqdn}</p>
                  <div className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
                    <p>Order {order.id}</p>
                    {order.last_error && order.state !== 'completed' && (
                      <p style={{ color: 'var(--warn)' }}>{order.last_error}</p>
                    )}
                    <p>Ordered {new Date(order.created_at * 1000).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div className="text-sm">{formatCurrency(order.price_cents, order.currency || 'USD')}</div>
                  <Pill status={ORDER_PILL[order.state] ?? order.state} label={ORDER_LABEL[order.state] ?? order.state} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {(ordersOffset > 0 || orders.length === PAGE_SIZE) && (
        <div className="flex justify-between pt-2">
          <Button small variant="ghost" disabled={ordersOffset === 0} onClick={() => setOrdersOffset(Math.max(0, ordersOffset - PAGE_SIZE))}>
            Previous
          </Button>
          <Button small variant="ghost" disabled={orders.length < PAGE_SIZE} onClick={() => setOrdersOffset(ordersOffset + PAGE_SIZE)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function MembersSection({ domain }: { domain: DomainEntry }) {
  const [members, setMembers] = useState<DomainMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Domain DNS');
  const [removing, setRemoving] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDomainMembers(domain.id);
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domain members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [domain.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async () => {
    try {
      await inviteDomainMember(domain.id, inviteEmail, inviteRole);
      toast.success(`Invited ${inviteEmail} as ${inviteRole}`);
      setInviteEmail('');
      setInviteRole('Domain DNS');
      setShowInvite(false);
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite member');
    }
  };

  const elevated = useElevatedSession();
  const handleRemove = async (email: string) => {
    setRemoving(email);
    try {
      await removeDomainMember(domain.id, email, elevated.token ?? '');
      toast.success(`Removed ${email}`);
      loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  const handleRemoveConfirm = (email: string) => {
    if (confirm('Are you sure you want to remove this member? This requires an elevated session.')) {
      handleRemove(email);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Cloudflare Members</h3>
        <Button small onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? 'Cancel' : 'Invite Member'}
        </Button>
      </div>

      {showInvite && (
        <div className="card p-4 space-y-3">
          <h4 className="font-medium">Invite Member</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Field
                value={inviteEmail}
                onChange={(e: any) => setInviteEmail(e.target.value)}
                placeholder="member@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                className="w-full p-2 border rounded bg-background text-foreground"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="Domain DNS">Domain DNS</option>
                <option value="Domain SSL">Domain SSL</option>
                <option value="Domain Read">Domain Read</option>
                <option value="Organization Admin">Organization Admin</option>
                <option value="Organization Editor">Organization Editor</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button onClick={handleInvite} disabled={!inviteEmail}>Invite</Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="note bad">{error}</p>}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading members...</p>
        ) : members.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No members found.</p>
        ) : (
          members.map((member) => (
            <div key={member.email} className="card-hover p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{member.email}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Role: {member.role} • CF ID: {member.cf_member_id}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Pill
                  status={member.status === 'removed' ? 'error' : member.status === 'accepted' ? 'active' : 'warning'}
                  label={member.status}
                />
                <Button
                  small
                  variant="ghost"
                  onClick={() => handleRemoveConfirm(member.email)}
                  disabled={!!removing}
                >
                  {removing === member.email ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function VhostEditorSection({ domain }: { domain: DomainEntry }) {
  const [vhostContent, setVhostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidateFreeformVhostResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyFreeformVhostResponse | null>(null);
  const [dryRun, setDryRun] = useState(false);

  const loadVhost = useCallback(async () => {
    setLoading(true);
    try {
      const vhosts = await fetchAdoptedVhosts(domain.organization_id || undefined);
      const domainVhost = vhosts.find((v) => v.domain_fqdn === domain.fqdn);
      
      if (domainVhost) {
        const res = await fetchWithAuth(`proxy/domains/vhost-content?path=${encodeURIComponent(domainVhost.path)}`);
        if (res.data?.content) {
          setVhostContent(res.data.content);
        } else {
          setVhostContent('');
        }
      } else {
        setVhostContent('');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vhost');
      setVhostContent('');
    } finally {
      setLoading(false);
    }
  }, [domain.id, domain.fqdn, domain.organization_id]);

  useEffect(() => {
    loadVhost();
  }, [loadVhost]);

  const handleValidate = async () => {
    setValidating(true);
    setValidationError(null);
    setValidation(null);
    try {
      const result = await validateFreeformVhost(domain.id, vhostContent);
      setValidation(result);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to validate vhost');
    } finally {
      setValidating(false);
    }
  };

  const elevated = useElevatedSession();
  const handleApply = async () => {
    if (!vhostContent) {
      toast.error('Vhost content is empty');
      return;
    }
    setApplying(true);
    setApplyResult(null);
    try {
      const result = await applyFreeformVhost(domain.id, vhostContent, elevated.token ?? '', dryRun);
      setApplyResult(result);
      toast.success(dryRun ? 'Dry run completed' : 'Vhost applied successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply vhost');
    } finally {
      setApplying(false);
    }
  };

  const formatSeverity = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-[color:var(--bad)] bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]';
      case 'warn':
        return 'text-[color:var(--warn)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]';
      case 'info':
        return 'text-[color:var(--info)] bg-[color-mix(in_srgb,var(--info)_12%,transparent)]';
      default:
        return 'text-[color:var(--text)]';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold">Freeform Vhost Editor</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry Run
          </label>
          <Button small onClick={loadVhost}>Reload</Button>
          <Button small variant="primary" onClick={handleValidate} disabled={validating}>
            {validating ? 'Validating...' : 'Validate'}
          </Button>
          <Button small variant="primary" onClick={handleApply} disabled={applying || !vhostContent}>
            {applying ? 'Applying...' : dryRun ? 'Dry Run' : 'Apply'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <textarea
            className="w-full h-96 p-3 font-mono text-sm rounded bg-background text-foreground border"
            value={vhostContent}
            onChange={(e) => setVhostContent(e.target.value)}
            placeholder="# Enter your nginx server block here..."
          />
          {error && <p className="note bad">{error}</p>}
        </div>

        <div className="space-y-4">
          {validation && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium">Validation Results</h4>
              <div className={`p-2 rounded ${validation.nginx_ok ? 'bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[color:var(--ok)]' : 'bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-[color:var(--bad)]'}`}>
                <p className="font-medium">{validation.nginx_ok ? 'nginx syntax OK' : 'nginx syntax errors found'}</p>
                {validation.nginx_output && <p className="text-xs mt-1 font-mono whitespace-pre-wrap">{validation.nginx_output}</p>}
              </div>
              {validation.new_findings.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Findings</h5>
                  {validation.new_findings.map((finding, i) => (
                    <div key={i} className={`p-2 rounded text-sm ${formatSeverity(finding.severity)}`}>
                      <p className="font-medium">{finding.code}</p>
                      <p className="text-xs">{finding.message}</p>
                    </div>
                  ))}
                </div>
              )}
              {validation.corrected && validation.corrected !== vhostContent && (
                <div>
                  <h5 className="text-sm font-medium">Corrected</h5>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded mt-1">
                    {validation.corrected}
                  </pre>
                </div>
              )}
            </div>
          )}

          {applyResult && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium">Apply Result</h4>
              <div className={`p-2 rounded ${applyResult.applied ? 'bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[color:var(--ok)]' : 'bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-[color:var(--warn)]'}`}>
                <p className="font-medium">{applyResult.applied ? (dryRun ? 'Dry run successful' : 'Applied successfully') : 'Apply not performed'}</p>
              </div>
              {applyResult.diff && (
                <div>
                  <h5 className="text-sm font-medium">Diff</h5>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded mt-1">
                    {applyResult.diff}
                  </pre>
                </div>
              )}
            </div>
          )}

          {validationError && <p className="note bad">{validationError}</p>}
        </div>
      </div>
    </div>
  );
}

export default function DomainsPage() {
  const router = useRouter();
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
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

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

  const [activeTab, setActiveTab] = useState('dns');
  const [selectedDomain, setSelectedDomain] = useState<DomainEntry | null>(null);

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

  const openDomainTab = (domain: DomainEntry) => {
    setSelectedDomain(domain);
    setActiveTab('dns');
  };

  const filteredDomains = domains.filter((d) => {
    if (sourceFilter && d.source !== sourceFilter) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    return true;
  });

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
          {elevated.error && <p className="note bad">{elevated.error}</p>}
        </div>

        <BuyDomain orgId={myOrgId} canBuy={isAdminRole(role)} elevated={elevated} onChanged={loadDomains} />

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
            <SelectField value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full sm:w-48">
              <option value="">All sources</option>
              <option value="purchased">purchased</option>
              <option value="byo">byo</option>
              <option value="imported">imported</option>
            </SelectField>
            <SelectField value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-48">
              <option value="">All statuses</option>
              <option value="pending_payment">pending_payment</option>
              <option value="registering">registering</option>
              <option value="provisioning_dns">provisioning_dns</option>
              <option value="pending_dns">pending_dns</option>
              <option value="issuing">issuing</option>
              <option value="active">active</option>
              <option value="renewing">renewing</option>
              <option value="error">error</option>
              <option value="removed">removed</option>
            </SelectField>
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
          {domainsError && <p className="note bad">{domainsError}</p>}
        </div>

        <div className="card p-6 space-y-2 relative">
          {loading && <LoadingOverlay />}
          {!loading && filteredDomains.length === 0 && !domainsError && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No domains found.</p>
          )}
          {filteredDomains.map((d) => (
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
                  {d.vhost_paths.length > 0 && (
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      Paths: {d.vhost_paths.join(', ')}
                    </p>
                  )}
                  {d.cert_dirs.length > 0 && (
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      Certs: {d.cert_dirs.join(', ')}
                    </p>
                  )}
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
                  <Button small variant="ghost" onClick={() => openDomainTab(d)}>
                    More
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

          {(offset > 0 || filteredDomains.length === PAGE_SIZE) && (
            <div className="flex justify-between pt-2">
              <Button small variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </Button>
              <Button small variant="ghost" disabled={filteredDomains.length < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next
              </Button>
            </div>
          )}
        </div>

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
            {findingsError && <p className="note bad">{findingsError}</p>}
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
            {vhostsError && <p className="note bad">{vhostsError}</p>}
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

        {selectedDomain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-semibold">{selectedDomain.fqdn} Details</h2>
                <Button small variant="ghost" onClick={() => setSelectedDomain(null)}>Close</Button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                <Tabs
                  tabs={[
                    { key: 'dns', label: 'DNS Records' },
                    { key: 'certs', label: 'Certificates' },
                    { key: 'orders', label: 'Orders' },
                    { key: 'members', label: 'Members' },
                    { key: 'vhost', label: 'Vhost Editor' },
                  ]}
                  active={activeTab}
                   onChange={setActiveTab}
                 >
                  <TabPanel tabKey="dns" active={activeTab}>
                    <DnsRecordsSection domain={selectedDomain} />
                  </TabPanel>
                  <TabPanel tabKey="certs" active={activeTab}>
                    <CertificateSection domain={selectedDomain} />
                  </TabPanel>
                  <TabPanel tabKey="orders" active={activeTab}>
                    <OrdersSection domain={selectedDomain} />
                  </TabPanel>
                  <TabPanel tabKey="members" active={activeTab}>
                    <MembersSection domain={selectedDomain} />
                  </TabPanel>
                  <TabPanel tabKey="vhost" active={activeTab}>
                    <VhostEditorSection domain={selectedDomain} />
                  </TabPanel>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
