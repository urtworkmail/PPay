document.addEventListener('DOMContentLoaded', () => {

  // Load theme preference
  const savedTheme = localStorage.getItem('ppay_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  const BANNER_HTML = `
  <div style="background:var(--accent);color:#fff;text-align:center;padding:8px 24px;font-size:13px;font-weight:600;">
    Sentinel risk scoring is live in sandbox. <a href="sentinel.html" style="color:#fff;font-weight:700;">See what's built</a>
  </div>`;

  // ── Mega menu data ───────────────────────────────────────────
  // Each top-level nav item that opens a mega menu is defined once here —
  // both the desktop panel and the flattened mobile menu are generated from
  // this same data, so the two can never drift out of sync.
  const MEGA_MENUS = {
    products: {
      label: 'Products',
      columns: 4,
      groups: [
        {
          label: 'Payments',
          items: [
            { href: 'checkout.html', ico: 'card', title: 'Checkout', desc: 'Hosted payment page — card, wallet, bank transfer' },
            { href: 'payment-links.html', ico: 'link', title: 'Payment Links', desc: 'Collect a payment with no code and no website' },
            { href: 'invoicing.html', ico: 'invoice', title: 'Invoicing', desc: 'One-off invoices, auto-numbered, paid online' },
            { href: 'subscriptions.html', ico: 'refresh', title: 'Subscriptions', desc: 'Recurring billing with retries and saved methods' },
          ],
        },
        {
          label: 'Risk & compliance',
          items: [
            { href: 'sentinel.html', ico: 'shield', title: 'Sentinel', desc: 'Real-time fraud scoring before a charge is attempted' },
            { href: 'disputes.html', ico: 'scale', title: 'Disputes', desc: 'Respond to chargebacks from one place' },
            { href: 'tax.html', ico: 'receipt', title: 'Tax', desc: "Pakistan provincial sales tax on PPay's fee" },
          ],
        },
        {
          label: 'Money & insights',
          items: [
            { href: 'balances-payouts.html', ico: 'bank', title: 'Balances & Payouts', desc: 'Settlement batches and payout scheduling' },
            { href: 'analytics.html', ico: 'chart', title: 'Analytics', desc: 'Trends, comparisons, and a payment-method breakdown' },
            { href: 'financial-connections.html', ico: 'plug', title: 'Financial Connections', desc: 'Verify the bank account payouts go to' },
          ],
        },
        {
          label: 'Platform',
          items: [
            { href: 'notifications.html', ico: 'bell', title: 'Notifications', desc: 'An activity feed, plus email alerts you control' },
            { href: 'team-security.html', ico: 'users', title: 'Team & Security', desc: 'Roles, two-factor auth, and session control' },
            { href: 'status.html', ico: 'monitor', title: 'Status', desc: 'Live uptime for every capability below' },
          ],
        },
      ],
      promo: {
        href: 'changelog.html',
        eyebrow: "What's new",
        title: 'Notifications, Sentinel, and five new products',
        body: 'See everything that shipped this release in the changelog.',
      },
    },

    solutions: {
      label: 'Solutions',
      columns: 4,
      groups: [
        {
          label: 'By industry',
          items: [
            { href: 'checkout.html', ico: 'store', title: 'Ecommerce & retail', desc: 'Hosted checkout for card, wallet, and bank' },
            { href: 'subscriptions.html', ico: 'terminal', title: 'SaaS & software', desc: 'Recurring billing with automatic dunning' },
            { href: 'invoicing.html', ico: 'book', title: 'Education & edtech', desc: 'Course and admission fees, billed online' },
            { href: 'invoicing.html', ico: 'idCard', title: 'Healthcare & clinics', desc: 'Bill a patient after the appointment' },
            { href: 'checkout.html', ico: 'globe', title: 'Travel & ticketing', desc: 'High-value bookings, risk-checked first' },
          ],
        },
        {
          label: 'More industries',
          items: [
            { href: 'balances-payouts.html', ico: 'users', title: 'Marketplaces & platforms', desc: 'Settlement batches across many sellers' },
            { href: 'checkout.html', ico: 'store', title: 'Food & delivery', desc: 'Fast checkout for high-frequency orders' },
            { href: 'subscriptions.html', ico: 'refresh', title: 'Gyms & memberships', desc: 'Recurring dues collected automatically' },
            { href: 'balances-payouts.html', ico: 'box', title: 'Logistics & wholesale', desc: 'Batch-level records for larger invoices' },
            { href: 'sentinel.html', ico: 'workflow', title: 'Gaming & digital goods', desc: 'Catch card testing on instant delivery' },
          ],
        },
        {
          label: 'By business size',
          items: [
            { href: 'payment-links.html', ico: 'compass', title: 'Creators & freelancers', desc: 'Get paid with a link, no website' },
            { href: 'invoicing.html', ico: 'clipboard', title: 'Agencies & services', desc: 'Bill a named client for delivered work' },
            { href: 'checkout.html', ico: 'store', title: 'Small businesses', desc: 'Start taking payments in an afternoon' },
            { href: 'team-security.html', ico: 'users', title: 'Growing teams', desc: 'Roles, 2FA, and session control' },
            { href: 'payment-links.html', ico: 'lifeBuoy', title: 'Nonprofits & fundraising', desc: 'One reusable link for many donors' },
          ],
        },
        {
          label: 'By use case',
          items: [
            { href: 'checkout.html', ico: 'card', title: 'Online payments', desc: 'Card, wallet, and bank on one page' },
            { href: 'subscriptions.html', ico: 'refresh', title: 'Recurring revenue', desc: 'Subscriptions with retry logic' },
            { href: 'sentinel.html', ico: 'shield', title: 'Fraud prevention', desc: 'Block risky attempts before the rail' },
            { href: 'tax.html', ico: 'receipt', title: 'Tax & compliance', desc: 'Provincial sales tax estimates' },
            { href: 'analytics.html', ico: 'chart', title: 'Reporting & insights', desc: 'Trends and per-method success rates' },
          ],
        },
      ],
      promo: {
        href: 'roadmap.html',
        eyebrow: 'Honest by design',
        title: "See what's live vs. on the roadmap",
        body: 'Every solution here is backed by a product page that says exactly what is built today.',
      },
    },

    developers: {
      label: 'Developers',
      columns: 4,
      groups: [
        {
          label: 'Get started',
          items: [
            { href: 'developers.html', ico: 'rocket', title: 'Quickstart', desc: 'Your first API call in minutes' },
            { href: 'developers.html', ico: 'key', title: 'API keys', desc: 'Sandbox keys issued automatically' },
            { href: 'developers.html#test-cards', ico: 'card', title: 'Test cards & wallets', desc: 'Deterministic sandbox outcomes' },
          ],
        },
        {
          label: 'Build',
          items: [
            { href: 'developers.html', ico: 'terminal', title: 'API Reference', desc: 'Endpoints, requests, and responses' },
            { href: 'checkout.html', ico: 'card', title: 'Checkout Sessions', desc: 'The core payment integration' },
            { href: 'developers.html#webhooks', ico: 'plug', title: 'Webhooks', desc: 'Signed events with automatic retries' },
          ],
        },
        {
          label: 'Operate',
          items: [
            { href: 'notifications.html', ico: 'bell', title: 'Events & notifications', desc: 'An immutable log of what happened' },
            { href: 'status.html', ico: 'monitor', title: 'API status', desc: 'Live uptime for every capability' },
            { href: 'team-security.html', ico: 'shield', title: 'Security', desc: 'Roles, 2FA, and session control' },
          ],
        },
        {
          label: 'Stay current',
          items: [
            { href: 'changelog.html', ico: 'refresh', title: 'Changelog', desc: 'Everything shipped, in order' },
            { href: 'contact.html', ico: 'lifeBuoy', title: 'Developer support', desc: 'Talk to the people who built it' },
          ],
        },
      ],
      promo: {
        href: 'developers.html',
        eyebrow: 'Quickstart',
        title: 'Your first API call in minutes',
        body: 'Sandbox keys are generated automatically. No approval wait.',
      },
    },

    resources: {
      label: 'Resources',
      columns: 4,
      groups: [
        {
          label: 'Company',
          items: [
            { href: 'team.html', ico: 'users', title: 'Team', desc: 'Who is building PPay' },
            { href: 'contact.html', ico: 'lifeBuoy', title: 'Contact', desc: 'Beta access and partnerships' },
            { href: 'roadmap.html', ico: 'compass', title: 'Roadmap', desc: "What's shipped and what's next" },
          ],
        },
        {
          label: 'Learn',
          items: [
            { href: 'products.html', ico: 'book', title: 'How it works', desc: 'The sequence, start to settlement' },
            { href: 'changelog.html', ico: 'refresh', title: 'Changelog', desc: 'Everything shipped, in order' },
            { href: 'sentinel.html', ico: 'shield', title: 'Fraud guide', desc: 'How risk scoring actually works' },
          ],
        },
        {
          label: 'Support',
          items: [
            { href: 'status.html', ico: 'monitor', title: 'Platform status', desc: 'Live uptime for every capability' },
            { href: 'tel:+923275754989', ico: 'phone', title: 'Call us', desc: '+92 (327) 575-4989' },
            { href: 'mailto:support@silicatelabs.site', ico: 'bell', title: 'Email support', desc: 'support@silicatelabs.site' },
          ],
        },
        {
          label: 'Legal & pricing',
          items: [
            { href: 'pricing.html', ico: 'receipt', title: 'Pricing', desc: 'Sandbox is free while we build' },
            { href: 'privacy.html', ico: 'idCard', title: 'Privacy Policy', desc: 'How data is handled' },
            { href: 'terms.html', ico: 'clipboard', title: 'Terms of Service', desc: 'The terms of using PPay' },
          ],
        },
      ],
      promo: {
        href: 'contact.html',
        eyebrow: 'Silicate Labs',
        title: 'PPay is built by Silicate Labs',
        body: 'Reach support at support@silicatelabs.site. Investor relations: silicatelabs.site.',
      },
    },
  };

  function megaPanelHTML(key, menu) {
    return `
    <div class="mega-panel" id="mega-panel-${key}" role="menu">
      <div class="mega-grid mega-grid-${menu.columns}">
        ${menu.groups.map(group => `
          <div>
            <div class="mega-col-label">${group.label}</div>
            ${group.items.map(item => `
              <a class="mega-link" href="${item.href}" role="menuitem">
                <span class="mega-link-ico">${icon(item.ico, 17)}</span>
                <span class="mega-link-copy">
                  <span class="mega-link-title">${item.title}</span>
                  <span class="mega-link-desc">${item.desc}</span>
                </span>
              </a>
            `).join('')}
          </div>
        `).join('')}
        <a class="mega-promo" href="${menu.promo.href}">
          <div class="mega-promo-eyebrow">${menu.promo.eyebrow}</div>
          <div class="mega-promo-title">${menu.promo.title}</div>
          <div class="mega-promo-body">${menu.promo.body}</div>
        </a>
      </div>
    </div>`;
  }

  function mobileMenuLinksHTML(menu) {
    return menu.groups.map(group => `
      <div class="mobile-menu-group-label">${group.label}</div>
      ${group.items.map(item => `<a href="${item.href}"><span style="display:inline-flex;vertical-align:-3px;margin-right:9px;color:var(--accent);">${icon(item.ico, 16)}</span>${item.title}</a>`).join('')}
    `).join('');
  }

  function mobileMenuSectionHTML(key, menu) {
    return `
    <div class="mobile-menu-section">
      <button type="button" class="mobile-menu-section-toggle" data-mobile-target="${key}" aria-expanded="false" aria-controls="mobile-panel-${key}">
        ${menu.label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="mobile-menu-section-panel" id="mobile-panel-${key}">
        <div class="mobile-menu-section-panel-inner">
          ${mobileMenuLinksHTML(menu)}
        </div>
      </div>
    </div>`;
  }

  const MEGA_KEYS = Object.keys(MEGA_MENUS);
  const ALL_PANELS_HTML = MEGA_KEYS.map(key => megaPanelHTML(key, MEGA_MENUS[key])).join('');

  const NAV_HTML = `
  <nav class="nav" id="site-nav" style="position:sticky;top:0;">
    <div class="nav-inner">
      <a href="index.html" class="nav-logo">
        ${logoMark(30)}
        <span>PPay</span>
      </a>
      <ul class="nav-links" id="nav-links">
        ${MEGA_KEYS.map(key => `
          <li>
            <button type="button" class="mega-trigger" data-mega="${key}" aria-expanded="false" aria-controls="mega-panel-${key}">
              ${MEGA_MENUS[key].label}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </li>
        `).join('')}
        <li><a href="pricing.html">Pricing</a></li>
      </ul>
      ${ALL_PANELS_HTML}
      <div class="nav-cta">
        <button id="theme-toggle" class="btn btn-ghost btn-sm" style="display:flex;align-items:center;justify-content:center;padding:6px;width:32px;height:32px;" aria-label="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
        </button>
        <a href="tel:+923275754989" class="btn btn-ghost btn-sm nav-call" title="Call support: +92 (327) 575-4989" style="display:flex;align-items:center;gap:6px;"><span data-icon="phone" data-icon-size="15"></span><span class="nav-call-num">+92 (327) 575-4989</span></a>
        <a href="https://app.ppay.silicatelabs.site" class="btn btn-primary btn-sm">Access app in beta</a>
      </div>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>
  <div class="mobile-menu" id="mobile-menu">
    ${MEGA_KEYS.map(key => mobileMenuSectionHTML(key, MEGA_MENUS[key])).join('')}
    <div class="mobile-menu-group-label" style="border-top:1px solid var(--border);padding-top:14px;margin-top:6px;">More</div>
    <a href="pricing.html">Pricing</a>
    <a href="tel:+923275754989" class="btn btn-secondary" style="margin-top:8px;justify-content:center;">Call +92 (327) 575-4989</a>
    <a href="https://app.ppay.silicatelabs.site" class="btn btn-primary" style="margin-top:8px;justify-content:center;">Access app in beta</a>
  </div>`;

  const FOOTER_HTML = `
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="nav-logo" style="display:inline-flex;">
            ${logoMark(30)}
            <span>PPay</span>
          </a>
          <p>Pakistan's payment infrastructure platform, built for developers, honest about where it is, clear about where it's going. A product of <a href="https://silicatelabs.site" target="_blank" rel="noopener" style="color:var(--accent);">Silicate Labs</a>.</p>
        </div>
        <div class="footer-col">
          <h4>Products</h4>
          <ul>
            <li><a href="checkout.html">Checkout</a></li>
            <li><a href="payment-links.html">Payment Links</a></li>
            <li><a href="invoicing.html">Invoicing</a></li>
            <li><a href="subscriptions.html">Subscriptions</a></li>
            <li><a href="sentinel.html">Sentinel</a></li>
            <li><a href="disputes.html">Disputes</a></li>
            <li><a href="tax.html">Tax</a></li>
            <li><a href="balances-payouts.html">Balances &amp; Payouts</a></li>
            <li><a href="analytics.html">Analytics</a></li>
            <li><a href="financial-connections.html">Financial Connections</a></li>
            <li><a href="notifications.html">Notifications</a></li>
            <li><a href="team-security.html">Team &amp; Security</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Solutions</h4>
          <ul>
            <li><a href="checkout.html">Ecommerce &amp; retail</a></li>
            <li><a href="subscriptions.html">SaaS &amp; software</a></li>
            <li><a href="balances-payouts.html">Marketplaces</a></li>
            <li><a href="payment-links.html">Creators &amp; freelancers</a></li>
            <li><a href="invoicing.html">Agencies &amp; services</a></li>
            <li><a href="invoicing.html">Education &amp; edtech</a></li>
            <li><a href="invoicing.html">Healthcare &amp; clinics</a></li>
            <li><a href="checkout.html">Travel &amp; ticketing</a></li>
            <li><a href="checkout.html">Food &amp; delivery</a></li>
            <li><a href="subscriptions.html">Gyms &amp; memberships</a></li>
            <li><a href="sentinel.html">Gaming &amp; digital goods</a></li>
            <li><a href="payment-links.html">Nonprofits</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Developers</h4>
          <ul>
            <li><a href="developers.html">API Reference</a></li>
            <li><a href="developers.html#webhooks">Webhooks</a></li>
            <li><a href="developers.html#test-cards">Test cards</a></li>
            <li><a href="status.html">API status</a></li>
            <li><a href="changelog.html">Changelog</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="products.html">How it works</a></li>
            <li><a href="pricing.html">Pricing</a></li>
            <li><a href="roadmap.html">Roadmap</a></li>
            <li><a href="status.html">Platform status</a></li>
            <li><a href="contact.html">Support</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="team.html">Team</a></li>
            <li><a href="contact.html">Contact</a></li>
            <li><a href="https://silicatelabs.site" target="_blank" rel="noopener">Silicate Labs</a></li>
            <li><a href="https://silicatelabs.site/investor-relations.html" target="_blank" rel="noopener">Investor relations</a></li>
            <li><a href="tel:+923275754989">+92 (327) 575-4989</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p> PPay is a technology orchestration layer built for Pakistani businesses. We build the checkout panels, payment links, developer APIs, webhooks, invoicing, and subscription tooling that Pakistani merchants currently hand-code or piece together from multiple vendors. We do not hold a PSO/PSP or EMI license, we are not a bank, and we do not custody merchant or customer funds. Money movement, settlement, and fund custody are handled by our licensed banking and payment partners. PPay sits on top of those rails as the software layer: one API and one dashboard instead of a different integration for every card network, wallet, and bank. We're currently structuring the specific partnership and regulatory arrangement with our banking partners, and that structure will determine the final legal position of the platform. This page will be updated as that structure is finalized. Until then, PPay is in sandbox: no live transactions, no real money movement, test credentials only. PPay is a product of Silicate Labs, which will hold or arrange any licenses, approvals, or partner agreements required for PPay to operate live.</p>
        <div class="footer-badges">
          <a href="privacy.html" class="footer-badge">Privacy</a>
          <a href="terms.html" class="footer-badge">Terms</a>
          <span class="footer-badge">Pakistan-first</span>
          <span class="footer-badge">Sandbox Stage</span>
        </div>
      </div>
    </div>
  </footer>`;

  // 1. Inject Banner & Nav
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  document.body.insertAdjacentHTML('afterbegin', BANNER_HTML);

  // 2. Wrap all remaining body content (non-nav, non-banner, non-footer) in <main>
  const main = document.createElement('main');
  const nav = document.getElementById('site-nav');
  const mobileMenu = document.getElementById('mobile-menu');
  const toMove = [];
  let node = mobileMenu ? mobileMenu.nextSibling : nav.nextSibling;
  while (node) {
    if (node.tagName !== 'SCRIPT' || !node.src.includes('shared.js')) {
      toMove.push(node);
    }
    node = node.nextSibling;
  }
  toMove.forEach(n => main.appendChild(n));
  document.body.appendChild(main);

  // 3. Inject footer after <main>
  document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);

  // ── Active nav link ───────────────────────────────────────
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#nav-links > li > a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
  // A mega-menu trigger doesn't link anywhere itself, but it should still
  // read as "active" when the current page is one of its own items.
  // Solutions deliberately cross-lists the same product pages under an
  // industry lens, so a page can legitimately appear under more than one
  // menu — only the first match (in MEGA_KEYS's declared order, which is
  // also each page's canonical home) gets highlighted, so exactly one
  // trigger lights up rather than every menu that happens to link there.
  const canonicalKey = MEGA_KEYS.find(key =>
    MEGA_MENUS[key].groups.some(g => g.items.some(i => i.href.split('#')[0] === path))
  );
  if (canonicalKey) {
    document.querySelector(`.mega-trigger[data-mega="${canonicalKey}"]`)?.classList.add('active');
  }

  // ── Mega menus (multiple triggers, one open at a time) ────────
  const triggers = [...document.querySelectorAll('.mega-trigger')];
  function closeAllMega(except) {
    triggers.forEach(t => {
      if (t === except) return;
      t.setAttribute('aria-expanded', 'false');
      document.getElementById(`mega-panel-${t.dataset.mega}`)?.classList.remove('open');
    });
  }
  triggers.forEach(trigger => {
    const panel = document.getElementById(`mega-panel-${trigger.dataset.mega}`);
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains('open');
      closeAllMega();
      if (!isOpen) {
        panel.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('click', (e) => {
    const openPanel = document.querySelector('.mega-panel.open');
    if (openPanel && !openPanel.contains(e.target) && !e.target.closest('.mega-trigger')) {
      closeAllMega();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMega();
  });

  // ── Theme toggle ──────────────────────────────────────────
  const themeBtn = document.getElementById('theme-toggle');

  const updateThemeIcon = (theme) => {
    if (themeBtn) {
      if (theme === 'dark') {
        themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>';
      } else {
        themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>';
      }
    }
  };

  // Initialize icon
  let currentTheme = document.documentElement.getAttribute('data-theme');
  if (!currentTheme) {
    currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  updateThemeIcon(currentTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      let current = document.documentElement.getAttribute('data-theme');
      if (!current) {
        current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ppay_theme', next);
      updateThemeIcon(next);
    });
  }

  // ── Hamburger toggle ──────────────────────────────────────
  const hamburger = document.getElementById('nav-hamburger');
  const mm = document.getElementById('mobile-menu');
  if (hamburger) {
    hamburger.addEventListener('click', () => mm.classList.toggle('open'));
  }
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => mm.classList.remove('open'));
  });

  // ── Collapsible sections within the mobile menu ───────────
  document.querySelectorAll('.mobile-menu-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`mobile-panel-${btn.getAttribute('data-mobile-target')}`);
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (panel) panel.classList.toggle('open', !isOpen);
    });
  });

  // ── Visit tracking ────────────────────────────────────────
  // Fire-and-forget beacon so the internal review team can see who's
  // actually visiting the site (IP-resolved city/region/country, same
  // mechanism as the dashboard's own sign-in location — see
  // services/geoip.py — never device GPS, no permission prompt). Never
  // blocks rendering and never throws if the API is unreachable.
  (function () {
    var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : 'https://app.ppay.silicatelabs.site';
    try {
      fetch(API_BASE + '/api/v1/public/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: location.pathname + location.search,
          referrer: document.referrer || null,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {}
  })();

  // ── Icon placeholders ─────────────────────────────────────
  // Static pages mark icons up as <span data-icon="shield"> so the markup
  // stays readable; this swaps each one for the real SVG on load.
  document.querySelectorAll('[data-icon]').forEach(el => {
    const size = parseInt(el.getAttribute('data-icon-size') || '18', 10);
    el.innerHTML = icon(el.getAttribute('data-icon'), size);
    el.style.display = 'inline-flex';
  });

  // ── Scroll animations ─────────────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.08 });

  requestAnimationFrame(() => {
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
  });

});
