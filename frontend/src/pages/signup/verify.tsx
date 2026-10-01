import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui';
import { verifySignup } from '@/lib/signup';

// The emailed link lands here. Confirming is one deliberate click rather than
// something that happens on page load, so a mail scanner that opens the link
// cannot use it up before the person does.
export default function VerifySignupPage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Wait for the router to hydrate `token` before deciding the link is missing.
  const tokenMissing = router.isReady && !token;

  const confirm = async () => {
    setError('');
    setBusy(true);
    try {
      await verifySignup(token);
      router.replace('/welcome');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page">
      <div className="w-full max-w-sm card p-6 sm:p-8">
        <div className="mb-6 flex justify-center">
          <img src="/imgs/artisan-studios__lockup__dark__2048w.webp" alt="Artisan Hosting" className="h-10 w-auto max-w-full dark:hidden" />
          <img src="/imgs/artisan-studios__lockup__light__2048w.webp" alt="Artisan Hosting" className="hidden h-10 w-auto max-w-full dark:block" />
        </div>

        {tokenMissing ? (
          <div className="space-y-4 text-center">
            <p style={{ color: 'var(--text)' }}>This link is missing its token.</p>
            <Link href="/signup" className="inline-block text-brand hover:underline">Start again</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 style={{ fontSize: '1.6rem' }}>Confirm your email</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              One more click and your account is ready. You will name your organization next.
            </p>
            {error && (
              <div className="error" role="alert">
                {error}{' '}
                <Link href="/signup" className="text-brand hover:underline">Start again</Link>
              </div>
            )}
            <Button onClick={confirm} disabled={busy || !router.isReady}>
              {busy ? 'Confirming…' : 'Confirm and continue'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
