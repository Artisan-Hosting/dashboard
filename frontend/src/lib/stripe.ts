// Stripe.js must be loaded from Stripe's own origin (never bundled), so this
// injects the script on first use instead of adding an npm dependency.
// Card data goes straight from the browser to Stripe; we only ever hold the
// client secret and publishable key Billing hands back.

type StripeElements = { create: (type: 'payment') => { mount: (el: HTMLElement) => void; destroy: () => void } };
export interface StripeJs {
  elements: (opts: { clientSecret: string }) => StripeElements;
  confirmPayment: (opts: {
    elements: StripeElements;
    redirect: 'if_required';
  }) => Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe needs a browser'));
  if (window.Stripe) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error('Could not load Stripe. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

export async function loadStripe(publishableKey: string): Promise<StripeJs> {
  await loadScript();
  if (!window.Stripe) throw new Error('Stripe did not initialise');
  return window.Stripe(publishableKey);
}
