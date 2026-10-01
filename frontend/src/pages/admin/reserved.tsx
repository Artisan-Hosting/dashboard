import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/topbar';
import { RequireSuper } from '@/components/requireAdmin';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { Button, Field } from '@/components/ui';
import { ReservedRule, addReserved, describeRule, listReserved, removeReserved } from '@/lib/address';

type Kind = 'exact' | 'prefix' | 'range';

const CUSTOMER_IDS = { kind: 'range', prefix: 'c', digits: 8, min_value: 0, max_value: 99_999_999, note: 'customer ids' };

// Names nobody may claim as a free address. Super only: the server refuses anyone else, this page
// only hides what would be refused.
export default function ReservedNamesPage() {
  const [zone, setZone] = useState('');
  const [rules, setRules] = useState<ReservedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<Kind>('range');
  const [prefix, setPrefix] = useState('');
  const [digits, setDigits] = useState('8');
  const [min, setMin] = useState('0');
  const [max, setMax] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const l = await listReserved();
      setZone(l.free_zone);
      setRules(l.rules);
      setError('');
    } catch (err: any) {
      setError(err?.message ?? 'Could not load the reserved names');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (what: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await what();
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await addReserved({
        kind,
        prefix: prefix.trim().toLowerCase(),
        ...(kind === 'range' ? { digits: Number(digits), min_value: Number(min), max_value: Number(max) } : {}),
        note: note.trim(),
      });
      setPrefix('');
      setNote('');
    });
  };

  const hasCustomerIds = rules.some(
    (r) => r.kind === 'range' && r.prefix === 'c' && r.digits === 8 && r.min_value === 0 && r.max_value === 99_999_999,
  );

  // What the form would reserve, in the same words as the table, so a mistake is visible before saving.
  const preview =
    kind === 'range' && prefix && Number(digits) >= 1 && max !== ''
      ? describeRule({ id: 0, kind, prefix, digits: Number(digits), min_value: Number(min), max_value: Number(max), note: '', created_by: '', created_at: 0 })
      : kind !== 'range' && prefix
        ? describeRule({ id: 0, kind, prefix, digits: 0, min_value: 0, max_value: 0, note: '', created_by: '', created_at: 0 })
        : '';

  return (
    <RequireSuper>
      <div className="relative min-h-screen bg-page text-foreground">
        <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
        <main className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
          <div>
            <p className="sub"><Link href="/admin">Admin</Link></p>
            <h1>Reserved names</h1>
            <p className="sub">
              Names nobody can claim as a free address{zone ? <> on <span className="mono">{zone}</span></> : null}. A rule applies to the next claim; nothing needs restarting.
            </p>
          </div>

          {error && <p className="note bad" role="alert">{error}</p>}

          {!loading && !hasCustomerIds && (
            <div className="callout">
              The customer ids <span className="mono">c00000000</span> to <span className="mono">c99999999</span> are not reserved yet.{' '}
              <Button small disabled={busy} onClick={() => void run(() => addReserved(CUSTOMER_IDS))}>Reserve them</Button>
            </div>
          )}

          <section className="card p-6 space-y-3">
            <h2>Current rules</h2>
            {loading ? (
              <p className="sub">Loading…</p>
            ) : rules.length === 0 ? (
              <p className="sub">Nothing is reserved.</p>
            ) : (
              <div className="scroll-x">
                <table className="tbl">
                  <thead><tr><th>Reserves</th><th>Kind</th><th>Note</th><th /></tr></thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{describeRule(r)}{zone ? <span className="sub">.{zone}</span> : null}</td>
                        <td>{r.kind}</td>
                        <td>{r.note}</td>
                        <td>
                          <Button
                            small
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Stop reserving ${describeRule(r)}? Customers will be able to claim those names.`)) void run(() => removeReserved(r.id));
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <form className="card p-6 form" onSubmit={add} noValidate>
            <h2>Add a rule</h2>
            <div>
              <label htmlFor="kind">Kind</label>
              <select id="kind" className="field field-sans" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="range">A prefix and a range of numbers</option>
                <option value="prefix">Anything starting with…</option>
                <option value="exact">One exact name</option>
              </select>
            </div>
            <div>
              <label htmlFor="prefix">{kind === 'exact' ? 'Name' : 'Prefix'}</label>
              <Field id="prefix" sans autoComplete="off" spellCheck={false} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder={kind === 'range' ? 'c' : kind === 'prefix' ? 'ais-' : 'www'} />
            </div>
            {kind === 'range' && (
              <div className="addr-row">
                <div><label htmlFor="digits">Digits</label><Field id="digits" sans inputMode="numeric" value={digits} onChange={(e) => setDigits(e.target.value)} /></div>
                <div><label htmlFor="min">From</label><Field id="min" sans inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></div>
                <div><label htmlFor="max">To</label><Field id="max" sans inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="99999999" /></div>
              </div>
            )}
            <div>
              <label htmlFor="note">Note <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</small></label>
              <Field id="note" sans value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {preview && <p className="hint">This reserves <b className="mono">{preview}</b>{zone ? <span className="mono">.{zone}</span> : null}</p>}
            <div><Button type="submit" disabled={busy || !prefix.trim()}>Reserve</Button></div>
          </form>
        </main>
      </div>
    </RequireSuper>
  );
}
