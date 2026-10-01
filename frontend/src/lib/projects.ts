// Customer deploy: look up a repository, create a project, watch it come up.
// Portal answers in its standard envelope; errors arrive as `API Error: <status> <body>`
// (see postWithAuth/fetchWithAuth), so the message is pulled back out of the body.
import { fetchWithAuth, postWithAuth, sendProjectControl } from './api';

export interface RepoInspection {
  /** False when the host is not one we can look into: fill the form in by hand. */
  supported: boolean;
  owner: string;
  repo: string;
  private?: boolean;
  default_branch?: string;
  branches?: string[];
  /** e.g. "Node.js", or "" when nothing was recognised. */
  stack?: string;
  suggestion?: { install?: string; build?: string; run?: string };
  note?: string;
}

export type DeployState = 'preparing' | 'building' | 'built' | 'starting' | 'running' | 'failed';

export interface Deployment {
  id: string;
  node_id: number;
  state: DeployState;
  message: string;
  port: number | null;
  build: string | null;
  log_tail: string[];
}

export interface CreateProjectInput {
  user: string;
  repo: string;
  branch: string;
  server?: string;
  token?: string;
  build_command?: string;
  install_command?: string;
  run_command: string;
  secrets: { key: string; value: string }[];
}

export class ProjectError extends Error {
  constructor(message: string, public readonly needsPlan = false) {
    super(message);
  }
}

function messageFrom(err: any, fallback: string): string {
  const raw = String(err?.message ?? '');
  const brace = raw.indexOf('{');
  if (brace >= 0) {
    try {
      const body = JSON.parse(raw.slice(brace));
      const first = Array.isArray(body?.errors) ? body.errors[0] : undefined;
      if (first?.message) return String(first.message);
    } catch {
      /* not JSON */
    }
  }
  return fallback;
}

/** Whether Portal's refusal was "you have no plan" (so the page can link to Billing). */
const looksLikeNoPlan = (m: string) => /plan|good standing/i.test(m);

export async function inspectRepo(url: string, token?: string): Promise<RepoInspection> {
  try {
    const res = await postWithAuth('proxy/repos/inspect', { url, token: token || undefined });
    return (res?.data ?? res) as RepoInspection;
  } catch (err: any) {
    throw new ProjectError(messageFrom(err, 'We could not look that repository up. You can fill in the details by hand.'));
  }
}

export async function createProject(input: CreateProjectInput): Promise<{ id: string; node_id: number; started: boolean }> {
  try {
    const res = await postWithAuth('proxy/projects', {
      repo: {
        user: input.user,
        repo: input.repo,
        branch: input.branch,
        server: input.server || undefined,
        token: input.token || undefined,
      },
      commands: {
        build_command: input.build_command || undefined,
        install_command: input.install_command || undefined,
        run_command: input.run_command,
      },
      secrets: input.secrets,
    });
    return res.data ?? res;
  } catch (err: any) {
    const message = messageFrom(err, 'We could not start the deploy. Please try again.');
    throw new ProjectError(message, looksLikeNoPlan(message));
  }
}

export async function fetchDeployment(id: string): Promise<Deployment> {
  const res = await fetchWithAuth(`proxy/projects/${id}/deployment`);
  if (res?.status !== 'success' || !res?.data) {
    throw new ProjectError((res?.errors ?? []).map((e: any) => e.message).join('; ') || 'Could not read the deploy status');
  }
  return res.data as Deployment;
}

/** The deploy built but is not running: start it (the node does not start a fresh app by itself). */
export const startProject = (id: string) => sendProjectControl(id, 'start');

/** Splits `https://github.com/owner/name(.git)` or `owner/name` into its parts. */
export function parseRepoAddress(input: string): { owner: string; repo: string } | null {
  const m = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
    .match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export const STATE_LABEL: Record<DeployState, string> = {
  preparing: 'Fetching your code',
  building: 'Building',
  built: 'Built',
  starting: 'Starting',
  running: 'Running',
  failed: 'Failed',
};

export const STATE_ORDER: DeployState[] = ['preparing', 'building', 'starting', 'running'];
