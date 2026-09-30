/* Artisan console mock: signed-in layer for the billing and domain-purchase pages.
   Loaded after console.js. Turns the logged-out shell into a signed-in one,
   adds the "mock controls" strip (things the real product decides for you), and
   provides the one checkout dialog every money flow shares:
   review -> confirm password (elevated) -> card -> paying.
   Everything is sample data. Nothing is saved, charged or sent. */
(function () {
  'use strict';
  const { $, $$, esc, sleep } = window.AH;

  /* What the real product decides, exposed as switches so each state can be seen. */
  const S = {
    role: 'Admin',          // Admin can spend (an org-scoped Super); Viewer is read-only
    purchasing: true,       // the kill switch that ships off (purchasing.enabled)
    cardDecline: false,     // Stripe declines the card
    viewerBilling: false,   // org policy: may Viewers see billing? Off unless an Admin turns it on
    elevatedUntil: 0,       // password re-entry stays good for 5 minutes
  };
  const subs = [];
  const on = (fn) => subs.push(fn);
  const emit = () => subs.forEach((f) => f());

  const usd = (c) => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const canSeeBilling = () => S.role !== 'Viewer' || S.viewerBilling;
  function setViewerBilling(v) {
    S.viewerBilling = !!v;
    const c = $('#mc-vb'); if (c) c.checked = S.viewerBilling;
    emit();
  }

  function canSpend() {
    if (S.role === 'Viewer') return { ok: false, why: 'Spending money needs the Admin role. You can look, but not buy.' };
    if (!S.purchasing) return { ok: false, why: 'Buying is not open yet. Nothing here can charge a card until it is switched on.' };
    return { ok: true };
  }

  /* ---------- Shell ---------- */
  function signedShell(active) {
    const nav = $('.nav');
    if (nav) {
      nav.insertAdjacentHTML('beforeend',
        '<a href="billing.html"' + (active === 'billing' ? ' aria-current="page"' : '') + '>Billing</a>' +
        '<a href="buy-domain.html"' + (active === 'buy-domain' ? ' aria-current="page"' : '') + '>Buy a domain</a>');
    }
    const note = $('.ribbon-in p');
    if (note) note.innerHTML = '<strong>Mock of the signed-in screens.</strong> Amounts are sample amounts. Nothing here is saved, charged or sent.';
    $('#ribbon-dismiss')?.remove();
    const signIn = $('.tools .btn-primary');
    if (signIn) signIn.outerHTML = '<span class="acct" title="Signed in (mock)"><b>dana@acme.example</b><small>Acme Studio</small></span>';

    const bar = document.createElement('div');
    bar.className = 'mockbar';
    bar.innerHTML = '<div class="wrap mockbar-in">' +
      '<strong>Mock controls</strong>' +
      '<label>Signed in as <select id="mc-role"><option>Admin</option><option>Viewer</option></select></label>' +
      '<label class="chk"><input type="checkbox" id="mc-vb"> Org lets viewers see billing</label>' +
      '<label class="chk"><input type="checkbox" id="mc-purch" checked> Buying is open</label>' +
      '<label class="chk"><input type="checkbox" id="mc-decline"> Card gets declined</label>' +
      '<span id="mc-extra"></span></div>';
    (document.getElementById('ribbon') || $('.topbar')).after(bar);
    $('#mc-role').addEventListener('change', (e) => { S.role = e.target.value; emit(); });
    $('#mc-vb').addEventListener('change', (e) => setViewerBilling(e.target.checked));
    $('#mc-purch').addEventListener('change', (e) => { S.purchasing = e.target.checked; emit(); });
    $('#mc-decline').addEventListener('change', (e) => { S.cardDecline = e.target.checked; });
  }
  function addControl(html) { const m = $('#mc-extra'); if (m) m.insertAdjacentHTML('beforeend', html); }

  /* ---------- Checkout dialog ----------
     opts: { title, sub, lines: [{t,d}], amount (cents, optional), amountLabel,
             cta, pay (bool), footnote }
     Resolves true when the flow completed, false when it was closed. */
  function checkout(opts) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'drawer';
      dlg.setAttribute('aria-labelledby', 'co-title');
      document.body.append(dlg);
      let done = false;
      const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
      dlg.addEventListener('click', (e) => { if (e.target === dlg) finish(false); });

      const pays = opts.pay !== false;
      const head = (sub) => '<div><h2 id="co-title">' + esc(opts.title) + '</h2><p class="muted" style="margin-top:6px">' + sub + '</p></div>';
      const shell = (inner) => { dlg.innerHTML = '<div class="drawer-in">' + inner + '</div>'; };

      function review() {
        // Changing a plan without paying (downgrade, cancel) is still a write:
        // viewers may look but not change. (Billing does not enforce this yet.)
        const gate = pays ? canSpend() : (S.role === 'Viewer' ? { ok: false, why: 'Changing a plan needs the Admin role. You can look, but not change it.' } : { ok: true });
        shell(head(esc(opts.sub || '')) +
          '<ol>' + opts.lines.map((l) => '<li><b>' + esc(l.t) + '.</b> ' + esc(l.d) + '</li>').join('') + '</ol>' +
          (pays ? '<div class="due"><span>' + esc(opts.amountLabel || 'Charged today') + '</span><b>' + usd(opts.amount) + '</b></div>' : '') +
          (gate.ok ? '' : '<p class="error">' + esc(gate.why) + '</p>') +
          (opts.footnote ? '<p class="callout">' + opts.footnote + '</p>' : '') +
          '<div class="row"><button class="btn btn-primary" type="button" id="co-go"' + (gate.ok ? '' : ' disabled') + '>' + esc(opts.cta || 'Continue') + '</button><button class="btn btn-ghost" type="button" id="co-x">Close</button></div>');
        $('#co-x', dlg).onclick = () => finish(false);
        $('#co-go', dlg).onclick = () => {
          if (!pays) return finish(true);
          if (Date.now() < S.elevatedUntil) return card();
          auth();
        };
      }
      function auth(err) {
        shell(head('Spending money asks for your password again, even though you are signed in.') +
          '<form class="form" id="co-f"><div><label for="co-pw">Password</label><input class="field" id="co-pw" type="password" autocomplete="current-password" required></div>' +
          '<p class="error" id="co-err"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p>' +
          '<p class="muted" style="font-size:.9rem">Mock: any password works except <code>wrong</code>. Once confirmed, it stays confirmed for 5 minutes.</p>' +
          '<div class="row" style="display:flex;gap:10px"><button class="btn btn-primary" type="submit">Confirm</button><button class="btn btn-ghost" type="button" id="co-x">Close</button></div></form>');
        $('#co-x', dlg).onclick = () => finish(false);
        $('#co-pw', dlg).focus();
        $('#co-f', dlg).onsubmit = (e) => {
          e.preventDefault();
          const v = $('#co-pw', dlg).value;
          if (v === 'wrong') return auth('That password did not match.');
          S.elevatedUntil = Date.now() + 5 * 60 * 1000;
          card();
        };
      }
      function card(err) {
        shell(head('The card form is Stripe&rsquo;s. We never see or store the card number.') +
          '<form class="form" id="co-f">' +
          '<div><label for="co-n">Card number</label><input class="field mono" id="co-n" value="4242 4242 4242 4242" inputmode="numeric"></div>' +
          '<div class="two"><div><label for="co-e">Expires</label><input class="field mono" id="co-e" value="12 / 29"></div><div><label for="co-c">CVC</label><input class="field mono" id="co-c" value="123"></div></div>' +
          '<p class="error" id="co-err"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p>' +
          '<div class="due"><span>' + esc(opts.amountLabel || 'Charged today') + '</span><b>' + usd(opts.amount) + '</b></div>' +
          '<div class="row" style="display:flex;gap:10px"><button class="btn btn-primary" type="submit">Pay ' + usd(opts.amount) + '</button><button class="btn btn-ghost" type="button" id="co-x">Close</button></div></form>');
        $('#co-x', dlg).onclick = () => finish(false);
        $('#co-f', dlg).onsubmit = async (e) => {
          e.preventDefault();
          shell(head('Talking to your card issuer. Please do not close this.') + '<p class="working" role="status">Paying ' + usd(opts.amount) + '&hellip;</p>');
          await sleep(1300);
          if (S.cardDecline) return card('Your card was declined. Nothing was charged. Try another card.');
          finish(true);
        };
      }
      review();
      dlg.showModal();
    });
  }

  window.AHS = { S, on, emit, usd, canSpend, canSeeBilling, setViewerBilling, signedShell, addControl, checkout };
})();
