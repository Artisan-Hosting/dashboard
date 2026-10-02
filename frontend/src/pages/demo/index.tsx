import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { DemoEdge, DemoShell, startUrl } from '@/components/demo/DemoShell';
import { Button, Meter, Panel, Pill, TabPanel, Tabs, Term } from '@/components/ui';
import { formatBytes } from '@/components/billing/format';
import { COMING_SOON, DEMO_PROJECTS, DemoProject } from '@/lib/demoData';

const TABS = [
  { key: 'config', label: 'Config' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'logs', label: 'Logs' },
  { key: 'source', label: 'Source' },
];

export default function DemoPage() {
  const router = useRouter();
  const selected = typeof router.query.p === 'string' ? router.query.p : '';
  const project = DEMO_PROJECTS.find((p) => p.name === selected);

  return (
    <DemoShell>
      {project ? <ProjectView key={project.name} project={project} /> : <ProjectList />}
    </DemoShell>
  );
}

function ProjectList() {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-8 text-brand">Current Projects</h2>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DEMO_PROJECTS.map((p) => (
          <div key={p.name} className="card-hover p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xl font-semibold text-brand">{p.label}</p>
                <div className="mt-1"><Pill status="running" /></div>
              </div>
              <Link className="btn btn-primary btn-sm" href={`/demo?p=${p.name}`}>Details →</Link>
            </div>
            <div className="mb-4 text-sm">
              {p.addresses.map((a) => (
                <p key={a.fqdn} className="flex items-center gap-2">
                  <span className="mono">{a.fqdn}</span>
                  <span className="pill" data-s={a.state === 'live' ? 'live' : 'waiting'}>{a.state === 'live' ? 'Live' : 'Setting up'}</span>
                </p>
              ))}
            </div>
            <div className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
              <p>Total CPU Time: <span className="font-medium" style={{ color: 'var(--strong)' }}>{p.usage.totalCpu.toFixed(2)}</span> hrs</p>
              <p>Avg RAM: <span className="font-medium" style={{ color: 'var(--strong)' }}>{p.usage.avgMemory.toFixed(2)}</span> MB</p>
              <p>Peak RAM: <span className="font-medium" style={{ color: 'var(--strong)' }}>{p.usage.peakMemory.toFixed(2)}</span> MB</p>
            </div>
          </div>
        ))}
      </div>
      <DemoEdge text="This is where your own projects would appear, once you add a repository." from="list" cta="Add yours" />

      <section style={{ marginTop: 40 }} aria-labelledby="soon-h">
        <h3 id="soon-h" className="text-lg font-semibold" style={{ color: 'var(--strong)' }}>
          Coming soon <span className="tag">Not available yet</span>
        </h3>
        <p className="muted text-sm mt-1">Designed, but not built yet. None of this is part of the platform today.</p>
        <div className="soon-list">
          {COMING_SOON.map((c) => (
            <div key={c.title}>
              <strong>{c.title}</strong>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ProjectView({ project }: { project: DemoProject }) {
  const [tab, setTab] = useState('config');
  const [instances, setInstances] = useState(project.instances);
  const [edge, setEdge] = useState<{ text: string; from: string } | null>(null);
  const u = project.usage;

  // Start / Stop / Restart are real controls. Here they only change local
  // sample state, which is lost on reload.
  const command = (ids: string[], cmd: 'start' | 'stop' | 'restart') => {
    const next = cmd === 'stop' ? 'stopped' : 'running';
    setInstances((cur) => cur.map((i) => (ids.includes(i.id) ? { ...i, status: next } : i)));
    setEdge({ text: `That was only a sample ${cmd}. On your own project it ${cmd}s the real instance.`, from: 'restart' });
  };
  const all = instances.map((i) => i.id);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="text-sm"><Link href="/demo" className="text-brand hover:underline">← All projects</Link></p>
          <h1 className="text-3xl font-bold text-brand">{project.label}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {instances.length} instance{instances.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="grid3">
        <Panel
          title={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span>Instances</span>
              <div className="flex gap-2">
                <Button small variant="ghost" onClick={() => command(all, 'start')}>Start all</Button>
                <Button small variant="ghost" onClick={() => command(all, 'restart')}>Restart all</Button>
                <Button small variant="danger" onClick={() => command(all, 'stop')}>Stop all</Button>
              </div>
            </div>
          }
        >
          {instances.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ fontFamily: 'var(--font-mono)', color: 'var(--strong)' }}>{i.id}</p>
                <Pill status={i.status} />
              </div>
              <div className="flex gap-2 shrink-0">
                <Button small variant="ghost" onClick={() => command([i.id], 'start')}>Start</Button>
                <Button small variant="danger" onClick={() => command([i.id], 'stop')}>Stop</Button>
                <Button small variant="ghost" onClick={() => command([i.id], 'restart')}>Restart</Button>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Usage, last 30 days">
          <Meter label="Memory, average" value={u.avgMemory} valueLabel={`${u.avgMemory.toFixed(1)} MB`} included={u.peakMemory} includedLabel={`${u.peakMemory.toFixed(1)} MB`} capNote={`Peak was ${u.peakMemory.toFixed(1)} MB.`} />
          <Meter label="CPU, average" value={u.totalCpu} valueLabel={`${u.totalCpu.toFixed(2)} hrs`} included={u.peakCpu} includedLabel={`${u.peakCpu.toFixed(2)} hrs`} capNote={`Peak was ${u.peakCpu.toFixed(2)} hrs.`} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>TX {formatBytes(u.tx)} -- RX {formatBytes(u.rx)}</p>
        </Panel>

        <Panel title="Domains">
          {project.addresses.map((a) => (
            <div key={a.fqdn} className="py-2" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontFamily: 'var(--font-mono)' }}>{a.fqdn}</span>
                <span className="pill" data-s={a.state === 'live' ? 'live' : 'waiting'}>{a.state === 'live' ? 'Live' : 'Setting up'}</span>
              </div>
              {project.domains.map((d) => (
                <p key={d.fqdn} className="text-xs mt-1" style={{ color: 'var(--muted)' }}>certificate expires in {d.expiresInDays}d</p>
              ))}
            </div>
          ))}
          <Link href={startUrl('domains')} className="text-sm text-brand hover:underline">Manage domains</Link>
        </Panel>
      </div>

      {edge && <DemoEdge text={edge.text} from={edge.from} />}

      <div style={{ marginTop: 24 }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab}>
          <TabPanel tabKey="config" active={tab}>
            <textarea className="field mono" rows={6} defaultValue={project.config} aria-label="Config file" style={{ width: '100%' }} />
            <div style={{ marginTop: 12 }}>
              <Button small onClick={() => setEdge({ text: 'Saving writes the file on your real nodes. Create an account to edit your own.', from: 'drawer' })}>Save</Button>
            </div>
          </TabPanel>
          <TabPanel tabKey="secrets" active={tab}>
            <p className="muted text-sm mb-2">Names only. Values are never shown.</p>
            {project.secrets.map((s) => (
              <p key={s} className="mono py-1">{s}</p>
            ))}
            <div style={{ marginTop: 12 }}>
              <Button small onClick={() => setEdge({ text: 'Secrets are encrypted and stored for your project. Create an account to add one.', from: 'drawer' })}>Add secret</Button>
            </div>
          </TabPanel>
          <TabPanel tabKey="logs" active={tab}>
            <Term lines={project.logs} tall />
          </TabPanel>
          <TabPanel tabKey="source" active={tab}>
            <dl className="facts">
              <dt>Where the code lives</dt><dd>{project.source.server}</dd>
              <dt>Repository</dt><dd className="mono">{project.source.repo}</dd>
              <dt>Branch</dt><dd className="mono">{project.source.branch}</dd>
            </dl>
          </TabPanel>
        </Tabs>
      </div>
    </>
  );
}
