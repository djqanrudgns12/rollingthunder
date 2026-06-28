const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting Map 5 test...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const artifactsDir = 'C:\\Users\\rudgn\\.gemini\\antigravity\\brain\\8767ff0f-a4ad-4d3e-b285-94aa1add8357\\scratch\\images';
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  try {
    console.log('Navigating to http://localhost:3005');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); 

    // Open map modal
    console.log('Opening Map modal...');
    await page.click('button:has-text("변경")');
    await page.waitForTimeout(500);

    // Click "차원 포탈 미궁" (Map 5)
    console.log('Selecting Map 5...');
    await page.click('h3:has-text("차원 포탈 미궁")');
    await page.waitForTimeout(500);

    // Set participants
    await page.fill('textarea[placeholder="참가자 이름 (쉼표/공백/줄바꿈 다중입력)"]', 'P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20');
    await page.click('button:has-text("추가")');
    await page.waitForTimeout(500);

    // Start Game
    console.log('Starting the game...');
    await page.click('button:has-text("GAME START")');

    // Take screenshots
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(3000); 
      await page.screenshot({ path: path.join(artifactsDir, `map5_stage_${i}.png`) });
      console.log(`Captured playing stage ${i}`);
    }

    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(artifactsDir, 'map5_later_stage.png') });
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browser.close();
    console.log('Test completed.');
  }
})();
