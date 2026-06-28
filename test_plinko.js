const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting plinko cascade map test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const artifactsDir = 'C:\\Users\\rudgn\\.gemini\\antigravity\\brain\\6a6c6bbc-c28e-4270-bc38-4945c2227bb5\\images';
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  try {
    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); 

    // Open map selector
    console.log('Opening map selector...');
    await page.evaluate(() => {
        document.querySelectorAll('button').forEach(b => {
            if (b.innerText && (b.innerText.includes('변경') || b.innerText.includes('맵'))) {
                b.click();
            }
        });
    });
    await page.waitForTimeout(1000);

    // Select '플링코 폭포'
    console.log('Selecting Plinko Cascade map...');
    await page.evaluate(() => {
        document.querySelectorAll('div, h3, button').forEach(el => {
            if (el.innerText && el.innerText.includes('플링코 폭포')) {
                el.click();
            }
        });
    });
    await page.waitForTimeout(1000);

    // Click confirm or load map
    // (Removed because clicking the map directly loads it)
    await page.waitForTimeout(1000);

    // Add many participants to see if any get stuck
    let participants = [];
    for(let i=1; i<=150; i++) {
        participants.push(`p${i}`);
    }
    await page.fill('textarea[placeholder*="참가자 이름"]', participants.join(', '));
    await page.click('button:has-text("추가")');
    await page.waitForTimeout(500);

    // Start Game
    console.log('Starting the game...');
    await page.click('button:has-text("GAME START")');

    // Wait for the game to start and take several screenshots over time
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(4000); // Wait 4 seconds between shots
      const shotPath = path.join(artifactsDir, `plinko_test_${i}.png`);
      await page.screenshot({ path: shotPath });
      console.log(`Captured playing stage ${i} at ${shotPath}`);
    }

    // Wait extra to see if it finishes or gets stuck
    await page.waitForTimeout(10000);
    const finalShotPath = path.join(artifactsDir, 'plinko_test_final.png');
    await page.screenshot({ path: finalShotPath });
    console.log(`Captured final stage at ${finalShotPath}`);
    
  } catch (error) {
    console.error('Error during gameplay testing:', error);
  } finally {
    await browser.close();
    console.log('Gameplay test completed.');
  }
})();
