/* Go-live mock: a running app -> an address -> a live check.
   Three ways to get an address: our free one, a domain the organization already
   has (bought here or brought), or a new domain bought for this app. Where we
   hold the DNS zone we write the records; where we do not, we show them and
   check. Server and port are never typed: Portal knows both.
   Everything is sample data. Nothing is saved, charged or sent. */
(function () {
  'use strict';
  const { $, $$, esc, sleep } = window.AH;

  const APP = 'sample-shop', PORT = 24117, FREE_ZONE = 'arhst.net';
  const EDGE = [['A', '203.0.113.10'], ['AAAA', '2001:db8::10']];
  const TAKEN = ['www', 'shop', 'app', 'admin', 'api', 'mail', 'blog'];
  const LABEL = /^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/;

  const domains = [
    { fq: 'acmestudio.com', src: 'bought here', dns: 'managed', on: '' },
    { fq: 'acme-shop.dev', src: 'bought here', dns: 'managed', on: 'billing-api' },
    { fq: 'acme-old.net', src: 'brought by you', dns: 'manual', on: '' },
  ];
  const apps = [
    { app: 'billing-api', addr: 'acme-shop.dev', s: 'live' },
    { app: 'blog', addr: 'blog.' + FREE_ZONE, s: 'waiting' },
    { app: 'worker-ui', addr: '', s: 'none' },
    { app: APP, addr: '', s: 'none' },
  ];
  const ST = { live: 'Live', waiting: 'Waiting for DNS', down: 'App not answering', none: 'No address', building: 'Setting up', failed: 'Needs attention' };

  const st = { mode: 'free', free: APP, dom: null, host: 'sub', sub: 'shop', busy: false, outcome: 'ok' };

  const domain = () => domains.find((d) => d.fq === st.dom);
  function fqdn() {
    if (st.mode === 'free') return st.free + '.' + FREE_ZONE;
    const d = domain(); if (!d) return '';
    return st.host === 'apex' ? d.fq : st.host === 'www' ? 'www.' + d.fq : st.sub + '.' + d.fq;
  }
  /* Why the Set it up button is off, or '' when it is fine. */
  function problem() {
    if (st.mode === 'buy') return '';
    if (st.mode === 'free') {
      if (!LABEL.test(st.free)) return 'Use letters, numbers and hyphens.';
      if (TAKEN.includes(st.free) && st.free !== APP) return st.free + ' is already taken. Try another.';
      return '';
    }
    const d = domain();
    if (!d) return 'Choose a domain.';
    if (st.host === 'apex' && d.on) return d.fq + ' already points at ' + d.on + '. Use a subdomain instead.';
    if (st.host === 'sub' && !LABEL.test(st.sub)) return 'Use letters, numbers and hyphens for the subdomain.';
    if (st.host === 'sub' && TAKEN.includes(st.sub) && st.sub !== 'shop') return st.sub + '.' + d.fq + ' is already taken.';
    return '';
  }

  /* ---------- Steps header ---------- */
  function setStep(n) {
    $$('#steps li').forEach((li, i) => {
      li.className = i < n ? 'done' : '';
      if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  /* ---------- Choose ---------- */
  const OPTS = [
    ['free', 'A free address', 'Live in seconds on ' + FREE_ZONE + '. Switch to your own later.'],
    ['owned', 'A domain I have', 'Bought here or brought by you. Use the domain itself or add a subdomain.'],
    ['buy', 'Buy a new domain', 'Search, pay, and we attach it to this app when it is ready.'],
  ];
  function renderOpts() {
    $('#opts').innerHTML = OPTS.map(([k, t, d]) =>
      '<button class="opt" type="button" role="radio" aria-checked="' + (st.mode === k) + '" data-k="' + k + '"><b>' + t + '</b><small>' + d + '</small></button>').join('');
    $$('.opt').forEach((b) => b.onclick = () => { if (st.busy) return; st.mode = b.dataset.k; paint(); });
  }

  function renderDetail() {
    const el = $('#detail');
    if (st.mode === 'free') {
      el.innerHTML = '<div class="row"><label class="visually-hidden" for="free">Name</label><input class="field" id="free" value="' + esc(st.free) + '" spellcheck="false" autocomplete="off"><span class="suffix">.' + FREE_ZONE + '</span></div>' +
        '<p class="hint">We write the DNS, get the certificate and connect it to the app. Nothing for you to do.</p>';
      $('#free').oninput = (e) => { st.free = e.target.value.toLowerCase().trim(); paintLight(); };
    } else if (st.mode === 'owned') {
      el.innerHTML = '<ul class="dom-list" id="doms">' + domains.map((d) =>
        '<li role="radio" aria-checked="' + (st.dom === d.fq) + '" tabindex="0" data-fq="' + d.fq + '" style="cursor:pointer"><span class="fq">' + esc(d.fq) + '</span>' +
        '<span class="sub">' + esc(d.src) + (d.on ? ' &middot; used by ' + esc(d.on) : '') + '</span>' +
        '<span class="pill" data-s="' + (d.dns === 'managed' ? 'live' : 'waiting') + '">' + (d.dns === 'managed' ? 'We manage its DNS' : 'You manage its DNS') + '</span></li>').join('') + '</ul>' +
        (st.dom ? hostPicker() : '<p class="hint">Choose a domain above.</p>') +
        '<p class="hint">Domains bought here, and any domain whose DNS we hold, are set up for you. For others we show the two records to add, then check them.</p>';
      $$('#doms li').forEach((li) => { const pick = () => { st.dom = li.dataset.fq; if (domain().on && st.host === 'apex') st.host = 'sub'; paint(); }; li.onclick = pick; li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }; });
      bindHost();
    } else {
      el.innerHTML = '<p>You will search for a name and pay on the next page. When the domain is ready we point it at <b class="mono">' + APP + '</b> for you, so you can come straight back to a live site.</p>';
    }
  }
  function hostPicker() {
    const d = domain();
    const chip = (k, t, off) => '<button class="chip" type="button" data-h="' + k + '" aria-pressed="' + (st.host === k) + '"' + (off ? ' disabled title="Already in use"' : '') + '>' + t + '</button>';
    return '<div class="chips" id="hosts">' + chip('apex', d.fq, !!d.on) + chip('www', 'www.' + d.fq) + chip('sub', 'A subdomain') + '</div>' +
      (st.host === 'sub' ? '<div class="row"><label class="visually-hidden" for="sub">Subdomain</label><input class="field" id="sub" value="' + esc(st.sub) + '" spellcheck="false" autocomplete="off"><span class="suffix">.' + esc(d.fq) + '</span></div>' : '');
  }
  function bindHost() {
    $$('#hosts .chip').forEach((b) => b.onclick = () => { st.host = b.dataset.h; paint(); });
    const s = $('#sub'); if (s) s.oninput = (e) => { st.sub = e.target.value.toLowerCase().trim(); paintLight(); };
  }

  function paintLight() {
    const p = problem(), go = $('#go'), why = $('#why');
    go.disabled = st.busy || !!p;
    why.className = 'hint' + (p ? ' bad' : '');
    why.innerHTML = p ? esc(p) : (st.mode === 'buy' ? '' : 'Visitors will find it at <b class="mono">' + esc(fqdn()) + '</b>');
    go.textContent = st.mode === 'buy' ? 'Search for a domain' : 'Set it up';
  }
  function paint() { renderOpts(); renderDetail(); paintLight(); }

  /* ---------- Set up ---------- */
  const STEPS = [
    ['Reserve the name', 'Recorded as belonging to Acme Studio and this app.'],
    ['Point it at our edge', ''],
    ['Connect it to your app', 'Server and port ' + PORT + ' filled in for you.'],
    ['Get a security certificate', 'HTTPS, renewed automatically.'],
    ['Check that it answers', ''],
  ];
  const ICO = { todo: '·', doing: '…', done: '✓', wait: '!', fail: '✕' };
  function drawSteps(state) {
    $('#check').innerHTML = STEPS.map(([t, d], i) => {
      const s = state[i] || { st: 'todo' };
      return '<li data-st="' + s.st + '"><span class="ico" aria-hidden="true">' + ICO[s.st] + '</span><div><b>' + t + '</b><small>' + (s.msg != null ? s.msg : d) + '</small></div></li>';
    }).join('');
  }
  function press(label, host) {
    return new Promise((res) => {
      host.innerHTML = '<div class="actions"><button class="btn btn-primary" type="button" id="press">' + label + '</button></div>';
      $('#press').onclick = () => { host.innerHTML = ''; res(); };
    });
  }
  const setApp = (s, addr) => { const a = apps.find((x) => x.app === APP); a.s = s; if (addr != null) a.addr = addr; renderApps(); };

  async function run() {
    const fq = fqdn(), d = st.mode === 'owned' ? domain() : null;
    const manual = !!d && d.dns === 'manual';
    st.busy = true; paintLight();
    $('#s-run').hidden = false; $('#s-live').hidden = true; $('#run-fq').textContent = fq; setStep(2);
    const extra = $('#run-extra'); extra.innerHTML = '';
    const state = [];
    const set = (i, s, msg) => { state[i] = { st: s, msg }; drawSteps(state); };
    setApp('building', fq);
    $('#s-run').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    set(0, 'doing'); await sleep(700); set(0, 'done');

    set(1, 'doing'); await sleep(800);
    if (manual) {
      set(1, 'wait', 'We do not hold the DNS for ' + esc(d.fq) + '. Add these two records where you manage it.');
      extra.innerHTML = '<div class="records"><table><tr><th>Type</th><th>Name</th><th>Value</th></tr>' +
        EDGE.map(([t, v]) => '<tr><td>' + t + '</td><td>' + esc(fq) + '</td><td>' + v + '</td></tr>').join('') + '</table></div><div id="pb"></div>';
      setApp('waiting', fq);
      await press('I have added them, check now', $('#pb'));
      extra.innerHTML = '';
      set(1, 'doing', 'Looking for the records…'); await sleep(900);
    }
    set(1, 'done', manual ? 'Both records found.' : 'Created the A and AAAA records in Cloudflare (DNS only, so our certificate is the one visitors see).');

    set(2, 'doing'); await sleep(800); set(2, 'done');

    set(3, 'doing'); await sleep(1100);
    if (st.outcome === 'cert') {
      set(3, 'fail', 'We could not get a certificate just now. Nothing is wrong with your app. Try again in a minute.');
      await press('Try again', extra); st.outcome = 'ok'; $('#mc-gl').value = 'ok';
      set(3, 'doing'); await sleep(900);
    }
    set(3, 'done');

    set(4, 'doing'); await sleep(900);
    while (st.outcome === 'dns' || st.outcome === 'down') {
      if (st.outcome === 'dns') {
        set(4, 'wait', 'The name has not reached everyone yet. This can take a few minutes; nothing needs fixing.'); setApp('waiting', fq);
      } else {
        set(4, 'fail', 'Nothing answered on port ' + PORT + '. Your app may have stopped or crashed. <a href="#" onclick="return false">View its logs</a>.'); setApp('down', fq);
      }
      await press('Check again', extra); st.outcome = 'ok'; $('#mc-gl').value = 'ok';
      set(4, 'doing', 'Checking…'); await sleep(900);
    }
    set(4, 'done', 'Answered over HTTPS.');
    setApp('live', fq);
    live(fq);
    st.busy = false; paintLight(); setStep(3);
  }

  function live(fq) {
    const el = $('#s-live'); el.hidden = false;
    el.innerHTML = '<div class="live"><span class="pill" data-s="live">Live</span><div class="addr">https://' + esc(fq) + '</div>' +
      '<div class="probe"><span>DNS <b>points at our edge</b></span><span>Certificate <b>valid, renews itself</b></span><span>App <b>answered in 84 ms</b></span></div>' +
      '<div class="actions" style="margin-top:4px"><a class="btn btn-primary" href="#" onclick="return false">Open the site</a>' +
      '<button class="btn btn-ghost" type="button" id="again">Set up another address</button></div></div>';
    $('#again').onclick = () => { $('#s-run').hidden = true; el.hidden = true; setStep(1); $('#s-choose').scrollIntoView({ behavior: 'smooth' }); };
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderApps() {
    $('#apps').innerHTML = apps.map((a) =>
      '<tr><td class="mono">' + esc(a.app) + '</td><td class="mono">' + (a.addr ? esc(a.addr) : '<span class="sub">none yet</span>') + '</td>' +
      '<td><span class="pill" data-s="' + a.s + '">' + ST[a.s] + '</span></td>' +
      '<td class="r">' + (a.s === 'none' && a.app !== APP ? '<button class="btn btn-ghost btn-sm" type="button" disabled>Give it an address</button>' : '') + '</td></tr>').join('');
  }

  /* ---------- Boot ---------- */
  window.AHPages = window.AHPages || {};
  window.AHPages['go-live'] = function () {
    window.AHS.signedShell('go-live');
    window.AHS.addControl('<label>What happens when we set it up <select id="mc-gl"><option value="ok">It works</option><option value="dns">DNS is slow to spread</option><option value="cert">Certificate fails once</option><option value="down">App is not answering</option></select></label>');
    $('#mc-gl').addEventListener('change', (e) => { st.outcome = e.target.value; });
    $('#go').addEventListener('click', () => { if (st.mode === 'buy') { location.href = 'buy-domain.html'; } else if (!st.busy && !problem()) run(); });
    setStep(1); paint(); renderApps();
  };
})();
