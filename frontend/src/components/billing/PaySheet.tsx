import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import type { useElevatedSession } from '@/hooks/useElevatedSession';
import { loadStripe, StripeJs } from '@/lib/stripe';
import { ElevatedPrompt } from './ElevatedPrompt';
import { usd } from './format';

type Phase = 'ready' | 'card' | 'confirming';

interface Checkout {
  stripe_client_secret: string;
  stripe_publishable_key: string;
}

// One payment, start to finish: unlock with the password, ask Billing for the
// charge (`begin`), collect the card in Stripe's own field, confirm. Card
// details go from the browser to Stripe and never touch our servers.
//
// `begin` returning no client secret means nothing is owed (a free plan), so
// `onPaid` runs straight away. `onPaid` is where the caller waits for Stripe's
// webhook to land -- the charge is only real once Billing has heard from Stripe.
export function PaySheet({
  amountCents,
  amountLabel = 'Charged today',
  cta = 'Continue to payment',
  elevated,
  begin,
  onPaid,
  onCancel,
}: {
  amountCents?: number;
  amountLabel?: string;
  cta?: string;
  elevated: ReturnType<typeof useElevatedSession>;
  begin: (elevatedToken: string) => Promise<Checkout>;
  onPaid: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<string | null>(null);
  const held = useRef<{ stripe: StripeJs; elements: any } | null>(null);
  const mount = useRef<HTMLDivElement>(null);

  const start = async () => {
    if (!elevated.token) return;
    setError(null);
    try {
      const checkout = await begin(elevated.token);
      if (!checkout.stripe_client_secret) {
        await onPaid();
        return;
      }
      const stripe = await loadStripe(checkout.stripe_publishable_key);
      const elements = stripe.elements({ clientSecret: checkout.stripe_client_secret });
      held.current = { stripe, elements };
      setPhase('card');
      // The mount node only exists once the card phase has rendered.
      setTimeout(() => {
        if (mount.current) elements.create('payment').mount(mount.current);
      }, 0);
    } catch (err: any) {
      setError(err?.message ?? 'Could not start the payment.');
    }
  };

  const pay = async () => {
    const h = held.current;
    if (!h) return;
    setPhase('confirming');
    setError(null);
    const result = await h.stripe.confirmPayment({ elements: h.elements, redirect: 'if_required' });
    if (result.error) {
      setError(result.error.message ?? 'The payment did not go through.');
      setPhase('card');
      return;
    }
    await onPaid();
  };

  return (
    <div className="space-y-4">
      {amountCents != null && (
        <div className="due">
          <span>{amountLabel}</span>
          <b>{usd(amountCents)}</b>
        </div>
      )}

      {phase === 'ready' ? (
        <div className="space-y-3">
          {elevated.isElevated ? (
            <Button onClick={start}>{cta}</Button>
          ) : (
            <ElevatedPrompt elevated={elevated} />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div ref={mount} />
          <Button onClick={pay} disabled={phase === 'confirming'}>
            {phase === 'confirming' ? 'Paying...' : amountCents != null ? `Pay ${usd(amountCents)}` : 'Pay'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button variant="ghost" small onClick={onCancel} disabled={phase === 'confirming'}>
        Cancel
      </Button>
    </div>
  );
}
