import { TopBar } from '@/components/topbar';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Panel } from '@/components/ui';

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

        <Panel title="Not available yet">
          <p style={{ color: 'var(--text)' }}>
            Standalone VMs aren't served by the platform's API yet, so there's nothing this
            page can show. This isn't a bug -- the feature is planned but not built.
          </p>
        </Panel>
      </main>
    </div>
  );
}
