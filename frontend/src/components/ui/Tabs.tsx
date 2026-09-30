import { ReactNode } from 'react';

export interface TabDef {
  key: string;
  label: string;
}

// Tab strip + panel, matching console.css's `.tabs`/.tabpanel` (see
// redesign-and-blend/project.html's Config/Secrets/Logs/Source tabs).
// Panels are kept mounted (hidden, not unmounted) so per-tab state (a
// textarea draft, a scroll position) survives switching tabs.
export function Tabs({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

export function TabPanel({ tabKey, active, children }: { tabKey: string; active: string; children: ReactNode }) {
  return (
    <section className="tabpanel" role="tabpanel" hidden={active !== tabKey}>
      {children}
    </section>
  );
}
