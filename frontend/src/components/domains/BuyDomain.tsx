import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, Panel, Pill } from '@/components/ui';
import { PaySheet } from '@/components/billing/PaySheet';
import { usd } from '@/components/billing/format';
import type { useElevatedSession } from '@/hooks/useElevatedSession';
import { createDomainOrder, getOrder, quoteDomain, searchDomains } from '@/lib/api';
import { DomainOffer, DomainQuote, Order } from '@/lib/types';
import { ORDER_LABEL, ORDER_PILL, ORDER_TERMINAL } from './orderLabels';

type Phase = 'search' | 'quote' | 'order';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 2500;
const POLL_FOR_MS = 10 * 60 * 1000;

// Keep letters, digits, hyphens and dots; a name with a dot is searched as typed.
const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9.-]/g, '').replace(/^[-.]+|[-.]+$/g, '');

function secondsUntil(unix: number) {
  return Math.max(0, Math.round(unix - Date.now() / 1000));
}

// Search -> a held price -> pay by card -> watch the order until it is live,
// refunded, or needs a person. Everything that decides anything is on the
// server: the price is re-checked right before the registry is charged, and a
// name that cannot be registered is refunded. This only shows what happens.
export function BuyDomain({
  orgId,
  canBuy,
  elevated,
  onChanged,
  forApp,
}: {
  orgId: string;
  canBuy: boolean;
  /** The app this domain is being bought for. The server attaches it when the domain is ready. */
  forApp?: string;
  elevated: ReturnType<typeof useElevatedSession>;
  onChanged: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('search');
  const [query, setQuery] = useState('');
  const [offers, setOffers] = useState<DomainOffer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DomainQuote | null>(null);
  const [left, setLeft] = useState(0);
  const [order, setOrder] = useState<Order | null>(null);
  const orderId = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!quote) return;
    setLeft(secondsUntil(quote.expires_at));
    const t = setInterval(() => setLeft(secondsUntil(quote.expires_at)), 1000);
    return () => clearInterval(t);
  }, [quote]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = clean(query);
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setOffers(await searchDomains(q));
    } catch (err: any) {
      setError(err?.message ?? 'Search failed');
      setOffers(null);
    } finally {
      setSearching(false);
    }
  };

  const choose = useCallback(async (fqdn: string) => {
    setError(null);
    try {
      const q = await quoteDomain(fqdn);
      if (!q.offer?.registrable) {
        setError(q.offer?.reason || `${fqdn} is not available.`);
        return;
      }
      orderId.current = null;
      setQuote(q);
      setPhase('quote');
    } catch (err: any) {
      setError(err?.message ?? 'Could not get a price');
    }
  }, []);

  const watchOrder = async () => {
    setPhase('order');
    const until = Date.now() + POLL_FOR_MS;
    while (alive.current && Date.now() < until) {
      try {
        const latest = await getOrder(orderId.current!);
        if (!alive.current) return;
        setOrder(latest);
        if (ORDER_TERMINAL.has(latest.state)) {
          onChanged();
          return;
        }
      } catch {
        // a failed read is not a failed order; keep watching
      }
      await sleep(POLL_MS);
    }
  };

  const reset = () => {
    setPhase('search');
    setQuote(null);
    setOrder(null);
    orderId.current = null;
    setError(null);
  };

  const offer = quote?.offer ?? null;

  if (phase === 'order') {
    const state = order?.state ?? 'awaiting_payment';
    const fq = order?.fqdn ?? offer?.fqdn ?? '';
    const paid = state !== 'awaiting_payment' && state !== 'failed';
    const steps: { label: string; st: 'done' | 'doing' | 'pending' | 'bad'; note?: string }[] = [
      { label: 'Payment received', st: paid ? 'done' : state === 'failed' ? 'bad' : 'doing' },
      {
        label: 'Registering the name',
        st:
          state === 'completed'
            ? 'done'
            : state === 'refunded' || state === 'needs_admin'
              ? 'bad'
              : paid
                ? 'doing'
                : 'pending',
        note: state === 'refunded' ? 'The registry could not register this name.' : state === 'needs_admin' ? 'This one needs a person to look at it.' : undefined,
      },
      { label: 'Live', st: state === 'completed' ? 'done' : 'pending' },
    ];
    return (
      <Panel title={fq || 'Your order'}>
        <ol className="progress" aria-live="polite">
          {steps.map((s) => (
            <li key={s.label} data-st={s.st}>
              <span>
                {s.label}
                {s.note && <small>{s.note}</small>}
              </span>
            </li>
          ))}
        </ol>
        {state === 'completed' && (
          <p className="note">
            <b>{fq} is live.</b> Attach it to a project from the list below.
          </p>
        )}
        {state === 'refunded' && (
          <p className="note bad">
            <b>We could not register {fq}.</b> Your {usd(order?.price_cents ?? 0)} has been refunded to the card you paid with, so you are
            not left with a charge and no domain.
          </p>
        )}
        {state === 'failed' && <p className="note bad">The payment was not completed, so nothing was charged.</p>}
        {state === 'needs_admin' && (
          <p className="note bad">
            <b>We are looking at this one.</b> We will either finish the registration or refund you in full. You do not need to do
            anything, and you will not be charged twice.
          </p>
        )}
        {ORDER_TERMINAL.has(state) ? (
          <div>
            <Button variant="ghost" onClick={reset}>
              Buy another domain
            </Button>
          </div>
        ) : (
          <p className="sub text-sm">This usually takes a few minutes. You can leave this page; the order carries on.</p>
        )}
      </Panel>
    );
  }

  if (phase === 'quote' && offer && quote) {
    const expired = left === 0;
    return (
      <Panel title="Review">
        <div className="quote">
          <div className="fq">{offer.fqdn}</div>
          <p className={`timer ${expired ? 'out' : ''}`}>
            {expired ? 'This price has expired.' : `Price held for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
          </p>
          <p className="sub">
            It is registered for one year. Renewing is not available yet, so note the date when it is live. You pay once, by card. If we
            cannot register the name, the payment is refunded to the same card.
          </p>
          {expired ? (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => choose(offer.fqdn)}>Get a fresh price</Button>
              <Button variant="ghost" onClick={reset}>
                Pick a different name
              </Button>
            </div>
          ) : !canBuy ? (
            <p className="note">Buying a domain needs an admin of your organization.</p>
          ) : (
            <PaySheet
              amountCents={offer.price_cents}
              amountLabel="First year"
              cta="Continue to payment"
              elevated={elevated}
              begin={async (token) => {
                const checkout = await createDomainOrder({ quoteId: quote.quote_id, elevatedToken: token, organizationId: orgId || undefined, runnerId: forApp || undefined });
                orderId.current = checkout.order?.id ?? null;
                if (checkout.order) setOrder(checkout.order);
                if (!checkout.stripe_client_secret) {
                  // Already paid or closed: nothing to collect, so just watch it.
                  void watchOrder();
                  throw new Error('This order is already being handled.');
                }
                return checkout;
              }}
              onPaid={watchOrder}
              onCancel={reset}
            />
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Buy a domain">
      <form className="searchbar" onSubmit={search}>
        <Field
          sans
          aria-label="Domain name to search"
          placeholder="artisan-widgets or artisanwidgets.com"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={searching || !clean(query)}>
          {searching ? 'Searching...' : 'Search'}
        </Button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {offers && offers.length === 0 && <p className="sub">Nothing came back for that. Try another name.</p>}
      {offers && offers.length > 0 && (
        <ul className="results">
          {offers.map((o) => (
            <li key={o.fqdn} data-off={o.registrable ? 0 : 1}>
              <span className="fq">{o.fqdn}</span>
              {o.registrable ? (
                <>
                  <span className="sub">{usd(o.price_cents)} for the first year</span>
                  <Button small onClick={() => choose(o.fqdn)}>
                    Choose
                  </Button>
                </>
              ) : (
                <>
                  <span className="sub" title={o.reason || 'Taken, or a name we do not sell here'}>
                    Not available
                  </span>
                  <span />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!canBuy && <p className="sub text-sm">You can search and see prices. Buying needs an admin of your organization.</p>}
    </Panel>
  );
}

export function OrderPill({ state }: { state: string }) {
  return <Pill status={ORDER_PILL[state] ?? state} label={ORDER_LABEL[state] ?? state} />;
}
