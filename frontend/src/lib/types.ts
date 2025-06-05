// Represents a project listed on the Dashboard
export interface Project {
  name: string;      // From runner.name (without "ais_" prefix)
  status: string;    // Runner status ("Running", "Stopped", etc.)
  usage?: UsageSummary; // Fetched separately via `usage/group/{runner_id}`
  cost?: BillingCosts;
  live?: Metrics;
}

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
 * Live/summary metrics for a runner (optional).
 */
export interface Metrics {
  /** Current CPU usage, e.g. "12.34%" */
  cpu_usage: string;
  /** Current RAM usage, e.g. "256 MB" */
  ram_usage: string;
  /** Total bytes transmitted by the runner */
  tx_bytes: number;
  /** Total bytes received by the runner */
  rx_bytes: number;
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
  /** Optional live metrics from the runner */
  metrics?: Metrics;
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

export interface VmMetrics {
  cpu_percent: number;      // e.g. 12.5
  memory_percent: number;   // e.g. 34.2
  uptime_seconds: number;   // e.g. 123456
}

export interface VmListItem {
  vmid: number;       // numeric VM ID
  name: string;       // e.g. "web-server-01"
  status: string;     // e.g. "running" | "stopped"
  // if your JSON sometimes omits metrics, mark it optional or nullable:
  metrics?: VmMetrics | null;
}

export interface VmStatusDetail {
  vmid: number;
  name: string;
  status: string;            // e.g. "running"
  uptime_seconds: number;    // how long it’s been up

  // CPU usage percent (e.g. 5.2)
  cpu_pc: number;

  // memory in megabytes
  memory_total_mb: number;
  memory_used_mb: number;

  // cumulative disk I/O (in KB)
  disk_read_kb: number;
  disk_write_kb: number;

  // cumulative network I/O (in KB)
  net_rx_kb: number;
  net_tx_kb: number;

  // …add any extra fields your backend actually returns
}

export type VmActionType = 'start' | 'stop' | 'reboot' | 'shutdown';

export interface VmActionRequest {
  action: VmActionType;
  // optional flags, e.g. force shutdown
  force?: boolean;
}