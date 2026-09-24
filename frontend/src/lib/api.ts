// src/lib/api.ts
import {
  AuditOutcome,
  BillingCosts,
  GitConfigOp,
  LogEntry,
  MultiNodeConfigResponse,
  MultiNodeConfigSetResponse,
  NodeDetails,
  NodeInfo,
  NodeReloadResult,
  ProjectDetails,
  ProjectSummary,
  RepoCatalogEntry,
  ReposEnvelope,
  ReposResponse,
  SyncNodeOutcome,
  UsageSummary,
  VmActionRequest,
  VmActionType,
  VmListItem,
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

export async function sendVmAction(
  vmid: number,
  action: VmActionType,
): Promise<void> {
  const res = await fetchWithAuth(`proxy/vms/${vmid}/${action}`);
  if (!res.data && res.status !== 'success' && res.status !== 'ok') {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join(', '));
  }
}

export async function fetchVmList(): Promise<VmListItem[]> {
  const res = await fetchWithAuth('proxy/vms');
  if (!res.data || (res.status !== 'success' && res.status !== 'ok')) {
    throw new Error((res.errors ?? []).map((e: any) => e.message).join(', '));
  }
  return res.data;
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