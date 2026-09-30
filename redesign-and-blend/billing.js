/* Billing page mock: plan, credit, payments.
   Sample data mirrors Billing's Price Book v1 seed (plan names, prices,
   allowances, overage rates) so the numbers on screen are the real ones. */
(function () {
  'use strict';
  const { $, $$, esc, sleep, meterHTML } = window.AH;
  const { S, usd, canSpend, checkout } = window.AHS;

  /* ---------- Sample data ---------- */
  const STOREFRONTS = [['developer', 'Developer'], ['business', 'Business'], ['email', 'Email']];
  const PLANS = {
    developer: [
      { code: 'dev_builder', name: 'Builder', cents: 800, bullets: ['0.5 GB memory', '0.25 processor', '10 GB traffic', '1,000 emails'] },
      { code: 'dev_pro', name: 'Pro', cents: 3200, bullets: ['2 GB memory', '1 processor', '50 GB traffic', '5,000 emails'] },
      { code: 'dev_team', name: 'Team', cents: 9500, bullets: ['6 GB memory', '3 processors', '200 GB traffic', '25,000 emails'] },
    ],
    business: [
      { code: 'biz_essentials', name: 'Essentials Care', cents: 3000, bullets: ['0.25 GB memory', '0.25 processor', 'We look after it'] },
      { code: 'biz_care', name: 'Business Care', cents: 9900, bullets: ['1 GB memory', '1 processor', 'We look after it'] },
      { code: 'biz_managed', name: 'Managed Platform', cents: 30000, bullets: ['4 GB memory', '2 processors', 'We look after it'] },
    ],
    email: [
      { code: 'mail_starter', name: 'Mail Starter', cents: 1200, bullets: ['3 mailboxes'] },
      { code: 'mail_business', name: 'Mail Business', cents: 2500, bullets: ['10 mailboxes'] },
      { code: 'mail_team', name: 'Mail Team', cents: 4500, bullets: ['25 mailboxes'] },
    ],
  };
  const PERIOD = { start: 'Sep 15', end: 'Oct 15', daysLeft: 15, days: 30 };
  const subsData = {
    developer: { plan: 'dev_builder', status: 'active', pending: null, ending: false },
    business: null,
    email: { plan: 'mail_starter', status: 'past_due', pending: null, ending: false, openInvoice: 1200 },
  };
  // Developer plan usage this period (averaged), the overage line the invoice will carry.
  const USAGE = { ram: 0.9, cpu: 0.2, egress: 6.2 };
  const RATES = { ram: 1000, cpu: 1300, egress: 5 }; // cents per GB-month / vCPU-month / GB
  const INCL = { dev_builder: { ram: 0.5, cpu: 0.25, egress: 10 }, dev_pro: { ram: 2, cpu: 1, egress: 50 }, dev_team: { ram: 6, cpu: 3, egress: 200 } };

  let credit = 4750;
  const ledger = [
    { d: 'Sep 27', t: 'GPU session, 1h 12m', c: -360 },
    { d: 'Sep 24', t: 'GPU session, 2h 5m', c: -625 },
    { d: 'Sep 20', t: 'Top-up', c: 5000 },
    { d: 'Sep 12', t: 'Virtual machine, 6h', c: -180 },
    { d: 'Sep 03', t: 'Top-up', c: 2500 },
  ];
  const payments = [
    { d: 'Sep 30', kind: 'domain', t: 'Domain: artisanwidgets.com', sub: 'Registered for one year', c: 1350, s: 'paid' },
    { d: 'Sep 20', kind: 'credit', t: 'Credit top-up', sub: 'Added to your credit', c: 5000, s: 'paid' },
    { d: 'Sep 15', kind: 'sub', t: 'Builder plan', sub: 'Sep 15 – Oct 15', c: 800, s: 'paid' },
    { d: 'Sep 15', kind: 'sub', t: 'Mail Starter plan', sub: 'Sep 15 – Oct 15', c: 1200, s: 'open' },
    { d: 'Aug 30', kind: 'domain', t: 'Domain: mysite.dev', sub: 'We could not register it', c: 1400, s: 'refunded' },
    { d: 'Aug 15', kind: 'sub', t: 'Builder plan', sub: 'Aug 15 – Sep 15, plus $4.00 above the plan', c: 1200, s: 'paid' },
    { d: 'Aug 15', kind: 'sub', t: 'Mail Starter plan', sub: 'Aug 15 – Sep 15', c: 1200, s: 'paid' },
    { d: 'Aug 02', kind: 'credit', t: 'Credit top-up', sub: 'Your card was declined', c: 2500, s: 'failed' },
    { d: 'Jul 20', kind: 'credit', t: 'Credit top-up', sub: 'Added to your credit', c: 2500, s: 'paid' },
    { d: 'Jul 15', kind: 'sub', t: 'Builder plan', sub: 'Jul 15 – Aug 15', c: 800, s: 'paid' },
    { d: 'Jul 15', kind: 'sub', t: 'Mail Starter plan', sub: 'Jul 15 – Aug 15', c: 1200, s: 'paid' },
    { d: 'Jun 15', kind: 'sub', t: 'Builder plan', sub: 'Jun 15 – Jul 15', c: 800, s: 'paid' },
  ];
  const STATUS_LABEL = { paid: 'Paid', open: 'Unpaid', failed: 'Failed', refunded: 'Refunded', active: 'Active', past_due: 'Payment due', none: 'No plan', ending: 'Ending' };

  const planOf = (sf, code) => PLANS[sf].find((p) => p.code === code);
  const pill = (s, label) => '<span class="pill" data-s="' + s + '">' + esc(label || STATUS_LABEL[s] || s) + '</span>';
  const lockNote = () => { const g = canSpend(); return g.ok ? '' : '<p class="locked">' + esc(g.why) + '</p>'; };

  /* ---------- Tabs ---------- */
  const tabs = ['plan', 'credit', 'pay'];
  let curTab = 'plan';
  function showTab(name) {
    curTab = name;
    tabs.forEach((t) => {
      $('#t-' + t).setAttribute('aria-selected', String(t === name));
      $('#p-' + (t === 'pay' ? 'pay' : t)).hidden = t !== name;
    });
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// */ }
  }

  /* ---------- Plan tab ---------- */
  let sf = 'developer';
  function renderPlan() {
    const root = $('#p-plan');
    const sub = subsData[sf];
    const cur = sub ? planOf(sf, sub.plan) : null;
    const seg = '<div class="seg" role="radiogroup" aria-label="Product">' + STOREFRONTS.map(([k, l]) =>
      '<button type="button" role="radio" data-sf="' + k + '" aria-checked="' + (k === sf) + '">' + l + '</button>').join('') + '</div>';

    let summary;
    if (!sub) {
      summary = '<div class="panel"><header>Your ' + esc(STOREFRONTS.find((s) => s[0] === sf)[1]) + ' plan</header><div class="panel-body">' +
        '<div class="subhead">' + pill('none') + '<span class="sub">You do not have a plan for this yet. Pick one below.</span></div></div></div>';
    } else {
      const status = sub.ending ? 'ending' : sub.status;
      const lines = [];
      if (sub.status === 'past_due') lines.push('<p class="note bad">The ' + usd(sub.openInvoice) + ' payment for this period did not go through. Your plan stays on for now, but pay it to keep it.</p>');
      if (sub.pending) lines.push('<p class="note">You are moving to <b>' + esc(planOf(sf, sub.pending).name) + '</b> on ' + PERIOD.end + '. Until then you keep ' + esc(cur.name) + '.</p>');
      if (sub.ending) lines.push('<p class="note">Cancelled. Your plan stays on until ' + PERIOD.end + ', then ends.</p>');
      const g = canSpend();
      summary = '<div class="panel"><header>Your ' + esc(STOREFRONTS.find((s) => s[0] === sf)[1]) + ' plan</header><div class="panel-body">' +
        '<div class="subhead"><h2>' + esc(cur.name) + '</h2>' + pill(status) + '</div>' +
        '<p><span class="big" style="font-size:2rem">' + usd(cur.cents) + '</span> <span class="sub">a month. Renews ' + PERIOD.end + '.</span></p>' + lines.join('') +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        (sub.status === 'past_due' ? '<button class="btn btn-primary" type="button" data-act="payopen"' + (g.ok ? '' : ' disabled') + '>Pay ' + usd(sub.openInvoice) + ' now</button>' : '') +
        (!sub.ending ? '<button class="btn btn-danger" type="button" data-act="cancel">Cancel plan</button>' : '') +
        '</div>' + (sub.status === 'past_due' ? lockNote() : '') + '</div></div>';
    }

    let usage = '';
    if (sf === 'developer' && sub && INCL[sub.plan]) {
      const inc = INCL[sub.plan];
      const over = Math.max(0, USAGE.ram - inc.ram) * RATES.ram + Math.max(0, USAGE.cpu - inc.cpu) * RATES.cpu + Math.max(0, USAGE.egress - inc.egress) * RATES.egress;
      usage = '<div class="panel"><header>This month so far</header><div class="panel-body">' +
        meterHTML({ label: 'Memory', value: USAGE.ram, max: Math.max(USAGE.ram, inc.ram) * 1.6, mark: inc.ram, valueText: USAGE.ram + ' GB', cap: 'Your plan includes ' + inc.ram + ' GB.' }) +
        meterHTML({ label: 'Processor', value: USAGE.cpu, max: Math.max(USAGE.cpu, inc.cpu) * 1.6, mark: inc.cpu, valueText: USAGE.cpu + '', cap: 'Your plan includes ' + inc.cpu + '.' }) +
        meterHTML({ label: 'Traffic', value: USAGE.egress, max: Math.max(USAGE.egress, inc.egress) * 1.6, mark: inc.egress, valueText: USAGE.egress + ' GB', cap: 'Your plan includes ' + inc.egress + ' GB.' }) +
        '<p class="' + (over ? 'note' : 'sub') + '">' + (over
          ? 'About <b>' + usd(Math.round(over)) + '</b> above your plan so far. Memory is $10 per GB, processor $13, traffic 5 cents per GB, averaged over the month. It is added to your ' + PERIOD.end + ' payment.'
          : 'Nothing above your plan so far.') + '</p></div></div>';
    }

    const cards = '<div class="plans">' + PLANS[sf].map((p) => {
      const isCur = sub && sub.plan === p.code;
      let btn;
      if (isCur) btn = '<button class="btn btn-ghost" type="button" disabled>Your plan</button>';
      else if (!sub) btn = '<button class="btn btn-primary" type="button" data-pick="' + p.code + '">Choose ' + esc(p.name) + '</button>';
      else if (p.cents > cur.cents) btn = '<button class="btn btn-primary" type="button" data-pick="' + p.code + '">Upgrade to ' + esc(p.name) + '</button>';
      else btn = '<button class="btn btn-ghost" type="button" data-pick="' + p.code + '">Switch on ' + PERIOD.end + '</button>';
      return '<div class="plan"' + (isCur ? ' aria-current="true"' : '') + '><h3>' + esc(p.name) + '</h3><div class="price">' + usd(p.cents) + ' <small>a month</small></div>' +
        '<ul>' + p.bullets.map((b) => '<li>' + esc(b) + '</li>').join('') + '</ul>' + btn + '</div>';
    }).join('') + '</div>' + lockNote();

    const policy = S.role === 'Viewer' ? '' :
      '<div class="panel"><header>Who can see billing</header><div class="panel-body">' +
      '<div class="subhead"><span class="knob-label">Let viewers see billing</span><button type="button" class="switch" role="switch" id="vb" aria-label="Let viewers see billing" aria-checked="' + S.viewerBilling + '"></button></div>' +
      '<p class="sub">' + (S.viewerBilling
        ? 'Viewers in your organization can see your plans, credit and payments. They still cannot change or pay for anything.'
        : 'Only Admins can see billing right now. Turn this on if you want viewers to see plans, credit and payments too. They will never be able to change or pay for anything.') + '</p></div></div>';
    root.innerHTML = '<div class="stack">' + seg + '<div class="split">' + summary + usage + '</div><div><h2 style="margin-bottom:14px">' + (sub ? 'Change plan' : 'Plans') + '</h2>' + cards +
      (sf === 'developer' ? '<p class="sub" style="margin-top:12px">Going up takes effect now and you pay only the difference for the days left. Going down waits for the end of the period, so you never lose something you have paid for.</p>' : '') + '</div>' + policy + '</div>';

    const vb = $('#vb', root); if (vb) vb.onclick = () => window.AHS.setViewerBilling(!S.viewerBilling);
    $$('[data-sf]', root).forEach((b) => b.onclick = () => { sf = b.dataset.sf; renderPlan(); });
    $$('[data-pick]', root).forEach((b) => b.onclick = () => pickPlan(b.dataset.pick));
    const c = $('[data-act=cancel]', root); if (c) c.onclick = cancelPlan;
    const po = $('[data-act=payopen]', root); if (po) po.onclick = payOpen;
  }

  async function pickPlan(code) {
    const sub = subsData[sf], p = planOf(sf, code), cur = sub && planOf(sf, sub.plan);
    if (sub && p.cents < cur.cents) {
      const ok = await checkout({
        pay: false, title: 'Switch to ' + p.name, sub: 'Nothing is charged and nothing changes today.',
        lines: [{ t: 'You keep ' + cur.name, d: 'Everything you have now stays until ' + PERIOD.end + '.' }, { t: 'On ' + PERIOD.end, d: 'You move to ' + p.name + ' at ' + usd(p.cents) + ' a month.' }],
        cta: 'Schedule the switch',
      });
      if (ok) { sub.pending = code; renderPlan(); }
      return;
    }
    const today = sub ? Math.round((p.cents - cur.cents) * PERIOD.daysLeft / PERIOD.days) : p.cents;
    const ok = await checkout({
      title: (sub ? 'Upgrade to ' : 'Start ') + p.name,
      sub: sub ? 'Takes effect as soon as the payment goes through.' : 'Your plan starts as soon as the payment goes through.',
      lines: sub
        ? [{ t: 'Today', d: 'You pay ' + usd(today) + ', which is the ' + usd(p.cents - cur.cents) + ' difference for the ' + PERIOD.daysLeft + ' days left.' }, { t: 'Straight away', d: 'You get ' + p.name + ' allowances.' }, { t: 'On ' + PERIOD.end, d: 'Renews at ' + usd(p.cents) + ' a month.' }]
        : [{ t: 'Today', d: 'You pay ' + usd(p.cents) + ' for the first month.' }, { t: 'Renews', d: 'Every month at ' + usd(p.cents) + ' until you cancel.' }],
      amount: today, amountLabel: 'Charged today', cta: 'Continue to payment',
      footnote: 'If the payment fails, your current plan stays exactly as it is.',
    });
    if (!ok) return;
    subsData[sf] = { plan: code, status: 'active', pending: null, ending: false };
    payments.unshift({ d: 'Sep 30', kind: 'sub', t: p.name + ' plan', sub: sub ? 'Upgrade, ' + PERIOD.daysLeft + ' days prorated' : PERIOD.start + ' – ' + PERIOD.end, c: today, s: 'paid' });
    renderPlan(); renderPay();
  }
  async function cancelPlan() {
    const sub = subsData[sf], cur = planOf(sf, sub.plan);
    const ok = await checkout({
      pay: false, title: 'Cancel ' + cur.name, sub: 'You can cancel without confirming your password.',
      lines: [{ t: 'Until ' + PERIOD.end, d: 'Everything keeps working. You have already paid for it.' }, { t: 'After that', d: 'The plan ends and you are not charged again.' }, { t: 'Your data', d: 'Stays yours. You can export it or sign up again any time.' }],
      cta: 'Cancel at the end of the period',
    });
    if (ok) { sub.ending = true; renderPlan(); }
  }
  async function payOpen() {
    const sub = subsData[sf], cur = planOf(sf, sub.plan);
    const ok = await checkout({
      title: 'Pay for ' + cur.name, sub: 'This pays the payment that is already waiting. It does not make a second one.',
      lines: [{ t: 'Payment', d: cur.name + ', ' + PERIOD.start + ' – ' + PERIOD.end + '.' }],
      amount: sub.openInvoice, amountLabel: 'Amount due', cta: 'Continue to payment',
    });
    if (!ok) return;
    sub.status = 'active';
    const row = payments.find((r) => r.s === 'open' && r.kind === 'sub');
    if (row) row.s = 'paid';
    renderPlan(); renderPay();
  }

  /* ---------- Credit tab ---------- */
  let topAmt = 5000, custom = '', waiting = false;
  const MIN_TOPUP = 2500;
  function renderCredit() {
    const root = $('#p-credit');
    const chips = [2500, 5000, 10000].map((c) => '<button class="chip" type="button" data-amt="' + c + '" aria-pressed="' + (custom === '' && topAmt === c) + '">' + usd(c).replace('.00', '') + '</button>').join('');
    const customCents = Math.round(parseFloat(custom) * 100);
    const customBad = custom !== '' && !(customCents >= MIN_TOPUP);
    const amount = custom !== '' ? customCents : topAmt;
    const g = canSpend();
    root.innerHTML = '<div class="stack"><div class="split">' +
      '<div class="panel"><header>Your credit</header><div class="panel-body">' +
      '<div class="big" aria-live="polite">' + usd(credit) + '</div>' +
      '<p class="sub">Credit pays for things billed by the hour, like GPU sessions and virtual machines. It is separate from your monthly plans.</p>' +
      (waiting ? '<p class="note" role="status">Payment received. Adding it to your credit&hellip;</p>' : '') +
      '</div></div>' +
      '<div class="panel"><header>Add credit</header><div class="panel-body">' +
      '<div class="chips" role="group" aria-label="Amount">' + chips + '</div>' +
      '<div class="inline-field"><label for="cust">Or another amount</label><span class="sub">$</span><input class="field" id="cust" inputmode="decimal" placeholder="25.00" value="' + esc(custom) + '"></div>' +
      (customBad ? '<p class="error">The smallest top-up is ' + usd(MIN_TOPUP) + '.</p>' : '') +
      '<div><button class="btn btn-primary" type="button" id="topup"' + (g.ok && !customBad && !waiting && amount >= MIN_TOPUP ? '' : ' disabled') + '>Add ' + usd(amount >= MIN_TOPUP ? amount : 0) + '</button></div>' +
      (g.ok ? '' : lockNote()) +
      '</div></div></div>' +
      '<div><h2 style="margin-bottom:12px">Credit history</h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Date</th><th>What</th><th class="r">Amount</th></tr></thead><tbody>' +
      ledger.map((l) => '<tr><td>' + esc(l.d) + '</td><td>' + esc(l.t) + '</td><td class="amt ' + (l.c > 0 ? 'plus' : '') + '">' + (l.c > 0 ? '+' : '') + usd(l.c) + '</td></tr>').join('') +
      '</tbody></table></div></div></div>';

    $$('[data-amt]', root).forEach((b) => b.onclick = () => { topAmt = +b.dataset.amt; custom = ''; renderCredit(); });
    const cu = $('#cust', root);
    cu.oninput = () => { custom = cu.value; const pos = cu.selectionStart; renderCredit(); const n = $('#cust'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#topup', root).onclick = () => topUp(amount);
  }
  async function topUp(amount) {
    const ok = await checkout({
      title: 'Add ' + usd(amount) + ' credit', sub: 'Paid once by card. It is not a subscription.',
      lines: [{ t: 'Today', d: 'You pay ' + usd(amount) + '.' }, { t: 'Straight after', d: 'The same amount is added to your credit.' }],
      amount, amountLabel: 'Charged today', cta: 'Continue to payment',
    });
    if (!ok) return;
    waiting = true; renderCredit();
    await sleep(2200); // the gap between "card charged" and "balance updated": the payment confirmation arrives separately
    credit += amount; waiting = false;
    ledger.unshift({ d: 'Sep 30', t: 'Top-up', c: amount });
    payments.unshift({ d: 'Sep 30', kind: 'credit', t: 'Credit top-up', sub: 'Added to your credit', c: amount, s: 'paid' });
    renderCredit(); renderPay();
  }

  /* ---------- Payments tab ---------- */
  let filter = 'All', page = 0;
  const PER = 6;
  function renderPay() {
    const root = $('#p-pay');
    const F = { All: null, Plans: 'sub', Credit: 'credit', Domains: 'domain' };
    const rows = payments.filter((r) => !F[filter] || r.kind === F[filter]);
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages - 1);
    const view = rows.slice(page * PER, page * PER + PER);
    root.innerHTML = '<div class="stack"><div class="seg" role="radiogroup" aria-label="Show">' + Object.keys(F).map((k) =>
      '<button type="button" role="radio" data-f="' + k + '" aria-checked="' + (k === filter) + '">' + k + '</button>').join('') + '</div>' +
      '<div class="scroll-x"><table class="tbl"><thead><tr><th>Date</th><th>What</th><th class="r">Amount</th><th>Status</th><th class="hide-s"></th></tr></thead><tbody>' +
      view.map((r) => '<tr><td>' + esc(r.d) + '</td><td class="desc">' + esc(r.t) + '<small>' + esc(r.sub) + '</small></td><td class="amt">' + usd(r.c) + '</td><td>' + pill(r.s) + '</td>' +
        '<td class="hide-s r">' + (r.s === 'paid' ? '<a href="#" data-receipt>Receipt</a>' : '') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="pager"><span>Showing ' + (rows.length ? page * PER + 1 : 0) + '–' + (page * PER + view.length) + ' of ' + rows.length + '</span>' +
      '<span style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" type="button" data-p="-1"' + (page === 0 ? ' disabled' : '') + '>Newer</button><button class="btn btn-ghost btn-sm" type="button" data-p="1"' + (page >= pages - 1 ? ' disabled' : '') + '>Older</button></span></div></div>';
    $$('[data-f]', root).forEach((b) => b.onclick = () => { filter = b.dataset.f; page = 0; renderPay(); });
    $$('[data-p]', root).forEach((b) => b.onclick = () => { page += +b.dataset.p; renderPay(); });
    $$('[data-receipt]', root).forEach((a) => a.onclick = (e) => { e.preventDefault(); a.textContent = 'Opens Stripe’s receipt (mock)'; });
  }

  /* ---------- Boot ---------- */
  window.AHPages = window.AHPages || {};
  window.AHPages.billing = function () {
    window.AHS.signedShell('billing');
    tabs.forEach((t) => $('#t-' + t).addEventListener('click', () => showTab(t)));
    const h = (location.hash || '').slice(1);
    renderPlan(); renderCredit(); renderPay();
    showTab(tabs.includes(h) ? h : 'plan');
    applyAccess();
    window.AHS.on(() => { renderPlan(); renderCredit(); applyAccess(); });
  };

  /* Org policy: viewers only see billing when an Admin has turned it on. */
  function applyAccess() {
    const yes = window.AHS.canSeeBilling(), lk = $('#locked'), tb = $('.tabs');
    lk.hidden = yes; tb.hidden = !yes;
    if (yes) return showTab(curTab);
    tabs.forEach((t) => { $('#p-' + t).hidden = true; });
    lk.innerHTML = '<div class="panel" style="max-width:640px"><header>Billing is limited to Admins</header><div class="panel-body">' +
      '<p>Your organization keeps its plans, credit and payments to Admins.</p>' +
      '<p class="sub">If you need to see them, ask an Admin to turn on &ldquo;Let viewers see billing&rdquo;. Even then you would only be able to look, not change or pay for anything.</p></div></div>';
  }
})();
