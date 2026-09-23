import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { fetchNodes } from '@/lib/api';
import { NodeInfo, statusColorMap } from '@/lib/types';
import { Sidebar } from '@/components/header';
import LoadingOverlay from '@/components/loading';
import { RequireAdmin } from '@/components/requireAdmin';
import { handleLogout, handleLogoutAll } from '@/lib/logout';

const REFRESH_INTERVAL = 15_000; // nodes churn slower than runners/VMs

function formatTimestamp(value: string): string {
  const seconds = Number(value);
  if (Number.isNaN(seconds)) return value;
  return new Date(seconds * 1000).toLocaleString();
}

function NodesListPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNodes = useCallback(async () => {
    try {
      const list = await fetchNodes();
      setNodes(list);
    } catch (err) {
      console.error('Failed to load nodes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
    const iv = setInterval(loadNodes, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [loadNodes]);

  return (
    <div className="relative min-h-screen flex bg-page text-foreground">
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold mb-8 text-brand">Nodes</h2>

        {!loading && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nodes.map((node) => (
              <div key={node.identity.id} className="card-hover p-6 min-w-0">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-brand truncate">{node.hostname}</p>
                    <p className={`text-sm mt-1 ${statusColorMap[node.status] ?? 'text-gray-400'}`}>
                      {node.status}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/nodes/${node.identity.id}`)}
                    className="btn-brand px-4 py-2 rounded-full text-sm font-medium shrink-0"
                  >
                    Details →
                  </button>
                </div>

                <div className="text-sm text-gray-300 space-y-1">
                  <p>ID: <span className="font-medium text-white">{node.identity.id}</span></p>
                  <p>IP: <span className="font-medium text-white">{node.ip_address}</span></p>
                  <p>Runners: <span className="font-medium text-white">{node.projects.length}</span></p>
                  <p>Last Updated: <span className="font-medium text-white">{formatTimestamp(node.last_updated)}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}

export default function GuardedNodesListPage() {
  return (
    <RequireAdmin>
      <NodesListPage />
    </RequireAdmin>
  );
}
