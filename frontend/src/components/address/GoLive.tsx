import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Field } from '@/components/ui';
import { fetchDomains } from '@/lib/api';
import {
  AddressError,
  AddressState,
  AddressView,
  RecordToAdd,
  checkAddress,
  checkFreeName,
  fetchAddresses,
  setAddress,
} from '@/lib/address';
import type { DomainEntry } from '@/lib/types';

type Mode = 'free' | 'owned' | 'buy';

// Where an address has got to, in the order things happen. `app_down` is the last step failing, not a step.
const ORDER: { states: AddressState[]; label: string }[] = [
  { states: ['reserving'], label: 'Reserve the name' },
  { states: ['dns'], label: 'Point it at our edge' },
  { states: ['certificate'], label: 'Get a security certificate' },
  { states: ['not_attached'], label: 'Connect it to your app' },
  { states: ['live', 'app_down'], label: 'Check that it answers' },
];

const POLL_MS = 4000;
const POLL_FOR_MS = 15 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function stepStatus(state: AddressState, i: number): 'done' | 'doing' | 'bad' | 'pending' {
  const at = ORDER.findIndex((s) => s.states.includes(state));
  if (state === 'failed') return i === 0 ? 'bad' : 'pending';
  if (at < 0) return 'pending';
  if (state === 'live') return 'done';
  if (state === 'app_down' && i === at) return 'bad';
  return i < at ? 'done' : i === at ? 'doing' : 'pending';
}

/** Gives a running app an address and shows it coming up. The server and port are never typed:
 *  Portal looks both up. */
