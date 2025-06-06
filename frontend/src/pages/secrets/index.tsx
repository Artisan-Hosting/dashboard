import { useState } from 'react';
import { Sidebar } from '@/components/header';
import { handleLogout } from '@/lib/logout';

interface SecretItem {
  name: string;
  value: string;
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  const addSecret = () => {
    if (!newName || !newValue) return;
    setSecrets([...secrets, { name: newName, value: newValue }]);
    setNewName('');
    setNewValue('');
    setShowForm(false);
  };

  const deleteSecret = (idx: number) => {
    setSecrets(secrets.filter((_, i) => i !== idx));
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-brand">Secrets</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand text-white px-4 py-2 rounded hover:bg-brand-dark"
          >
            {showForm ? 'Cancel' : 'New Secret'}
          </button>
        </div>

        {showForm && (
          <div className="card p-4 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="value">
                Value
              </label>
              <input
                id="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <button
              onClick={addSecret}
              className="bg-brand text-white px-4 py-2 rounded hover:bg-brand-dark"
            >
              Save
            </button>
          </div>
        )}

        {secrets.length === 0 ? (
          <p className="text-gray-500">No secrets stored yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secrets.map((s, idx) => (
              <div key={idx} className="card-hover p-4">
                <p className="font-semibold text-brand mb-2">{s.name}</p>
                <p className="text-sm text-gray-400 truncate">{s.value}</p>
                <div className="mt-4 flex gap-2">
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
      </main>
    </div>
  );
}
