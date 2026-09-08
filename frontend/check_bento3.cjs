const { chromium } = require('playwright-core');
const path = require('path');
const OUT = 'C:/Users/hp/AppData/Local/Temp/claude/e--Projects-OpenPay/655c0dd0-f2df-4bd7-aaa0-1eede2a69caa/scratchpad';
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => errs.push('index: ' + e.message));
  await p.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('[data-animate]').forEach(e => e.classList.add('visible')));
  await p.waitForTimeout(300);
  const secureGrid = await p.$$('.bento-grid');
  console.log('index.html bento-grid count:', secureGrid.length);
  await p.screenshot({ path: path.join(OUT, 'index_full_v2.png'), fullPage: true });

  const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p2.on('pageerror', e => errs.push('products: ' + e.message));
  await p2.goto('http://localhost:8080/products.html', { waitUntil: 'networkidle' });
  await p2.evaluate(() => document.querySelectorAll('[data-animate]').forEach(e => e.classList.add('visible')));
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: path.join(OUT, 'products_full_v2.png'), fullPage: true });

  await b.close();
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
})();
