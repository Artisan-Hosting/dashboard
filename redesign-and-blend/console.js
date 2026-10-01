/* Artisan console mock: shared behaviour.
   Shell, theme, command palette, dry-run drawer, knob kit, meters, and the
   working sample project. Everything here is sample data; nothing is saved
   except the theme choice and whether the ribbon was dismissed. */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 120) : ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  /* ---------- Theme ---------- */
  function applyTheme(t) { document.documentElement.dataset.theme = t; }
  function initTheme() {
    applyTheme(store.get('ah-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next); store.set('ah-theme', next);
  }
  initTheme();

  /* ---------- Destinations (nav + palette) ---------- */
  const NAV = [
    ['index.html', 'Overview', 'overview'],
    ['project.html', 'Projects', 'project'],
    ['services.html', 'Services', 'services'],
    ['usage.html', 'Usage', 'usage'],
  ];
  const PALETTE = [
    ['Overview', 'page', 'index.html'],
    ['Projects: sample-shop', 'page', 'project.html'],
    ['Usage and how billing works', 'page', 'usage.html'],
    ['Managed hosting', 'service', 'services.html?s=hosting'],
    ['Deploy from git', 'service', 'services.html?s=hosting&t=git'],
    ['Domains', 'service', 'services.html?s=domains'],
    ['Email', 'service', 'services.html?s=email'],
    ['Open-source apps', 'service', 'services.html?s=oss'],
    ['Virtual machines', 'service', 'services.html?s=compute&t=vms'],
    ['GPU sessions', 'service', 'services.html?s=compute&t=gpu'],
    ['Get started: create an account', 'account', 'signup.html?from=palette'],
    ['Sign in', 'account', 'login.html'],
    ['Switch light or dark theme', 'action', '#theme'],
  ];

  /* ---------- Shell ---------- */
  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function mountShell(active) {
    const shell = document.createElement('div');
    shell.innerHTML = `
      <a class="skip" href="#main">Skip to content</a>
      <header class="topbar"><div class="wrap topbar-in">
        <a class="brand" href="index.html" aria-label="Artisan Hosting, overview">
          <svg viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" fill="var(--btn-bg)"/><path d="M7.5 19 13 7l5.5 12M9.8 14.6h6.4" fill="none" stroke="var(--btn-fg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Artisan Hosting
        </a>
        <nav class="nav" aria-label="Main">
          ${NAV.map(([href, label, key]) => `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
        <div class="tools">
          <button class="kbar" id="open-palette" type="button" aria-label="Search or jump to a page"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Search or jump to&hellip;</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'}</kbd></button>
          <button class="icon-btn" id="theme" type="button" aria-label="Switch light or dark theme">${ICON_MOON}</button>
          <a class="btn btn-ghost btn-sm" href="login.html">Sign in</a>
          <a class="btn btn-primary btn-sm" href="${startUrl('topbar')}">Get started</a>
        </div>
      </div></header>
      <div class="ribbon" id="ribbon" role="status"><div class="wrap ribbon-in">
        <p><strong>Sample data.</strong> Change anything you like. Nothing here is saved. <a href="${startUrl('ribbon')}">Get started</a> to run your own, or <a href="login.html">sign in</a>.</p>
        <button type="button" id="ribbon-dismiss">Dismiss</button>
      </div></div>`;
    document.body.prepend(...shell.children);
    if (session.get('ah-ribbon') === 'off') $('#ribbon').remove();
    $('#ribbon-dismiss')?.addEventListener('click', () => { $('#ribbon').remove(); session.set('ah-ribbon', 'off'); });
    $('#theme').addEventListener('click', toggleTheme);
    $('#open-palette').addEventListener('click', openPalette);
    addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    });
    buildPalette();
    buildDrawer();
    mountCtas();
  }

  /* ---------- Calls to action ----------
     The sample console is a shop window: the places where it stops being
     useful (the drawer that cannot apply, a restart that was only a sample, the
     bottom of every page) are where "Get started" goes. Each link says where
     it came from, so signup can pick up the thread. */
  function startUrl(from) { return 'signup.html' + (from ? '?from=' + encodeURIComponent(from) : ''); }
  function edgeHTML(from, text, cta) {
    return `<p class="demo-edge"><span>${text}</span><a class="btn btn-primary btn-sm" href="${startUrl(from)}">${cta || 'Get started'}</a></p>`;
  }
  function mountCtas() {
    const main = $('#main');
    if (!main) return;
    main.insertAdjacentHTML('beforeend', `<aside class="cta-band" aria-labelledby="cta-h">
      <div><h2 id="cta-h">Ready to run your own?</h2><p>Create an account, pick a plan, and put your own app online. It takes a few minutes, and you can leave any time.</p></div>
      <div class="cta-actions"><a class="btn btn-primary" href="${startUrl('band')}">Get started</a><a class="btn btn-ghost" href="login.html">Sign in</a></div>
    </aside>`);
    // After a few real interactions, a slim bar offers the next step. Once.
    if (session.get('ah-bar') === 'off') return;
    let n = 0;
    const show = () => {
      if ($('.cta-bar') || session.get('ah-bar') === 'off') return;
      const bar = document.createElement('div');
      bar.className = 'cta-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Get started');
      bar.innerHTML = `<div class="wrap cta-bar-in"><p><b>Enjoying the sample?</b> Your own projects work the same way.</p><span><a class="btn btn-primary btn-sm" href="${startUrl('bar')}">Get started</a><button class="btn btn-ghost btn-sm" type="button" id="bar-x">Not now</button></span></div>`;
      document.body.append(bar);
      $('#bar-x', bar).addEventListener('click', () => { bar.remove(); session.set('ah-bar', 'off'); });
    };
    main.addEventListener('click', (e) => {
      if (e.target.closest('button, [role=switch], [role=radio]') && ++n === 4) window.AH.nudge();
    });
    window.AH.nudge = show;
  }

  /* ---------- Command palette ---------- */
  let palette, pInput, pList, pItems = [], pSel = 0;
  function buildPalette() {
    palette = document.createElement('dialog');
    palette.className = 'palette';
    palette.setAttribute('aria-label', 'Search or jump to a page');
    palette.innerHTML = `<input type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-label="Search or jump to" placeholder="Search pages and services" autocomplete="off"><ul id="palette-list" role="listbox"></ul>`;
    document.body.append(palette);
    pInput = $('input', palette); pList = $('ul', palette);
    pInput.addEventListener('input', renderPalette);
    pInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selectPalette(pSel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectPalette(pSel - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); goPalette(pItems[pSel]); }
    });
    pList.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) goPalette(pItems[+li.dataset.i]); });
    palette.addEventListener('click', (e) => { if (e.target === palette) palette.close(); });
  }
  function renderPalette() {
    const q = pInput.value.trim().toLowerCase();
    pItems = PALETTE.filter(([label, kind]) => !q || (label + ' ' + kind).toLowerCase().includes(q));
    pSel = 0;
    pList.innerHTML = pItems.length
      ? pItems.map(([label, kind], i) => `<li role="option" id="po-${i}" data-i="${i}" aria-selected="${i === 0}">${esc(label)}<small>${esc(kind)}</small></li>`).join('')
      : '<li class="empty" role="presentation">Nothing matches. Try &ldquo;domain&rdquo; or &ldquo;usage&rdquo;.</li>';
    pInput.setAttribute('aria-activedescendant', pItems.length ? 'po-0' : '');
  }
  function selectPalette(i) {
    if (!pItems.length) return;
    pSel = (i + pItems.length) % pItems.length;
    $$('li[data-i]', pList).forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.i === pSel)));
    pInput.setAttribute('aria-activedescendant', 'po-' + pSel);
    $('#po-' + pSel, pList)?.scrollIntoView({ block: 'nearest' });
  }
  function goPalette(item) {
    if (!item) return;
    palette.close();
    if (item[2] === '#theme') return toggleTheme();
    location.href = item[2];
  }
  function openPalette() { pInput.value = ''; renderPalette(); palette.showModal(); pInput.focus(); }

  /* ---------- Dry-run drawer ---------- */
  let drawer;
  function buildDrawer() {
    drawer = document.createElement('dialog');
    drawer.className = 'drawer';
    drawer.setAttribute('aria-labelledby', 'drawer-title');
    drawer.innerHTML = `<div class="drawer-in">
      <div><h2 id="drawer-title">What would happen</h2><p class="muted" id="drawer-sub" style="margin-top:6px"></p></div>
      <ol id="drawer-steps"></ol>
      <p class="callout" id="drawer-note"></p>
      <div class="row"><a class="btn btn-primary" href="${startUrl('drawer')}">Get started to apply this</a><a class="btn btn-ghost" href="login.html">Sign in</a><button class="btn btn-ghost" type="button" id="drawer-close">Close</button></div>
    </div>`;
    document.body.append(drawer);
    $('#drawer-close').addEventListener('click', () => drawer.close());
    drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); });
  }
  function openDrawer({ title, sub, steps, empty }) {
    $('#drawer-title').textContent = title || 'What would happen';
    $('#drawer-sub').textContent = sub || 'Nothing has changed yet. This is a preview of exactly what applying would do.';
    const list = $('#drawer-steps');
    list.innerHTML = steps && steps.length
      ? steps.map((s) => `<li>${s}</li>`).join('')
      : `<li class="muted" style="list-style:none;margin-left:-1.3rem">${esc(empty || 'No changes yet. Move a knob and try again.')}</li>`;
    $('#drawer-note').innerHTML = '<strong>You’re looking at sample data,</strong> so nothing was applied. Signed in, this same panel lists the real change for your own project and adds an Apply button.';
    drawer.showModal();
    if (window.AH.nudge) window.AH.nudge();
  }

  /* ---------- Meter ---------- */
  function meterHTML({ label, value, max, mark, valueText, cap }) {
    const pct = clamp((value / max) * 100, 0, 100);
    const over = mark != null && value > mark;
    return `<div class="meter" role="img" aria-label="${esc(label)}: ${esc(valueText)}${cap ? '. ' + esc(cap) : ''}">
      <div class="meter-top"><span>${esc(label)}</span><span class="v">${esc(valueText)}</span></div>
      <div class="meter-bar"><i class="${over ? 'over' : ''}" style="width:${pct}%"></i>${mark != null ? `<b style="left:${clamp((mark / max) * 100, 0, 100)}%"></b>` : ''}</div>
      ${cap ? `<div class="meter-cap">${esc(cap)}</div>` : ''}</div>`;
  }

  /* ---------- Knob kit ----------
     spec: { id, label, type, plain, effect(v, state), tip, ... }
     type: stepper | slider | segmented | toggle | select | text */
  let knobSeq = 0;
  function fmtValue(k, v) {
    if (k.fmt) return k.fmt(v);
    if (typeof v === 'boolean') return v ? 'On' : 'Off';
    return k.unit ? `${v} ${k.unit}` : String(v);
  }
  function renderKnob(k, state, onChange) {
    const uid = 'k' + (++knobSeq);
    const wrap = document.createElement('div');
    wrap.className = 'knob';
    wrap.dataset.id = k.id;
    let control = '';
    if (k.type === 'stepper') {
      control = `<div class="stepper" role="group" aria-labelledby="${uid}-l"><button type="button" data-d="-1" aria-label="Decrease ${esc(k.label)}">&minus;</button><output id="${uid}-o" aria-live="polite"></output><button type="button" data-d="1" aria-label="Increase ${esc(k.label)}">+</button></div>`;
    } else if (k.type === 'slider') {
      control = `<div class="slider"><input type="range" id="${uid}-c" min="${k.min}" max="${k.max}" step="${k.step || 1}" aria-labelledby="${uid}-l"><output for="${uid}-c"></output></div>`;
    } else if (k.type === 'segmented') {
      control = `<div class="seg" role="radiogroup" aria-labelledby="${uid}-l">${k.options.map((o) => `<button type="button" role="radio" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    } else if (k.type === 'toggle') {
      control = `<button type="button" class="switch" role="switch" id="${uid}-c" aria-labelledby="${uid}-l"></button>`;
    } else if (k.type === 'select') {
      control = `<select class="field field-sans" id="${uid}-c" aria-labelledby="${uid}-l">${k.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    } else {
      control = `<input class="field" type="text" id="${uid}-c" aria-labelledby="${uid}-l" spellcheck="false" autocomplete="off" value="">`;
    }
    wrap.innerHTML = `<div class="knob-head"><span class="knob-label" id="${uid}-l">${esc(k.label)}</span>${control}</div>
      <p class="plain">${esc(k.plain)}</p><p class="effect" aria-live="polite"></p>${k.tip ? `<p class="tip"><b>Most people:</b> ${esc(k.tip)}</p>` : ''}`;

    const effectEl = $('.effect', wrap);
    function paint() {
      const v = state[k.id];
      if (k.type === 'stepper') {
        $('output', wrap).textContent = fmtValue(k, v);
        $$('button', wrap).forEach((b) => { b.disabled = (+b.dataset.d < 0 && v <= k.min) || (+b.dataset.d > 0 && v >= k.max); });
      } else if (k.type === 'slider') {
        $('input', wrap).value = v; $('output', wrap).textContent = fmtValue(k, v);
      } else if (k.type === 'segmented') {
        $$('[role=radio]', wrap).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(v))));
      } else if (k.type === 'toggle') {
        $('.switch', wrap).setAttribute('aria-checked', String(!!v));
      } else if (k.type === 'select') {
        $('select', wrap).value = v;
      } else if (document.activeElement !== $('input', wrap)) {
        $('input', wrap).value = v;
      }
      effectEl.textContent = k.effect ? k.effect(v, state) : '';
      effectEl.hidden = !k.effect;
    }
    function set(v) { state[k.id] = v; paint(); onChange && onChange(k); }

    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (k.type === 'stepper') set(clamp(state[k.id] + (+b.dataset.d) * (k.step || 1), k.min, k.max));
      else if (k.type === 'segmented' && b.dataset.v != null) set(b.dataset.v);
      else if (k.type === 'toggle') set(!state[k.id]);
    });
    $('input[type=range]', wrap)?.addEventListener('input', (e) => set(+e.target.value));
    $('select', wrap)?.addEventListener('change', (e) => set(e.target.value));
    $('input[type=text]', wrap)?.addEventListener('input', (e) => set(e.target.value));
    wrap.repaint = paint;
    paint();
    return wrap;
  }

  /* ---------- Sample project (the working instrument) ----------
     Rows are per-instance (the controls that exist today); the header adds
     project-level Restart / Stop / Start, which is the proposed addition. */
  const PROJECT_ID = '63eff31e';
  function mountShop(root, opts = {}) {
    const S = { env: 'production', inst: [], busy: false };
    let clock = 14 * 3600 + 2 * 60 + 3;
    const NODES = { production: ['node-a', 'node-b'], staging: ['node-a'] };
    function reset(env) {
      S.env = env;
      S.inst = NODES[env].map((n) => ({ node: n, s: 'running', up: env === 'staging' ? '9h 12m' : '4d 3h' }));
    }
    reset('production');

    root.innerHTML = `<div class="instrument">
      <div class="instr-head">
        <div><div class="instr-title">sample-shop</div><div class="instr-sub" data-r="sub"></div></div>
        <span class="pill" data-r="pill"></span>
      </div>
      <div class="instr-bulk">
        <button class="btn btn-ghost btn-sm" type="button" data-bulk="restart">Restart all</button>
        <button class="btn btn-danger btn-sm" type="button" data-bulk="stop">Stop all</button>
        <button class="btn btn-ghost btn-sm" type="button" data-bulk="start">Start all</button>
        ${opts.openLink ? '<a class="btn btn-ghost btn-sm spacer" href="project.html">Open project</a>' : ''}
      </div>
      <ul class="inst-list" data-r="list"></ul>
      <p class="inst-note" data-r="note" aria-live="polite"></p>
      <div data-r="edge" hidden></div>
      <div class="instr-meters" data-r="meters"></div>
      ${opts.term === false ? '' : '<div class="term" role="log" aria-live="off" tabindex="0" aria-label="Recent log lines" data-r="term"></div>'}
    </div>`;
    const R = (n) => $(`[data-r=${n}]`, root);
    const termEl = () => opts.logEl || R('term');

    function stamp() {
      clock += 1 + Math.floor(Math.random() * 2);
      const h = String(Math.floor(clock / 3600) % 24).padStart(2, '0');
      const m = String(Math.floor(clock / 60) % 60).padStart(2, '0');
      const s = String(clock % 60).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    function log(msg, cls) {
      const t = termEl(); if (!t) return;
      const d = document.createElement('div');
      d.innerHTML = `<span class="t">${stamp()}</span><span${cls ? ` class="${cls}"` : ''}>${esc(msg)}</span>`;
      t.append(d);
      while (t.children.length > 200) t.firstChild.remove();
      t.scrollTop = t.scrollHeight;
    }
    const overall = () => {
      const st = S.inst.map((i) => i.s);
      if (st.includes('running')) return 'running';
      if (st.includes('restarting')) return 'restarting';
      if (st.includes('starting')) return 'starting';
      if (st.includes('stopping')) return 'stopping';
      return 'stopped';
    };
    const label = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    function render() {
      const ov = overall();
      const pill = R('pill'); pill.dataset.s = ov; pill.textContent = label(ov);
      R('sub').textContent = `${S.env}, ${S.inst.length} ${S.inst.length === 1 ? 'copy' : 'copies'}, project ${PROJECT_ID}`;
      R('list').innerHTML = S.inst.map((i, n) => `<li class="inst-row">
        <span class="inst-name">${i.node}</span>
        <span><span class="pill" data-s="${i.s}">${label(i.s)}</span> <span class="inst-up">${i.s === 'running' ? 'up ' + i.up : ''}</span></span>
        <span class="inst-acts">
          <button class="btn btn-ghost btn-sm" type="button" data-one="restart" data-n="${n}" ${i.s !== 'running' || S.busy ? 'disabled' : ''} aria-label="Restart ${i.node}">Restart</button>
          ${i.s === 'stopped'
            ? `<button class="btn btn-ghost btn-sm" type="button" data-one="start" data-n="${n}" ${S.busy ? 'disabled' : ''} aria-label="Start ${i.node}">Start</button>`
            : `<button class="btn btn-danger btn-sm" type="button" data-one="stop" data-n="${n}" ${i.s !== 'running' || S.busy ? 'disabled' : ''} aria-label="Stop ${i.node}">Stop</button>`}
        </span></li>`).join('');
      const running = ov === 'running';
      $$('[data-bulk]', root).forEach((b) => {
        const a = b.dataset.bulk;
        b.disabled = S.busy || (a === 'start' ? S.inst.every((i) => i.s === 'running') : S.inst.every((i) => i.s !== 'running'));
      });
      const live = S.inst.some((i) => i.s === 'running');
      R('meters').innerHTML =
        meterHTML({ label: 'Processor', value: live ? (S.env === 'staging' ? 9 : 34) : 0, max: 100, valueText: live ? (S.env === 'staging' ? '9%' : '34%') : 'idle' }) +
        meterHTML({ label: 'Memory', value: live ? (S.env === 'staging' ? 31 : 58) : 0, max: 100, valueText: live ? (S.env === 'staging' ? '31%' : '58%') : 'idle' });
      if (!S.busy && !S.noteSet) note(running ? (S.inst.length > 1 ? 'Both copies are serving visitors.' : 'The one copy is serving visitors.') : 'Stopped. Your site is offline until you start it.');
    }
    function note(t) { R('note').textContent = t; }

    async function act(action, idxs) {
      if (S.busy) return;
      S.busy = true; S.noteSet = true; render();
      const one = idxs.length === 1;
      if (action === 'restart') {
        for (const n of idxs) {
          const i = S.inst[n], others = S.inst.length > 1;
          i.s = 'restarting'; render();
          note(others ? `Restarting ${i.node}. The other copy keeps serving visitors.` : `Restarting ${i.node}. With a single copy, visitors see a short outage.`);
          log(`${i.node}  stopping runner ${PROJECT_ID}`);
          await sleep(700);
          log(`${i.node}  starting runner ${PROJECT_ID}`);
          await sleep(900);
          log(`${i.node}  health check ok`);
          i.s = 'running'; i.up = 'just now'; render();
        }
        note(one ? `Restarted ${S.inst[idxs[0]].node}.` : (S.inst.length > 1 ? 'Restarted one copy at a time, so visitors never saw an error.' : 'Restarted.'));
      } else if (action === 'stop') {
        idxs.forEach((n) => { S.inst[n].s = 'stopping'; log(`${S.inst[n].node}  stopping runner ${PROJECT_ID}`); });
        note('Stopping.'); render();
        await sleep(900);
        idxs.forEach((n) => { S.inst[n].s = 'stopped'; log(`${S.inst[n].node}  stopped`, 'w'); });
        note(S.inst.every((i) => i.s === 'stopped') ? 'Stopped. Your site is offline until you start it.' : 'Stopped one copy. The others keep serving visitors.');
      } else {
        idxs.forEach((n) => { S.inst[n].s = 'starting'; log(`${S.inst[n].node}  starting runner ${PROJECT_ID}`); });
        note('Starting.'); render();
        await sleep(1000);
        idxs.forEach((n) => { S.inst[n].s = 'running'; S.inst[n].up = 'just now'; log(`${S.inst[n].node}  health check ok`); });
        note('Running again.');
      }
      S.busy = false; S.noteSet = true; render();
      const edge = R('edge');
      if (edge && edge.hidden) {
        edge.innerHTML = edgeHTML('restart', 'That was a sample, so no real site changed. On your own project the same buttons do it for real.');
        edge.hidden = false;
      }
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.bulk) {
        const a = b.dataset.bulk;
        const idxs = S.inst.map((_, n) => n).filter((n) => (a === 'start' ? S.inst[n].s === 'stopped' : S.inst[n].s === 'running'));
        act(a, idxs);
      } else if (b.dataset.one) act(b.dataset.one, [+b.dataset.n]);
    });

    ['14:01:52  node-a  request 200 GET / (12 ms)', '14:01:58  node-b  request 200 GET /products (18 ms)', '14:02:03  node-a  health check ok']
      .forEach((l) => { const t = termEl(); if (!t) return; const d = document.createElement('div'); d.innerHTML = `<span class="t">${l.slice(0, 8)}</span>${esc(l.slice(10))}`; t.append(d); });
    S.noteSet = false; render();
    return { setEnv(env) { if (S.busy) return; reset(env); S.noteSet = false; render(); }, log };
  }

  window.AH = { startUrl, edgeHTML, $, $$, esc, clamp, sleep, store, reduce, mountShell, openDrawer, meterHTML, renderKnob, fmtValue, mountShop, toggleTheme };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page && page !== 'login') mountShell(page);
    if (window.AHPages && window.AHPages[page]) window.AHPages[page]();
  });
})();
