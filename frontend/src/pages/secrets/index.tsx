import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/header';
import { fetchWithAuth, postWithAuth } from '@/lib/api';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { resolveRunnerLabel } from '@/lib/repoLabel';

interface SecretItem {
  name: string;
  value: string;
}

export default function SecretsPage() {
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [projectLabels, setProjectLabels] = useState<Record<string, string>>({});
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedEnv, setSelectedEnv] = useState('prod');
  const [customEnv, setCustomEnv] = useState('');
  const [items, setItems] = useState<SecretItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [secretsError, setSecretsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetchWithAuth('proxy/runners');
        const ids = (res.data || []).map((r: any) => r.name.replace('ais_', ''));
        setProjectIds(ids);
        setProjectsLoadError(null);
        if (ids.length) {
          setSelectedProject((cur) => cur || ids[0]);
        }
      } catch (err) {
        console.error('Failed to load projects', err);
        setProjectsLoadError(err instanceof Error ? err.message : 'Failed to load projects');
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    let cancelled = false;
    projectIds.forEach((id) => {
      if (projectLabels[id]) return;
      resolveRunnerLabel(id).then((label) => {
        if (cancelled) return;
        setProjectLabels((prev) => (prev[id] ? prev : { ...prev, [id]: label }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [projectIds]);

  const envValue = selectedEnv === '__custom__' ? customEnv : selectedEnv;

const loadSecrets = useCallback(async () => {
  if (!selectedProject || !envValue) {
    setItems([]);
    return;
  }

  try {
    // Portal decodes the secret bytes to a plain UTF-8 string server-side,
    // unlike the old dashboard/backend route this used to hit -- no more
    // byte-array decoding needed on this end.
    const res = await fetchWithAuth(
      `proxy/secrets?runner_id=${selectedProject}&environment_id=${envValue}`
    );

    const list: SecretItem[] = (res.data || []).map((kv: { key: string; value: string }) => ({
      name: kv.key,
      value: kv.value,
    }));

    setItems(list);
    setSecretsError(null);
  } catch (err) {
    console.error('Failed to load secrets', err);
    setItems([]);
    // Don't try to distinguish an mTLS/channel problem from an access denial
    // in the UI text -- portal and ais_secretserver deliberately return the
    // same shape for both, and that distinction isn't safely surfaceable to
    // a non-privileged caller anyway.
    setSecretsError('Could not load secrets -- check your access to this project/environment.');
  }
}, [selectedProject, envValue]);


  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const addSecret = async () => {
    if (!newName || !newValue || !selectedProject || !envValue) return;
    try {
      await postWithAuth('proxy/secrets', {
        runner_id: selectedProject,
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

  // POST, not DELETE/PUT -- Portal's CORS layer only allows GET/POST/OPTIONS,
  // same convention as every other mutating admin route.
  const deleteSecret = async (name: string) => {
    if (!selectedProject || !envValue) return;
    try {
      await postWithAuth('proxy/secrets/delete', {
        runner_id: selectedProject,
        environment_id: envValue,
        secret_key: name,
      });
      loadSecrets();
    } catch (err) {
      console.error('Failed to delete secret', err);
    }
  };

  const updateSecret = async (name: string, current: string) => {
    if (!selectedProject || !envValue) return;
    const newVal = prompt('Enter new value', current);
    if (newVal === null) return;
    try {
      await postWithAuth('proxy/secrets/update', {
        runner_id: selectedProject,
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
    <div className="min-h-screen flex bg-page text-foreground">
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-brand mb-6">Secrets</h1>

        {projectsLoadError && <p className="text-sm text-red-500 mb-4">{projectsLoadError}</p>}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Select Project</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              {projectIds.map((id) => (
                <option key={id} value={id}>
                  {projectLabels[id] ?? id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Select Environment</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
            >
              <option value="dev">dev</option>
              <option value="stage">stage</option>
              <option value="prod">prod</option>
              <option value="__custom__">Custom...</option>
            </select>
            {selectedEnv === '__custom__' && (
              <input
                className="mt-2 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                placeholder="Environment name"
                value={customEnv}
                onChange={(e) => setCustomEnv(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="card p-6 space-y-6">
          {secretsError && <p className="text-sm text-red-500">{secretsError}</p>}
          {selectedProject && items.length === 0 && !secretsError ? (
            <p className="text-gray-500">No secrets stored yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <div key={s.name} className="card-hover p-4 space-y-2">
                  <p className="font-semibold text-brand">{s.name}</p>
                  <p className="text-sm text-gray-400 truncate">{s.value}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => copySecret(s.value)}
                      className="btn-brand px-3 py-1 rounded text-sm"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => updateSecret(s.name, s.value)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => deleteSecret(s.name)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
            <h3 className="font-semibold text-brand mb-2">Add Secret</h3>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <input
                id="name"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
              />
              <input
                id="value"
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
              />
            </div>
            <button
              onClick={addSecret}
              className="btn-brand px-4 py-2 rounded"
            >
              Save
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

