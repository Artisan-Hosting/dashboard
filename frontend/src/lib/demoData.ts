// Sample data for the logged-out demo at /demo. Nothing here is fetched or
// saved. The shapes follow what the real pages read (runner status, group
// usage in MB / CPU hours, addresses with a state, domains with a cert expiry,
// repo + branch, secret names) so the demo only ever shows things the platform
// reports today.

export interface DemoInstance {
  id: string;
  status: 'running' | 'stopped';
}

export interface DemoProject {
  name: string;
  label: string;
  instances: DemoInstance[];
  usage: { avgMemory: number; peakMemory: number; totalCpu: number; peakCpu: number; tx: number; rx: number };
  addresses: { fqdn: string; state: 'live' | 'pending' }[];
  domains: { fqdn: string; status: string; expiresInDays: number }[];
  source: { server: string; repo: string; branch: string };
  config: string;
  secrets: string[];
  logs: string[];
}

const MB = 1024 * 1024;

export const DEMO_PROJECTS: DemoProject[] = [
  {
    name: 'sample-shop',
    label: 'Sample shop',
    instances: [
      { id: 'a41f09c2', status: 'running' },
      { id: 'b7d3e158', status: 'running' },
    ],
    usage: { avgMemory: 412.6, peakMemory: 688.2, totalCpu: 3.42, peakCpu: 5.1, tx: 18_400 * MB, rx: 2_900 * MB },
    addresses: [{ fqdn: 'shop.example.com', state: 'live' }],
    domains: [{ fqdn: 'shop.example.com', status: 'active', expiresInDays: 74 }],
    source: { server: 'GitHub', repo: 'acme/shop', branch: 'main' },
    config: 'PORT=3000\nNODE_ENV=production\nLOG_LEVEL=info\n',
    secrets: ['DATABASE_URL', 'STRIPE_KEY', 'SESSION_SECRET'],
    logs: [
      '[12:01:07] server listening on :3000',
      '[12:01:09] GET /healthz 200 2ms',
      '[12:03:41] GET / 200 38ms',
      '[12:03:42] GET /static/app.css 200 4ms',
      '[12:04:15] POST /cart/add 200 61ms',
      '[12:06:02] GET /products/lamp 200 44ms',
    ],
  },
  {
    name: 'sample-blog',
    label: 'Sample blog',
    instances: [{ id: 'c92a6e04', status: 'running' }],
    usage: { avgMemory: 148.3, peakMemory: 201.7, totalCpu: 0.61, peakCpu: 1.2, tx: 2_100 * MB, rx: 380 * MB },
    addresses: [{ fqdn: 'notes.example.com', state: 'pending' }],
    domains: [],
    source: { server: 'GitHub', repo: 'acme/blog', branch: 'main' },
    config: 'PORT=8080\nSITE_TITLE=Field notes\n',
    secrets: ['ADMIN_TOKEN'],
    logs: ['[09:12:30] build ok', '[09:12:33] server listening on :8080', '[09:12:35] GET /healthz 200 1ms'],
  },
];

// Things that are designed but not built yet. Shown as plain text only, never
// as controls, so the demo does not promise anything the platform can't do.
export const COMING_SOON: { title: string; text: string }[] = [
  { title: 'Scaling controls', text: 'Choosing how many instances run, and how much memory and processor each one gets, from the console.' },
  { title: 'Staging environments', text: 'A second copy of a project with its own settings, for trying a change before visitors see it.' },
  { title: 'Email', text: 'Mailboxes on your own domain.' },
  { title: 'One-click open-source apps', text: 'Apps such as Ghost or Plausible, set up for you.' },
  { title: 'GPU sessions', text: 'Short-lived GPU machines for running models.' },
];
