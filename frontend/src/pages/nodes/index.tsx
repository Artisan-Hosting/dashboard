import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { fetchNodes } from '@/lib/api';
import { NodeInfo } from '@/lib/types';
import { TopBar } from '@/components/topbar';
import LoadingOverlay from '@/components/loading';
import { RequireAdmin } from '@/components/requireAdmin';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Button, Pill } from '@/components/ui';

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
    <div className="relative min-h-screen bg-page text-foreground">
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold mb-8 text-brand">Nodes</h2>

        {!loading && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nodes.map((node) => (
              <div key={node.identity.id} className="card-hover p-6 min-w-0">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-brand truncate">{node.hostname}</p>
                    <div className="mt-1">
                      <Pill status={node.status} />
                    </div>
                  </div>
                  <Button small onClick={() => router.push(`/nodes/${node.identity.id}`)} className="shrink-0">
                    Details →
                  </Button>
                </div>

                <div className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
                  <p>ID: <span className="font-medium" style={{ color: 'var(--strong)' }}>{node.identity.id}</span></p>
                  <p>IP: <span className="font-medium" style={{ color: 'var(--strong)' }}>{node.ip_address}</span></p>
                  <p>Apps: <span className="font-medium" style={{ color: 'var(--strong)' }}>{node.projects.length}</span></p>
                  <p>Last Updated: <span className="font-medium" style={{ color: 'var(--strong)' }}>{formatTimestamp(node.last_updated)}</span></p>
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
