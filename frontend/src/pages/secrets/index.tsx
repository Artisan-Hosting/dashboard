import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/header';
import { fetchWithAuth } from '@/lib/api';
import { handleLogout } from '@/lib/logout';

interface SecretItem {
  name: string;
  value: string;
  env: string;
}

export default function SecretsPage() {
  const [runnerIds, setRunnerIds] = useState<string[]>([]);
  const [selectedRunner, setSelectedRunner] = useState('');
  const [secrets, setSecrets] = useState<Record<string, SecretItem[]>>({});
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newEnv, setNewEnv] = useState('prod');

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

  const addSecret = () => {
    if (!newName || !newValue || !selectedRunner) return;
    const list = secrets[selectedRunner] || [];
    const updated = {
      ...secrets,
      [selectedRunner]: [...list, { name: newName, value: newValue, env: newEnv }],
    };
    setSecrets(updated);
    setNewName('');
    setNewValue('');
    setNewEnv('prod');
    setShowForm(false);
  };

  const deleteSecret = (idx: number) => {
    const list = secrets[selectedRunner] || [];
    const updated = { ...secrets, [selectedRunner]: list.filter((_, i) => i !== idx) };
    setSecrets(updated);
  };

  const changeEnv = (idx: number, env: string) => {
    const list = secrets[selectedRunner] || [];
    list[idx] = { ...list[idx], env };
    setSecrets({ ...secrets, [selectedRunner]: [...list] });
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
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-brand mb-6">Secrets</h1>

        <div className="mb-6">
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
        <div className="card p-6 space-y-6">
          {selectedRunner && (secrets[selectedRunner] || []).length === 0 ? (
            <p className="text-gray-500">No secrets stored yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(secrets[selectedRunner] || []).map((s, idx) => (
                <div key={idx} className="card-hover p-4 space-y-2">
                  <p className="font-semibold text-brand">{s.name}</p>
                  <p className="text-sm text-gray-400 truncate">{s.value}</p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs">Env:</label>
                    <select
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm"
                      value={s.env}
                      onChange={(e) => changeEnv(idx, e.target.value)}
                    >
                      <option value="dev">dev</option>
                      <option value="stage">stage</option>
                      <option value="prod">prod</option>
                    </select>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => copySecret(s.value)}
                      className="bg-brand text-white px-3 py-1 rounded text-sm hover:bg-brand-dark"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => deleteSecret(idx)}
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
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
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
              <select
                id="env"
                value={newEnv}
                onChange={(e) => setNewEnv(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
              >
                <option value="dev">dev</option>
                <option value="stage">stage</option>
                <option value="prod">prod</option>
              </select>
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
