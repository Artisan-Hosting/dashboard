import { useState } from 'react'
import { fetchWithAuth, postWithAuth } from '@/lib/api'
import { Sidebar } from '@/components/header'
import { handleLogout } from '@/lib/logout'

interface SecretPair {
  key: string
  value: string
}

export default function SecretsPage() {
  const [runnerId, setRunnerId] = useState('')
  const [envId, setEnvId] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [secrets, setSecrets] = useState<SecretPair[]>([])

  const loadSecrets = async () => {
    const res = await fetchWithAuth(`secrets/list?runner_id=${runnerId}&environment_id=${envId}`)
    if (res && res.vals) {
      setSecrets(res.vals.map((v: any) => ({ key: v.key, value: atob(v.value) })))
    }
  }

  const createSecret = async () => {
    await postWithAuth('secrets/create', {
      runner_id: runnerId,
      environment_id: envId,
      secret_key: newKey,
      value: newVal,
      actor: 'dashboard',
    })
    setNewKey('')
    setNewVal('')
    loadSecrets()
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-tr from-[#0b0c10] via-[#161b22] to-[#1f2937] text-white">
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-purple-300">Secrets</h1>
        <div className="space-y-2">
          <input placeholder="Runner" className="p-2 rounded bg-gray-800" value={runnerId} onChange={e => setRunnerId(e.target.value)} />
          <input placeholder="Environment" className="p-2 rounded bg-gray-800" value={envId} onChange={e => setEnvId(e.target.value)} />
          <button onClick={loadSecrets} className="bg-purple-600 px-4 py-2 rounded">Load</button>
        </div>
        <div className="space-y-2">
          <input placeholder="Key" className="p-2 rounded bg-gray-800" value={newKey} onChange={e => setNewKey(e.target.value)} />
          <input placeholder="Value" className="p-2 rounded bg-gray-800" value={newVal} onChange={e => setNewVal(e.target.value)} />
          <button onClick={createSecret} className="bg-purple-600 px-4 py-2 rounded">Create</button>
        </div>
        <ul className="space-y-1">
          {secrets.map(s => (
            <li key={s.key} className="border border-gray-700 p-2 rounded">
              <span className="font-medium">{s.key}</span> : {s.value}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
