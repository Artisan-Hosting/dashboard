import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button, Field } from '@/components/ui';
import { CapHandle, CapWidget } from '@/components/signup/CapWidget';
import { SignupConfig, getSignupConfig, resendSignup, startSignup } from '@/lib/signup';

// Where in the sample console the visitor came from, so signup can pick up the thread.
const FROM_NOTE: Record<string, string> = {
  drawer: 'You were previewing a change. Create an account and you can make it on your own project.',
  applybar: 'You were about to apply a change. Create an account and you can make it for real.',
  restart: 'You tried restarting the sample project. Create an account and you can do that to your own.',
  list: 'You were looking at the sample projects. Create an account and add your own.',
  domains: 'You were looking at domains in the sample. Create an account and attach your own.',
  bar: 'Glad the sample was useful. Your own projects work exactly the same way.',
};

const RESEND_WAIT_SECONDS = 60;

export default function SignupPage() {
  const router = useRouter();
  const from = typeof router.query.from === 'string' ? router.query.from : '';

  const [config, setConfig] = useState<SignupConfig>({ captchaEnabled: false, captchaEndpoint: '' });
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);
  const [resendNote, setResendNote] = useState('');
  const cap = useRef<CapHandle | null>(null);

  useEffect(() => {
    getSignupConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const onToken = useCallback((t: string) => setCaptchaToken(t), []);
  const needsCaptcha = config.captchaEnabled;

  // A used or failed token is dead: get a fresh challenge before the next try.
  const freshChallenge = () => {
    setCaptchaToken('');
    cap.current?.reset();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim() || !email.trim() || !password) return setError('Fill in every field.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('That does not look like an email address.');
    if (password.length < 8) return setError('Choose a password with at least 8 characters.');
    if (!agreed) return setError('Agree to the terms to continue.');
    if (needsCaptcha && !captchaToken) return setError('Complete the check below first.');

    setSubmitting(true);
    try {
      await startSignup({ email: email.trim(), displayName: displayName.trim(), password, captchaToken });
      setSent(true);
      setWait(RESEND_WAIT_SECONDS);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      freshChallenge();
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResendNote('');
    if (needsCaptcha && !captchaToken) return setResendNote('Complete the check below first.');
    try {
      await resendSignup(email.trim(), captchaToken);
      setResendNote('If that address is waiting for confirmation, we sent the link again.');
      setWait(RESEND_WAIT_SECONDS);
    } catch (err: any) {
      setResendNote(err?.message ?? 'Could not resend. Please try again.');
    }
    freshChallenge();
  };

  const widget = needsCaptcha && config.captchaEndpoint ? (
    <div className="my-2">
      <CapWidget endpoint={config.captchaEndpoint} onToken={onToken} handle={cap} />
    </div>
  ) : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page">
      <div className="w-full max-w-md card p-6 sm:p-8">
        <div className="mb-6 flex justify-center">
          <img src="/imgs/artisan-studios__lockup__dark__2048w.webp" alt="Artisan Hosting" className="h-10 w-auto max-w-full dark:hidden" />
          <img src="/imgs/artisan-studios__lockup__light__2048w.webp" alt="Artisan Hosting" className="hidden h-10 w-auto max-w-full dark:block" />
        </div>

        {sent ? (
          <div className="space-y-4">
            <h1 style={{ fontSize: '1.6rem' }}>Check your email</h1>
            <p style={{ color: 'var(--text)' }}>
              If <b>{email.trim()}</b> can be used to sign up, we have sent a link to it. Open the link to confirm your account. It works for 24 hours.
            </p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              We show this same message for every address, so nobody can use this form to find out who has an account.
            </p>
            {widget}
            {resendNote && <div className="callout" role="status">{resendNote}</div>}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" small onClick={resend} disabled={wait > 0}>
                {wait > 0 ? `Send it again in ${wait}s` : 'Send it again'}
              </Button>
              <Button variant="ghost" small onClick={() => { setSent(false); setResendNote(''); }}>
                Wrong address? Go back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '1.6rem' }}>Create your account</h1>
            {from && FROM_NOTE[from] && <p className="callout mt-3">{FROM_NOTE[from]}</p>}
            <p className="mb-4 mt-3 text-sm" style={{ color: 'var(--muted)' }}>
              Next you will name your organization and get set up. A card is only needed once you choose a plan.
            </p>

            {error && <div className="error mb-4" role="alert">{error}</div>}

            <form onSubmit={submit} className="form" noValidate>
              <div>
                <label htmlFor="displayName">Your name</label>
                <Field id="displayName" sans autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="email">Work email</label>
                <Field id="email" type="email" sans autoComplete="email" autoCapitalize="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Field
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    sans
                    autoComplete="new-password"
                    style={{ paddingRight: '4.6rem' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-sm" style={{ color: 'var(--muted)', marginTop: 4 }}>
                  At least 8 characters. A longer phrase is stronger than a clever short one.
                </p>
              </div>
              <label className="flex items-start gap-2" style={{ fontWeight: 400, cursor: 'pointer' }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '0.3rem' }} />
                <span>
                  I agree to the{' '}
                  <a href="https://www.artisanhosting.net/terms" target="_blank" rel="noreferrer" className="text-brand hover:underline">terms of service</a>
                  {' '}and{' '}
                  <a href="https://www.artisanhosting.net/privacy" target="_blank" rel="noreferrer" className="text-brand hover:underline">privacy policy</a>.
                </span>
              </label>
              {widget}
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Already have an account?{' '}
          <Link href="/" className="text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
