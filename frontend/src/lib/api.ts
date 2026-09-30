// src/lib/api.ts
import {
  AdoptedVhost,
  AssignDomainBody,
  AttachDomainBody,
  AuditOutcome,
  BillingCosts,
  DeployNodeResult,
  DomainFinding,
  DomainRescanResult,
  DomainsPage,
  DomainSummary,
  GitConfigOp,
  LogEntry,
  MultiNodeConfigResponse,
  MultiNodeConfigSetResponse,
  NodeDetails,
  NodeInfo,
  NodeReloadResult,
  OrgPolicyRow,
  CreditBalance,
  DomainOffer,
  DomainQuote,
  Invoice,
  InvoicePage,
  Order,
  OrderCheckout,
  Plan,
  Subscription,
  SubscriptionCheckout,
  CreditLedgerPage,
  TopUpCheckout,
  ProjectDetails,
  ProjectSummary,
  RepoCatalogEntry,
  RepoEntry,
  ReposEnvelope,
  ReposResponse,
  SetOrgPolicyBody,
  SyncNodeOutcome,
  UsageSummary,
  WatchdogConfigKind,
  WatchdogGetConfigResponse,
  WatchdogSetConfigResponse,
} from "./types";
import { API_URL } from "./config";

export async function fetchWithAuth(endpoint: string) {
  const res = await fetch(
    `${API_URL}/${endpoint}`,
    {
      method: "GET",
      credentials: "include", // ← send the server‐issued cookie
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function postWithAuth(endpoint: string, body?: any) {
  const opts: RequestInit = {
    method: "POST",
    credentials: "include", // ← send the server‐issued cookie
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(
    `${API_URL}/${endpoint}`,
    opts
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function putWithAuth(endpoint: string, body?: any) {
  const opts: RequestInit = {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(
    `${API_URL}/${endpoint}`,
    opts
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function deleteWithAuth(endpoint: string, body?: any) {
  const opts: RequestInit = {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(
    `${API_URL}/${endpoint}`,
    opts
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}


export async function fetchBilling(
  usage: UsageSummary
): Promise<BillingCosts> {
  const res = await fetch(
    `${API_URL}/proxy/billing/calculate?instances=${usage.instances}`,
    {
      method: "POST",
      credentials: "include", // ← send the cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(usage),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  const resp = await res.json();
  if (resp.errors?.length) {
    throw new Error(resp.errors.map((e: any) => e.message).join("; "));
  }

  return resp.data as BillingCosts;
}

// ======= Projects =======

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetchWithAuth('proxy/runners');
  if (!res.data || (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load projects');
  }
  return (res.data ?? []) as ProjectSummary[];
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectDetails[]> {
  const res = await fetchWithAuth(`proxy/runner/${projectId}`);
  if (!res.data || (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to load details for ${projectId}`);
  }
  return (res.data ?? []) as ProjectDetails[];
}

export interface ProjectGitInfo {
  user: string;
  repo: string;
  branch: string;
}

// Returns null if the id has no git repo behind it (a system project) or the
// caller isn't permitted to see it — either is a normal "fall back to the
// raw id" case for the resolver in `@/lib/repoLabel`, not an error to surface.
export async function fetchProjectGitInfo(projectId: string): Promise<ProjectGitInfo | null> {
  try {
    const res = await fetchWithAuth(`proxy/runner/${projectId}/git-info`);
    return (res.data ?? null) as ProjectGitInfo | null;
  } catch {
    return null;
  }
}

export async function fetchGroupUsage(projectId: string): Promise<UsageSummary> {
  const res = await fetchWithAuth(`proxy/usage/group/${projectId}`);
  if (!res.data || (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to load usage for ${projectId}`);
  }
  return res.data as UsageSummary;
}

export async function fetchInstanceUsage(instanceId: string): Promise<UsageSummary> {
  const res = await fetchWithAuth(`proxy/usage/single/${instanceId}`);
  if (!res.data || (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to load usage for ${instanceId}`);
  }
  return res.data as UsageSummary;
}

export async function fetchInstanceLogs(instanceId: string, limit: number): Promise<LogEntry[]> {
  const res = await fetchWithAuth(`proxy/logs/${instanceId}/${limit}`);
  return res.data?.lines ?? [];
}

export async function sendProjectControl(instanceId: string, command: string): Promise<any> {
  const res = await fetchWithAuth(`proxy/control/${instanceId}/${command}`);
  if (!res.data && res.status !== 'success' && res.status !== 'ok') {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Control command failed');
  }
  return res;
}

// --- multi-node app config (Apps page) ---

export async function fetchMultiNodeConfig(
  application: string,
  kind: WatchdogConfigKind,
): Promise<MultiNodeConfigResponse> {
  const res = await fetchWithAuth(`proxy/runner/${application}/config?kind=${kind}`);
  if (!res.data && res.status !== 'success' && res.status !== 'ok') {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to fetch config for ${application}`);
  }
  return res.data as MultiNodeConfigResponse;
}

export async function setMultiNodeConfig(
  application: string,
  kind: WatchdogConfigKind,
  content: string,
  expectedShas: Record<string, string>,
): Promise<MultiNodeConfigSetResponse> {
  const res = await postWithAuth(`proxy/runner/${application}/config`, {
    kind,
    content,
    expected_shas: expectedShas,
  });
  if (!res.data && res.status !== 'success' && res.status !== 'ok') {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to set config for ${application}`);
  }
  return res.data as MultiNodeConfigSetResponse;
}

// ======= Nodes (Admin/Super only) =======

export async function fetchNodes(): Promise<NodeInfo[]> {
  const res = await fetchWithAuth('proxy/nodes');
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load nodes');
  }
  return (res.data ?? []) as NodeInfo[];
}

export async function fetchNodeDetails(nodeId: number): Promise<NodeDetails> {
  const res = await fetchWithAuth(`proxy/node/${nodeId}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to load details for node ${nodeId}`);
  }
  return res.data as NodeDetails;
}

export async function reloadNode(nodeId: number): Promise<NodeReloadResult> {
  const res = await fetchWithAuth(`proxy/node_reload/${nodeId}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to reload node ${nodeId}`);
  }
  return res.data as NodeReloadResult;
}

// --- Git config ---

export async function fetchGitConfig(nodeId: number): Promise<ReposEnvelope> {
  const res = await fetchWithAuth(`proxy/node/${nodeId}/git-config`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to load git config for node ${nodeId}`);
  }
  return res.data as ReposEnvelope;
}

export async function setGitConfig(
  nodeId: number,
  op: GitConfigOp,
  body: object,
): Promise<ReposResponse> {
  const res = await postWithAuth(`proxy/node/${nodeId}/git-config`, { op, ...body });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to set git config');
  }
  return res.data as ReposResponse;
}

// Super-only: edits one node's stored repo identity/credentials in place.
// `repo` replaces the whole entry server-side (Manager does a full swap, not
// a merge) -- callers must send back every field they want kept, token
// included.
export async function updateNodeRepo(
  nodeId: number,
  id: string,
  repo: RepoEntry,
  reload = true,
): Promise<ReposResponse> {
  return setGitConfig(nodeId, 'update', { id, repo, reload });
}

// Super-only: removes one repo from one node's git config.
export async function removeNodeRepo(
  nodeId: number,
  id: string,
  reload = true,
): Promise<ReposResponse> {
  return setGitConfig(nodeId, 'remove', { id, reload });
}

// `GitReposAudit` doesn't touch git.cf, so it answers with an `AuditOutcome`,
// not a `ReposResponse` -- kept separate from `setGitConfig` rather than
// widening that function's return type for one op.
export async function auditGitConfig(nodeId: number): Promise<AuditOutcome> {
  const res = await postWithAuth(`proxy/node/${nodeId}/git-config`, { op: 'audit' });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to audit git config');
  }
  return res.data as AuditOutcome;
}

// --- Phase I: centralized repo/project catalog ---
export async function fetchRepoCatalog(): Promise<RepoCatalogEntry[]> {
  const res = await fetchWithAuth('proxy/repos');
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load repository catalog');
  }
  return (res.data ?? []) as RepoCatalogEntry[];
}

// Explicit "sync now" -- the only repo call that asks a node to actually
// clone/fetch/reset. `nodeIds` omitted or empty means every node this repo
// is currently configured on.
export async function syncRepo(repoId: string, nodeIds?: number[]): Promise<SyncNodeOutcome[]> {
  const res = await postWithAuth(`proxy/repos/${repoId}/sync`, { node_ids: nodeIds ?? [] });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to sync repo');
  }
  return (res.data ?? []) as SyncNodeOutcome[];
}

// Adds a repo already in the catalog to more nodes. Reuses its existing
// GitAuth (server + token) server-side, so -- unlike the deploy wizard --
// this never needs a token re-entered for a private repo.
export async function addRepoNodes(repoId: string, nodeIds: number[]): Promise<DeployNodeResult[]> {
  const res = await postWithAuth(`proxy/repos/${repoId}/add-nodes`, { node_ids: nodeIds });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to add repo to node(s)');
  }
  return (res.data?.results ?? []) as DeployNodeResult[];
}

// --- Watchdog config ---

export async function fetchWatchdogConfig(
  nodeId: number,
  application: string,
  kind: WatchdogConfigKind,
  createIfMissing = false,
): Promise<WatchdogGetConfigResponse> {
  const qs = `application=${encodeURIComponent(application)}&kind=${kind}&create_if_missing=${createIfMissing}`;
  const res = await fetchWithAuth(`proxy/node/${nodeId}/watchdog/config?${qs}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to fetch watchdog config for ${application}`);
  }
  return res.data as WatchdogGetConfigResponse;
}

export async function setWatchdogConfig(
  nodeId: number,
  application: string,
  kind: WatchdogConfigKind,
  content: string,
  expectedPreviousSha256: string,
): Promise<WatchdogSetConfigResponse> {
  const res = await postWithAuth(`proxy/node/${nodeId}/watchdog/config`, {
    application,
    kind,
    content,
    expected_previous_sha256: expectedPreviousSha256,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || `Failed to set watchdog config for ${application}`);
  }
  return res.data as WatchdogSetConfigResponse;
}

// --- Org role-policy editor ---
//
// `orgId` may be the literal string "GLOBAL" to read/write the platform-wide
// default policy every org inherits -- portal maps that alias to ais_auth's
// sentinel org id server-side (see `handler::admin::resolve_org_path_segment`).

export async function fetchOrgPolicy(orgId: string): Promise<OrgPolicyRow[]> {
  const res = await fetchWithAuth(`proxy/admin/organizations/${orgId}/policy`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load org policy');
  }
  return (res.data ?? []) as OrgPolicyRow[];
}

export async function setOrgPolicyRow(orgId: string, body: SetOrgPolicyBody): Promise<boolean> {
  const res = await postWithAuth(`proxy/admin/organizations/${orgId}/policy`, body);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to set org policy');
  }
  return !!res.data;
}

// --- Domains (RBAC Phase 6) ---
//
// A `Super` may pass `organization_id`, or none for the whole fleet; everyone
// else is pinned server-side to their own organization whatever they send,
// so the frontend doesn't need to enforce that itself -- it just reflects
// whatever Portal hands back.

export async function fetchDomains(params: {
  organizationId?: string;
  unassignedOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<DomainsPage> {
  const qs = new URLSearchParams();
  if (params.organizationId) qs.set('organization_id', params.organizationId);
  if (params.unassignedOnly) qs.set('unassigned_only', 'true');
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`proxy/domains${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load domains');
  }
  return res.data as DomainsPage;
}

// Super-only: names file paths and certificate directories fleet-wide, with
// no organization to scope it by.
export async function fetchDomainFindings(params: {
  code?: string;
  severity?: 'info' | 'warn' | 'error';
  openOnly?: boolean;
  limit?: number;
} = {}): Promise<DomainFinding[]> {
  const qs = new URLSearchParams();
  if (params.code) qs.set('code', params.code);
  if (params.severity) qs.set('severity', params.severity);
  if (params.openOnly) qs.set('open_only', 'true');
  if (params.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`proxy/domains/findings${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load domain findings');
  }
  return (res.data ?? []) as DomainFinding[];
}

export async function fetchAdoptedVhosts(organizationId?: string): Promise<AdoptedVhost[]> {
  const suffix = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
  const res = await fetchWithAuth(`proxy/domains/vhosts${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load adopted vhosts');
  }
  return (res.data ?? []) as AdoptedVhost[];
}

// Claiming a currently-unassigned domain (organization_id empty) is Super
// only -- otherwise the first Admin to ask would own an unowned name.
// `elevated_token` is required only to move a domain that already belongs to
// an organization.
export async function assignDomain(body: AssignDomainBody): Promise<DomainSummary> {
  const res = await postWithAuth('proxy/domains/assign', body);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to assign domain');
  }
  return res.data as DomainSummary;
}

// Needs Write on the runner and ownership of the domain. More than one
// backend becomes a balanced upstream.
export async function attachDomain(body: AttachDomainBody): Promise<DomainSummary> {
  const res = await postWithAuth('proxy/domains/attach', body);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to attach domain');
  }
  return res.data as DomainSummary;
}

// Super-only: read-only on the host, but walks every nginx config file
// there, and is slow with check_dns.
export async function rescanDomains(body: { checkDns?: boolean; checkCloudflare?: boolean } = {}): Promise<DomainRescanResult> {
  const res = await postWithAuth('proxy/domains/rescan', {
    check_dns: body.checkDns ?? false,
    check_cloudflare: body.checkCloudflare ?? false,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to rescan domains');
  }
  return res.data as DomainRescanResult;
}

// --- DNS Records ---

export interface DnsRecord {
  id: string;
  cf_record_id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

export interface CreateDnsRecordBody {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}

export interface UpdateDnsRecordBody extends CreateDnsRecordBody {
  id: string;
}

export async function listDnsRecords(domainId: string): Promise<DnsRecord[]> {
  const res = await fetchWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/dns-records`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to list DNS records');
  }
  return (res.data ?? []) as DnsRecord[];
}

export async function createDnsRecord(domainId: string, body: CreateDnsRecordBody): Promise<DnsRecord> {
  const res = await postWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/dns-records`, body);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to create DNS record');
  }
  return res.data as DnsRecord;
}

export async function updateDnsRecord(domainId: string, recordId: string, body: UpdateDnsRecordBody): Promise<DnsRecord> {
  const res = await postWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/dns-records/${encodeURIComponent(recordId)}`, body);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to update DNS record');
  }
  return res.data as DnsRecord;
}

export async function deleteDnsRecord(domainId: string, recordId: string, elevatedToken: string): Promise<void> {
  const res = await deleteWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/dns-records/${encodeURIComponent(recordId)}`, { elevated_token: elevatedToken });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to delete DNS record');
  }
}

// --- Certificates ---

export interface Certificate {
  domain_id: string;
  key_type: 'ecc' | 'rsa' | string;
  serial: string;
  not_before: number;
  not_after: number;
  renew_after: number;
  fail_count: number;
  last_error: string;
}

export async function listCertificates(organizationId?: string, expiringWithinDays?: number): Promise<Certificate[]> {
  const qs = new URLSearchParams();
  if (organizationId) qs.set('organization_id', organizationId);
  if (expiringWithinDays !== undefined) qs.set('expiring_within_days', String(expiringWithinDays));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`proxy/domains/certificates${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to list certificates');
  }
  return (res.data ?? []) as Certificate[];
}

export async function forceRenewCertificate(domainId: string, keyType?: 'ecc' | 'rsa', elevatedToken?: string): Promise<{ job_id: string }> {
  const res = await postWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/force-renew`, {
    key_type: keyType,
    elevated_token: elevatedToken,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to force certificate renewal');
  }
  return res.data as { job_id: string };
}

// --- Orders ---

export async function listOrders(organizationId?: string, limit?: number, offset?: number): Promise<Order[]> {
  const qs = new URLSearchParams();
  if (organizationId) qs.set('organization_id', organizationId);
  if (limit !== undefined) qs.set('limit', String(limit));
  if (offset !== undefined) qs.set('offset', String(offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`proxy/domains/orders${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to list orders');
  }
  return (res.data ?? []) as Order[];
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await fetchWithAuth(`proxy/domains/orders/${encodeURIComponent(orderId)}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to get order');
  }
  return res.data as Order;
}

// --- Domain Members ---

export interface DomainMember {
  domain_id: string;
  email: string;
  cf_member_id: string;
  role: string;
  status: string;
  invited_at: number;
}

export async function listDomainMembers(domainId: string): Promise<DomainMember[]> {
  const res = await fetchWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/members`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to list domain members');
  }
  return (res.data ?? []) as DomainMember[];
}

export async function inviteDomainMember(domainId: string, email: string, role?: string): Promise<DomainMember> {
  const res = await postWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/members`, {
    email,
    role: role || 'Domain DNS',
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to invite domain member');
  }
  return res.data as DomainMember;
}

export async function removeDomainMember(domainId: string, email: string, elevatedToken?: string): Promise<void> {
  const res = await deleteWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/members`, {
    elevated_token: elevatedToken,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to remove domain member');
  }
}

// --- Freeform Vhost ---

export interface FreeformLintFinding {
  code: string;
  severity: string;
  message: string;
}

export interface ValidateFreeformVhostResponse {
  nginx_ok: boolean;
  nginx_output: string;
  new_findings: FreeformLintFinding[];
  corrected: string;
}

export interface ApplyFreeformVhostResponse {
  applied: boolean;
  diff: string;
  validation: ValidateFreeformVhostResponse;
}

export async function validateFreeformVhost(domainId: string, serverBlock: string): Promise<ValidateFreeformVhostResponse> {
  const res = await postWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/validate-vhost`, {
    server_block: serverBlock,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to validate vhost');
  }
  return res.data as ValidateFreeformVhostResponse;
}

export async function applyFreeformVhost(domainId: string, serverBlock: string, elevatedToken?: string, dryRun?: boolean): Promise<ApplyFreeformVhostResponse> {
  const res = await postWithAuth(`proxy/domains/${encodeURIComponent(domainId)}/apply-vhost`, {
    server_block: serverBlock,
    elevated_token: elevatedToken,
    dry_run: dryRun ?? false,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to apply vhost');
  }
  return res.data as ApplyFreeformVhostResponse;
}
// --- Billing: credits ---
//
// Billing decides who may see or spend: Admins always, other roles only when
// the organization has opted them in (see `setViewerBillingAccess`).

export async function fetchCreditBalance(organizationId?: string): Promise<CreditBalance> {
  const suffix = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
  const res = await fetchWithAuth(`proxy/billing/credits${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load credit balance');
  }
  return res.data as CreditBalance;
}

export async function fetchCreditLedger(params: {
  organizationId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<CreditLedgerPage> {
  const qs = new URLSearchParams();
  if (params.organizationId) qs.set('organization_id', params.organizationId);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`proxy/billing/credits/ledger${suffix}`);
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to load credit history');
  }
  return res.data as CreditLedgerPage;
}

// Needs an elevated token (this creates a real charge) and a minimum of
// 2500 cents, enforced by Billing.
export async function topUpCredit(body: {
  amountCents: number;
  elevatedToken: string;
  organizationId?: string;
}): Promise<TopUpCheckout> {
  const res = await postWithAuth('proxy/billing/credits/topup', {
    organization_id: body.organizationId ?? '',
    amount_cents: body.amountCents,
    elevated_token: body.elevatedToken,
  });
  if (!res.data && (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || 'Failed to start the top-up');
  }
  return res.data as TopUpCheckout;
}

// Whether the org has opted its viewers into seeing billing. Default is off:
// it is the org's own `subscription:read` row for the viewer role.
export async function fetchViewerBillingAccess(orgId: string): Promise<boolean> {
  const rows = await fetchOrgPolicy(orgId);
  return rows.some(
    (r) => r.resource_type === 'subscription' && r.action === 'read' && r.role === 'viewer' && r.allow,
  );
}

export async function setViewerBillingAccess(orgId: string, allow: boolean, elevatedToken: string): Promise<boolean> {
  return setOrgPolicyRow(orgId, {
    elevated_token: elevatedToken,
    resource_type: 'subscription',
    action: 'read',
    role: 'viewer',
    allow,
  });
}

// --- Billing: plans, subscriptions, invoices ---
//
// Same visibility rule as credits: Billing answers permission_denied for a
// role the organization has not opted in, which callers treat as "locked".

function billingFail(res: any, fallback: string): never {
  throw new Error((res.errors ?? []).map((e: any) => e.message).join('; ') || fallback);
}

function billingOk(res: any): boolean {
  return !!res.data || res.status === 'success' || res.status === 'ok';
}

export async function fetchPlans(storefront?: string): Promise<Plan[]> {
  const suffix = storefront ? `?storefront=${encodeURIComponent(storefront)}` : '';
  const res = await fetchWithAuth(`proxy/billing/plans${suffix}`);
  if (!billingOk(res)) billingFail(res, 'Failed to load plans');
  return res.data as Plan[];
}

export async function fetchSubscriptions(organizationId?: string): Promise<Subscription[]> {
  const suffix = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
  const res = await fetchWithAuth(`proxy/billing/subscriptions${suffix}`);
  if (!billingOk(res)) billingFail(res, 'Failed to load subscriptions');
  return res.data as Subscription[];
}

export async function fetchInvoices(params: {
  organizationId?: string;
  storefront?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<InvoicePage> {
  const qs = new URLSearchParams();
  if (params.organizationId) qs.set('organization_id', params.organizationId);
  if (params.storefront) qs.set('storefront', params.storefront);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`proxy/billing/invoices${suffix}`);
  if (!billingOk(res)) billingFail(res, 'Failed to load payments');
  return res.data as InvoicePage;
}

// Needs an elevated token: a new plan, or an upgrade, can charge the card.
export async function upgradeSubscription(body: {
  storefront: string;
  planCode: string;
  elevatedToken: string;
  organizationId?: string;
}): Promise<SubscriptionCheckout> {
  const res = await postWithAuth('proxy/billing/subscription/upgrade', {
    organization_id: body.organizationId ?? '',
    storefront: body.storefront,
    plan_code: body.planCode,
    elevated_token: body.elevatedToken,
  });
  if (!billingOk(res)) billingFail(res, 'Failed to start the plan change');
  return res.data as SubscriptionCheckout;
}

// Takes effect at the end of the period and charges nothing, so no elevated token.
export async function scheduleDowngrade(body: {
  storefront: string;
  planCode: string;
  organizationId?: string;
}): Promise<Subscription> {
  const res = await postWithAuth('proxy/billing/subscription/downgrade', {
    organization_id: body.organizationId ?? '',
    storefront: body.storefront,
    plan_code: body.planCode,
  });
  if (!billingOk(res)) billingFail(res, 'Failed to schedule the switch');
  return res.data as Subscription;
}

export async function cancelSubscription(body: { storefront: string; organizationId?: string }): Promise<Subscription> {
  const res = await postWithAuth('proxy/billing/subscription/cancel', {
    organization_id: body.organizationId ?? '',
    storefront: body.storefront,
  });
  if (!billingOk(res)) billingFail(res, 'Failed to cancel the plan');
  return res.data as Subscription;
}

// Pays an invoice that is still open, instead of creating a second one.
export async function retryInvoicePayment(body: {
  invoiceId: string;
  elevatedToken: string;
  organizationId?: string;
}): Promise<SubscriptionCheckout> {
  const res = await postWithAuth('proxy/billing/invoices/retry', {
    organization_id: body.organizationId ?? '',
    invoice_id: body.invoiceId,
    elevated_token: body.elevatedToken,
  });
  if (!billingOk(res)) billingFail(res, 'Failed to start the payment');
  return res.data as SubscriptionCheckout;
}

// --- Domain purchasing ---
//
// `ais_domains` decides who may search, quote and buy; creating the order
// needs an elevated token because it starts a real charge.

export async function searchDomains(query: string, limit = 10): Promise<DomainOffer[]> {
  const res = await fetchWithAuth(`proxy/domains/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!billingOk(res)) billingFail(res, 'Search failed');
  return (res.data ?? []) as DomainOffer[];
}

export async function quoteDomain(fqdn: string): Promise<DomainQuote> {
  const res = await postWithAuth('proxy/domains/quote', { fqdn });
  if (!billingOk(res)) billingFail(res, 'Could not get a price');
  return res.data as DomainQuote;
}

// Sending the same quote again returns the order it already made, so a double
// click or a retry can never buy twice.
export async function createDomainOrder(body: {
  quoteId: string;
  elevatedToken: string;
  organizationId?: string;
  runnerId?: string;
}): Promise<OrderCheckout> {
  const res = await postWithAuth('proxy/domains/orders', {
    quote_id: body.quoteId,
    organization_id: body.organizationId ?? '',
    runner_id: body.runnerId ?? '',
    elevated_token: body.elevatedToken,
  });
  if (!billingOk(res)) billingFail(res, 'Could not start the order');
  return res.data as OrderCheckout;
}