export function GoLive({ projectId, appLabel, onLive }: { projectId: string; appLabel?: string; onLive?: (fqdn: string) => void }) {
  const [mode, setMode] = useState<Mode>('free');
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [free, setFree] = useState<{ available: boolean; reason: string } | null>(null);
  const [owned, setOwned] = useState<DomainEntry[]>([]);
  const [domain, setDomain] = useState('');
  const [host, setHost] = useState<'apex' | 'sub'>('sub');
  const [sub, setSub] = useState('');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<RecordToAdd[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [watching, setWatching] = useState('');
  const [view, setView] = useState<AddressView | null>(null);
  const [existing, setExisting] = useState<AddressView[]>([]);
  const alive = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // The zone, and what this app already has.
  useEffect(() => {
    checkFreeName('')
      .then((a) => alive.current && setZone(a.free_zone))
      .catch(() => {});
    fetchAddresses(projectId)
      .then((l) => alive.current && setExisting(l.addresses))
      .catch(() => {});
    fetchDomains({ limit: 200 })
      .then((p) => alive.current && setOwned(p.entries.filter((d) => d.status === 'active')))
      .catch(() => {});
  }, [projectId]);

  // As-you-type availability, with a late answer for an earlier name thrown away.
  useEffect(() => {
    setFree(null);
    const n = name.trim();
    if (!n) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      checkFreeName(n)
        .then((a) => {
          if (alive.current && mine === seq.current) setFree({ available: a.available, reason: a.reason });
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [name]);

  const watch = useCallback(
    async (fqdn: string) => {
      setWatching(fqdn);
      const until = Date.now() + POLL_FOR_MS;
      while (alive.current && Date.now() < until) {
        try {
          // The check asks ais_domains to look again right now rather than wait for its next pass.
          const v = await checkAddress(projectId, fqdn);
          if (!alive.current) return;
          setView(v);
          if (v.state === 'live') {
            onLive?.(fqdn);
            return;
          }
          if (v.state === 'failed') return;
        } catch (err: any) {
          if (alive.current) setError(err?.message ?? 'Still watching.');
        }
        await sleep(POLL_MS);
      }
    },
    [projectId, onLive],
  );

  const fqdn =
    mode === 'free'
      ? name.trim() && zone
        ? `${name.trim().toLowerCase()}.${zone}`
        : ''
      : domain === '__other'
        ? other.trim().toLowerCase()
        : domain
          ? host === 'apex'
            ? domain
            : sub.trim()
              ? `${sub.trim().toLowerCase()}.${domain}`
              : ''
          : '';

  const problem =
    mode === 'free'
      ? !name.trim()
        ? 'Choose a name.'
        : free && !free.available
          ? free.reason
          : ''
      : mode === 'owned' && !fqdn
        ? 'Choose a domain, and a subdomain if you want one.'
        : '';

  const go = async () => {
    setError('');
    setRecords([]);
    setNotes([]);
    setView(null);
    setBusy(true);
    try {
      const r = await setAddress(projectId, mode === 'free' ? { mode: 'free', name: name.trim() } : { mode: 'custom', fqdn });
      setRecords(r.required_records);
      setNotes(r.notes);
      void watch(r.fqdn);
    } catch (err: any) {
      setError(err instanceof AddressError ? err.message : 'We could not set that address up.');
    } finally {
      setBusy(false);
    }
  };

  const state: AddressState = view?.state ?? 'reserving';

  if (watching) {
    return (
      <div className="space-y-3">
        <h2>Setting up <span className="mono">{watching}</span></h2>
        <ol className="progress" aria-live="polite">
          {ORDER.map((s, i) => (
            <li key={s.label} data-st={stepStatus(state, i)}>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
        {view && state !== 'live' && <p className="sub">{view.message}</p>}
        {error && <p className="note bad">{error}</p>}
        {records.length > 0 && (
          <div className="records">
            <p>Add {records.length === 1 ? 'this record' : 'these records'} where your domain&rsquo;s DNS is managed. We check again every few seconds.</p>
            <table>
              <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={`${r.type}${r.name}${r.content}`}><td>{r.type}</td><td>{r.name}</td><td>{r.content}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {notes.map((n) => <p key={n} className="hint">{n}</p>)}
        {state === 'live' && (
          <div className="live">
            <p className="addr"><a href={`https://${watching}`} target="_blank" rel="noreferrer">{watching}</a></p>
            <p className="sub">Live. Anyone can open it.</p>
          </div>
        )}
        {state === 'app_down' && <p className="note bad">The name works but your app is not answering. Check its logs on the app page.</p>}
        <div className="flex flex-wrap gap-2">
          {state !== 'live' && <Button variant="ghost" onClick={() => void watch(watching)}>Check again</Button>}
          <Button variant="ghost" onClick={() => { setWatching(''); setView(null); }}>Use a different address</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2>Give {appLabel ? <span className="mono">{appLabel}</span> : 'your app'} an address</h2>
      {existing.length > 0 && (
        <p className="sub">
          Already: {existing.map((a) => <span key={a.fqdn} className="mono">{a.fqdn} </span>)}
        </p>
      )}
      <div className="opts" role="radiogroup" aria-label="Where should it live?">
        {([
          ['free', 'A free address', zone ? `Live in seconds on ${zone}. Switch to your own later.` : 'Live in seconds. Switch to your own later.'],
          ['owned', 'A domain I have', 'Bought here or brought by you. Use the domain itself or add a subdomain.'],
          ['buy', 'Buy a new domain', 'Search, pay, and we attach it to this app when it is ready.'],
        ] as [Mode, string, string][]).map(([k, t, d]) => (
          <button key={k} type="button" className="opt" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}>
            <b>{t}</b>
            <small>{d}</small>
          </button>
        ))}
      </div>

      <div className="addr-detail">
        {mode === 'free' && (
          <>
            <div className="addr-row">
              <label className="sr-only" htmlFor="free-name">Name</label>
              <Field id="free-name" sans autoComplete="off" spellCheck={false} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="my-shop" />
              <span className="suffix">{zone ? `.${zone}` : ''}</span>
            </div>
            <p className="hint">We write the DNS, get the certificate and connect it to the app. Nothing for you to do.</p>
          </>
        )}
        {mode === 'owned' && (
          <>
            <div>
              <label htmlFor="dom">Domain</label>
              <select id="dom" className="field field-sans" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">Choose…</option>
                {owned.map((d) => <option key={d.id} value={d.fqdn}>{d.fqdn}</option>)}
                <option value="__other">Another domain I own…</option>
              </select>
            </div>
            {domain === '__other' ? (
              <div>
                <label htmlFor="other">Full hostname</label>
                <Field id="other" sans autoComplete="off" spellCheck={false} value={other} onChange={(e) => setOther(e.target.value)} placeholder="shop.example.com" />
                <p className="hint">We will show you the DNS records to add, then check them.</p>
              </div>
            ) : domain ? (
              <div className="addr-row">
                <Button type="button" variant="ghost" small aria-pressed={host === 'apex'} onClick={() => setHost('apex')}>{domain}</Button>
                <Button type="button" variant="ghost" small aria-pressed={host === 'sub'} onClick={() => setHost('sub')}>A subdomain</Button>
                {host === 'sub' && (
                  <>
                    <label className="sr-only" htmlFor="sub">Subdomain</label>
                    <Field id="sub" sans autoComplete="off" spellCheck={false} value={sub} onChange={(e) => setSub(e.target.value)} placeholder="shop" />
                    <span className="suffix">.{domain}</span>
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
        {mode === 'buy' && (
          <p>You will search for a name and pay on the next page. When the domain is ready we point it at this app for you, so you can come straight back to a live site.</p>
        )}
      </div>

      {error && <p className="note bad" role="alert">{error}</p>}
      <div className="addr-actions">
        {mode === 'buy' ? (
          <Link href={`/domains?app=${encodeURIComponent(projectId)}`} className="btn btn-primary">Search for a domain</Link>
        ) : (
          <Button onClick={go} disabled={busy || !!problem}>{busy ? 'Setting up…' : 'Set it up'}</Button>
        )}
        {mode !== 'buy' && (
          <span className={`hint${problem ? ' bad' : ''}`}>
            {problem || (fqdn ? <>Visitors will find it at <b className="mono">{fqdn}</b></> : '')}
          </span>
        )}
      </div>
    </div>
  );
}
