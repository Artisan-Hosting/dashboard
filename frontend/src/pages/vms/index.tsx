import { TopBar } from '@/components/topbar';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { toast, Toaster } from 'react-hot-toast';
import { Button, Pill } from '@/components/ui';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Portal's own OpenAPI spec is explicit that it serves no /vms/* routes
// today (ais_vm's REST re-export is planned but not built -- see
// PLANNED_SURFACES.md upstream). This page used to poll a dead endpoint
// every 5s and render an empty grid with no explanation; that's a worse
// experience than admitting the feature isn't live yet. Swap this for the
// real listing once Portal actually routes /vms/*.
export default function VmListPage() {
  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold mb-6 text-brand">
          Virtual Machines
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {vms.map((vm) => {
            const isBusy = actionLoading[vm.vm_id] ?? false;

            return (
              <div
                key={vm.vm_id}
                className="card-hover p-6"
              >
                <h3 className="text-xl font-semibold text-brand">
                  VM {vm.vm_id}
                </h3>
                <div className="mt-1">
                  <Pill status={vm.status} />
                </div>

                <div className="mt-2 text-sm space-y-1 mb-4" style={{ color: 'var(--muted)' }}>
                  <p>CPU: {(vm.cpu * 100).toFixed(1)}%</p>
                  <p>RAM: {vm.maxmem > 0 ? ((vm.mem / vm.maxmem) * 100).toFixed(1) : '0.0'}%</p>
                  <p>Uptime: {formatUptime(vm.uptime)}</p>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['start', 'stop', 'restart', 'shutdown'] as VmActionType[]).map(
                    (action) => (
                      <Button
                        key={action}
                        small
                        variant={action === 'stop' || action === 'shutdown' ? 'danger' : 'ghost'}
                        onClick={() => handleAction(vm.vm_id, action)}
                        disabled={isBusy}
                        className="flex-1"
                      >
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
