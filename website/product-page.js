/* ══════════════════════════════════════════════════════════════
   Product page renderer.

   Every product page on this site is the same sequence of sections
   with different content, so the sections live here as a small
   vocabulary of renderers and each page is just data. A page's HTML
   file only needs to name which product it is; this builds the rest.

   Section order mirrors how a payments marketing page is structured:
     hero (text + product mockup)
       → value-prop strip
       → industries marquee
       → alternating feature rows, each with a real UI mockup
       → who it's for (segment targeting)
       → stat band
       → integration snippet
       → related products
       → final CTA
   ══════════════════════════════════════════════════════════════ */

/* ── Industries served (shared across pages) ─────────────── */
const INDUSTRIES = [
  { ico: 'store', name: 'Ecommerce' },
  { ico: 'terminal', name: 'SaaS & software' },
  { ico: 'book', name: 'Education & edtech' },
  { ico: 'idCard', name: 'Healthcare & clinics' },
  { ico: 'store', name: 'Food & delivery' },
  { ico: 'globe', name: 'Travel & ticketing' },
  { ico: 'compass', name: 'Creators & freelancers' },
  { ico: 'store', name: 'Retail & D2C brands' },
  { ico: 'users', name: 'Marketplaces' },
  { ico: 'box', name: 'Logistics' },
  { ico: 'refresh', name: 'Gyms & memberships' },
  { ico: 'lifeBuoy', name: 'Nonprofits & donations' },
  { ico: 'clipboard', name: 'Professional services' },
  { ico: 'workflow', name: 'Gaming' },
];

function marqueeHTML() {
  // Rendered twice so the -50% keyframe loops seamlessly.
  const items = INDUSTRIES.map(
    (i) => `<div class="marquee-item"><span class="mq-ico" style="color:var(--accent);display:inline-flex;">${icon(i.ico, 15)}</span>${i.name}</div>`
  ).join('');
  return `
  <section style="padding:34px 0;background:var(--bg);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
    <div class="container">
      <div class="text-center" style="margin-bottom:20px;">
        <div class="section-eyebrow">Built for how Pakistan actually sells</div>
      </div>
    </div>
    <div class="marquee"><div class="marquee-track">${items}${items}</div></div>
  </section>`;
}

/* Expands {{ico:name}} tokens in copy into inline icons. */
function expandIcons(str) {
  return String(str).replace(/\{\{ico:([a-zA-Z]+)\}\}/g, (_, n) =>
    `<span style="display:inline-flex;vertical-align:-2px;color:var(--accent);">${icon(n, 15)}</span>`
  );
}

/* ── Mockup builders ──────────────────────────────────────── */
const browserChrome = (url) => `
  <div class="mockup-chrome">
    <div class="mockup-dot" style="background:#ff5f57;"></div>
    <div class="mockup-dot" style="background:#febc2e;"></div>
    <div class="mockup-dot" style="background:#28c840;"></div>
    <span class="mockup-url">${url}</span>
  </div>`;

