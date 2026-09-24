// Represents summarized usage data from /usage/group/{runner_id}
//
// NOT renamed to project_id/organization_id yet, deliberately: this type
// mirrors Portal's actual JSON wire format, and Portal is Phase 4 of the
// resource-taxonomy migration (RESOURCE_TAXONOMY.md 9) -- it shares that
// wire format with Manager/watchdog and moves in the same synchronized
// wave, not independently. Renaming a TS field here ahead of Portal would
// compile fine (TS types aren't runtime-checked) but silently break at
// runtime, since the JSON Portal actually sends still says `runner_id`.
export interface UsageSummary {
  runner_id: string;
  instance_id: string;  // Will be "Grouped Data" if summarized across all
  total_cpu: number;
  peak_cpu: number;
  avg_memory: number;
  peak_memory: number;
  total_rx: number;
  total_tx: number;
  total_samples: number;
  instances: number;
}

// --- Repo Hydration Types ---

// `unknown` is what a node that timed out, was unreachable, or hadn't
// answered for a given repo id reports -- distinct from `idle`/`failed`
// (which mean the node *did* answer).
export type SyncStatus = 'idle' | 'syncing' | 'latest' | 'outdated' | 'failed' | 'unknown';

export interface NodeHydrationStatus {
  node_id: number;
  hostname: string;
  repo_id: string;
  repo_path: string;
  branch: string;
  commit_sha: string | null;
  is_hydrated: boolean;
  last_sync_timestamp: number | null;
  sync_status: SyncStatus;
  error_message: string | null;
}

// If you later pull instance-level runner details (optional future expansion)
export interface RunnerDetails {
  id: string;
  status: string;
  version: SoftwareVersion;
  artisan_config: any;
  specific_config?: any;
  enviornment?: any;
  health?: RunnerHealth;
  logs?: RunnerLogs;
}

export interface RunnerHealth {
  uptime: number;
  last_check: number;
  cpu_usage: string;
  ram_usage: string;
  tx_bytes: number;
  rx_bytes: number;
}

export interface RunnerLogs {
  recent: string[];
}

export interface SoftwareVersion {
  version: string;   // E.g., "1.2.3"
  release: string;   // E.g., "Production" or "Beta"
}


// ======= Dashboard / Project Types =======

/**
 * The breakdown of costs returned by the billing service.
 */
export interface BillingCosts {
  /** Total CPU charge in dollars (e.g. 12.34) */
  cpu_cost: number;

  /** Total RAM charge in dollars */
  ram_cost: number;

  /** Total bandwidth charge in dollars (tx + rx) */
  bandwidth_cost: number;

  /** Grand total charge in dollars (includes minimum fee logic) */
  total_cost: number;
}


export interface FullInstance {
  details: RunnerDetails;
  usage: UsageSummary;
}


// Represents a single instance of a runner (individual app instance)
export interface ProjectInstance {
  id: string;
  status: string;
  version: {
    version: string;
    code: string;
  };
  artisan_config: object; // you can later strongly type this if you want
  specific_config?: object;
  enviornment?: object;
  health?: {
    uptime: number;
    last_check: number;
    cpu_usage: string;
    ram_usage: string;
    tx_bytes: number;
    rx_bytes: number;
  };
  logs?: {
    recent: string[];
  };
}

// Represents the summarized group usage for all instances under one runner.
// Same "not renamed yet" reasoning as UsageSummary above -- Portal's wire
// format hasn't moved to project_id yet.
export interface ProjectGroupUsage {
  runner_id: string;
  instance_id: string; // For group, you might set this manually like "Grouped Data"
  total_cpu: number;
  peak_cpu: number;
  avg_memory: number;
  peak_memory: number;
  total_rx: number;
  total_tx: number;
  total_samples: number;
}

// Cost breakdown (optional helper if you want clean typings for calculateCosts())
export interface ProjectCostSummary {
  cpu_cost: number;
  ram_cost: number;
  bandwidth_cost: number;
  total_cost: number;
}

/**
 * A minimal summary of a runner group for listing.
 * Mirrors the Rust `RunnerSummary`:
 */
export interface RunnerSummary {
  /** Short name or ID of the runner */
  name: string;
  /** Current state, e.g. "Running" or "Stopped" */
  status: string;
  /** Software version info (you can expand this as needed) */
  version: {
    /** SemVer string, e.g. "1.2.3" */
    version: string;
    /** Release channel or label, e.g. "Beta" */
    release?: string;
  };
  /** IDs of nodes this runner is deployed on */
  nodes: number[];
  /** Total seconds this runner has been active (optional) */
  uptime?: number;
}

/**
 * Definition of the refresh response
 */
export interface RefreshResponse {
  /** The new token issued */
  auth: String;
}

