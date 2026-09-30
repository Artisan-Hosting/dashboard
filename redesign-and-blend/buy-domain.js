/* Domain purchase mock: search -> price quote -> pay -> watch it get set up.
   Shows the states the backend can actually produce: a held price that
   expires, a name that is simply "not available" (taken, unsupported and over
   the price cap all look the same), and a registration that fails after the
   card was charged (refunded) or needs a person (needs_admin). */
(function () {
  'use strict';
  const { $, $$, esc, sleep } = window.AH;
  const { S, usd, canSpend, checkout } = window.AHS;

  const TLDS = [['.com', 1350], ['.net', 1420], ['.org', 1290], ['.dev', 1400], ['.app', 1600], ['.io', null]];
  const QUOTE_SECS = 600;
  const orders = [
    { d: 'Sep 12', fq: 'artisanwidgets.com', c: 1350, s: 'active' },
    { d: 'Aug 30', fq: 'mysite.dev', c: 1400, s: 'refunded' },
  ];
  const ST_LABEL = { active: 'Live', refunded: 'Refunded', needs_admin: 'We are looking at it', awaiting_payment: 'Waiting for payment', registering: 'Setting up' };
  let sel = null, quote = null, timer = null, busy = false, outcome = 'succeed';

  // Keep letters, digits, hyphens and dots, drop a typed-in ending like ".com", then trim.
  const clean = (v) => v.toLowerCase().replace(/[^a-z0-9.-]/g, '').replace(/\.[a-z.]*$/, '').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
  function available(name, tld, cents) {
    if (cents == null) return false;                                   // not sold here
    if (tld === '.com' && name.length <= 4) return false;              // short .com names are taken
    if (name === 'artisan' && (tld === '.com' || tld === '.net')) return false;
    return true;
  }

  /* ---------- Steps header ---------- */
  function setStep(n) {
    $$('#steps li').forEach((li, i) => {
      li.className = i < n ? 'done' : '';
      if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  /* ---------- Notice (role / kill switch) ---------- */
  function renderNotice() {
    const g = canSpend();
    $('#notice').innerHTML = g.ok ? '' : '<p class="note bad">' + esc(g.why) + ' You can still search and see prices.</p>';
    if (quote) renderQuote();
  }

  /* ---------- Search ---------- */
  function search(raw) {
    const name = clean(raw);
    const ul = $('#results');
    if (!name) { ul.hidden = false; ul.innerHTML = '<li><span class="sub">Type a name to search, like <code>artisan-widgets</code>.</span></li>'; return; }
    ul.hidden = false;
    ul.innerHTML = TLDS.map(([tld, cents]) => {
      const fq = name + tld, ok = available(name, tld, cents);
      return '<li data-off="' + (ok ? 0 : 1) + '"><span class="fq">' + esc(fq) + '</span>' +
        (ok ? '<span class="sub">' + usd(cents) + ' for the first year</span><button class="btn btn-primary btn-sm" type="button" data-fq="' + esc(fq) + '" data-c="' + cents + '">Choose</button>'
          : '<span class="sub" title="Taken, or a name we do not sell here">Not available</span><span></span>') + '</li>';
    }).join('');
    $$('[data-fq]', ul).forEach((b) => b.onclick = () => choose(b.dataset.fq, +b.dataset.c));
    setStep(0);
  }

  /* ---------- Quote ---------- */
  let attach = 'sample-shop', invite = '';
  function choose(fq, cents) {
    sel = fq;
    quote = { fq, cents, exp: Date.now() + QUOTE_SECS * 1000 };
    $('#s-order').hidden = true; order = null;
    renderQuote(); setStep(1);
    $('#s-quote').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    clearInterval(timer); timer = setInterval(tick, 1000);
  }
  const left = () => Math.max(0, Math.round((quote.exp - Date.now()) / 1000));
  function tick() {
    const t = $('#qtimer'); if (!t || !quote) return;
    const s = left();
    t.className = 'timer' + (s === 0 ? ' out' : '');
    t.textContent = s === 0 ? 'This price has expired.' : 'Price held for ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    const buy = $('#buy'), fresh = $('#fresh');
    if (buy) buy.disabled = s === 0 || busy || !canSpend().ok;
    if (fresh) fresh.hidden = s !== 0;
  }
  function renderQuote() {
    const el = $('#s-quote'); if (!quote) return;
    el.hidden = false;
    el.innerHTML = '<div class="quote"><h2 id="h-quote" class="visually-hidden">Review</h2>' +
      '<div class="fq">' + esc(quote.fq) + '</div>' +
      '<div class="due"><span>First year</span><b>' + usd(quote.cents) + '</b></div>' +
      '<p class="timer" id="qtimer"></p>' +
      '<div class="two"><div class="form" style="margin:0"><label for="att">Point it at</label><select class="field field-sans" id="att"><option' + (attach === 'sample-shop' ? ' selected' : '') + '>sample-shop</option><option' + (attach === 'Nothing yet' ? ' selected' : '') + '>Nothing yet</option></select></div>' +
      '<div class="form" style="margin:0"><label for="inv">Invite someone to manage DNS <span class="muted">(optional)</span></label><input class="field" id="inv" type="email" placeholder="them@example.com" value="' + esc(invite) + '"></div></div>' +
      '<p class="sub">It is registered for one year. Renewing is not available yet, so note the date when it is live.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" type="button" id="buy">Buy ' + esc(quote.fq) + '</button><button class="btn btn-ghost" type="button" id="fresh" hidden>Get a fresh price</button><button class="btn btn-ghost" type="button" id="back">Pick a different name</button></div>' +
      '<p class="footnote muted" style="font-size:.92rem">You pay once, by card. If we cannot register the name, the payment is refunded to the same card.</p></div>';
    $('#att').onchange = (e) => { attach = e.target.value; };
    $('#inv').oninput = (e) => { invite = e.target.value; };
    $('#back').onclick = () => { quote = null; clearInterval(timer); el.hidden = true; setStep(0); $('#q').focus(); };
    $('#fresh').onclick = () => { quote.exp = Date.now() + QUOTE_SECS * 1000; tick(); };
    $('#buy').onclick = buy;
    tick();
  }

  /* ---------- Pay, then watch ---------- */
  let order = null;
  async function buy() {
    const q = quote;
    const ok = await checkout({
      title: 'Buy ' + q.fq, sub: 'You confirm before anything is charged.',
      lines: [
        { t: 'Payment', d: 'You pay ' + usd(q.cents) + ' for one year.' },
        { t: 'Registering the name', d: 'Usually within minutes.' },
        { t: 'Setting up DNS', d: invite ? 'We create the records, and invite ' + invite + ' to manage them.' : 'We create the zone and the records your project needs.' },
        { t: 'Getting your certificate', d: 'So the address shows the padlock.' },
        { t: 'Live', d: attach === 'Nothing yet' ? 'Set up, and not pointing at a project yet.' : q.fq + ' shows ' + attach + '.' },
      ],
      amount: q.cents, amountLabel: 'Charged today', cta: 'Continue to payment',
      footnote: 'If we cannot register the name, we refund the payment to the same card.',
    });
    if (!ok) return;
    startOrder(q);
  }
  async function startOrder(q) {
    busy = true; setStep(3);
    clearInterval(timer);
    const row = { d: 'Sep 30', fq: q.fq, c: q.cents, s: 'registering' };
    orders.unshift(row); renderOrders();
    order = { fq: q.fq, steps: [['Payment received', 'done'], ['Registering the name', 'pending'], ['Setting up DNS', 'pending'], ['Getting your certificate', 'pending'], ['Live', 'pending']], end: null };
    const el = $('#s-order'); el.hidden = false; $('#s-quote').hidden = true;
    const paint = () => {
      el.innerHTML = '<h2 id="h-order" style="margin-bottom:12px">' + esc(order.fq) + '</h2><ol class="progress" aria-live="polite">' +
        order.steps.map(([t, st, note]) => '<li data-st="' + st + '"><span>' + esc(t) + (note ? '<small>' + esc(note) + '</small>' : '') + '</span></li>').join('') + '</ol>' +
        (order.end ? '<p class="' + (order.endBad ? 'note bad' : 'note') + '" style="margin-top:16px">' + order.end + '</p>' +
          '<div style="margin-top:14px"><button class="btn btn-ghost" type="button" id="again">Buy another domain</button></div>' : '');
      const a = $('#again'); if (a) a.onclick = () => { el.hidden = true; order = null; quote = null; busy = false; setStep(0); $('#q').focus(); };
    };
    const set = (i, st, note) => { order.steps[i][1] = st; if (note !== undefined) order.steps[i][2] = note; paint(); };
    paint();
    await sleep(700); set(1, 'doing');
    await sleep(1800);

    if (outcome === 'refuse') {
      set(1, 'bad', 'The registry refused this name.');
      order.steps.push(['Refunding ' + usd(q.cents), 'doing']); paint();
      await sleep(1500);
      order.steps[order.steps.length - 1][1] = 'done';
      order.end = '<b>We could not register ' + esc(q.fq) + '.</b> Your ' + usd(q.cents) + ' has been refunded to the card ending 4242. You were not left with a charge and no domain.';
      order.endBad = true; row.s = 'refunded'; busy = false; paint(); renderOrders(); return;
    }
    if (outcome === 'admin') {
      set(1, 'bad', 'This one needs a person to look at it.');
      order.end = '<b>We are looking at this one.</b> We will either finish the registration or refund you in full. You do not need to do anything, and you will not be charged twice.';
      order.endBad = true; row.s = 'needs_admin'; busy = false; paint(); renderOrders(); return;
    }
    set(1, 'done', 'Registered for one year.');
    set(2, 'doing'); await sleep(1300); set(2, 'done', attach === 'Nothing yet' ? '' : 'Records point at ' + attach + '.');
    set(3, 'doing'); await sleep(1600); set(3, 'done');
    set(4, 'done');
    order.end = '<b>' + esc(q.fq) + ' is live.</b> ' + (attach === 'Nothing yet' ? 'It is not pointing at a project yet. Attach one from the Domains page.' : 'Visitors now see ' + esc(attach) + '.');
    row.s = 'active'; busy = false; paint(); renderOrders();
  }

  function renderOrders() {
    $('#orders').innerHTML = orders.map((o) => '<tr><td>' + esc(o.d) + '</td><td class="fq mono">' + esc(o.fq) + '</td><td class="amt">' + usd(o.c) + '</td><td><span class="pill" data-s="' + o.s + '">' + esc(ST_LABEL[o.s] || o.s) + '</span></td></tr>').join('');
  }

  /* ---------- Boot ---------- */
  window.AHPages = window.AHPages || {};
  window.AHPages['buy-domain'] = function () {
    window.AHS.signedShell('buy-domain');
    window.AHS.addControl('<label>When we register it <select id="mc-out"><option value="succeed">It works</option><option value="refuse">Registry refuses (refunded)</option><option value="admin">Needs a person</option></select></label>');
    $('#mc-out').addEventListener('change', (e) => { outcome = e.target.value; });
    $('#sform').addEventListener('submit', (e) => { e.preventDefault(); search($('#q').value); });
    window.AHS.on(renderNotice);
    renderNotice(); renderOrders(); setStep(0);
  };
})();