const MOCKUPS = {
  checkout: () => `
    <div class="mockup">
      ${browserChrome('pay.ppay.pk/c/cs_live_9fA2')}
      <div class="mockup-body">
        <div class="mock-card" style="display:flex;justify-content:space-between;align-items:center;">
          <div><div class="mock-label">Order #1029</div><div class="mock-value">₨1,500.00</div></div>
          <div style="width:34px;height:34px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;color:var(--accent);">${icon('box', 17)}</div>
        </div>
        <div class="mock-grid-3">
          <div class="mock-field" style="text-align:center;border-color:var(--accent);color:var(--accent);font-weight:700;">Card</div>
          <div class="mock-field" style="text-align:center;">Wallet</div>
          <div class="mock-field" style="text-align:center;">Bank</div>
        </div>
        <div class="mock-field">4242 4242 4242 4242</div>
        <div class="mock-grid-2">
          <div class="mock-field">12 / 28</div>
          <div class="mock-field">•••</div>
        </div>
        <div class="mock-btn">Pay ₨1,500.00</div>
        <div style="text-align:center;font-size:10.5px;color:var(--text-faint);;display:flex;align-items:center;justify-content:center;gap:5px;">${icon('shield', 12)} Sentinel-checked before authorization</div>
      </div>
    </div>`,

  paymentLink: () => `
    <div class="mockup-phone">
      <div class="mockup-phone-body">
        <div style="text-align:center;padding:6px 0;">
          <div style="width:36px;height:36px;border-radius:9px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;margin:0 auto 8px;">Z</div>
          <div style="font-size:12.5px;font-weight:700;">Zainab Traders</div>
          <div style="font-size:10.5px;color:var(--text-faint);">ppay.pk/pay/lnk_8Kd</div>
        </div>
        <div class="mock-card" style="text-align:center;">
          <div class="mock-label">Amount due</div>
          <div class="mock-value">₨2,500</div>
        </div>
        <div class="mock-field" style="font-size:11px;">buyer@example.com</div>
        <div class="mock-btn" style="font-size:11.5px;padding:9px;">Pay now</div>
        <div style="font-size:9.5px;color:var(--text-faint);text-align:center;">No app, no account needed</div>
      </div>
    </div>`,

  invoice: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/invoices/INV-0042')}
      <div class="mockup-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div><div class="mock-label">Invoice</div><div style="font-size:14px;font-weight:800;">INV-0042</div></div>
          <span class="badge badge-pending">Sent</span>
        </div>
        <div class="mock-list">
          <div class="mock-row"><div><div class="mock-row-title">September wholesale order</div><div class="mock-row-sub">Qty 1</div></div><div style="font-size:12.5px;font-weight:700;">₨50,000</div></div>
          <div class="mock-row"><div class="mock-row-title" style="color:var(--text-muted);font-weight:600;">Total due</div><div style="font-size:14px;font-weight:800;">₨50,000</div></div>
        </div>
        <div class="mock-card" style="display:flex;justify-content:space-between;align-items:center;">
          <div><div class="mock-row-title">Zainab Traders</div><div class="mock-row-sub">billing@zainabtraders.example</div></div>
          <div style="font-size:10.5px;color:var(--text-faint);">Due Sep 30</div>
        </div>
        <div class="mock-btn">View hosted pay link</div>
      </div>
    </div>`,

  subscription: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/subscriptions')}
      <div class="mockup-body">
        <div class="mock-grid-2">
          <div class="mock-card"><div class="mock-label">Active</div><div class="mock-value">128</div></div>
          <div class="mock-card"><div class="mock-label">MRR</div><div class="mock-value">₨384k</div></div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">Upcoming renewals</div>
          <div class="mock-row"><div><div class="mock-row-title">Pro plan · monthly</div><div class="mock-row-sub">Renews in 3 days</div></div><span class="badge badge-success">Active</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Studio plan · monthly</div><div class="mock-row-sub">Retry 2 of 3</div></div><span class="badge badge-pending">Past due</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Basic plan · yearly</div><div class="mock-row-sub">Renews in 41 days</div></div><span class="badge badge-success">Active</span></div>
        </div>
      </div>
    </div>`,

  sentinel: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/transactions/txn_01J3')}
      <div class="mockup-body">
        <div class="mock-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div class="mock-label" style="margin:0;">Risk score</div>
            <span class="badge badge-danger">Blocked</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:9px;">
            <div style="font-size:30px;font-weight:900;color:var(--danger);line-height:1;">82</div>
            <div style="font-size:11px;color:var(--text-faint);">/ 100 · threshold 75</div>
          </div>
          <div class="mock-bar-track"><div class="mock-bar-fill" style="width:82%;background:var(--danger);"></div></div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">Signals triggered</div>
          <div class="mock-row"><div class="mock-row-title" style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;">velocity_email</div><span style="font-size:10.5px;color:var(--danger);font-weight:700;">+30</span></div>
          <div class="mock-row"><div class="mock-row-title" style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;">first_time_customer</div><span style="font-size:10.5px;color:var(--pending);font-weight:700;">+22</span></div>
          <div class="mock-row"><div class="mock-row-title" style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;">amount_deviation</div><span style="font-size:10.5px;color:var(--danger);font-weight:700;">+30</span></div>
        </div>
      </div>
    </div>`,

  disputes: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/disputes/dp_7Xq')}
      <div class="mockup-body">
        <div class="mock-card" style="border-color:var(--danger);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><div class="mock-label">Disputed amount</div><div class="mock-value">₨12,000</div></div>
            <span class="badge badge-danger">Needs response</span>
          </div>
          <div style="margin-top:11px;padding-top:11px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:11px;">
            <span style="color:var(--text-faint);">Respond by</span>
            <span style="font-weight:700;color:var(--danger);">6 days left</span>
          </div>
        </div>
        <div class="mock-card">
          <div class="mock-label">Your evidence</div>
          <div style="font-size:11.5px;color:var(--text-muted);line-height:1.6;">Customer received the product; tracking number attached…</div>
        </div>
        <div class="mock-btn">Submit response</div>
      </div>
    </div>`,

  tax: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/settings/tax')}
      <div class="mockup-body">
        <div class="mock-grid-2">
          <div class="mock-field">Province · <strong style="color:var(--text);">Sindh</strong></div>
          <div class="mock-field">Status · <strong style="color:var(--text);">Filer</strong></div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">Last 365 days</div>
          <div class="mock-row"><div class="mock-row-title">Gross volume</div><div style="font-size:12.5px;font-weight:700;">₨4,820,000</div></div>
          <div class="mock-row"><div><div class="mock-row-title">PPay fee</div><div class="mock-row-sub">The figure sales tax applies to</div></div><div style="font-size:12.5px;font-weight:700;">₨125,320</div></div>
          <div class="mock-row"><div><div class="mock-row-title">Sales tax on services</div><div class="mock-row-sub">SRB · Sindh</div></div><div style="font-size:12.5px;font-weight:700;color:var(--accent);">₨16,291</div></div>
        </div>
        <div style="font-size:10px;color:var(--text-faint);text-align:center;">Estimate from published rates — not filing advice</div>
      </div>
    </div>`,

  payouts: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/balances')}
      <div class="mockup-body">
        <div class="mock-grid-2">
          <div class="mock-card"><div class="mock-label">Available</div><div class="mock-value" style="color:var(--success);">₨218,400</div><div class="mock-sub">Next payout Fri</div></div>
          <div class="mock-card"><div class="mock-label">Pending</div><div class="mock-value">₨64,900</div><div class="mock-sub">Clears in 1 day</div></div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">Settlement batches</div>
          <div class="mock-row"><div><div class="mock-row-title">Batch · 14 payments</div><div class="mock-row-sub">Gross ₨96,000 · fee ₨2,496</div></div><span class="badge badge-success">Paid</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Batch · 9 payments</div><div class="mock-row-sub">Gross ₨61,500 · fee ₨1,599</div></div><span class="badge badge-pending">Pending</span></div>
        </div>
      </div>
    </div>`,

  analytics: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/analytics')}
      <div class="mockup-body">
        <div class="mock-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><div class="mock-label">Success rate · 30d</div><div class="mock-value" style="color:var(--success);">94.2%</div></div>
            <div style="font-size:11px;color:var(--success);font-weight:700;">▲ 2.1% vs prev</div>
          </div>
          <div class="mock-chart">
            ${[52, 64, 48, 72, 60, 80, 68, 88, 74, 92, 82, 96].map((h) => `<div class="mock-chart-bar" style="height:${h}%;"></div>`).join('')}
          </div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">By payment method</div>
          <div class="mock-row"><div class="mock-row-title">Card</div><div style="flex:1;max-width:90px;"><div class="mock-bar-track"><div class="mock-bar-fill" style="width:96%;"></div></div></div><span style="font-size:10.5px;font-weight:700;">96%</span></div>
          <div class="mock-row"><div class="mock-row-title">Wallet</div><div style="flex:1;max-width:90px;"><div class="mock-bar-track"><div class="mock-bar-fill" style="width:91%;"></div></div></div><span style="font-size:10.5px;font-weight:700;">91%</span></div>
          <div class="mock-row"><div class="mock-row-title">Bank transfer</div><div style="flex:1;max-width:90px;"><div class="mock-bar-track"><div class="mock-bar-fill" style="width:88%;"></div></div></div><span style="font-size:10.5px;font-weight:700;">88%</span></div>
        </div>
      </div>
    </div>`,

  financialConnections: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/settings/payout-account')}
      <div class="mockup-body">
        <div class="mock-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><div class="mock-row-title">Meezan Bank ••••4417</div><div class="mock-row-sub">Payout destination</div></div>
            <span class="badge badge-success">Verified</span>
          </div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">Micro-deposit confirmation</div>
          <div class="mock-row"><div class="mock-row-title">Amount 1</div><div class="mock-field" style="padding:5px 10px;font-size:11.5px;">0.20</div></div>
          <div class="mock-row"><div class="mock-row-title">Amount 2</div><div class="mock-field" style="padding:5px 10px;font-size:11.5px;">0.03</div></div>
        </div>
        <div class="mock-btn">Confirm amounts</div>
        <div style="font-size:10px;color:var(--text-faint);text-align:center;">5 attempts per verification</div>
      </div>
    </div>`,

  notifications: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/notifications')}
      <div class="mockup-body">
        <div class="mock-list">
          <div class="mock-list-header">Activity</div>
          <div class="mock-row" style="background:var(--accent-soft);"><div><div class="mock-row-title">Payment blocked by Sentinel</div><div class="mock-row-sub">Risk 82 · 2 min ago</div></div><span class="badge badge-danger">Critical</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Payout sent to ••••4417</div><div class="mock-row-sub">₨218,400 · 1 hr ago</div></div><span class="badge badge-success">Payout</span></div>
          <div class="mock-row"><div><div class="mock-row-title">New sign-in from Lahore</div><div class="mock-row-sub">Chrome · Windows · 3 hr ago</div></div><span class="badge badge-pending">Security</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Refund issued · ₨1,500</div><div class="mock-row-sub">Order #1029 · 5 hr ago</div></div><span class="badge badge-neutral">Refund</span></div>
        </div>
      </div>
    </div>`,

  teamSecurity: () => `
    <div class="mockup">
      ${browserChrome('app.ppay.pk/settings/team')}
      <div class="mockup-body">
        <div class="mock-list">
          <div class="mock-list-header">Team members</div>
          <div class="mock-row"><div><div class="mock-row-title">Usama R.</div><div class="mock-row-sub">2FA enabled</div></div><span class="badge badge-accent">Owner</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Ayesha K.</div><div class="mock-row-sub">2FA enabled</div></div><span class="badge badge-neutral">Admin</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Bilal S.</div><div class="mock-row-sub">Invite pending</div></div><span class="badge badge-neutral">Support</span></div>
        </div>
        <div class="mock-list">
          <div class="mock-list-header">Active sessions</div>
          <div class="mock-row"><div><div class="mock-row-title">Chrome · Windows</div><div class="mock-row-sub">Karachi · current</div></div><span style="font-size:10.5px;color:var(--text-faint);">—</span></div>
          <div class="mock-row"><div><div class="mock-row-title">Safari · macOS</div><div class="mock-row-sub">Lahore · 2 days ago</div></div><span style="font-size:10.5px;color:var(--danger);font-weight:700;">Revoke</span></div>
        </div>
      </div>
    </div>`,
};

/* ── Section renderers ────────────────────────────────────── */
function heroHTML(p) {
  return `
  <section class="page-top" style="border-bottom:1px solid var(--border);background:var(--surface);">
    <div class="container">
      <div class="grid-2" style="gap:64px;align-items:center;">
        <div>
          <div class="hero-eyebrow">${p.category}</div>
          <h1 class="hero-title" style="font-size:clamp(30px,4.2vw,46px);">${p.hero.title}</h1>
          <p class="hero-sub">${p.hero.sub}</p>
          <div class="hero-actions">
            <a href="https://app.ppay.silicatelabs.site" class="btn btn-primary btn-lg">Access app in beta</a>
            <a href="developers.html" class="btn btn-secondary btn-lg">Read the docs →</a>
          </div>
          <div style="display:flex;align-items:center;gap:18px;margin-top:26px;flex-wrap:wrap;">
            ${p.hero.marks.map((m) => `<span style="font-size:13px;color:var(--text-muted);display:inline-flex;align-items:center;gap:6px;">${expandIcons(m)}</span>`).join('')}
          </div>
        </div>
        <div>${MOCKUPS[p.mockup]()}</div>
      </div>
    </div>
  </section>`;
}

function valuePropsHTML(p) {
  return `
  <section class="section-sm">
    <div class="container">
      <div class="vp-strip" data-animate>
        ${p.valueProps
          .map((v) => `<div class="vp-item"><div class="vp-title">${v.title}</div><div class="vp-body">${v.body}</div></div>`)
          .join('')}
      </div>
    </div>
  </section>`;
}

function featureRowsHTML(p) {
  return `
  <section class="section" style="padding-top:8px;">
    <div class="container">
      ${p.featureRows
        .map(
          (f, i) => `
        <div class="feature-row${i % 2 === 1 ? ' reverse' : ''}" data-animate>
          <div class="feature-row-text">
            <div class="section-eyebrow">${f.eyebrow}</div>
            <h2 class="feature-row-title" style="margin-top:10px;">${f.title}</h2>
            <p class="feature-row-sub">${f.sub}</p>
            <ul class="feature-row-list">
              ${f.bullets.map((b) => `<li>${b}</li>`).join('')}
            </ul>
          </div>
          <div class="feature-row-visual">${f.visual ? MOCKUPS[f.visual]() : codeBlockHTML(f.code)}</div>
        </div>`
        )
        .join('')}
    </div>
  </section>`;
}

function codeBlockHTML(code) {
  if (!code) return '';
  return `
    <div class="code-block">
      <div class="code-block-header"><span>${code.label}</span></div>
      <pre class="code-block-body">${code.body}</pre>
    </div>`;
}

function segmentsHTML(p) {
  return `
  <section class="section" style="background:var(--surface);border-top:1px solid var(--border);">
    <div class="container">
      <div class="text-center mb-48" data-animate>
        <div class="section-eyebrow">Who it's for</div>
        <h2 class="section-title">${p.segments.title}</h2>
        <p class="section-sub">${p.segments.sub}</p>
      </div>
      <div class="segment-grid" data-animate>
        ${p.segments.items
          .map(
            (s) => `
          <div class="segment-card">
            <div class="segment-ico" style="color:var(--accent);">${icon(s.ico, 24)}</div>
            <div class="segment-title">${s.title}</div>
            <div class="segment-body">${s.body}</div>
            <div class="segment-need">${s.need}</div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

function statBandHTML(p) {
  return `
  <section class="section-sm" style="border-top:1px solid var(--border);">
    <div class="container">
      <div class="stat-band" data-animate>
        ${p.stats
          .map((s) => `<div class="stat-band-item"><div class="stat-band-num">${s.num}</div><div class="stat-band-label">${s.label}</div></div>`)
          .join('')}
      </div>
    </div>
  </section>`;
}

function relatedHTML(p) {
  return `
  <section class="section" style="background:var(--surface);border-top:1px solid var(--border);">
    <div class="container">
      <div class="text-center mb-48" data-animate>
        <div class="section-eyebrow">Works with</div>
        <h2 class="section-title">Pairs with the rest of the platform</h2>
      </div>
      <div class="grid-3" style="gap:20px;" data-animate>
        ${p.related
          .map(
            (r) => `
          <a href="${r.href}" class="feature-card card-hover" style="text-decoration:none;display:block;">
            <div class="icon-box icon-accent">${icon(r.ico, 18)}</div>
            <div class="feature-card-title">${r.title}</div>
            <div class="feature-card-body">${r.body}</div>
          </a>`
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

function finalCTAHTML(p) {
  return `
  <section class="section">
    <div class="container" data-animate>
      <div class="cta-band">
        <h2>${p.cta.title}</h2>
        <p>${p.cta.body}</p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap;">
          <a href="https://app.ppay.silicatelabs.site" class="btn btn-white btn-lg">Access app in beta</a>
          <a href="developers.html" class="btn btn-outline-white btn-lg">Read the docs →</a>
        </div>
      </div>
    </div>
  </section>`;
}

/* ── Page assembly ────────────────────────────────────────── */
function renderProductPage(key) {
  const p = PRODUCTS[key];
  if (!p) {
    console.error('Unknown product page:', key);
    return;
  }
  const html = [
    heroHTML(p),
    valuePropsHTML(p),
    marqueeHTML(),
    featureRowsHTML(p),
    segmentsHTML(p),
    statBandHTML(p),
    relatedHTML(p),
    finalCTAHTML(p),
  ].join('\n');
  document.body.insertAdjacentHTML('beforeend', html);
}
