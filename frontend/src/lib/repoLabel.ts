// Universal runner-id -> human label resolver.
//
// Runner/app ids are 8-hex-char git-derived hashes (see `GitAuth::generate_id`
// in the Rust backend) with no meaning to a human. This resolves one to
// "repo @ branch" via `GET proxy/runner/{id}/git-info`, with a module-level
// cache so the same id is only ever looked up once per page load regardless
// of how many components render it.
import { fetchRunnerGitInfo, RunnerGitInfo } from './api';

const SYSTEM_APP_LABELS: Record<string, string> = {
  manager: 'Manager',
  gitmon: 'Git Monitor',
  mailler: 'Mailer',
  welcome: 'Welcome',
};

function bareId(id: string): string {
  return id.startsWith('ais_') ? id.slice(4) : id;
}

export function systemAppLabel(id: string): string | null {
  return SYSTEM_APP_LABELS[bareId(id)] ?? null;
}

const cache = new Map<string, RunnerGitInfo | null>();
const inflight = new Map<string, Promise<RunnerGitInfo | null>>();

export async function fetchGitInfo(id: string): Promise<RunnerGitInfo | null> {
  const key = bareId(id);
  if (cache.has(key)) return cache.get(key)!;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchRunnerGitInfo(key)
    .then((info) => {
      cache.set(key, info);
      return info;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

// Resolves an id to "repo @ branch", a friendly system-app name, or the raw
// id itself as a last resort (a runner with no git repo and no known system
// name, or one the caller lacks permission to see).
export async function resolveRunnerLabel(id: string): Promise<string> {
  const sys = systemAppLabel(id);
  if (sys) return sys;

  const info = await fetchGitInfo(id);
  return info ? `${info.repo} @ ${info.branch}` : bareId(id);
}
