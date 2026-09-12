// Represents summarized usage data from /usage/group/{runner_id}
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

// Represents the summarized group usage for all instances under one runner
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

export type StatusType = 'Running' | 'Stopped' | 'Warning' | 'Building';

export const statusColorMap: Record<StatusType, string> = {
  Running: 'text-green-400',
  Stopped: 'text-red-400',
  Warning: 'text-yellow-400',
  Building: 'text-blue-400',
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

export type NodeStatus =
  | 'Starting'
  | 'Running'
  | 'Idle'
  | 'Stopping'
  | 'Stopped'
  | 'Unknown'
  | 'Warning'
  | 'Building';

export interface NodeInfo {
  identity: Identifier;
  hostname: string;
  status: NodeStatus;
  ip_address: string;
  runners: string[];
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
  status: NodeStatus;
  runners: string[];
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