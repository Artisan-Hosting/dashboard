import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useElevatedSession } from '@/hooks/useElevatedSession';
import {
  listDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
  listCertificates,
  forceRenewCertificate,
  validateFreeformVhost,
  applyFreeformVhost,
  fetchAdoptedVhosts,
  fetchWithAuth,
} from '@/lib/api';
import {
  DomainEntry,
  DnsRecord,
  Certificate,
  FreeformLintFinding,
  ValidateFreeformVhostResponse,
  ApplyFreeformVhostResponse,
} from '@/lib/types';
import { Button, Field, Pill } from '@/components/ui';

export function DnsRecordsSection({ domain }: { domain: DomainEntry }) {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<DnsRecord>>({
    type: 'A',
    name: '',
    content: '',
    ttl: 300,
    proxied: false,
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDnsRecords(domain.id);
      setRecords(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DNS records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [domain.id]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleCreate = async () => {
    try {
      const record = await createDnsRecord(domain.id, newRecord as any);
      toast.success(`Created ${record.type} record for ${record.name}`);
      setNewRecord({ type: 'A', name: '', content: '', ttl: 300, proxied: false });
      setShowCreate(false);
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create DNS record');
    }
  };

  const elevated = useElevatedSession();
  const handleDelete = async (recordId: string) => {
    try {
      await deleteDnsRecord(domain.id, recordId, elevated.token ?? '');
      toast.success('Record deleted');
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete DNS record');
    }
  };

  const handleDeleteConfirm = (recordId: string) => {
    if (confirm('Are you sure you want to delete this DNS record? This requires an elevated session.')) {
      handleDelete(recordId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">DNS Records</h3>
        <Button small onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Record'}
        </Button>
      </div>

      {showCreate && (
        <div className="card p-4 space-y-3">
          <h4 className="font-medium">Create New Record</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                className="w-full p-2 border rounded bg-background text-foreground"
                value={newRecord.type}
                onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as any })}
              >
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="TXT">TXT</option>
                <option value="MX">MX</option>
                <option value="SRV">SRV</option>
                <option value="NS">NS</option>
                <option value="CAA">CAA</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Field
                value={newRecord.name}
                onChange={(e: any) => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder="e.g. www or @ for root"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <Field
                value={newRecord.content}
                onChange={(e: any) => setNewRecord({ ...newRecord, content: e.target.value })}
                placeholder="IP address, domain, or text value"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">TTL (seconds)</label>
              <Field
                type="number"
                value={newRecord.ttl ?? 300}
                onChange={(e: any) => setNewRecord({ ...newRecord, ttl: parseInt(e.target.value) || 300 })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRecord.proxied ?? false}
                  onChange={(e) => setNewRecord({ ...newRecord, proxied: e.target.checked })}
                />
                Proxy through Cloudflare
              </label>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="note bad">{error}</p>}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading DNS records...</p>
        ) : records.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No DNS records found.</p>
        ) : (
          records.map((record) => (
            <div key={record.id} className="card-hover p-3 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                    {record.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                    {record.type} — TTL: {record.ttl}s
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded text-sm" style={{ background: 'var(--muted)', color: 'var(--bg)' }}>
                    {record.content}
                  </span>
                  <Pill status={record.proxied ? 'active' : 'idle'} label={record.proxied ? 'Proxied' : 'DNS Only'} />
                  <Button small variant="ghost" onClick={() => handleDeleteConfirm(record.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CertificateSection({ domain }: { domain: DomainEntry }) {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);
  const [daysToExpiry, setDaysToExpiry] = useState(30);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [keyType, setKeyType] = useState<'ecc' | 'rsa'>('ecc');
  const elevated = useElevatedSession();

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCertificates(
        domain.organization_id || undefined,
        showExpiringOnly ? daysToExpiry : undefined
      );
      setCerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates');
      setCerts([]);
    } finally {
      setLoading(false);
    }
  }, [domain.organization_id, showExpiringOnly, daysToExpiry]);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const handleForceRenew = async (domainId: string) => {
    setRenewing(domainId);
    try {
      await forceRenewCertificate(domainId, keyType, elevated.token ?? '');
      toast.success(`Certificate renewal initiated for ${domainId}`);
      loadCerts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to force certificate renewal');
    } finally {
      setRenewing(null);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold">Certificates</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExpiringOnly}
              onChange={(e) => setShowExpiringOnly(e.target.checked)}
            />
            Show expiring within
          </label>
          <Field
            type="number"
            value={daysToExpiry}
            onChange={(e: any) => setDaysToExpiry(parseInt(e.target.value) || 30)}
            className="w-20"
          />
          <span className="text-sm">days</span>
          <Button small onClick={loadCerts}>Refresh</Button>
        </div>
      </div>

      {error && <p className="note bad">{error}</p>}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading certificates...</p>
        ) : certs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No certificates found.</p>
        ) : (
          certs.map((cert, i) => (
            <div key={i} className="card-hover p-3 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">Domain: {cert.domain_id}</p>
                  <div className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
                    <p>Serial: {cert.serial}</p>
                    <p>Key Type: {cert.key_type.toUpperCase()}</p>
                    <p>Valid from: {formatTimestamp(cert.not_before)}</p>
                    <p>Expires: {formatTimestamp(cert.not_after)}</p>
                    {cert.last_error && <p style={{ color: 'var(--warn)' }}>Last Error: {cert.last_error}</p>}
                    <p>Fail Count: {cert.fail_count}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--muted)', color: 'var(--bg)' }}>
                    Renew after: {formatTimestamp(cert.renew_after)}
                  </span>
                  <Button
                    small
                    onClick={() => handleForceRenew(domain.id)}
                    disabled={!!renewing}
                  >
                    {renewing === domain.id ? 'Renewing...' : 'Force Renew'}
                  </Button>
                </div>
              </div>
              {i < certs.length - 1 && <div className="h-px bg-line" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function VhostEditorSection({ domain }: { domain: DomainEntry }) {
  const [vhostContent, setVhostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidateFreeformVhostResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyFreeformVhostResponse | null>(null);
  const [dryRun, setDryRun] = useState(false);

  const loadVhost = useCallback(async () => {
    setLoading(true);
    try {
      const vhosts = await fetchAdoptedVhosts(domain.organization_id || undefined);
      const domainVhost = vhosts.find((v) => v.domain_fqdn === domain.fqdn);
      
      if (domainVhost) {
        const res = await fetchWithAuth(`proxy/domains/vhost-content?path=${encodeURIComponent(domainVhost.path)}`);
        if (res.data?.content) {
          setVhostContent(res.data.content);
        } else {
          setVhostContent('');
        }
      } else {
        setVhostContent('');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vhost');
      setVhostContent('');
    } finally {
      setLoading(false);
    }
  }, [domain.id, domain.fqdn, domain.organization_id]);

  useEffect(() => {
    loadVhost();
  }, [loadVhost]);

  const handleValidate = async () => {
    setValidating(true);
    setValidationError(null);
    setValidation(null);
    try {
      const result = await validateFreeformVhost(domain.id, vhostContent);
      setValidation(result);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to validate vhost');
    } finally {
      setValidating(false);
    }
  };

  const elevated = useElevatedSession();
  const handleApply = async () => {
    if (!vhostContent) {
      toast.error('Vhost content is empty');
      return;
    }
    setApplying(true);
    setApplyResult(null);
    try {
      const result = await applyFreeformVhost(domain.id, vhostContent, elevated.token ?? '', dryRun);
      setApplyResult(result);
      toast.success(dryRun ? 'Dry run completed' : 'Vhost applied successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply vhost');
    } finally {
      setApplying(false);
    }
  };

  const formatSeverity = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-[color:var(--bad)] bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]';
      case 'warn':
        return 'text-[color:var(--warn)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]';
      case 'info':
        return 'text-[color:var(--info)] bg-[color-mix(in_srgb,var(--info)_12%,transparent)]';
      default:
        return 'text-[color:var(--text)]';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold">Freeform Vhost Editor</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry Run
          </label>
          <Button small onClick={loadVhost}>Reload</Button>
          <Button small variant="primary" onClick={handleValidate} disabled={validating}>
            {validating ? 'Validating...' : 'Validate'}
          </Button>
          <Button small variant="primary" onClick={handleApply} disabled={applying || !vhostContent}>
            {applying ? 'Applying...' : dryRun ? 'Dry Run' : 'Apply'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <textarea
            className="w-full h-96 p-3 font-mono text-sm rounded bg-background text-foreground border"
            value={vhostContent}
            onChange={(e) => setVhostContent(e.target.value)}
            placeholder="# Enter your nginx server block here..."
          />
          {error && <p className="note bad">{error}</p>}
        </div>

        <div className="space-y-4">
          {validation && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium">Validation Results</h4>
              <div className={`p-2 rounded ${validation.nginx_ok ? 'bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[color:var(--ok)]' : 'bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-[color:var(--bad)]'}`}>
                <p className="font-medium">{validation.nginx_ok ? 'nginx syntax OK' : 'nginx syntax errors found'}</p>
                {validation.nginx_output && <p className="text-xs mt-1 font-mono whitespace-pre-wrap">{validation.nginx_output}</p>}
              </div>
              {validation.new_findings.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Findings</h5>
                  {validation.new_findings.map((finding, i) => (
                    <div key={i} className={`p-2 rounded text-sm ${formatSeverity(finding.severity)}`}>
                      <p className="font-medium">{finding.code}</p>
                      <p className="text-xs">{finding.message}</p>
                    </div>
                  ))}
                </div>
              )}
              {validation.corrected && validation.corrected !== vhostContent && (
                <div>
                  <h5 className="text-sm font-medium">Corrected</h5>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded mt-1">
                    {validation.corrected}
                  </pre>
                </div>
              )}
            </div>
          )}

          {applyResult && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium">Apply Result</h4>
              <div className={`p-2 rounded ${applyResult.applied ? 'bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[color:var(--ok)]' : 'bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-[color:var(--warn)]'}`}>
                <p className="font-medium">{applyResult.applied ? (dryRun ? 'Dry run successful' : 'Applied successfully') : 'Apply not performed'}</p>
              </div>
              {applyResult.diff && (
                <div>
                  <h5 className="text-sm font-medium">Diff</h5>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded mt-1">
                    {applyResult.diff}
                  </pre>
                </div>
              )}
            </div>
          )}

          {validationError && <p className="note bad">{validationError}</p>}
        </div>
      </div>
    </div>
  );
}

