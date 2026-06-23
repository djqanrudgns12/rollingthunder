const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting gameplay browser test...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const artifactsDir = 'C:\\Users\\rudgn\\.gemini\\antigravity\\brain\\5000998c-a9ab-42a0-b292-106c2a824f7c\\images';
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  try {
    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for PIXI assets to load if any

    // Fill participants
    await page.fill('input[placeholder="참가자 이름 (쉼표/공백 다중입력)"]', 'A, B, C, D, E, F, G, H, I, J');
    await page.click('button:has-text("추가")');
    await page.waitForTimeout(500);

    // Save dashboard state
    await page.screenshot({ path: path.join(artifactsDir, '5_dashboard_ready.png') });

    // Start Game
    console.log('Starting the game...');
    await page.click('button:has-text("GAME START")');

    // Wait for the game to start and take several screenshots over time
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(3000); // Every 3 seconds
      await page.screenshot({ path: path.join(artifactsDir, `6_playing_stage_${i}.png`) });
      console.log(`Captured playing stage ${i}`);
    }

    // Wait a bit more to see if result screen appears or simulation continues
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(artifactsDir, '7_game_later_stage.png') });
    
  } catch (error) {
    console.error('Error during gameplay testing:', error);
  } finally {
    await browser.close();
    console.log('Gameplay test completed.');
  }
})();
