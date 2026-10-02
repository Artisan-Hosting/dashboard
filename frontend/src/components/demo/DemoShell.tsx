import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ui';

export const startUrl = (from?: string) => '/signup' + (from ? `?from=${encodeURIComponent(from)}` : '');

const RIBBON_KEY = 'ah-ribbon';

// Chrome for the logged-out demo: a top bar with Sign in / Get started, a
// dismissible "sample data" ribbon, and a closing call to action.
export function DemoShell({ children }: { children: ReactNode }) {
  const [ribbon, setRibbon] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(RIBBON_KEY) === 'off') setRibbon(false);
    } catch {}
  }, []);

  const dismiss = () => {
    setRibbon(false);
    try { sessionStorage.setItem(RIBBON_KEY, 'off'); } catch {}
  };

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <header className="topbar">
        <div className="topbar-in px-4 sm:px-6 lg:px-8">
          <Link className="brand" href="/demo" aria-label="Artisan Hosting, sample console">
            <img src="/imgs/artisan-studios__lockup__dark__2048w.webp" alt="Artisan Hosting" className="h-7 w-auto max-w-full dark:hidden" />
            <img src="/imgs/artisan-studios__lockup__light__2048w.webp" alt="Artisan Hosting" className="hidden h-7 w-auto max-w-full dark:block" />
          </Link>
          <div className="tools" style={{ marginLeft: 'auto' }}>
            <ThemeToggle />
            <Link className="btn btn-ghost btn-sm" href="/">Sign in</Link>
            <Link className="btn btn-primary btn-sm" href={startUrl('topbar')}>Get started</Link>
          </div>
        </div>
      </header>

      {ribbon && (
        <div className="ribbon" role="status">
          <div className="ribbon-in px-4 sm:px-6 lg:px-8">
            <p>
              <strong>Sample data.</strong> Look around. Nothing here is saved and nothing is running.{' '}
              <Link href={startUrl('ribbon')}>Get started</Link> to run your own, or <Link href="/">sign in</Link>.
            </p>
            <button type="button" onClick={dismiss}>Dismiss</button>
          </div>
        </div>
      )}

      <main className="p-4 sm:p-6 lg:p-8">
        {children}
        <aside className="cta-band" aria-labelledby="cta-h">
          <div>
            <h2 id="cta-h">Ready to run your own?</h2>
            <p>Create an account and put your own app online.</p>
          </div>
          <div className="cta-actions">
            <Link className="btn btn-primary" href={startUrl('band')}>Get started</Link>
            <Link className="btn btn-ghost" href="/">Sign in</Link>
          </div>
        </aside>
      </main>
    </div>
  );
}

// A quiet note shown where the demo stops being useful.
export function DemoEdge({ text, from, cta }: { text: string; from: string; cta?: string }) {
  return (
    <p className="demo-edge">
      <span>{text}</span>
      <Link className="btn btn-primary btn-sm" href={startUrl(from)}>{cta ?? 'Get started'}</Link>
    </p>
  );
}
