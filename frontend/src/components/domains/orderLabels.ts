// How an order's state reads to a customer, and which pill colour it gets.
// The states are ais_domains' own (`domain_orders.state`).

export const ORDER_LABEL: Record<string, string> = {
  awaiting_payment: 'Waiting for payment',
  paid: 'Paid',
  registering: 'Setting up',
  completed: 'Live',
  refunded: 'Refunded',
  failed: 'Not completed',
  needs_admin: 'We are looking at it',
};

export const ORDER_PILL: Record<string, string> = {
  awaiting_payment: 'awaiting_payment',
  paid: 'registering',
  registering: 'registering',
  completed: 'active',
  refunded: 'refunded',
  failed: 'failed',
  needs_admin: 'needs_admin',
};

// Nothing more will happen to an order in one of these (needs_admin waits on a person).
export const ORDER_TERMINAL = new Set(['completed', 'refunded', 'failed', 'needs_admin']);
