const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const base = 'http://localhost:3000';
  const outDir = 'E:/Github/FitTrack-AI/docs/screenshots';
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 430, height: 2200 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  async function capture(route, file, expectedTexts) {
    await page.goto(`${base}${route}`, { waitUntil: 'load' });
    let matched = false;
    for (const text of expectedTexts) {
      try {
        await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20000 });
        matched = true;
        break;
      } catch {}
    }
    if (!matched) {
      await page.waitForTimeout(6000);
    }
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  }

  await capture('/#/analytics/daily', 'analytics-daily.png', ['综合评估', '热量分析', '饮食分析']);
  await capture('/#/analytics/weekly', 'analytics-weekly.png', ['本周综合评估', '饮食趋势', '行为风险预警']);

  await browser.close();
})();
