// Hardcoded plan catalog -- Portal has no plan-catalog endpoint (no
// `ListPlans` RPC anywhere in billing.proto's bindings), so there's no way
// to fetch this at runtime. Sourced from the Artisan Pricing Model
// spreadsheet; `code` values are PLACEHOLDER slugs guessed from the plan
// names, not confirmed against Billing's real plan_code catalog -- verify
// each one against whatever you configured when connecting Stripe, and fix
// here if they don't match. Same for the `Storefront` values below: the
// spreadsheet only has display names, and `storefront` is opaque to Portal
// (it just forwards whatever string is sent), so the exact wire casing
// lives in Billing's own config, not here.
export type Storefront = 'developer' | 'business' | 'email';

export interface PlanOption {
  code: string;
  name: string;
  priceCents: number;
}

export const STOREFRONTS: { key: Storefront; label: string }[] = [
  { key: 'developer', label: 'Developer' },
  { key: 'business', label: 'Business' },
  { key: 'email', label: 'Email' },
];

// VM-S/M/L and the Managed VM add-on are marked "(paused)" or are an add-on
// in the spreadsheet, not a standalone plan -- left out of the picker.
export const PLAN_CATALOG: Record<Storefront, PlanOption[]> = {
  developer: [
    { code: 'beta', name: 'Beta', priceCents: 0 },
    { code: 'builder', name: 'Builder', priceCents: 800 },
    { code: 'pro', name: 'Pro', priceCents: 3200 },
    { code: 'team', name: 'Team', priceCents: 9500 },
  ],
  business: [
    { code: 'essentials_care', name: 'Essentials Care', priceCents: 3000 },
    { code: 'business_care', name: 'Business Care', priceCents: 9900 },
    { code: 'managed_platform', name: 'Managed Platform', priceCents: 30000 },
    { code: 'embed_10hrs', name: 'Embed, 10 hrs', priceCents: 110000 },
    { code: 'embed_20hrs', name: 'Embed, 20 hrs', priceCents: 200000 },
    { code: 'embed_40hrs', name: 'Embed, 40 hrs', priceCents: 380000 },
  ],
  email: [
    { code: 'mail_starter', name: 'Mail Starter', priceCents: 1200 },
    { code: 'mail_business', name: 'Mail Business', priceCents: 2500 },
    { code: 'mail_team', name: 'Mail Team', priceCents: 4500 },
    { code: 'send_10k', name: 'Send 10k', priceCents: 1000 },
    { code: 'send_50k', name: 'Send 50k', priceCents: 3000 },
    { code: 'send_150k', name: 'Send 150k', priceCents: 7500 },
    { code: 'dedicated_apostle', name: 'Dedicated Apostle', priceCents: 15000 },
  ],
};

export function findPlan(storefront: Storefront, code: string): PlanOption | undefined {
  return PLAN_CATALOG[storefront].find((p) => p.code === code);
}
