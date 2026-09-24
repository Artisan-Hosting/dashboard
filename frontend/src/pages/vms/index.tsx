import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchVmList, sendVmAction } from '@/lib/api';
import { VmListItem, VmActionType } from '@/lib/types';
import { Sidebar } from '@/components/header';
import LoadingOverlay from '@/components/loading';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { toast, Toaster } from 'react-hot-toast';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function VmListPage() {
  const [vms, setVms] = useState<VmListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const previousStatusRef = useRef<Record<number, string>>({});

  // When we perform an action, we may want to show a quick “loading” state per‐VM:
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const updateVmList = useCallback(
    async (notify = false) => {
      try {
        const list = await fetchVmList();
        if (!list) return;

        if (notify) {
          list.forEach((vm) => {
            const prev = previousStatusRef.current[vm.vm_id];
            if (prev && prev !== vm.status) {
              toast(`VM ${vm.vm_id} is now ${vm.status}`, {
                icon: vm.status === 'running' ? '✅' : '⚠️',
              });
            }
            previousStatusRef.current[vm.vm_id] = vm.status;
          });
        } else {
          list.forEach((vm) => {
            previousStatusRef.current[vm.vm_id] = vm.status;
          });
        }

        setVms(list);
      } catch (err) {
        console.error(notify ? 'Error refreshing VMs:' : 'Error fetching VMs', err);
      } finally {
        if (!notify) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    updateVmList(false);
  }, [updateVmList]);

  useEffect(() => {
    const iv = setInterval(() => updateVmList(true), 5000);
    return () => clearInterval(iv);
  }, [updateVmList]);

  // If you want to refresh the VM list after an action, call this helper:
  const reloadVmList = async () => {
    await updateVmList(true);
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
      <Toaster position="bottom-right" />
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
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
                <p
                  className={`text-sm mt-1 ${
                    vm.status === 'running'
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {vm.status.toUpperCase()}
                </p>

                <div className="mt-2 text-sm text-gray-300 space-y-1 mb-4">
                  <p>CPU: {(vm.cpu * 100).toFixed(1)}%</p>
                  <p>RAM: {vm.maxmem > 0 ? ((vm.mem / vm.maxmem) * 100).toFixed(1) : '0.0'}%</p>
                  <p>Uptime: {formatUptime(vm.uptime)}</p>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['start', 'stop', 'restart', 'shutdown'] as VmActionType[]).map(
                    (action) => (
                      <button
                        key={action}
                        onClick={() => handleAction(vm.vm_id, action)}
                        disabled={isBusy}
                        className={`
                          flex-1
                          px-3 py-1 text-sm font-medium rounded-full
                          ${
                            isBusy
                              ? 'bg-gray-500 cursor-not-allowed'
                              : 'btn-brand'
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