export interface RefreshRequest {
  expired_token: String,
  refresh_token: String
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

// The single canonical status type, matching artisan_middleware::aggregator::Status
// (RESOURCE_TAXONOMY.md 7.1). This used to be two conflicting unions --
// StatusType (4 variants, missing Starting/Idle/Unknown/Error) and NodeStatus
// (8 variants, missing Error) -- plus a third hardcoded partial copy in
// pages/nodes/index.tsx. All three are now this one type and one color map.
export type Status =
  | 'Starting'
  | 'Running'
  | 'Idle'
  | 'Stopping'
  | 'Stopped'
  | 'Warning'
  | 'Building'
  | 'Error'
  | 'Unknown';

export const statusColorMap: Record<Status, string> = {
  Starting: 'text-blue-400',
  Running: 'text-green-400',
  Idle: 'text-gray-400',
  Stopping: 'text-yellow-400',
  Stopped: 'text-red-400',
  Warning: 'text-yellow-400',
  Building: 'text-blue-400',
  Error: 'text-red-500',
  Unknown: 'text-gray-400',
};

// Mirrors the Rust `SmallVMStatus` returned by `ais_vm` — a flat struct, no
// nested "metrics" object and no "name" field.
export interface VmListItem {
  vmid: number;
  status: string;      // e.g. "running" | "stopped"
  cpu: number;          // fraction 0..1 (e.g. 0.17 -> 17%)
  mem: number;           // bytes
  maxmem: number;        // bytes
  disk_read: number;     // bytes, cumulative since VM start
  disk_write: number;    // bytes, cumulative since VM start
  net_in: number;        // bytes, cumulative since VM start
  net_out: number;       // bytes, cumulative since VM start
  uptime: number;        // seconds
}

export type VmActionType = 'start' | 'stop' | 'restart' | 'shutdown';

export interface VmActionRequest {
  action: VmActionType;
  // optional flags, e.g. force shutdown
  force?: boolean;
}

// ======= Nodes / Admin Types =======

export interface Identifier {
  id: number;
  _signature: string;
}

export interface NodeInfo {
  identity: Identifier;
  hostname: string;
  status: Status;
  ip_address: string;
  projects: string[];
  created_at: string;
  last_updated: string;
}

export type GitServer = 'GitHub' | 'GitLab' | { Custom: string };

export interface GitAuth {
  user: string;
  repo: string;
  branch: string;
  server: GitServer;
  token: string | null;
}

export interface GitCredentials {
  auth_items: GitAuth[];
}

export interface ManagerData {
  identity: Identifier;
  version: SoftwareVersion;
  git_config: GitCredentials;
  hostname: string;
  address: string;
  system_apps: number;
  client_apps: number;
  warning: number;
  uptime: number;
}

export interface NodeDetails {
  identity: Identifier;
  status: Status;
  projects: string[];
  created_at: string;
  last_updated: string;
  manager_data: ManagerData;
}

export interface NodeReloadResult {
  id: string;
  reloaded: boolean;
}

// --- git-config editor ---

export interface RepoEntry {
  id?: string | null;
  user: string;
  repo: string;
  branch: string;
  server: GitServer;
  token?: string | null;
}

export interface ReposEnvelope {
  schema: number;
  hostname?: string | null;
  exported_at?: number | null;
  path?: string | null;
  repos: RepoEntry[];
}

export interface ReloadOutcome {
  attempted: boolean;
  ok: boolean;
  method: string;
  message?: string | null;
}

export interface MovedId {
  old_id: string;
  new_id: string;
  note: string;
}

export interface ReposResponse extends ReposEnvelope {
  reload: ReloadOutcome;
  moved?: MovedId;
}

export type GitConfigOp = 'set' | 'add' | 'update' | 'remove' | 'audit';

// --- Phase I: centralized repo/project catalog ---

// org_id not renamed yet -- same reasoning as UsageSummary above, and this
// one is actually read/written against Portal's live /v1/repos JSON
// (pages/repos/index.tsx), so renaming it here alone would be a type-level
// rename with no matching backend change, not just an unused field.
export interface RepoCatalogEntry {
  id: string;
  user: string;
  repo: string;
  branch: string;
  nodes: NodeHydrationStatus[];  // Changed from number[] to include hydration info
  org_id?: string | null;
  sync_status: SyncStatus;
}

// Response of `POST /v1/repos/{id}/sync` -- one entry per node actually
// synced, each carrying that node's real post-sync hydration row(s).
export interface SyncNodeOutcome {
  node_id: number;
  ok: boolean;
  hydration: NodeHydrationStatus[];
  error: string | null;
}

// Result of a `GitReposAudit` run: a force-resync/force-clean of every
// configured checkout, plus a purge of any stale `/opt/artisan/tmp` state
// file left over from a repo no longer in git.cf.
export interface AuditOutcome {
  repos_considered: number;
  stale_checkouts_removed: number;
  stale_state_files_removed: number;
  errors: string[];
}

// --- watchdog config editor ---

export type WatchdogConfigKind = 'config' | 'overrides';

export interface WatchdogGetConfigResponse {
  found: boolean;
  created: boolean;
  path: string;
  content: string;
  sha256: string;
}

export interface WatchdogSetConfigResponse {
  accepted: boolean;
  message: string;
  backup_file: string;
}

// --- multi-node app config editor (Apps page) ---

export interface NodeConfigEntry {
  node_id: number;
  hostname: string;
  found: boolean;
  content?: string | null;
  sha256?: string | null;
  error?: string | null;
}

export interface MultiNodeConfigResponse {
  application: string;
  kind: string;
  nodes: NodeConfigEntry[];
  // True only when every node that answered has byte-identical content.
  all_match: boolean;
}

export interface NodeConfigSetResult {
  node_id: number;
  hostname: string;
  accepted: boolean;
  message: string;
}

export interface MultiNodeConfigSetResponse {
  application: string;
  kind: string;
  results: NodeConfigSetResult[];
}

// Sync status colors for UI
export const syncStatusColorMap: Record<SyncStatus, string> = {
  idle: 'text-blue-400',
  syncing: 'text-yellow-400 animate-pulse',
  latest: 'text-green-400',
  outdated: 'text-orange-400',
  failed: 'text-red-400',
  unknown: 'text-gray-400',
};