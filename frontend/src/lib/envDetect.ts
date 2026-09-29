// Best-effort extraction of an "environment" value out of an app's watchdog
// overrides file. The file's format isn't pinned down anywhere (JSON, TOML
// and .env-style configs are all in use across projects), so this tries a
// few shapes and gives up cleanly -- callers fall back to their own default
// when this returns null.
const KNOWN_ENVS = ['development', 'staging', 'production'];
const SHORTHAND: Record<string, string> = { dev: 'development', stage: 'staging', prod: 'production' };

export function detectEnvironmentFromConfig(content: string | null | undefined): string | null {
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    const found = findEnvKey(parsed);
    if (found) return normalizeEnvName(found);
  } catch {
    // Not JSON -- fall through to line-based formats below.
  }

  // Covers TOML (`environment = "production"`) and .env-style
  // (`ENVIRONMENT=production`) alike -- both are a `key = value` or
  // `key=value` line for a scalar field.
  const match = content.match(/^\s*environment(?:_id)?\s*[:=]\s*["']?([A-Za-z0-9_.-]+)["']?\s*$/im);
  if (match) return normalizeEnvName(match[1]);

  return null;
}

function findEnvKey(obj: unknown, depth = 0): string | null {
  if (depth > 4 || obj === null || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (/^environment(_id)?$/i.test(key) && typeof value === 'string') {
      return value;
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const nested = findEnvKey(value, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function normalizeEnvName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (SHORTHAND[lower]) return SHORTHAND[lower];
  if (KNOWN_ENVS.includes(lower)) return lower;
  return raw.trim();
}
