import { useEffect, useState } from 'react';
import { fetchVmList, sendVmAction } from '@/lib/api';
import { VmListItem, VmActionType } from '@/lib/types';
import { Sidebar } from '@/components/header';
import LoadingOverlay from '@/components/loading';
import { handleLogout, handleLogoutAll } from '@/lib/logout';

export default function VmListPage() {
  const [vms, setVms] = useState<VmListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // When we perform an action, we may want to show a quick “loading” state per‐VM:
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchVmList();
        if (list) {
          setVms(list);
        } else {
          console.error('Error fetching VMs');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // If you want to refresh the VM list after an action, call this helper:
  const reloadVmList = async () => {
    try {
      const list = await fetchVmList();
      if (list) {
        setVms(list);
      }
    } catch (err) {
      console.error('Error reloading VMs:', err);
    }
  };

  // Called when one of the action buttons is clicked:
  const handleAction = async (vmid: number, action: VmActionType) => {
    // Mark this VM as “action in progress”:
    setActionLoading((prev) => ({ ...prev, [vmid]: true }));

    try {
      await sendVmAction(vmid, action);
      // Optionally: re-fetch the VM list to pick up new statuses:
      await reloadVmList();
    } catch (err) {
      console.error(`Failed to ${action} VM ${vmid}:`, err);
      // You could also display a toast or alert here
    } finally {
      setActionLoading((prev) => ({ ...prev, [vmid]: false }));
    }
  };


  return (
    <div className="relative min-h-screen flex bg-page text-foreground">
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold mb-6 text-brand">
          Virtual Machines
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {vms.map((vm) => {
            const isBusy = actionLoading[vm.vmid] ?? false;

            return (
              <div
                key={vm.vmid}
                className="card-hover p-6"
              >
                <h3 className="text-xl font-semibold text-brand">
                  VM {vm.vmid}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    vm.status === 'running'
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {vm.status.toUpperCase()}
                </p>

                {vm.metrics && (
                  <div className="mt-2 text-sm text-gray-300 space-y-1 mb-4">
                    <p>CPU: {vm.metrics.cpu_percent.toFixed(1)}%</p>
                    <p>RAM: {vm.metrics.memory_percent.toFixed(1)}%</p>
                    <p>Uptime: {vm.metrics.uptime_seconds}s</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['start', 'stop', 'reboot', 'shutdown'] as VmActionType[]).map(
                    (action) => (
                      <button
                        key={action}
                        onClick={() => handleAction(vm.vmid, action)}
                        disabled={isBusy}
                        className={`
                          flex-1
                          px-3 py-1 text-sm font-medium rounded-full
                          ${
                            isBusy
                              ? 'bg-gray-500 cursor-not-allowed'
                              : 'bg-brand hover:bg-brand-dark'
                          }
                        `}
                      >
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}
