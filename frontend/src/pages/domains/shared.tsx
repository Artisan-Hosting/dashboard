import { useEffect, useState, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { TopBar } from '@/components/topbar';
import { isSuperRole } from '@/components/requireAdmin';
import LoadingOverlay from '@/components/loading';
import { useUser } from '@/hooks/useUser';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { fetchDomains, fetchWithAuth } from '@/lib/api';
import { listReserved, provisionServiceHost, parkSharedZone } from '@/lib/address';
import { DomainEntry } from '@/lib/types';
import { Button, Field, Pill, SelectField, Tabs, TabPanel } from '@/components/ui';
import { DnsRecordsSection, CertificateSection, VhostEditorSection } from '@/components/domains/DomainSections';

interface Organization {
  id: string;
  name: string;
}

const SERVICES = [{ key: 'kae', label: 'Kaelum' }];

const serviceOf = (fqdn: string) => SERVICES.find((s) => fqdn.startsWith(`${s.key}-`))?.label ?? 'Free address';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button small variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">{children}</div>
      </div>
    </div>
  );
}

function ProvisionDialog({ orgs, onClose, onDone }: { orgs: Organization[]; onClose: () => void; onDone: () => void }) {
  const [service, setService] = useState(SERVICES[0].key);
  const [orgId, setOrgId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ fqdn: string; notes: string[] } | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const done = await provisionServiceHost({ service, organization_id: orgId, project_id: projectId.trim() });
      setResult(done);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not provision that host');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Provision service host" onClose={onClose}>
      {result ? (
        <>
          <p className="font-medium" style={{ fontFamily: 'var(--font-mono)' }}>{result.fqdn}</p>
          <ul className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
            {result.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </>
      ) : (
        <>
          <SelectField value={service} onChange={(e) => setService(e.target.value)}>
            {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.key})</option>)}
          </SelectField>
          <SelectField value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Organization</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
          </SelectField>
          <Field sans placeholder="project id (session manager)" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <Button onClick={submit} disabled={busy || !orgId || !projectId.trim()}>{busy ? 'Provisioning...' : 'Provision'}</Button>
        </>
      )}
    </Modal>
  );
}

function ParkDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[] | null>(null);

  const run = async (dry: boolean) => {
    setBusy(true);
    try {
      setNotes((await parkSharedZone(dry)).notes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not park the zone');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Park the zone" onClose={onClose}>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => run(true)} disabled={busy}>Dry run</Button>
        <Button onClick={() => run(false)} disabled={busy}>{busy ? 'Working...' : 'Park it'}</Button>
      </div>
      {notes && (
        <ul className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </Modal>
  );
}

export default function SharedDomainPage() {
  const { role } = useUser();
  const isSuper = isSuperRole(role);

  const [zone, setZone] = useState('');
  const [zoneDomain, setZoneDomain] = useState<DomainEntry | null>(null);
  const [hosts, setHosts] = useState<DomainEntry[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [tab, setTab] = useState('hosts');
  const [dialog, setDialog] = useState<'provision' | 'park' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const z = (await listReserved()).free_zone;
      setZone(z);
      const page = await fetchDomains({ limit: 500 });
      const all = page.entries ?? [];
      setZoneDomain(all.find((d) => d.fqdn === z) ?? null);
      setHosts(all.filter((d) => d.fqdn.endsWith(`.${z}`)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the shared domain');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    load();
    fetchWithAuth('proxy/admin/organizations')
      .then((res) => setOrgs(res.data || []))
      .catch(() => setOrgs([]));
  }, [isSuper, load]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? id;
  const shown = hosts.filter(
    (h) => (!serviceFilter || serviceOf(h.fqdn) === serviceFilter) && (!orgFilter || h.organization_id === orgFilter),
  );

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <Toaster position="bottom-right" />
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-3xl font-bold text-brand">Shared domain server</h1>
          {isSuper && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDialog('park')}>Park the zone</Button>
              <Button onClick={() => setDialog('provision')}>Provision service host</Button>
            </div>
          )}
        </div>

        {!isSuper ? (
          <p className="note bad">Operators only.</p>
        ) : (
          <div className="card p-6 space-y-3 relative">
            {loading && <LoadingOverlay />}
            {error && <p className="note bad">{error}</p>}
            {!error && !zone && !loading && <p className="note bad">free_zone.zone is not set on the domain service.</p>}
            <Tabs
              tabs={[
                { key: 'hosts', label: 'Hosts' },
                { key: 'dns', label: 'DNS Records' },
                { key: 'certs', label: 'Certificates' },
                { key: 'vhost', label: 'Vhost Editor' },
              ]}
              active={tab}
              onChange={setTab}
            >
              <TabPanel tabKey="hosts" active={tab}>
                <div className="flex flex-wrap gap-3 mb-3">
                  <SelectField value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-full sm:w-48">
                    <option value="">All services</option>
                    {SERVICES.map((s) => <option key={s.key} value={s.label}>{s.label}</option>)}
                    <option value="Free address">Free address</option>
                  </SelectField>
                  <SelectField value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="w-full sm:w-64">
                    <option value="">All organizations</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </SelectField>
                </div>
                <div className="space-y-2">
                  {shown.map((h) => (
                    <div key={h.id} className="card-hover p-3 flex flex-wrap justify-between items-center gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate" style={{ fontFamily: 'var(--font-mono)' }}>{h.fqdn}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                          {serviceOf(h.fqdn)} -- {h.organization_id ? `${orgName(h.organization_id)} (${h.organization_id})` : 'unassigned'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill status={h.status} />
                        <Pill status={h.serves_tls ? 'active' : 'idle'} label={h.serves_tls ? 'TLS' : 'no TLS'} />
                      </div>
                    </div>
                  ))}
                  {shown.length === 0 && !loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>No hosts.</p>}
                </div>
              </TabPanel>
              <TabPanel tabKey="dns" active={tab}>
                {zoneDomain ? <DnsRecordsSection domain={zoneDomain} /> : <ZoneMissing zone={zone} />}
              </TabPanel>
              <TabPanel tabKey="certs" active={tab}>
                {zoneDomain ? <CertificateSection domain={zoneDomain} /> : <ZoneMissing zone={zone} />}
              </TabPanel>
              <TabPanel tabKey="vhost" active={tab}>
                {zoneDomain ? <VhostEditorSection domain={zoneDomain} /> : <ZoneMissing zone={zone} />}
              </TabPanel>
            </Tabs>
          </div>
        )}
      </main>
      {dialog === 'provision' && <ProvisionDialog orgs={orgs} onClose={() => setDialog(null)} onDone={load} />}
      {dialog === 'park' && <ParkDialog onClose={() => { setDialog(null); load(); }} />}
    </div>
  );
}

function ZoneMissing({ zone }: { zone: string }) {
  return <p className="text-sm" style={{ color: 'var(--muted)' }}>{zone || 'The shared zone'} is not recorded as a managed domain yet.</p>;
}
