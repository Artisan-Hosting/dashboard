/* Artisan console mock: page logic and sample data.
   Every knob here is defined once (label, plain words, live "what changes"
   line, and a tip). In the real app the same definitions would drive the
   same component against real data. */
(function () {
  'use strict';
  const { $, $$, esc, clamp, sleep, renderKnob, fmtValue, meterHTML, openDrawer, mountShop } = window.AH;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const NODE_NAMES = ['node-a', 'node-b', 'node-c', 'node-d'];

  /* ======================================================================
     Service families
     ====================================================================== */
  const FAMILIES = [
    {
      id: 'hosting', title: 'Managed hosting', preview: false,
      intro: 'Your website or app, running on machines we monitor. We patch them, watch them, and restore them from backups we have actually tested. You keep the code, the domain and the content.',
      own: ['Patching and hardened machines', 'Monitoring, and someone who answers', 'Backups, restores and rollbacks'],
      you: ['Your code and your content', 'Your domain', 'Deciding when to ship'],
      notFit: 'You want a bare cloud account with root access and nobody to call.',
      sections: [
        {
          id: 'project', title: 'Your project',
          intro: 'These are the settings most projects ever touch. Everything else is under Advanced.',
          knobs: [
            { id: 'instances', label: 'Instances', type: 'stepper', min: 1, max: 4, value: 2,
              plain: 'How many copies of your app run at once, each on its own machine.',
              effect: (v) => v === 1 ? 'One copy. If its machine fails, or it restarts, your site is down until it comes back.'
                : v === 2 ? 'Two copies on separate machines. One can fail and visitors will not notice.'
                : `${v} copies on separate machines. One can fail with room to spare, and there is more capacity for traffic.`,
              tip: 'leave this at 1 until an outage would really hurt, then move to 2.',
              dry: (f, t) => t > f ? `Start ${plural(t - f, 'more instance')} on machines that are not running this project yet. The instances already running are not touched.`
                : `Stop ${plural(f - t, 'instance')} and free their machines. The remaining instances keep serving visitors.` },
            { id: 'envs', label: 'Environments', type: 'segmented', options: ['Production only', 'Production and staging'], value: 'Production only',
              plain: 'Environments are separate copies of your project. Staging is where you try a change before visitors see it.',
              effect: (v) => v === 'Production only' ? 'One environment. Changes go straight to visitors.' : 'A second environment with its own settings and secrets, so you can test first.',
              tip: 'add staging once more than one person ships changes.',
              dry: (f, t) => t === 'Production and staging' ? 'Create a staging environment with its own config and an empty set of secrets.' : 'Remove the staging environment and its secrets.' },
            { id: 'mem', label: 'Memory', type: 'slider', min: 1, max: 8, step: 1, value: 2, unit: 'GB',
              plain: 'The most memory each instance may use.',
              effect: (v, s) => `${v} GB each, ${v * s.instances} GB across ${plural(s.instances, 'instance')}. What you use above your plan’s included amount is worked out from a daily average.`,
              tip: 'raise it only if the logs show out-of-memory restarts.',
              dry: (f, t) => `Change each instance’s memory limit from ${f} GB to ${t} GB, and restart each instance to apply it.` },
            { id: 'cpu', label: 'Processor', type: 'slider', min: 1, max: 4, step: 1, value: 2, unit: 'vCPU',
              plain: 'How much processing power each instance can use at once.',
              effect: (v) => `${v} vCPU each. A vCPU is one virtual processor. Most web apps are happy with one or two.`,
              tip: 'stay at 1 or 2 unless pages are slow and the processor meter is full.',
              dry: (f, t) => `Change each instance’s processor limit from ${f} vCPU to ${t} vCPU, and restart each instance to apply it.` },
            { id: 'branch', label: 'Deploy branch', type: 'select', options: ['main', 'staging', 'release-v2'], value: 'main',
              plain: 'The branch of your repository that this project runs.',
              effect: (v) => `New commits on ${v} are picked up by the git monitor and deployed.`,
              tip: 'use main for production and staging for your test environment.',
              dry: (f, t) => `Switch the deployed branch from ${f} to ${t}, then build and start it.` },
          ],
          adv: [
            { id: 'place', label: 'Where instances run', type: 'select', options: ['We choose', 'I choose the nodes'], value: 'We choose',
              plain: 'A node is one of our machines. By default we spread instances across nodes for you.',
              effect: (v) => v === 'We choose' ? 'We keep instances on separate nodes so one failure cannot take them all.' : 'You pick the nodes. You are then responsible for keeping them apart.',
              dry: (f, t) => `Change node placement from “${f}” to “${t}”.` },
            { id: 'health', label: 'Health check address', type: 'text', value: '/healthz',
              plain: 'The address we request to check that your app is alive.',
              effect: (v) => `We request ${v || '/'} on each instance. A failing answer marks it as having a problem.`,
              dry: (f, t) => `Check ${t || '/'} instead of ${f} for health.` },
            { id: 'cfgfile', label: 'Settings file', type: 'segmented', options: ['config', 'overrides'], value: 'config',
              plain: 'Which file the Config tab edits: the main config, or overrides that win over it.',
              effect: (v) => v === 'config' ? 'Edits the main settings every instance starts from.' : 'Edits overrides. Use them for one-off differences without touching the main config.',
              dry: (f, t) => `Point the Config tab at ${t}.` },
          ],
          previewTitle: 'What you’d get',
          preview: (s) => {
            const nodes = Array.from({ length: s.instances }, (_, i) => `<div class="node">${NODE_NAMES[i]}<small>${s.mem} GB, ${s.cpu} vCPU</small></div>`).join('');
            const stg = s.envs !== 'Production only' ? `<div class="node stg">node-a<small>staging, one copy</small></div>` : '';
            return `<div class="nodes" role="list" aria-label="Where your instances would run">${nodes}${stg}</div>
              <dl class="facts">
                <dt>Survives a machine failing</dt><dd>${s.instances > 1 ? 'Yes' : 'No'}</dd>
                <dt>Environments</dt><dd>${s.envs === 'Production only' ? '1' : '2'}</dd>
                <dt>Deploys from</dt><dd class="mono">${esc(s.branch)}</dd>
              </dl>
              ${meterHTML({ label: 'Memory across instances', value: s.mem * s.instances, max: 32, valueText: `${s.mem * s.instances} GB`, cap: 'Against the largest setup you can pick here.' })}
              ${meterHTML({ label: 'Processors across instances', value: s.cpu * s.instances, max: 16, valueText: `${s.cpu * s.instances} vCPU` })}`;
          },
        },
        {
          id: 'git', title: 'Deploy from git',
          intro: 'Point us at a repository and we build it and run it. You get the same pipeline whether it is your first project or your tenth.',
          applyLabel: 'Deploy…',
          knobs: [
            { id: 'server', label: 'Where the code lives', type: 'segmented', options: ['GitHub', 'GitLab', 'Custom'], value: 'GitHub',
              plain: 'The service that hosts your repository.',
              effect: (v) => v === 'Custom' ? 'A git server you run yourself. Give us its address below.' : `We fetch from ${v} using a token you provide.`,
              tip: 'pick the one you already use.' },
            { id: 'serverUrl', label: 'Server address', type: 'text', value: 'git.example.com', when: (s) => s.server === 'Custom',
              plain: 'The web address of your git server.', effect: (v) => `We fetch from https://${v}.` },
            { id: 'repo', label: 'Repository', type: 'text', value: 'acme/shop',
              plain: 'The owner and name, written owner/name.',
              effect: (v) => v ? `We would deploy ${v}.` : 'Enter the repository to deploy.' },
            { id: 'branch', label: 'Branch', type: 'select', options: ['main', 'staging', 'release-v2'], value: 'main',
              plain: 'Which branch to build.',
              effect: (v) => `We build the newest commit on ${v}.` },
            { id: 'build', label: 'Build command', type: 'text', value: 'npm run build',
              plain: 'What turns your source into something runnable.',
              effect: (v) => `Runs ${v || 'nothing'} after dependencies are installed.`,
              tip: 'copy the command you already use on your own machine.' },
            { id: 'run', label: 'Start command', type: 'text', value: 'node server.js',
              plain: 'What starts your app once it is built.',
              effect: (v) => `Runs ${v || 'nothing'} on every instance. We restart it if it stops.` },
          ],
          adv: [
            { id: 'install', label: 'Install command', type: 'text', value: 'npm ci',
              plain: 'How dependencies are installed before the build.', effect: (v) => `Runs ${v || 'nothing'} first.` },
            { id: 'nodes', label: 'Deploy to', type: 'select', options: ['node-a and node-b', 'node-a only', 'node-b only'], value: 'node-a and node-b',
              plain: 'Which of your nodes get this build.', effect: (v) => `The build goes to ${v}.` },
          ],
          previewTitle: 'The pipeline',
          steps: (s) => [
            { t: 'Fetch the code', d: `${s.server === 'Custom' ? s.serverUrl : s.server.toLowerCase() + '.com'}/${s.repo} at ${s.branch}` },
            { t: 'Install dependencies', d: s.install },
            { t: 'Build', d: s.build },
            { t: 'Start', d: `${s.run} on ${s.nodes}` },
            { t: 'Check health', d: 'Request the health address and wait for a good answer' },
          ],
          playLabel: 'Run a sample deploy',
          logLines: (s) => [
            `git clone https://${s.server === 'Custom' ? s.serverUrl : s.server.toLowerCase() + '.com'}/${s.repo} (${s.branch})`,
            `${s.install}   added 312 packages`,
            `${s.build}   compiled in 8.4s`,
            `start: ${s.run}   node-a, node-b`,
            'GET /healthz 200 OK',
          ],
          dry: (s) => [
            `Fetch ${s.repo} at ${s.branch} from ${s.server === 'Custom' ? s.serverUrl : s.server}.`,
            `Run “${s.install}”, then “${s.build}”.`,
            `Start “${s.run}” on ${s.nodes}.`,
            'Wait for the health check before sending visitors to the new build.',
          ],
        },
      ],
    },
    {
      id: 'domains', title: 'Domains', preview: true,
      intro: 'Register a domain, or bring one you already own. We handle the DNS records and the certificate so the padlock just works, and you can attach it to any project.',
      own: ['DNS records', 'Certificates and renewals', 'The registration paperwork'],
      you: ['Choosing the name', 'Owning it: you can leave with it'],
      notFit: 'You would rather keep DNS where it is. That works too, and we will give you the records to add.',
      sections: [{
        id: 'domain', title: 'Your domain',
        knobs: [
          { id: 'source', label: 'Where it comes from', type: 'segmented', options: ['Register a new one', 'Bring my own'], value: 'Bring my own',
            plain: 'Buy a name through us, or use one you already own.',
            effect: (v) => v === 'Bring my own' ? 'You keep your registrar. We just need to see the name and prove it is yours.' : 'We register it for you. You own it, and can transfer it out any time.',
            tip: 'bring your own if it is already working.' },
          { id: 'name', label: 'Domain', type: 'text', value: 'shop.example.com',
            plain: 'The name people will type.',
            effect: (v) => v ? `${v} is the address visitors will use.` : 'Enter a domain.' },
          { id: 'attach', label: 'Attach to', type: 'select', options: ['sample-shop', 'Nothing yet'], value: 'sample-shop',
            plain: 'Which project answers when someone visits.',
            effect: (v) => v === 'Nothing yet' ? 'The domain is set up but no project answers yet. That is a normal state; attach one whenever you like.' : `Visitors to this domain see ${v}.`,
            tip: 'attach it now. You can change it later.' },
          { id: 'dns', label: 'DNS', type: 'segmented', options: ['We manage it', 'I manage it'], value: 'We manage it',
            plain: 'DNS is the phone book that points your name at our machines.',
            effect: (v) => v === 'We manage it' ? 'We create and keep the records right. Nothing for you to do.' : 'You add a couple of records where your DNS lives. We will show you exactly which.',
            tip: 'let us manage it unless email or other services depend on your current setup.' },
          { id: 'renew', label: 'Renew automatically', type: 'toggle', value: true,
            plain: 'Keep the domain registered without you having to remember.',
            effect: (v) => v ? 'We renew it before it expires.' : 'It will lapse at expiry unless you renew it yourself.',
            tip: 'leave this on.' },
        ],
        previewTitle: 'Setting it up',
        steps: (s) => {
          const own = s.source === 'Bring my own', mine = s.dns === 'I manage it';
          const list = [];
          if (!own) list.push({ t: 'Payment', d: 'You confirm before we charge anything.' }, { t: 'Registering the name', d: 'Usually within minutes.' });
          list.push({ t: 'Setting up DNS', d: own && mine ? 'Nothing to do on our side.' : 'We create the zone and the records your project needs.' });
          list.push({ t: 'Waiting for DNS to spread', d: mine ? `Add this where your DNS lives: CNAME _acme-challenge.${s.name} to challenge.artisanhosting.net (sample value).` : 'Usually a few minutes. Nothing for you to do.' });
          list.push({ t: 'Getting your certificate', d: 'A certificate so the address shows the padlock.' });
          list.push({ t: 'Live', d: s.attach === 'Nothing yet' ? 'Set up, and not attached to a project yet.' : `${s.name} now shows ${s.attach}.` });
          return list;
        },
        playLabel: 'Play the setup',
        dry: (s) => [
          s.source === 'Bring my own' ? `Add ${s.name} as a domain you own.` : `Register ${s.name}.`,
          s.dns === 'We manage it' ? 'Create DNS records for it.' : 'Show you the records to add at your DNS provider.',
          'Request a certificate once DNS answers.',
          s.attach === 'Nothing yet' ? 'Leave it unattached.' : `Attach it to ${s.attach}.`,
          s.renew ? 'Turn on automatic renewal.' : 'Leave automatic renewal off.',
        ],
      }],
    },
    {
      id: 'email', title: 'Email', preview: true,
      intro: 'Real mailboxes on your own domain, with webmail, and someone watching storage so nothing bounces. Start with a couple of mailboxes and add more as you grow.',
      own: ['Mail servers', 'The records that point mail at us', 'Watching mailbox storage'],
      you: ['Your addresses and who uses them', 'Your domain'],
      notFit: 'You need more than ten mailboxes today. Ask us and we will size it.',
      sections: [{
        id: 'mail', title: 'Your mailboxes',
        knobs: [
          { id: 'domain', label: 'Domain', type: 'text', value: 'example.com',
            plain: 'The part after the @ in your addresses.',
            effect: (v) => `Addresses look like hello@${v || 'example.com'}.` },
          { id: 'count', label: 'Mailboxes', type: 'stepper', min: 1, max: 10, value: 5,
            plain: 'One for each person or role, such as hello@ or orders@.',
            effect: (v) => `${plural(v, 'mailbox', 'mailboxes')}. Each has its own login.`,
            tip: 'start with a mailbox per role you already answer.',
            dry: (f, t) => t > f ? `Create ${plural(t - f, 'new mailbox', 'new mailboxes')}.` : `Remove ${plural(f - t, 'mailbox', 'mailboxes')} and keep their mail for 30 days first.` },
          { id: 'store', label: 'Storage per mailbox', type: 'segmented', options: ['2 GB', '5 GB'], value: '2 GB',
            plain: 'How much mail each mailbox can hold.',
            effect: (v) => `Each mailbox holds up to ${v}.`,
            tip: 'choose 5 GB if people keep attachments.' },
          { id: 'warn', label: 'Warn me at', type: 'select', options: ['70%', '80%', '90%'], value: '80%',
            plain: 'We watch storage and tell you before a mailbox fills up.',
            effect: (v) => `You get a warning when a mailbox is ${v} full, before mail starts bouncing.`,
            tip: '80% leaves plenty of time to react.' },
          { id: 'records', label: 'Set up the DNS records', type: 'toggle', value: true,
            plain: 'Mail needs a few DNS records that point it at our servers.',
            effect: (v) => v ? 'We create and maintain those records for you.' : 'You add them yourself. We show you exactly which.',
            tip: 'leave this on if we already manage your domain.' },
        ],
        previewTitle: 'Your mailboxes',
        preview: (s) => {
          const names = ['hello', 'orders', 'support', 'billing', 'accounts', 'team', 'sales', 'info', 'admin', 'contact'];
          const used = [0.3, 1.7, 0.9, 0.2, 1.1, 0.1, 0.6, 1.9, 0.4, 0.8];
          const cap = parseInt(s.store, 10), warn = parseInt(s.warn, 10);
          const rows = names.slice(0, s.count).map((n, i) => {
            const pct = used[i] / cap * 100, hot = pct >= warn;
            return `<li><span class="addr">${esc(n)}@${esc(s.domain || 'example.com')}</span>
              <div class="meter-bar" role="img" aria-label="${used[i]} of ${cap} GB used"><i class="${hot ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></i><b style="left:${warn}%"></b></div>
              <span class="warnchip">${hot ? 'Would warn you' : `${used[i]} GB`}</span></li>`;
          }).join('');
          return `<ul class="mailboxes">${rows}</ul><p class="callout">The tick on each bar is your warning level. Sample usage shown.</p>`;
        },
        dry: (s, ch) => ch.length ? null : [],
      }],
    },
    {
      id: 'oss', title: 'Open-source apps', preview: true,
      intro: 'Software you would rather not run yourself. Pick an app and we install it, keep it updated, back it up, and put it on your own domain.',
      own: ['Installing and updating', 'Backups', 'HTTPS on your domain'],
      you: ['Using it', 'Your data'],
      notFit: 'You want to change the app’s source code. That is what a project is for.',
      sections: [{
        id: 'apps', title: 'Your app',
        knobs: [
          { id: 'app', label: 'App', type: 'select', options: ['Ghost', 'Plausible', 'Uptime Kuma', 'Shlink', 'PostHog'], value: 'Plausible',
            plain: 'The software we run for you.',
            effect: (v) => ({ Ghost: 'Publishing and newsletters.', Plausible: 'Simple, privacy-friendly website analytics.', 'Uptime Kuma': 'Checks that your sites and services are up, and tells you when they are not.', Shlink: 'Your own short-link service, with click statistics.', PostHog: 'Product analytics: funnels, sessions and feature flags.' }[v]) },
          { id: 'staging', label: 'Staging copy', type: 'toggle', value: false,
            plain: 'A second copy of the app to try things on.',
            effect: (v) => v ? 'Updates and setting changes are tried on the staging copy first.' : 'One copy. Updates go straight to the app you use.',
            tip: 'skip it unless several people rely on the app.' },
          { id: 'host', label: 'Address', type: 'text', value: 'stats.example.com',
            plain: 'Where you and your team open the app.',
            effect: (v) => `Opens at https://${v || 'stats.example.com'}.` },
          { id: 'sso', label: 'Single sign-on', type: 'toggle', value: false,
            plain: 'Let people sign in with the account they already have at work.',
            effect: (v) => v ? 'People sign in through your identity provider instead of making new passwords.' : 'The app keeps its own accounts and passwords.' },
          { id: 'smtp', label: 'Outgoing email', type: 'toggle', value: true,
            plain: 'Lets the app send invitations, alerts and password resets.',
            effect: (v) => v ? 'The app sends mail from your domain.' : 'The app cannot send email.',
            tip: 'leave it on. Most of these apps need it.' },
        ],
        previewTitle: 'What we would run',
        preview: (s) => `<h3>${esc(s.app)}</h3>
          <dl class="facts"><dt>Opens at</dt><dd class="mono">${esc(s.host || '')}</dd><dt>Copies</dt><dd>${s.staging ? '1 live, 1 staging' : '1 live'}</dd><dt>Sign-in</dt><dd>${s.sso ? 'Single sign-on' : 'App accounts'}</dd></dl>
          <p class="callout"><strong>We do:</strong> install it, keep it updated, back it up, and serve it over HTTPS.<br><strong>You do:</strong> use it. The data is yours.</p>`,
        dry: (s) => [`Install ${s.app} on a machine we manage.`, `Serve it at https://${s.host}.`, s.staging ? 'Create a staging copy to try updates on first.' : 'Run a single copy.', s.sso ? 'Connect it to your single sign-on.' : 'Use the app’s own accounts.', s.smtp ? 'Let it send email from your domain.' : 'Leave outgoing email off.'],
      }],
    },
    {
      id: 'compute', title: 'Virtual machines and GPUs', preview: false,
      intro: 'A whole machine of your own for software that does not fit a project, or a GPU for as long as you need one.',
      own: ['The hypervisor and the hardware', 'Keeping the machines running'],
      you: ['Everything inside the machine', 'Stopping a GPU session when you are done'],
      notFit: 'You just want to run a website. Managed hosting is simpler.',
      sections: [
        {
          id: 'vms', title: 'Virtual machines',
          knobs: [
            { id: 'vm', label: 'Machine', type: 'select', options: ['web-01', 'db-01', 'build-02'], value: 'web-01',
              plain: 'Which of your virtual machines to act on.',
              effect: (v) => v === 'build-02' ? 'build-02 is stopped right now.' : `${v} is running right now.` },
            { id: 'action', label: 'What to do', type: 'segmented', options: ['Start', 'Restart', 'Shut down', 'Stop'], value: 'Restart',
              plain: 'Four different ways to change a machine’s power.',
              effect: (v) => ({
                'Start': 'Powers the machine on.',
                'Restart': 'Reboots the machine. It is back in a minute or two.',
                'Shut down': 'Asks the operating system to close everything and power off. The polite way.',
                'Stop': 'Cuts power immediately. Unsaved work is lost.' }[v]),
              tip: 'use Shut down. Stop is for a machine that has stopped responding.' },
          ],
          previewTitle: 'The machine',
          preview: (s) => {
            const M = { 'web-01': { cpu: 21, ram: 47, up: '12d 4h', on: true }, 'db-01': { cpu: 8, ram: 71, up: '12d 4h', on: true }, 'build-02': { cpu: 0, ram: 0, up: '', on: false } }[s.vm];
            const after = s.action === 'Start' || s.action === 'Restart' ? 'running' : 'stopped';
            return `<div><span class="pill" data-s="${M.on ? 'running' : 'stopped'}">${M.on ? 'Running' : 'Stopped'}</span> <span class="mono muted">${esc(s.vm)}</span></div>
              ${meterHTML({ label: 'Processor', value: M.cpu, max: 100, valueText: M.on ? M.cpu + '%' : 'off' })}
              ${meterHTML({ label: 'Memory', value: M.ram, max: 100, valueText: M.on ? M.ram + '%' : 'off' })}
              <dl class="facts"><dt>Up for</dt><dd>${M.on ? M.up : 'not running'}</dd><dt>After this</dt><dd>${after === 'running' ? 'Running' : 'Stopped'}</dd></dl>
              <p class="callout">Changing a machine’s size is not available yet.</p>`;
          },
          dry: (s) => {
            const on = s.vm !== 'build-02';
            if (s.action === 'Start') return on ? [`${s.vm} is already running. Nothing would change.`] : [`Power on ${s.vm}.`, 'Mark it Running once it reports in.'];
            if (!on) return [`${s.vm} is already stopped. Nothing would change.`];
            if (s.action === 'Restart') return [`Reboot ${s.vm}.`, 'Mark it Running again once it reports in.'];
            if (s.action === 'Shut down') return [`Ask ${s.vm}’s operating system to close everything and power off.`, 'Mark it Stopped once it reports off.'];
            return [`Cut power to ${s.vm} immediately.`, 'Mark it Stopped. Anything unsaved is lost.'];
          },
        },
        {
          id: 'gpu', title: 'GPU sessions', preview: true,
          intro: 'Start a session, run your model, and stop it when you are done. Each session also gives you an address that speaks the OpenAI API, so tools that expect it can talk to your model.',
          knobs: [
            { id: 'size', label: 'GPU memory', type: 'select', options: ['24 GB', '48 GB', '80 GB'], value: '24 GB',
              plain: 'How much memory the GPU has. Bigger models need more.',
              effect: (v) => v === '24 GB' ? 'Fits models up to about 14 billion parameters.' : v === '48 GB' ? 'Fits models up to about 30 billion parameters.' : 'Fits the largest models we offer.',
              tip: 'start small. You can always start a bigger session.' },
            { id: 'model', label: 'Model', type: 'select', options: ['llama3.1:8b', 'qwen2.5:14b', 'mistral:7b'], value: 'llama3.1:8b',
              plain: 'The model loaded when the session starts.',
              effect: (v) => `${v} is loaded before the first request, so it is not slow.` },
            { id: 'idle', label: 'Stop when idle for', type: 'select', options: ['15 minutes', '1 hour', '4 hours'], value: '1 hour',
              plain: 'A session you forget about keeps running. This stops it for you.',
              effect: (v) => `After ${v} with no requests, the session stops on its own.`,
              tip: 'keep it short while you are experimenting.' },
            { id: 'session', label: 'Session', type: 'segmented', options: ['Start', 'Stop'], value: 'Start',
              plain: 'Turn the session on or off.',
              effect: (v) => v === 'Start' ? 'Finds a GPU, loads the model, and gives you an address to send requests to.' : 'Ends the session. The GPU is released.' },
          ],
          previewTitle: 'The session',
          steps: () => [
            { t: 'Finding a GPU', d: 'Usually under a minute.' },
            { t: 'Running', d: 'Model loaded. Your address is ready.' },
            { t: 'Stopping', d: 'Finishing any request in progress.' },
            { t: 'Stopped', d: 'The GPU is released.' },
          ],
          playLabel: 'Play a session',
          extra: (s) => `<div class="term" style="border-radius:8px">POST /v1/chat/completions<br>Host: your-session.example.net<br>Authorization: Bearer &lt;your key&gt;<br>{"model": "${esc(s.model)}", ...}</div>`,
          dry: (s) => s.session === 'Start'
            ? [`Find a ${s.size} GPU.`, `Load ${s.model}.`, `Give you an address that speaks the OpenAI API.`, `Stop the session after ${s.idle} with no requests.`]
            : ['End the running session.', 'Release the GPU.'],
        },
      ],
    },
  ];

  /* ======================================================================
     Overview
     ====================================================================== */
  function overview() {
    mountShop($('#shop'), { term: true, openLink: true });
  }

  /* ======================================================================
     Services workbench
     ====================================================================== */
  function services() {
    const params = new URLSearchParams(location.search);
    let famId = FAMILIES.some((f) => f.id === params.get('s')) ? params.get('s') : 'hosting';
    let secId = params.get('t');
    const states = {};
    const rail = $('#rail'), panel = $('#panel');

    rail.innerHTML = FAMILIES.map((f) => {
      const n = f.sections.reduce((a, s) => a + s.knobs.filter((k) => !k.when).length, 0);
      return `<a href="?s=${f.id}" data-f="${f.id}">${esc(f.title)}<small>${n} knobs</small></a>`;
    }).join('');
    rail.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-f]'); if (!a) return;
      e.preventDefault(); famId = a.dataset.f; secId = null; draw(true);
    });

    function stateFor(fam, sec) {
      const key = fam.id + ':' + sec.id;
      if (!states[key]) {
        const st = {};
        [...sec.knobs, ...(sec.adv || [])].forEach((k) => { st[k.id] = k.value; });
        states[key] = { state: st, defaults: { ...st }, ctx: { step: -1, lines: [] } };
      }
      return states[key];
    }

    function draw(push) {
      const fam = FAMILIES.find((f) => f.id === famId);
      const sec = fam.sections.find((s) => s.id === secId) || fam.sections[0];
      secId = sec.id;
      const url = `?s=${fam.id}${fam.sections.length > 1 && sec !== fam.sections[0] ? '&t=' + sec.id : ''}`;
      if (push) { try { history.replaceState(null, '', url); } catch (e) { /* file:// in some browsers */ } }
      $$('a[data-f]', rail).forEach((a) => a.setAttribute('aria-current', String(a.dataset.f === fam.id)));
      document.title = `${fam.title} | Artisan console (mock)`;

      const st = stateFor(fam, sec);
      const tabs = fam.sections.length > 1
        ? `<div class="subtabs" role="tablist" aria-label="${esc(fam.title)} sections">${fam.sections.map((s) => `<button type="button" role="tab" data-t="${s.id}" aria-selected="${s.id === sec.id}">${esc(s.title)}</button>`).join('')}</div>` : '';
      panel.innerHTML = `
        <div class="fam-head"><h1>${esc(fam.title)}</h1>${(fam.preview || sec.id === 'gpu') ? '<span class="tag" title="The controls are designed but the backend is not wired up yet">Preview</span>' : '<span class="tag">Sample</span>'}</div>
        <p class="fam-intro">${esc(fam.intro)}</p>
        <dl class="boundary">
          <div><dt>We own</dt><dd><ul>${fam.own.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd></div>
          <div><dt>You own</dt><dd><ul>${fam.you.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd></div>
          <div><dt>Not a fit if</dt><dd>${esc(fam.notFit)}</dd></div>
        </dl>
        ${tabs}
        <div class="bench">
          <div>
            ${sec.intro ? `<p class="sec-intro">${esc(sec.intro)}</p>` : ''}
            <div class="knobs-h"><h2>Settings</h2><span>${sec.knobs.filter((k) => !k.when).length} knobs${sec.adv ? `, ${sec.adv.length} advanced` : ''}</span></div>
            <div class="knobs" id="basic"></div>
            ${sec.adv ? `<details class="advanced"><summary>Advanced <span>(${sec.adv.length}). Most people never need these.</span></summary><div class="knobs" id="adv"></div></details>` : ''}
            <div class="applybar">
              <button class="btn btn-primary" type="button" id="apply">${esc(sec.applyLabel || 'Apply changes…')}</button>
              <button class="btn btn-ghost" type="button" id="reset">Reset</button>
              <span class="count" id="count" aria-live="polite"></span>
            </div>
            ${window.AH.edgeHTML('applybar', 'Applying is where the sample stops. On your own project this button makes the change.')}
          </div>
          <aside class="preview" aria-label="Preview">
            <header>${esc(sec.previewTitle || 'What you’d get')}</header>
            <div class="preview-body" id="pv"></div>
          </aside>
        </div>`;

      $$('[data-t]', panel).forEach((b) => b.addEventListener('click', () => { secId = b.dataset.t; draw(true); }));
      const els = [];
      [...sec.knobs.map((k) => [k, '#basic']), ...(sec.adv || []).map((k) => [k, '#adv'])].forEach(([k, host]) => {
        const el = renderKnob(k, st.state, update);
        $(host, panel).append(el); els.push([k, el]);
      });

      function visible() { return els.filter(([k]) => !k.when || k.when(st.state)); }
      function changed() { return visible().map(([k]) => k).filter((k) => st.state[k.id] !== st.defaults[k.id]); }
      function pv() {
        const box = $('#pv', panel);
        if (sec.steps) {
          const steps = sec.steps(st.state);
          box.innerHTML = `<ol class="steps">${steps.map((x, i) => `<li data-done="${i < st.ctx.step}" data-now="${i === st.ctx.step}"><span>${esc(x.t)}<small>${esc(x.d)}</small></span></li>`).join('')}</ol>
            <div><button class="btn btn-ghost btn-sm" type="button" data-play ${st.ctx.busy ? 'disabled' : ''}>${esc(sec.playLabel)}</button></div>
            ${st.ctx.lines.length ? `<div class="term" role="log" aria-live="off" tabindex="0" style="border-radius:8px">${st.ctx.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
            ${sec.extra ? sec.extra(st.state) : ''}`;
        } else {
          box.innerHTML = sec.preview(st.state);
        }
      }
      function update() {
        els.forEach(([k, el]) => { el.repaint(); if (k.when) el.hidden = !k.when(st.state); });
        pv();
        const n = changed().length;
        $('#count', panel).textContent = n ? `${plural(n, 'change')} from the current setup` : 'No changes from the current setup';
      }
      $('#pv', panel).addEventListener('click', async (e) => {
        if (!e.target.closest('[data-play]') || st.ctx.busy) return;
        const steps = sec.steps(st.state), logs = sec.logLines ? sec.logLines(st.state) : [];
        st.ctx.busy = true; st.ctx.lines = [];
        for (let i = 0; i < steps.length; i++) {
          st.ctx.step = i; if (logs[i]) st.ctx.lines.push(logs[i]); pv();
          await sleep(900);
        }
        st.ctx.step = steps.length; st.ctx.busy = false; pv();
      });
      $('#apply', panel).addEventListener('click', () => {
        const ch = changed();
        let steps;
        if (sec.dry) {
          steps = sec.dry(st.state, ch);
          if (steps === null) steps = ch.map(defaultDry);
        } else steps = ch.map(defaultDry);
        openDrawer({
          title: sec.applyLabel ? 'What deploying would do' : 'What applying would do',
          steps,
          empty: 'Nothing has changed from the current setup. Move a knob first.',
        });
      });
      function defaultDry(k) {
        const from = st.defaults[k.id], to = st.state[k.id];
        return k.dry ? k.dry(from, to, st.state) : `Change ${k.label.toLowerCase()} from ${fmtValue(k, from)} to ${fmtValue(k, to)}.`;
      }
      $('#reset', panel).addEventListener('click', () => { Object.assign(st.state, st.defaults); st.ctx = { step: -1, lines: [] }; update(); });
      update();
    }
    draw(false);
  }

  /* ======================================================================
     Project
     ====================================================================== */
  function project() {
    const shop = mountShop($('#shop'), { term: false, logEl: $('#logs') });
    // Environment switch
    const envSeg = $('#env');
    envSeg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      $$('[data-v]', envSeg).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      shop.setEnv(b.dataset.v);
    });
    // Tabs
    const tabs = $$('.tabs [role=tab]');
    function show(id) {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.p === id)));
      $$('.tabpanel').forEach((p) => { p.hidden = p.id !== 'p-' + id; });
    }
    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.p)));
    show('config');

    // Config
    const CONFIGS = {
      config: '{\n  "port": 3000,\n  "log_level": "info",\n  "database_pool": 10,\n  "cache_ttl_seconds": 60\n}',
      overrides: '{\n  "log_level": "debug"\n}',
    };
    const cfgSel = $('#cfg-file'), cfgText = $('#cfg-text');
    cfgText.value = CONFIGS.config;
    cfgSel.addEventListener('change', () => { cfgText.value = CONFIGS[cfgSel.value]; });
    $('#cfg-save').addEventListener('click', () => openDrawer({
      title: 'What saving would do',
      steps: [
        `Check that node-a and node-b both still have the version of ${cfgSel.value} you started from. If one has changed, you choose which to keep.`,
        `Save the new ${cfgSel.value} to node-a and node-b.`,
      ],
    }));

    // Secrets
    const SECRETS = { production: ['DATABASE_URL', 'SESSION_SECRET', 'SMTP_PASSWORD'], staging: ['DATABASE_URL', 'SESSION_SECRET'], dev: ['DATABASE_URL'] };
    const secEnv = $('#sec-env'), secList = $('#sec-list');
    function drawSecrets() {
      const rows = SECRETS[secEnv.value];
      secList.innerHTML = rows.length ? rows.map((k, i) => `<li><span>${esc(k)}</span><span class="val" aria-label="Value hidden">••••••••</span><button class="btn btn-danger btn-sm" type="button" data-del="${i}" aria-label="Delete ${esc(k)}">Delete</button></li>`).join('')
        : '<li><span class="muted" style="font-family:var(--font-sans)">No secrets in this environment yet. Add one below.</span></li>';
    }
    secEnv.addEventListener('change', drawSecrets);
    secList.addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (!b) return; SECRETS[secEnv.value].splice(+b.dataset.del, 1); drawSecrets(); });
    $('#sec-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const k = $('#sec-key').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!k || !$('#sec-val').value) { $('#sec-msg').textContent = 'Enter both a name and a value.'; return; }
      SECRETS[secEnv.value].push(k); $('#sec-key').value = ''; $('#sec-val').value = ''; $('#sec-msg').textContent = `Added ${k} to ${secEnv.value}. Sample only, so it is not stored.`;
      drawSecrets();
    });
    drawSecrets();

    // Logs
    $('#more-logs').addEventListener('click', () => {
      const t = $('#logs');
      for (let i = 0; i < 20; i++) {
        const d = document.createElement('div');
        d.innerHTML = `<span class="t">13:${String(40 + Math.floor(i / 2)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}</span>${i % 5 === 0 ? 'node-a  health check ok' : 'node-b  request 200 GET /products/' + (100 + i) + ' (' + (14 + (i % 9)) + ' ms)'}`;
        t.prepend(d);
      }
      $('#more-logs').textContent = 'Loaded 20 more (sample)';
    });

    // Source
    $('#copy-urn').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText('urn:artisan:project:63eff31e'); e.target.textContent = 'Copied'; }
      catch (err) { e.target.textContent = 'Copy failed. Select it and copy.'; }
      setTimeout(() => { e.target.textContent = 'Copy'; }, 1800);
    });
    $('#deploy-latest').addEventListener('click', () => openDrawer({
      title: 'What deploying would do',
      steps: ['Fetch the newest commit on main from acme/shop.', 'Install dependencies, then build.', 'Start the new build on node-a and node-b.', 'Wait for the health check before sending visitors to it.'],
    }));

    // Domain auto-renew
    const renew = $('#renew');
    renew.addEventListener('click', () => {
      const on = renew.getAttribute('aria-checked') !== 'true';
      renew.setAttribute('aria-checked', String(on));
      $('#renew-note').textContent = on ? 'Renews automatically before it expires.' : 'Will lapse at expiry unless you renew it yourself.';
    });
  }

  /* ======================================================================
     Usage
     ====================================================================== */
  function usage() {
    const PLANS = { Starter: { mem: 1, cpu: 1, bw: 5 }, Growth: { mem: 2, cpu: 2, bw: 10 } };
    const s = { plan: 'Growth', typical: 1.4, days: 1, size: 3, cpu: 0.8, bw: 6 };
    const noSpike = (st) => ({ ...st, days: 0 });
    const K = [
      { id: 'plan', label: 'Plan', type: 'segmented', options: ['Starter', 'Growth'],
        plain: 'Every plan includes some memory, processor and traffic.',
        effect: (v) => `${v} includes ${PLANS[v].mem} GB of memory, ${PLANS[v].cpu} vCPU and ${PLANS[v].bw} GB of traffic.` },
      { id: 'typical', label: 'Typical memory use', type: 'slider', min: 0.5, max: 4, step: 0.1, fmt: (v) => v.toFixed(1) + ' GB',
        plain: 'What your project uses on an ordinary day.', effect: (v) => `About ${v.toFixed(1)} GB on most days.` },
      { id: 'days', label: 'Traffic spike', type: 'stepper', min: 0, max: 5, fmt: (v) => plural(v, 'day'),
        plain: 'A launch, a mention, or a bad crawler.',
        effect: (v) => v === 0 ? 'No spike this month.' : `${plural(v, 'day')} of heavy use, starting on day 12.` },
      { id: 'size', label: 'Spike size', type: 'slider', min: 1, max: 8, step: 0.5, fmt: (v) => v.toFixed(1) + ' GB',
        plain: 'How much memory you use on a spike day.', effect: (v, st) => st.days ? `${v.toFixed(1)} GB on each spike day.` : 'Only matters if there is a spike.' },
    ];
    const ADV = [
      { id: 'cpu', label: 'Processor, average', type: 'slider', min: 0.1, max: 4, step: 0.1, fmt: (v) => v.toFixed(1) + ' vCPU', plain: 'How much processing your project uses on average.', effect: null },
      { id: 'bw', label: 'Traffic this month', type: 'slider', min: 0, max: 30, step: 1, fmt: (v) => v + ' GB', plain: 'Data sent to your visitors this month.', effect: null },
    ];
    const els = [];
    const host = $('#u-knobs'), adv = $('#u-adv');
    K.forEach((k) => { const el = renderKnob(k, s, draw); host.append(el); els.push(el); });
    ADV.forEach((k) => { const el = renderKnob(k, s, draw); adv.append(el); els.push(el); });

    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    function series(st) {
      return Array.from({ length: 30 }, (_, d) => (d >= 11 && d < 11 + st.days) ? st.size : Math.max(0.2, st.typical * (1 + 0.08 * Math.sin(d * 1.7))));
    }
    function draw() {
      els.forEach((e) => e.repaint());
      const inc = PLANS[s.plan], data = series(s);
      const avg = mean(data), base = mean(series(noSpike(s)));
      const above = Math.max(0, avg - inc.mem);
      const W = 600, H = 230, L = 40, B = 26, T = 12;
      const ymax = Math.max(4, Math.ceil(Math.max(...data, inc.mem) * 1.1));
      const y = (v) => T + (H - T - B) * (1 - v / ymax);
      const bw = (W - L - 4) / 30;
      const bars = data.map((v, i) => `<rect class="bar${v === s.size && s.days && i >= 11 && i < 11 + s.days ? ' spike' : ''}" x="${(L + i * bw + 1.5).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="2"/>`).join('');
      $('#u-chart').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Memory use for each of 30 days, with your plan's included amount and your monthly average">
        <text x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0</text><text x="${L - 6}" y="${y(ymax) + 10}" text-anchor="end">${ymax} GB</text>
        ${bars}
        <line class="incl" x1="${L}" x2="${W}" y1="${y(inc.mem)}" y2="${y(inc.mem)}"/><text class="lbl-incl" x="${W - 2}" y="${y(inc.mem) - 6}" text-anchor="end">included: ${inc.mem} GB</text>
        <line class="avg" x1="${L}" x2="${W}" y1="${y(avg)}" y2="${y(avg)}"/><text class="lbl-avg" x="${L + 4}" y="${y(avg) - 6}">monthly average: ${avg.toFixed(2)} GB</text>
        <text x="${L}" y="${H - 6}">day 1</text><text x="${W}" y="${H - 6}" text-anchor="end">day 30</text></svg>`;
      let v = above === 0
        ? `Your monthly average is ${avg.toFixed(2)} GB, under the ${inc.mem} GB ${s.plan} includes. Nothing extra is billed for memory.`
        : `Your monthly average is ${avg.toFixed(2)} GB. ${s.plan} includes ${inc.mem} GB, so ${above.toFixed(2)} GB is above it, and only that part is billed.`;
      if (s.days) v += ` The spike moves the month by ${(avg - base).toFixed(2)} GB, not by the full ${(s.size - s.typical).toFixed(1)} GB it rose that day.`;
      $('#u-verdict').textContent = v;
      const g = (label, val, incl, unit, digits) => meterHTML({ label, value: val, max: Math.max(incl * 2, val * 1.15, 1), mark: incl, valueText: `${val.toFixed(digits)} ${unit}`,
        cap: val > incl ? `${(val - incl).toFixed(digits)} ${unit} above the ${incl} ${unit} included` : `Within the ${incl} ${unit} included` });
      $('#u-gauges').innerHTML = g('Memory, monthly average', avg, inc.mem, 'GB', 2) + g('Processor, average', s.cpu, inc.cpu, 'vCPU', 1) + g('Traffic this month', s.bw, inc.bw, 'GB', 0);
    }
    draw();
  }

  window.AHPages = { overview, services, project, usage };
})();
