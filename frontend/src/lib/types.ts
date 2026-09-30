// Represents summarized usage data from /usage/group/{runner_id}
//
// This type has been updated to match the Portal API's BilledUsageSummary
// which uses project_id (not runner_id) as part of the resource-taxonomy
// migration.
export interface UsageSummary {
  project_id: string;
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

// If you later pull instance-level project details (optional future expansion)
export interface ProjectDetails {
  id: string;
  status: string;
  version: SoftwareVersion;
  artisan_config: any;
  specific_config?: any;
  enviornment?: any;
  health?: ProjectHealth;
  logs?: ProjectLogs;
}

export interface ProjectHealth {
  uptime: number;
  last_check: number;
  cpu_usage: string;
  ram_usage: string;
  tx_bytes: number;
  rx_bytes: number;
}

export interface ProjectLogs {
  recent: string[];
}

// Every service on the platform reports its own app version alongside the
// artisan_middleware ("ais_library") version it's built against -- verified
// against real GET /node/{id} and GET /runners responses, both nested this
// way. `code` is the release channel (e.g. "Production", "ReleaseCandidate"),
// not a version number.
export interface VersionField {
  number: string;
  code: string;
}

export interface SoftwareVersion {
  application: VersionField;
  library: VersionField;
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
  details: ProjectDetails;
  usage: UsageSummary;
}


// Represents the summarized group usage for all instances under one runner.
export interface ProjectGroupUsage {
  project_id: string;
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
 * A minimal summary of a project group for listing.
 * Mirrors the Rust `ProjectSummary`:
 */
export interface ProjectSummary {
  /** Short name or ID of the project */
  name: string;
  /** Current state, e.g. "Running" or "Stopped" */
  status: string;
  version: SoftwareVersion;
  /**
   * IDs of nodes this project is deployed on. For the platform's own system
   * apps (manager, gitmon, mailler) this is always empty -- Portal's
   * `/nodes` response never lists them in a node's own `projects` array, so
   * there's no per-node linkage for them here. Every node runs its own
   * manager + gitmon, but GET /runners folds all of those into one row per
   * app name (aggregated fleet-wide, worst-of status), not one per node.
   */
  nodes: number[];
  /** Total seconds this project has been active (optional) */
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
  /** This node's own manager: its application version and the ais_library
   *  (artisan_middleware) version it's built against. */
  version: SoftwareVersion;
  git_config: GitCredentials;
  hostname: string;
  address: string;
  /** Bare counts for this node -- no names or per-app status. See
   *  ais_manager's get_manager_data(): summed by walking this node's local
   *  app-status array and checking is_system_application(), not a fleet
   *  breakdown. */
  system_apps: number;
  client_apps: number;
  /**
   * NOT a count of warnings. A sticky 0/1 flag: 1 once this node's local
   * watchdog has reported a security/tamper trip at any point since the
   * manager process last started, and it stays 1 until the manager
   * restarts -- it does not clear when the underlying issue does. There is
   * no list of individual warnings anywhere in what Portal exposes today.
   */
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

// Per-node outcome from `POST /v1/repos/deploy` or `.../add-nodes` --
// same shape either way (both go through the same GitReposAdd + try_start_app
// per-node loop server-side).
export interface DeployNodeResult {
  node_id: number;
  added: boolean;
  config_written: boolean;
  started: boolean;
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

// --- Org role-policy editor ---

export interface OrgPolicyRow {
  organization_id: string;
  resource_type: string;
  action: string;
  role: string;
  allow: boolean;
}

export interface SetOrgPolicyBody {
  elevated_token: string;
  resource_type: string;
  action: string;
  role: string;
  allow: boolean;
}

// --- Domains (RBAC Phase 6) ---
//
// `source`/`status` accept the literals below for autocomplete, but also any
// other string: an unrecognised value from ais_domains arrives as
// `unknown(<n>)` rather than failing the listing (ais_domains may learn a
// value before Portal/the dashboard are rebuilt), so these are typed as an
// open union rather than a strict enum.
export type DomainSource = 'unspecified' | 'purchased' | 'byo' | 'imported' | (string & {});

export type DomainStatus =
  | 'unspecified'
  | 'pending_payment'
  | 'registering'
  | 'provisioning_dns'
  | 'pending_dns'
  | 'issuing'
  | 'active'
  | 'renewing'
  | 'error'
  | 'removed'
  | (string & {});

export interface DomainEntry {
  id: string;
  fqdn: string;
  organization_id: string; // empty = unassigned, a normal/durable state
  runner_id: string; // empty = not attached to a project
  source: DomainSource;
  status: DomainStatus;
  serves_tls: boolean;
  vhost_paths: string[];
  cert_dirs: string[];
  expires_at: number; // unix seconds; 0 = nothing on disk
  findings: string[];
}

export interface DomainsPage {
  entries: DomainEntry[];
  total: number;
  unassigned: number;
}

export interface DomainSummary {
  id: string;
  fqdn: string;
  organization_id: string;
  runner_id: string;
  source: DomainSource;
  status: DomainStatus;
  has_vhost: boolean;
  expires_at: number;
}

export interface DomainFinding {
  code: string; // e.g. vhost_only, cert_expiring, cert_without_snippet
  severity: 'info' | 'warn' | 'error';
  subject: string; // the domain or file the finding is about
  message: string;
  first_seen: number;
  last_seen: number;
  resolved_at: number; // 0 while still open
}

export interface AdoptedVhost {
  path: string; // relative to the nginx tree root
  domain_fqdn: string;
  server_names: string[];
  file_sha256: string;
  drifted: boolean; // the file changed on disk since it was adopted
}

export interface DomainRescanResult {
  scan_id: number;
  domain_count: number;
  finding_count: number;
  server_count: number;
}

export interface AssignDomainBody {
  id_or_fqdn: string;
  organization_id?: string;
  runner_id?: string;
  // An empty string means "leave alone" -- clearing is explicit via these
  // flags, so "not specified" and "remove it" can never be confused.
  clear_org?: boolean;
  clear_runner?: boolean;
  elevated_token?: string;
}

export interface AttachDomainBackend {
  node_id: string;
  port: number;
}

export interface AttachDomainBody {
  id_or_fqdn: string;
  runner_id: string;
  backends: AttachDomainBackend[];
  extra_names?: string[];
  no_http_redirect?: boolean;
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
// --- Billing: credits ---

export interface CreditBalance {
  organization_id: string;
  balance_cents: number;
  // 0 means no cap configured.
  monthly_spend_cap_cents: number;
}

export interface CreditLedgerEntry {
  id: number;
  entry_type: 'topup' | 'debit' | 'adjustment' | string;
  // Signed: top-ups positive, debits negative.
  amount_cents: number;
  balance_after_cents: number;
  // Stripe payment intent or session id; empty when there is none.
  external_reference: string;
  created_at: number;
}

export interface CreditLedgerPage {
  entries: CreditLedgerEntry[];
  total: number;
}

// The balance only changes once Stripe confirms the payment, so the caller
// confirms the card with these and then polls the balance.
export interface TopUpCheckout {
  payment_intent_id: string;
  amount_cents: number;
  currency: string;
  stripe_client_secret: string;
  stripe_publishable_key: string;
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

// --- Orders ---
export interface Order {
  id: string;
  fqdn: string;
  organization_id: string;
  user_id: string;
  cost: { amount_cents: number; currency: string };
  price: { amount_cents: number; currency: string };
  state: string;
  cf_workflow_state: string;
  stripe_payment_intent_id: string;
  domain_id: string;
  last_error: string;
  created_at: number;
  updated_at: number;
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
