const { chromium } = require('playwright-core');
const path = require('path');
const OUT = 'C:/Users/hp/AppData/Local/Temp/claude/e--Projects-OpenPay/655c0dd0-f2df-4bd7-aaa0-1eede2a69caa/scratchpad';
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('[data-animate]').forEach(e => e.classList.add('visible')));
  await p.waitForTimeout(300);
  const grids = await p.$$('.bento-grid');
  await grids[1].screenshot({ path: path.join(OUT, 'secure_bento.png') });
  await b.close();
})();
