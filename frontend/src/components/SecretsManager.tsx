import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth, postWithAuth, fetchMultiNodeConfig } from '@/lib/api';
import { detectEnvironmentFromConfig } from '@/lib/envDetect';
import { Button, Field, SelectField } from '@/components/ui';

interface SecretItem {
  name: string;
  value: string;
}

const KNOWN_ENVS = ['development', 'staging', 'production'];

// Per-project secrets CRUD, shared by the Secrets tab on a project's page.
// Scoped to one `projectId` -- unlike the old standalone /secrets page this
// replaced, there's no project picker here, just the environment.
export function SecretsManager({ projectId }: { projectId: string }) {
  const [selectedEnv, setSelectedEnv] = useState('production');
  const [customEnv, setCustomEnv] = useState('');
  const [autoDetected, setAutoDetected] = useState(false);
  const [items, setItems] = useState<SecretItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [secretsError, setSecretsError] = useState<string | null>(null);
  const userChangedEnv = useRef(false);

  const envValue = selectedEnv === '__custom__' ? customEnv : selectedEnv;

  // Best-effort: try to read the environment this project's watchdog
  // overrides are actually configured for, and pre-select it -- falls back
  // to the 'production' default above if there's no overrides file, the
  // fetch fails, or nothing in it looks like an environment field.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetchMultiNodeConfig(projectId, 'overrides')
      .then((data) => {
        if (cancelled || userChangedEnv.current) return;
        const withContent = data.nodes.find((n) => n.found && n.content);
        const detected = detectEnvironmentFromConfig(withContent?.content);
        if (!detected) return;
        setAutoDetected(true);
        if (KNOWN_ENVS.includes(detected)) {
          setSelectedEnv(detected);
        } else {
          setSelectedEnv('__custom__');
          setCustomEnv(detected);
        }
      })
      .catch(() => {
        // No overrides file, no access to it, or the fetch failed -- the
        // 'production' default above stands.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadSecrets = useCallback(async () => {
    if (!projectId || !envValue) {
      setItems([]);
      return;
    }
    try {
      // Portal decodes the secret bytes to a plain UTF-8 string server-side
      // -- no byte-array decoding needed on this end.
      const res = await fetchWithAuth(`proxy/secrets?runner_id=${projectId}&environment_id=${envValue}`);
      const list: SecretItem[] = (res.data || []).map((kv: { key: string; value: string }) => ({
        name: kv.key,
        value: kv.value,
      }));
      setItems(list);
      setSecretsError(null);
    } catch (err) {
      console.error('Failed to load secrets', err);
      setItems([]);
      // Don't try to distinguish an mTLS/channel problem from an access
      // denial in the UI text -- Portal and ais_secretserver deliberately
      // return the same shape for both.
      setSecretsError('Could not load secrets -- check your access to this project/environment.');
    }
  }, [projectId, envValue]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const addSecret = async () => {
    if (!newName || !newValue || !envValue) return;
    try {
      await postWithAuth('proxy/secrets', {
        runner_id: projectId,
        environment_id: envValue,
        secret_key: newName,
        value: newValue,
      });
      setNewName('');
      setNewValue('');
      loadSecrets();
    } catch (err) {
      console.error('Failed to add secret', err);
    }
  };

  // POST, not DELETE/PUT -- Portal's CORS layer only allows GET/POST/OPTIONS.
  const deleteSecret = async (name: string) => {
    if (!envValue) return;
    try {
      await postWithAuth('proxy/secrets/delete', {
        runner_id: projectId,
        environment_id: envValue,
        secret_key: name,
      });
      loadSecrets();
    } catch (err) {
      console.error('Failed to delete secret', err);
    }
  };

  const updateSecret = async (name: string, current: string) => {
    if (!envValue) return;
    const newVal = prompt('Enter new value', current);
    if (newVal === null) return;
    try {
      await postWithAuth('proxy/secrets/update', {
        runner_id: projectId,
        environment_id: envValue,
        secret_key: name,
        new_value: newVal,
      });
      loadSecrets();
    } catch (err) {
      console.error('Failed to update secret', err);
    }
  };

  const copySecret = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Environment</label>
        <SelectField
          className="w-full sm:w-64"
          value={selectedEnv}
          onChange={(e) => {
            userChangedEnv.current = true;
            setAutoDetected(false);
            setSelectedEnv(e.target.value);
          }}
        >
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
          <option value="__custom__">Custom...</option>
        </SelectField>
        {selectedEnv === '__custom__' && (
          <Field
            sans
            className="mt-2 w-full sm:w-64"
            placeholder="Environment name"
            value={customEnv}
            onChange={(e) => {
              userChangedEnv.current = true;
              setAutoDetected(false);
              setCustomEnv(e.target.value);
            }}
          />
        )}
        {autoDetected && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Detected from this project's overrides config.
          </p>
        )}
      </div>

      {secretsError && <p className="text-sm text-red-500">{secretsError}</p>}
      {items.length === 0 && !secretsError ? (
        <p style={{ color: 'var(--muted)' }}>No secrets stored yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <div key={s.name} className="card-hover p-4 space-y-2">
              <p className="font-semibold text-brand">{s.name}</p>
              <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{s.value}</p>
              <div className="mt-2 flex gap-2">
                <Button small onClick={() => copySecret(s.value)}>Copy</Button>
                <Button small variant="ghost" onClick={() => updateSecret(s.name, s.value)}>Update</Button>
                <Button small variant="danger" onClick={() => deleteSecret(s.name)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <h3 className="font-semibold text-brand mb-2">Add Secret</h3>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <Field sans placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full" />
          <Field sans placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="w-full" />
        </div>
        <Button onClick={addSecret}>Save</Button>
      </div>
    </div>
  );
}
