/* Signup mock: account -> verify email -> organization -> repository -> plan -> payment -> ready.
   Everything is sample data. Nothing is saved, sent or charged.
   Decisions the mock demonstrates (the real ones are server-side):
   - Signing up never says whether an email is already registered: the same
     "check your email" screen appears either way, and the email differs.
   - Opening the emailed link creates the account. The organization (and its
     first Admin) is created on the next step, so a verified account always
     exists before anything is owned.
   - Payment is the LAST step. By then you have an account, an organization and
     a repository we found, so the plan you pay for is for something real.
   - Deploying waits for a plan. Choose "Decide later" and the repo is kept but
     nothing runs. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = (c) => '$' + (c / 100).toFixed(2);
  const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const PLANS = [
    { code: 'dev_builder', name: 'Builder', cents: 800, bullets: ['0.5 GB memory', '0.25 processor', '10 GB traffic', '1,000 emails'] },
    { code: 'dev_pro', name: 'Pro', cents: 3200, bullets: ['2 GB memory', '1 processor', '50 GB traffic', '5,000 emails'] },
    { code: 'dev_team', name: 'Team', cents: 9500, bullets: ['6 GB memory', '3 processors', '200 GB traffic', '25,000 emails'] },
  ];
  const STEPS = ['Account', 'Verify email', 'Organization', 'Repository', 'Plan', 'Payment', 'Ready'];
  const S = { ACCOUNT: 0, VERIFY: 1, ORG: 2, REPO: 3, PLAN: 4, PAY: 5, READY: 6 };
  const M = { exists: false, expired: false, decline: false, priv: false, norepo: false };
  const D = { name: '', email: '', org: '', repoUrl: '', repo: null, plan: null, paid: false };
  let step = 0;
  // Where in the sample console the visitor came from; shown once, on step 1.
  const FROM = {
    drawer: 'You were previewing a change. Create an account and you can make it on your own project.',
    applybar: 'You were about to apply a change. Create an account and you can make it for real.',
    restart: 'You tried restarting the sample project. Create an account and you can do that to your own.',
    bar: 'Glad the sample was useful. Your own projects work exactly the same way.',
  };
  const from = (() => { try { return new URLSearchParams(location.search).get('from') || ''; } catch (e) { return ''; } })();

  const stage = $('#stage');
  function steps() {
    const skipPay = step === S.READY && !D.paid;
    $('#steps').innerHTML = STEPS.map((s, i) => {
      const st = i === S.PAY && skipPay ? 'skipped' : i < step ? 'done' : i === step ? 'doing' : 'todo';
      return '<li data-st="' + st + '"' + (st === 'doing' ? ' aria-current="step"' : '') + '>' + s + '</li>';
    }).join('');
  }
  function go(n) { step = n; render(); window.scrollTo({ top: 0 }); }

  /* ---------- 1 Account ---------- */
  function strength(pw) {
    let n = 0;
    if (pw.length >= 8) n++;
    if (pw.length >= 12) n++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) n++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) n++;
    return pw ? Math.max(1, n) : 0;
  }
  function viewAccount() {
    stage.innerHTML = '<div class="su-two"><div>' +
      '<h1>Create your account</h1>' + (FROM[from] ? '<p class="callout" style="margin-top:14px;max-width:52ch">' + esc(FROM[from]) + '</p>' : '') +
      '<p class="lede">Next you will name your organization and connect your code. You only add a card at the very end, once you have seen what you are paying for.</p>' +
      '<form class="form" id="f" novalidate>' +
      '<div><label for="nm">Your name</label><input class="field" id="nm" autocomplete="name" value="' + esc(D.name) + '"></div>' +
      '<div><label for="em">Work email</label><input class="field" id="em" type="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="' + esc(D.email) + '"></div>' +
      '<div><label for="pw">Password</label><div class="pwrow"><input class="field" id="pw" type="password" autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" id="show">Show</button></div>' +
      '<div class="meter" id="meter" data-n="0"><i></i><i></i><i></i><i></i></div><p class="hint">At least 8 characters. A longer phrase is stronger than a clever short one.</p></div>' +
      '<label class="chkrow"><input type="checkbox" id="tos"><span>I agree to the <a href="#" data-mock="terms">terms of service</a> and <a href="#" data-mock="privacy">privacy policy</a>.</span></label>' +
      '<div class="error" id="err" role="alert" hidden></div>' +
      '<button class="btn btn-primary" type="submit">Create account</button></form></div>' +
      '<div><h2>How this goes</h2><ul class="aside-list">' +
      '<li><b>1. Account and email.</b> Just you. We confirm your email first.</li>' +
      '<li><b>2. Your organization.</b> You become its Admin and can invite teammates later.</li>' +
      '<li><b>3. Your repository.</b> We find it and work out how to build and run it.</li>' +
      '<li><b>4. Plan and payment.</b> Last, so you only pay for something real.</li></ul></div></div>';

    $('#pw').addEventListener('input', (e) => { $('#meter').dataset.n = strength(e.target.value); });
    $('#show').addEventListener('click', (e) => {
      const p = $('#pw'); const show = p.type === 'password';
      p.type = show ? 'text' : 'password'; e.target.textContent = show ? 'Hide' : 'Show';
    });
    stage.querySelectorAll('[data-mock]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); const er = $('#err'); er.hidden = false; er.textContent = 'In the real console this opens the ' + a.dataset.mock + ' page.';
    }));
    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = $('#nm').value.trim(), m = $('#em').value.trim(), p = $('#pw').value;
      const er = $('#err'); const bad = (t) => { er.hidden = false; er.textContent = t; };
      D.name = n; D.email = m;
      if (!n || !m || !p) return bad('Fill in every field.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return bad('That does not look like an email address.');
      if (p.length < 8) return bad('Choose a password with at least 8 characters.');
      if (!$('#tos').checked) return bad('Agree to the terms to continue.');
      go(S.VERIFY);
    });
  }

  /* ---------- 2 Verify ---------- */
  let cooldown = 0, timer = null;
  function viewVerify() {
    stage.innerHTML = '<div class="su-one"><h1>Check your email</h1>' +
      '<p class="lede">If <b>' + esc(D.email) + '</b> can be used to sign up, we have sent a link to it. Open the link to confirm your account. It works for 24 hours.</p>' +
      '<p class="hint" style="margin-top:12px">We show this same message for every address, so nobody can use this form to find out who has an account.</p>' +
      '<div class="mailcard"><header>Mock inbox &middot; to <b>' + esc(D.email) + '</b></header><div class="mb">' +
      (M.exists
        ? '<b>You already have an Artisan account</b><p class="muted">Someone asked to sign up with this address, but it already has an account. If that was you, sign in or reset your password. If not, you can ignore this email.</p>' +
          '<div class="row2" style="margin:0"><a class="btn btn-primary" href="login.html">Sign in</a><a class="btn btn-ghost" href="login.html">Reset password</a></div>'
        : '<b>Confirm your email</b><p class="muted">Hi ' + esc(D.name) + ', this link confirms your account. You will name your organization next.</p>' +
          '<div class="row2" style="margin:0"><button class="btn btn-primary" type="button" id="open">Confirm my email</button></div>') +
      '</div></div>' +
      '<div class="row2"><button class="btn btn-ghost btn-sm" type="button" id="resend"></button><button class="btn btn-ghost btn-sm" type="button" id="wrong">Wrong address? Go back</button></div>' +
      '<div class="error" id="err" role="alert" hidden></div></div>';
    const rs = $('#resend');
    const paint = () => { rs.disabled = cooldown > 0; rs.textContent = cooldown > 0 ? 'Send it again in ' + cooldown + 's' : 'Send it again'; };
    const run = () => { cooldown = 5; paint(); clearInterval(timer); timer = setInterval(() => { cooldown = Math.max(0, cooldown - 1); paint(); if (!cooldown) clearInterval(timer); }, 1000); };
    run();
    rs.addEventListener('click', run);
    $('#wrong').addEventListener('click', () => go(S.ACCOUNT));
    const open = $('#open');
    if (open) open.addEventListener('click', () => {
      if (M.expired) {
        const er = $('#err'); er.hidden = false;
        er.textContent = 'That link has expired or was already used. Use "Send it again" for a fresh one.';
        return;
      }
      go(S.ORG);
    });
  }

  /* ---------- 3 Organization ---------- */
  function viewOrg() {
    stage.innerHTML = '<div class="su-one"><h1>You are in, ' + esc(D.name.split(' ')[0] || 'welcome') + '.</h1>' +
      '<p class="lede">Your account is confirmed. Now name your organization. Projects, domains and billing belong to it, not to one person, so teammates can share them.</p>' +
      '<form class="form" id="f" novalidate><div><label for="org">Organization name</label><input class="field" id="org" autocomplete="organization" value="' + esc(D.org) + '"><p class="slug" id="slug"></p></div>' +
      '<p class="hint">You will be its Admin. You can rename it and invite people later.</p>' +
      '<div class="error" id="err" role="alert" hidden></div>' +
      '<div class="row2" style="margin:0"><button class="btn btn-primary" type="submit">Create organization</button></div></form></div>';
    const org = $('#org'), slug = $('#slug');
    const upd = () => { const s = slugify(org.value); slug.innerHTML = s ? 'Your address name: <b>' + esc(s) + '</b>' : ''; };
    org.addEventListener('input', upd); upd();
    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      const o = org.value.trim();
      if (!o) { const er = $('#err'); er.hidden = false; er.textContent = 'Give your organization a name.'; return; }
      D.org = o; go(S.REPO);
    });
  }

  /* ---------- 4 Repository ---------- */
  const looksLikeRepo = (u) => /^(https:\/\/)?(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/[^\/\s]+\/[^\/\s]+?(\.git)?\/?$/i.test(u.trim());
  const repoName = (u) => u.trim().replace(/^https:\/\//, '').replace(/^www\./, '').replace(/\.git$/, '').replace(/\/$/, '');
  function viewRepo() {
    stage.innerHTML = '<div class="su-one"><h1>Find your repository</h1>' +
      '<p class="lede">Paste the address of the code you want to run. We look it up, pick the branch, and work out how to build and start it. Nothing runs until you choose a plan.</p>' +
      '<form class="form" id="f" novalidate>' +
      '<div><label for="url">Repository address</label><input class="field" id="url" placeholder="https://github.com/acme/shop" autocapitalize="off" spellcheck="false" value="' + esc(D.repoUrl) + '"></div>' +
      '<div id="tokwrap" hidden><label for="tok">Access token</label><input class="field" id="tok" type="password" autocomplete="off"><p class="hint">This repository is private. Create a read-only token on your git host and paste it here. We store it encrypted and use it only to fetch your code.</p></div>' +
      '<div class="error" id="err" role="alert" hidden></div>' +
      '<div class="row2" style="margin:0"><button class="btn btn-primary" type="submit" id="find">Find repository</button><button class="btn btn-ghost" type="button" id="skip">Skip for now</button></div></form>' +
      '<div id="found"></div></div>';
    const found = $('#found');
    if (D.repo) showFound();

    $('#skip').addEventListener('click', () => { D.repo = null; go(S.PLAN); });
    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = $('#url').value.trim(), er = $('#err'), btn = $('#find');
      const bad = (t) => { er.hidden = false; er.textContent = t; };
      er.hidden = true; D.repo = null; found.innerHTML = ''; D.repoUrl = url;
      if (!url) return bad('Paste a repository address.');
      if (!looksLikeRepo(url)) return bad('That does not look like a GitHub, GitLab or Bitbucket repository address. It should look like https://github.com/owner/name.');
      btn.disabled = true; btn.textContent = 'Looking...';
      await sleep(900);
      btn.disabled = false; btn.textContent = 'Find repository';
      if (M.norepo) return bad('We could not find ' + repoName(url) + '. Check the spelling, or that it is not private.');
      if (M.priv && !$('#tok').value) {
        $('#tokwrap').hidden = false;
        return bad('That repository is private, or does not exist. If it is private, add an access token below and try again.');
      }
      D.repo = { name: repoName(url), branches: ['main', 'release', 'staging'], branch: 'main', build: 'npm run build', run: 'npm start', stack: 'Node.js', port: 3000 };
      showFound();
    });
    function showFound() {
      const r = D.repo;
      found.innerHTML = '<div class="repo-found"><div><span class="pill" data-s="active">Found</span></div><h3>' + esc(r.name) + '</h3>' +
        '<dl><dt>Looks like</dt><dd>' + esc(r.stack) + ' app (found <code>package.json</code>)</dd><dt>Listens on</dt><dd>Port ' + r.port + ', which we set for you</dd></dl>' +
        '<div class="two"><div><label for="br">Branch to deploy</label><select class="field field-sans" id="br">' + r.branches.map((b) => '<option' + (b === r.branch ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div><div></div></div>' +
        '<div class="two"><div><label for="bc">Build command</label><input class="field" id="bc" value="' + esc(r.build) + '"></div><div><label for="rc">Start command</label><input class="field" id="rc" value="' + esc(r.run) + '"></div></div>' +
        '<p class="hint">We guessed these from your code. Change them if they are wrong. You can edit them any time.</p>' +
        '<div class="row2" style="margin:0"><button class="btn btn-primary" type="button" id="use">Use this repository</button></div></div>';
      $('#use').addEventListener('click', () => { r.branch = $('#br').value; r.build = $('#bc').value.trim(); r.run = $('#rc').value.trim(); go(S.PLAN); });
    }
  }

  /* ---------- 5 Plan ---------- */
  function viewPlan() {
    stage.innerHTML = '<div><h1>Choose a plan</h1>' +
      '<p class="lede">' + (D.repo ? '<b>' + esc(D.repo.name) + '</b> is ready to deploy for <b>' + esc(D.org) + '</b>. ' : 'Your organization <b>' + esc(D.org) + '</b> is ready. ') +
      'Pick a plan to start it. You pay on the next step, and can change plans any time.</p>' +
      '<div class="plans three" role="radiogroup" aria-label="Plan">' + PLANS.map((p) =>
        '<div class="plan" data-sel="' + (D.plan === p.code) + '"><h3>' + esc(p.name) + '</h3><div class="price">' + usd(p.cents) + ' <small>a month</small></div>' +
        '<ul>' + p.bullets.map((b) => '<li>' + esc(b) + '</li>').join('') + '</ul>' +
        '<button class="btn btn-primary" type="button" data-pick="' + p.code + '">Choose ' + esc(p.name) + '</button></div>').join('') + '</div>' +
      '<p class="later"><button class="btn btn-ghost" type="button" id="later">Decide later</button> <button class="btn btn-ghost" type="button" id="back">Back</button></p>' +
      '<p class="hint">Until you choose a plan nothing is deployed and you cannot buy a domain. Your repository and organization are kept.</p></div>';
    stage.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { D.plan = b.dataset.pick; go(S.PAY); }));
    $('#later').addEventListener('click', () => { D.plan = null; D.paid = false; go(S.READY); });
    $('#back').addEventListener('click', () => go(S.REPO));
  }

  /* ---------- 6 Payment (last) ---------- */
  function viewPay() {
    const p = PLANS.find((x) => x.code === D.plan);
    stage.innerHTML = '<div class="su-one"><h1>Add a card</h1><p class="lede">This is the last step. You are starting <b>' + esc(p.name) + '</b> for ' + esc(D.org) + (D.repo ? ', and deploying <b>' + esc(D.repo.name) + '</b> as soon as the payment goes through' : '') + '. The card is handled by Stripe; we never see the number.</p>' +
      '<form class="cardbox" id="cf" novalidate>' +
      '<div><label for="cn">Card number</label><input class="field field-sans" id="cn" inputmode="numeric" placeholder="4242 4242 4242 4242" style="width:100%"></div>' +
      '<div class="two"><div><label for="ce">Expiry</label><input class="field field-sans" id="ce" placeholder="MM / YY" style="width:100%"></div><div><label for="cc">CVC</label><input class="field field-sans" id="cc" placeholder="123" style="width:100%"></div></div>' +
      '<div class="due"><span>Charged today</span><b>' + usd(p.cents) + '</b></div>' +
      '<p class="hint">Then ' + usd(p.cents) + ' a month. Cancel or change plan any time from Billing.</p>' +
      '<div class="error" id="err" role="alert" hidden></div>' +
      '<div class="row2" style="margin:0"><button class="btn btn-primary" type="submit" id="pay">Pay ' + usd(p.cents) + (D.repo ? ' and deploy' : ' and start') + '</button><button class="btn btn-ghost" type="button" id="back">Back to plans</button></div>' +
      '<p class="hint">Mock: any details work. Tick "Card gets declined" above to see a failure.</p></form></div>';
    $('#back').addEventListener('click', () => go(S.PLAN));
    $('#cf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('#pay'), er = $('#err'), label = b.textContent; b.disabled = true; b.textContent = 'Paying...'; er.hidden = true;
      await sleep(900);
      if (M.decline) {
        b.disabled = false; b.textContent = label; er.hidden = false;
        er.textContent = 'Your card was declined. Nothing was charged and nothing was deployed. Try another card, or go back and decide later.';
        return;
      }
      D.paid = true; go(S.READY);
    });
  }

  /* ---------- 7 Ready ---------- */
  const DEPLOY = ['Fetching the code', 'Building', 'Starting', 'Running'];
  let deployTimer = null;
  function viewReady() {
    const p = PLANS.find((x) => x.code === D.plan);
    const gate = !D.paid;
    stage.innerHTML = '<div class="su-one"><h1>' + (gate ? 'Your account is ready' : D.repo ? 'Deploying ' + esc(D.repo.name) : 'You are all set') + '</h1>' +
      '<p class="lede">' + (gate ? 'Choose a plan when you are ready. Deploying and buying a domain unlock after that.' : esc(p.name) + ' is active for ' + esc(D.org) + '.' + (D.repo ? ' Your code is on its way up.' : ' Add a repository to get a site online.')) + '</p>' +
      '<ul class="todo" id="todo"></ul>' +
      '<div class="row2"><a class="btn btn-ghost" href="index.html">Go to the console</a><button class="btn btn-ghost" type="button" id="again">Start over</button></div></div>';
    $('#again').addEventListener('click', restart);
    const list = $('#todo');
    const row = (st, t, d, act) => '<li data-st="' + st + '"><span class="dot" aria-hidden="true"></span><span><b>' + t + '</b><small>' + d + '</small></span><span>' + (act || '') + '</span></li>';
    let n = 0;
    const draw = () => {
      const deploying = D.paid && D.repo;
      const live = deploying && n >= DEPLOY.length;
      list.innerHTML =
        row('done', 'Account created', esc(D.email), '') +
        row('done', 'Organization created', esc(D.org) + ', you are the Admin', '') +
        row(D.repo ? 'done' : 'todo', 'Repository', D.repo ? esc(D.repo.name) + ' on ' + esc(D.repo.branch) : 'Not added yet', D.repo ? '' : '<a class="btn btn-ghost btn-sm" href="project.html">Add a repository</a>') +
        row(D.paid ? 'done' : 'todo', 'Plan and payment', D.paid ? esc(p.name) + ', ' + usd(p.cents) + ' a month' : 'Needed before anything is deployed', D.paid ? '' : '<a class="btn btn-primary btn-sm" href="billing.html">Choose a plan</a>') +
        (deploying
          ? DEPLOY.map((t, i) => row(i < n ? 'done' : i === n ? 'doing' : 'waiting', t, i === DEPLOY.length - 1 && live ? 'Your app is up' : '', '')).join('')
          : '') +
        row('todo', 'Get a domain', gate ? 'Unlocks once you have a plan' : 'Buy a new name or bring one you own, and point it at your app', gate ? '' : '<a class="btn btn-primary btn-sm" href="buy-domain.html">Find a domain</a>');
    };
    draw();
    clearInterval(deployTimer);
    if (D.paid && D.repo) {
      deployTimer = setInterval(() => { n++; draw(); if (n > DEPLOY.length) clearInterval(deployTimer); }, 1100);
    }
  }

  function render() {
    steps();
    clearInterval(deployTimer);
    [viewAccount, viewVerify, viewOrg, viewRepo, viewPlan, viewPay, viewReady][step]();
  }
  function restart() { Object.assign(D, { name: '', email: '', org: '', repoUrl: '', repo: null, plan: null, paid: false }); go(S.ACCOUNT); }

  $('#mc-exists').addEventListener('change', (e) => { M.exists = e.target.checked; if (step === S.VERIFY) viewVerify(); });
  $('#mc-expired').addEventListener('change', (e) => { M.expired = e.target.checked; });
  $('#mc-private').addEventListener('change', (e) => { M.priv = e.target.checked; });
  $('#mc-norepo').addEventListener('change', (e) => { M.norepo = e.target.checked; });
  $('#mc-decline').addEventListener('change', (e) => { M.decline = e.target.checked; });
  $('#mc-restart').addEventListener('click', restart);
  render();
})();
