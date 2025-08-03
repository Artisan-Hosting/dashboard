import { useEffect, useState, useCallback } from 'react';
import { Buffer } from 'buffer';
import { Sidebar } from '@/components/header';
import {
  fetchWithAuth,
  postWithAuth,
  putWithAuth,
  deleteWithAuth,
} from '@/lib/api';
import { handleLogout, handleLogoutAll } from '@/lib/logout';

interface SecretItem {
  name: string;
  value: string;
}

export default function SecretsPage() {
  const [runnerIds, setRunnerIds] = useState<string[]>([]);
  const [selectedRunner, setSelectedRunner] = useState('');
  const [selectedEnv, setSelectedEnv] = useState('prod');
  const [customEnv, setCustomEnv] = useState('');
  const [items, setItems] = useState<SecretItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    async function loadRunners() {
      try {
        const res = await fetchWithAuth('proxy/runners');
        const ids = (res.data || []).map((r: any) => r.name.replace('ais_', ''));
        setRunnerIds(ids);
        if (ids.length) {
          setSelectedRunner((cur) => cur || ids[0]);
        }
      } catch (err) {
        console.error('Failed to load runners', err);
      }
    }
    loadRunners();
  }, []);

  const envValue = selectedEnv === '__custom__' ? customEnv : selectedEnv;

  const loadSecrets = useCallback(async () => {
    if (!selectedRunner || !envValue) {
      setItems([]);
      return;
    }
    try {
      const res = await fetchWithAuth(
        `secrets/list?runner_id=${selectedRunner}&environment_id=${envValue}`
      );
      const list: SecretItem[] = (res.vals || []).map((kv: any) => ({
        name: kv.key,
        value:
          typeof atob === 'function'
            ? atob(kv.value)
            : Buffer.from(kv.value, 'base64').toString('utf8'),
      }));
      setItems(list);
    } catch (err) {
      console.error('Failed to load secrets', err);
    }
  }, [selectedRunner, envValue]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const addSecret = async () => {
    if (!newName || !newValue || !selectedRunner || !envValue) return;
    try {
      await postWithAuth('secrets/create', {
        runner_id: selectedRunner,
        environment_id: envValue,
        secret_key: newName,
        value: newValue,
        actor: 'dashboard',
      });
      setNewName('');
      setNewValue('');
      loadSecrets();
    } catch (err) {
      console.error('Failed to add secret', err);
    }
  };

  const deleteSecret = async (name: string) => {
    if (!selectedRunner || !envValue) return;
    try {
      await deleteWithAuth('secrets/delete', {
        runner_id: selectedRunner,
        environment_id: envValue,
        secret_key: name,
      });
      loadSecrets();
    } catch (err) {
      console.error('Failed to delete secret', err);
    }
  };

  const updateSecret = async (name: string, current: string) => {
    if (!selectedRunner || !envValue) return;
    const newVal = prompt('Enter new value', current);
    if (newVal === null) return;
    try {
      await putWithAuth('secrets/update', {
        runner_id: selectedRunner,
        environment_id: envValue,
        secret_key: name,
        new_value: newVal,
        actor: 'dashboard',
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

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Select Runner</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
              value={selectedRunner}
              onChange={(e) => setSelectedRunner(e.target.value)}
            >
              {runnerIds.map((id) => (
                <option key={id} value={id}>
                  {id}
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
          {selectedRunner && items.length === 0 ? (
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
                      className="bg-brand text-white px-3 py-1 rounded text-sm hover:bg-brand-dark"
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
              className="bg-brand text-white px-4 py-2 rounded hover:bg-brand-dark"
            >
              Save
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

