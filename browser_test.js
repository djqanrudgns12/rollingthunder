const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('Starting browser test...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const artifactsDir = 'C:\\Users\\rudgn\\.gemini\\antigravity\\brain\\5000998c-a9ab-42a0-b292-106c2a824f7c\\images';
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  try {
    console.log('1. Navigating to main page');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${artifactsDir}\\1_main_page.png`, fullPage: true });
    console.log('Main page loaded and screenshotted.');

    const bodyTextMain = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log('Main page text excerpt:', bodyTextMain.replace(/\n/g, ' '));

    console.log('2. Navigating to /login');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${artifactsDir}\\2_login_page.png`, fullPage: true });
    console.log('Login page loaded and screenshotted.');

    console.log('3. Navigating to /editor');
    await page.goto('http://localhost:3000/editor', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${artifactsDir}\\3_editor_page.png`, fullPage: true });
    console.log('Editor page loaded and screenshotted.');

    console.log('4. Navigating to /gacha');
    await page.goto('http://localhost:3000/gacha', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${artifactsDir}\\4_gacha_page.png`, fullPage: true });
    console.log('Gacha page loaded and screenshotted.');

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browser.close();
    console.log('Browser test completed.');
  }
})();
