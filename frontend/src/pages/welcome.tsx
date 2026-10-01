import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button, Field } from '@/components/ui';
import LoadingOverlay from '@/components/loading';
import { isAdminRole } from '@/components/requireAdmin';
import { useUser } from '@/hooks/useUser';
import { OrganizationSummary, previewSlug, renameOrganization } from '@/lib/signup';

// Where a brand-new account lands after confirming its email: first name the
// organization (the draft one the signup created), then see what is left to do.
// Only steps that exist today are links; the rest say so instead of leading
// somewhere that cannot work yet.
export default function WelcomePage() {
  const router = useRouter();
  const { username, role, isLoading } = useUser();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  // Naming is a one-time step; once done (or skipped) the checklist shows.
  const [named, setNamed] = useState(false);

  // Nobody signed in has any business here.
  useEffect(() => {
    if (!isLoading && !username) router.replace('/');
  }, [isLoading, username, router]);

  if (isLoading || !username) return <LoadingOverlay />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Give your organization a name.');
    setSaving(true);
    try {
      setOrg(await renameOrganization(name.trim()));
      setNamed(true);
    } catch (err: any) {
      const message = String(err?.message ?? '');
      // Already named (a reload, or a second tab): nothing left to ask.
      if (message.toLowerCase().includes('already')) setNamed(true);
      else setError(message || 'Could not save the name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const slug = org?.slug || previewSlug(name);
  const isAdmin = isAdminRole(role);

  const Row = ({ done, title, detail, action }: { done?: boolean; title: string; detail: string; action?: React.ReactNode }) => (
    <li style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
      <span
        aria-hidden="true"
        style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: `1px solid ${done ? 'var(--ok)' : 'var(--line-strong)'}`, color: 'var(--ok)', display: 'grid', placeItems: 'center', fontSize: '.8rem' }}
      >
        {done ? '✓' : ''}
      </span>
      <span>
        <b style={{ color: 'var(--strong)', display: 'block' }}>{title}</b>
        <small style={{ color: 'var(--muted)' }}>{detail}</small>
      </span>
      <span>{action}</span>
    </li>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page">
      <div className="w-full max-w-xl card p-6 sm:p-8">
        {!named ? (
          <div className="space-y-4">
            <h1 style={{ fontSize: '1.6rem' }}>You are in.</h1>
            <p style={{ color: 'var(--text)' }}>
              Your account is confirmed. Now name your organization. Projects, domains and billing belong to it, not to one person, so teammates can share them.
            </p>
            {error && <div className="error" role="alert">{error}</div>}
            <form onSubmit={save} className="form" noValidate>
              <div>
                <label htmlFor="org">Organization name</label>
                <Field id="org" sans autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} />
                <p className="text-sm" style={{ color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  {slug ? <>Your address name: <b style={{ color: 'var(--strong)' }}>{slug}</b></> : ' '}
                </p>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                You are its Admin. You can invite people later. If this name is already taken as an address, we add a number to the end.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create organization'}</Button>
                <Button type="button" variant="ghost" onClick={() => setNamed(true)}>Use the suggested name for now</Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 style={{ fontSize: '1.6rem' }}>{org ? `${org.name} is ready` : 'Your account is ready'}</h1>
            <p style={{ color: 'var(--text)' }}>Here is what is left to get a site online.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', borderTop: '1px solid var(--line-strong)' }}>
              <Row done title="Account created" detail={username} />
              <Row done title="Organization" detail={org ? `${org.name} · ${org.slug}` : 'You are its Admin'} />
              <Row
                title="Choose a plan"
                detail={isAdmin ? 'Needed before you can deploy or buy a domain' : 'An Admin of your organization chooses the plan'}
                action={isAdmin ? <Link href="/billing" className="btn btn-primary btn-sm">Choose a plan</Link> : undefined}
              />
              <Row
                title="Add a repository"
                detail={isAdmin ? 'Connect your code and we build and run it' : 'An Admin of your organization adds the project'}
                action={isAdmin ? <Link href="/projects/new" className="btn btn-primary btn-sm">Add a project</Link> : undefined}
              />
              <Row
                title="Get a domain"
                detail="Buy a new name or bring one you own"
                action={<Link href="/domains" className="btn btn-ghost btn-sm">Find a domain</Link>}
              />
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/apps" className="btn btn-ghost">Go to your apps</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
