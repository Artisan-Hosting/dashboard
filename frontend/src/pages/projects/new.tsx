import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button, Field } from '@/components/ui';
import LoadingOverlay from '@/components/loading';
import { GoLive } from '@/components/address/GoLive';
import { isAdminRole } from '@/components/requireAdmin';
import { useUser } from '@/hooks/useUser';
import {
  Deployment,
  ProjectError,
  RepoInspection,
  STATE_LABEL,
  STATE_ORDER,
  createProject,
  fetchDeployment,
  inspectRepo,
  parseRepoAddress,
  startProject,
} from '@/lib/projects';

const POLL_MS = 3000;
// A first build compiles a runner for the app; give it a long time before saying so.
const POLL_FOR_MS = 20 * 60 * 1000;

type Phase = 'form' | 'deploying';

export default function NewProjectPage() {
  const router = useRouter();
  const { username, role, isLoading } = useUser();

  const [phase, setPhase] = useState<Phase>('form');
  const [address, setAddress] = useState('');
  const [token, setToken] = useState('');
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<RepoInspection | null>(null);
  const [branch, setBranch] = useState('main');
  const [install, setInstall] = useState('');
  const [build, setBuild] = useState('');
  const [run, setRun] = useState('');
  const [vars, setVars] = useState<{ key: string; value: string }[]>([]);
  const [error, setError] = useState('');
  const [needsPlan, setNeedsPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [projectId, setProjectId] = useState('');
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [watchError, setWatchError] = useState('');
  const alive = useRef(true);
  const startedOnce = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/');
  }, [isLoading, username, router]);

  const parsed = parseRepoAddress(address);

  const find = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setNeedsPlan(false);
    if (!parsed) return setError('Paste a GitHub address like https://github.com/owner/name.');
    setLooking(true);
    try {
      const r = await inspectRepo(address.trim(), token.trim() || undefined);
      setFound(r);
      if (r.default_branch) setBranch(r.default_branch);
      if (r.suggestion) {
        setInstall(r.suggestion.install ?? '');
        setBuild(r.suggestion.build ?? '');
        setRun(r.suggestion.run ?? '');
      }
    } catch (err: any) {
      // Not fatal: the form still works by hand.
      setFound({ supported: false, owner: parsed.owner, repo: parsed.repo, note: err?.message });
    } finally {
      setLooking(false);
    }
  };

  const watch = useCallback(async (id: string) => {
    const until = Date.now() + POLL_FOR_MS;
    while (alive.current && Date.now() < until) {
      try {
        const d = await fetchDeployment(id);
        if (!alive.current) return;
        setDeployment(d);
        setWatchError('');
        if (d.state === 'running' || d.state === 'failed') return;
        // A fresh app is not started by the node on its own: once it is built, start it.
        if (d.state === 'built' && !startedOnce.current) {
          startedOnce.current = true;
          try {
            await startProject(id);
          } catch {
            startedOnce.current = false; // try again next tick
          }
        }
      } catch (err: any) {
        // A failed read is not a failed deploy: keep watching.
        if (alive.current) setWatchError(err?.message ?? 'Could not read the status');
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }, []);

  const deploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsPlan(false);
    if (!parsed) return setError('Paste a GitHub address like https://github.com/owner/name.');
    if (!run.trim()) return setError('Enter the command that starts your app, for example npm start.');
    const cleanVars = vars.filter((v) => v.key.trim());
    setSubmitting(true);
    try {
      const created = await createProject({
        user: parsed.owner,
        repo: parsed.repo,
        branch: branch.trim() || 'main',
        token: token.trim() || undefined,
        install_command: install.trim() || undefined,
        build_command: build.trim() || undefined,
        run_command: run.trim(),
        secrets: cleanVars.map((v) => ({ key: v.key.trim(), value: v.value })),
      });
      setProjectId(created.id);
      setDeployment(null);
      startedOnce.current = false;
      setPhase('deploying');
      void watch(created.id);
    } catch (err: any) {
      setError(err?.message ?? 'We could not start the deploy.');
      setNeedsPlan(!!(err instanceof ProjectError && err.needsPlan));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !username) return <LoadingOverlay />;
  if (!isAdminRole(role)) {
    return (
      <Shell>
        <p style={{ color: 'var(--text)' }}>Adding a project needs an Admin of your organization.</p>
        <Link href="/apps" className="btn btn-ghost">Back to your apps</Link>
      </Shell>
    );
  }

  if (phase === 'deploying') {
    const state = deployment?.state ?? 'preparing';
    const reached = state === 'built' ? 'starting' : state;
    const idx = STATE_ORDER.indexOf(reached as any);
    return (
      <Shell>
        <h1 style={{ fontSize: '1.6rem' }}>{state === 'running' ? 'Your app is running' : state === 'failed' ? 'The deploy did not finish' : 'Deploying your app'}</h1>
        <p style={{ color: 'var(--text)' }}>{deployment?.message ?? 'Fetching your code and checking its configuration.'}</p>
        <ol className="progress" aria-live="polite" style={{ marginTop: 16 }}>
          {STATE_ORDER.map((s, i) => {
            const st = state === 'failed' ? (i < Math.max(idx, 0) ? 'done' : i === Math.max(idx, 0) ? 'bad' : 'pending')
              : i < idx || state === 'running' ? 'done' : i === idx ? 'doing' : 'pending';
            return (
              <li key={s} data-st={st}>
                <span>{STATE_LABEL[s]}</span>
              </li>
            );
          })}
        </ol>
        {watchError && <p className="sub text-sm">Still watching. {watchError}</p>}
        {deployment?.log_tail && deployment.log_tail.length > 0 && (state === 'failed' || state === 'building') && (
          <pre className="term" style={{ padding: 12, borderRadius: 8, overflowX: 'auto', maxHeight: 240 }}>{deployment.log_tail.join('\n')}</pre>
        )}
        {state === 'running' && (
          <div style={{ marginTop: 20 }}>
            <GoLive projectId={projectId} />
          </div>
        )}
        <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
          {state === 'running' && <Link href={`/apps/${projectId}`} className="btn btn-ghost">Open the project</Link>}
          {state === 'failed' && <Button onClick={() => setPhase('form')}>Edit and try again</Button>}
          {state !== 'running' && state !== 'failed' && <span className="sub text-sm">You can leave this page; the deploy carries on.</span>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: '1.6rem' }}>Add a project</h1>
      <p style={{ color: 'var(--text)' }}>Paste the address of your code. We look it up, then build and run it for you.</p>

      {error && (
        <div className="error mt-3" role="alert">
          {error} {needsPlan && <Link href="/billing" className="text-brand hover:underline">Choose a plan</Link>}
        </div>
      )}

      <form className="form" onSubmit={find} noValidate>
        <div>
          <label htmlFor="addr">Repository address</label>
          <Field id="addr" sans placeholder="https://github.com/owner/name" autoCapitalize="off" spellCheck={false} value={address} onChange={(e) => { setAddress(e.target.value); setFound(null); }} />
        </div>
        <div>
          <label htmlFor="tok">Access token <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(only for a private repository)</small></label>
          <Field id="tok" type="password" sans autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div><Button type="submit" variant="ghost" disabled={looking || !parsed}>{looking ? 'Looking…' : 'Find repository'}</Button></div>
      </form>

      {found && (
        <form className="form" onSubmit={deploy} noValidate style={{ marginTop: 20 }}>
          <div className="callout">
            {found.supported
              ? <><b>{found.owner}/{found.repo}</b>{found.stack ? <> looks like a {found.stack} app.</> : <> found. We could not tell what it is, so fill in the commands.</>}</>
              : <>{found.note || 'We could not look inside this repository, so fill in the details yourself.'}</>}
          </div>
          <div>
            <label htmlFor="branch">Branch to deploy</label>
            {found.branches && found.branches.length > 0 ? (
              <select id="branch" className="field field-sans" value={branch} onChange={(e) => setBranch(e.target.value)}>
                {found.branches.map((b) => <option key={b}>{b}</option>)}
              </select>
            ) : (
              <Field id="branch" sans value={branch} onChange={(e) => setBranch(e.target.value)} />
            )}
          </div>
          <div><label htmlFor="inst">Install command</label><Field id="inst" value={install} onChange={(e) => setInstall(e.target.value)} placeholder="npm ci" /></div>
          <div><label htmlFor="bld">Build command</label><Field id="bld" value={build} onChange={(e) => setBuild(e.target.value)} placeholder="npm run build" /></div>
          <div>
            <label htmlFor="run">Start command</label>
            <Field id="run" value={run} onChange={(e) => setRun(e.target.value)} placeholder="npm start" />
            <p className="text-sm" style={{ color: 'var(--muted)', marginTop: 4 }}>
              Your app must listen on the port in the <code>PORT</code> environment variable. We choose the port for you.
            </p>
          </div>
          <details>
            <summary style={{ cursor: 'pointer' }}>Environment variables <small style={{ color: 'var(--muted)' }}>(optional)</small></summary>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {vars.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8 }}>
                  <Field aria-label="Name" placeholder="NAME" value={v.key} onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <Field aria-label="Value" type="password" placeholder="value" autoComplete="off" value={v.value} onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" small onClick={() => setVars(vars.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <div><Button type="button" variant="ghost" small onClick={() => setVars([...vars, { key: '', value: '' }])}>Add a variable</Button></div>
            </div>
          </details>
          <div><Button type="submit" disabled={submitting}>{submitting ? 'Starting…' : 'Deploy'}</Button></div>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page">
      <div className="w-full max-w-xl card p-6 sm:p-8 space-y-3">{children}</div>
    </div>
  );
}
