const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const base = 'http://localhost:3000';
  const outDir = 'E:/Github/FitTrack-AI/docs/screenshots';
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (name.endsWith('.png')) fs.unlinkSync(path.join(outDir, name));
  }

  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 430, height: 1600 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  const waitReady = async () => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  };
  const shot = async (name) => page.screenshot({ path: path.join(outDir, name), fullPage: true });

  await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  await shot('dashboard.png');

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await waitReady();
  await shot('logs.png');

  await page.getByRole('button', { name: '断食', exact: true }).click();
  await waitReady();
  await shot('fasting.png');

  await page.getByRole('button', { name: '我的', exact: true }).click();
  await waitReady();
  await shot('profile.png');

  const bodyEntry = page.getByRole('button', { name: /身体档案/ }).first();
  if (await bodyEntry.count()) {
    await bodyEntry.click();
    await waitReady();
    await shot('body-metrics.png');
  }

  await page.goto(`${base}/#/discipline`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  await shot('discipline.png');

  await page.goto(`${base}/#/analytics/daily`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  await shot('analytics-daily.png');

  await page.goto(`${base}/#/analytics/weekly`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  await shot('analytics-weekly.png');

  await browser.close();
})();
