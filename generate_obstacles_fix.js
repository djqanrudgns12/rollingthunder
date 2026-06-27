const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, 'public', 'images', 'assets', 'obstacles');

const assets = [
  {
    name: 'obstacle_pin.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pinCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ccffff" />
            <stop offset="50%" stop-color="#00ffcc" />
            <stop offset="100%" stop-color="#006655" />
          </radialGradient>
          <filter id="glowPin" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <circle cx="128" cy="128" r="90" fill="url(#pinCore)" filter="url(#glowPin)" />
        <circle cx="128" cy="128" r="90" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.8" />
        <circle cx="100" cy="100" r="15" fill="#ffffff" opacity="0.6" />
      </svg>
    `
  },
  {
    name: 'obstacle_bumper.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bumperInner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffcc88" />
            <stop offset="80%" stop-color="#ff6600" />
            <stop offset="100%" stop-color="#882200" />
          </radialGradient>
          <filter id="glowBumper" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="15" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <circle cx="128" cy="128" r="110" fill="none" stroke="#ffaa55" stroke-width="10" opacity="0.4" filter="url(#glowBumper)" />
        <circle cx="128" cy="128" r="95" fill="url(#bumperInner)" />
        <circle cx="128" cy="128" r="60" fill="none" stroke="#ffdd99" stroke-width="6" opacity="0.8" />
        <circle cx="100" cy="100" r="25" fill="#ffffff" opacity="0.5" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall.png',
    width: 256, height: 64, // Tileable horizontally
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wallBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#2a303c" />
            <stop offset="50%" stop-color="#1b1e25" />
            <stop offset="100%" stop-color="#0f1115" />
          </linearGradient>
          <filter id="cyanGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="url(#wallBg)" />
        <rect x="0" y="4" width="256" height="4" fill="#00ffff" filter="url(#cyanGlow)" />
        <rect x="0" y="56" width="256" height="4" fill="#00ffff" filter="url(#cyanGlow)" />
        <path d="M 32 16 L 48 16 L 64 32 L 64 48 L 48 48 L 32 32 Z" fill="#3a4252" opacity="0.5" />
        <path d="M 160 16 L 176 16 L 192 32 L 192 48 L 176 48 L 160 32 Z" fill="#3a4252" opacity="0.5" />
      </svg>
    `
  },
  {
    name: 'obstacle_booster.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="padGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#113311" />
            <stop offset="100%" stop-color="#051a05" />
          </linearGradient>
          <filter id="greenGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect x="32" y="32" width="192" height="192" rx="30" fill="url(#padGrad)" stroke="#228822" stroke-width="4" />
        <path d="M 64 160 L 128 96 L 192 160" fill="none" stroke="#55ff55" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" filter="url(#greenGlow)" />
        <path d="M 80 192 L 128 144 L 176 192" fill="none" stroke="#22aa22" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 96 224 L 128 192 L 160 224" fill="none" stroke="#116611" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `
  },
  {
    name: 'obstacle_windmill.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#aaaaaa" />
            <stop offset="100%" stop-color="#444444" />
          </linearGradient>
          <filter id="bladeGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g transform="translate(128, 128)">
          <path d="M -10 -120 L 10 -120 L 20 -20 L -20 -20 Z" fill="url(#bladeGrad)" />
          <path d="M -10 120 L 10 120 L 20 20 L -20 20 Z" fill="url(#bladeGrad)" />
          <path d="M -120 -10 L -120 10 L -20 20 L -20 -20 Z" fill="url(#bladeGrad)" />
          <path d="M 120 -10 L 120 10 L 20 20 L 20 -20 Z" fill="url(#bladeGrad)" />
          <rect x="-4" y="-110" width="8" height="90" fill="#00ffff" filter="url(#bladeGlow)" />
          <rect x="-4" y="20" width="8" height="90" fill="#00ffff" filter="url(#bladeGlow)" />
          <rect x="-110" y="-4" width="90" height="8" fill="#00ffff" filter="url(#bladeGlow)" />
          <rect x="20" y="-4" width="90" height="8" fill="#00ffff" filter="url(#bladeGlow)" />
          <circle cx="0" cy="0" r="25" fill="#222222" stroke="#00ffff" stroke-width="4" filter="url(#bladeGlow)" />
          <circle cx="0" cy="0" r="10" fill="#00ffff" />
        </g>
      </svg>
    `
  },
  {
    name: 'windmill_rotor.png', // Same as windmill
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bladeGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#aaaaaa" />
            <stop offset="100%" stop-color="#444444" />
          </linearGradient>
          <filter id="bladeGlow2">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g transform="translate(128, 128)">
          <path d="M -10 -120 L 10 -120 L 20 -20 L -20 -20 Z" fill="url(#bladeGrad2)" />
          <path d="M -10 120 L 10 120 L 20 20 L -20 20 Z" fill="url(#bladeGrad2)" />
          <path d="M -120 -10 L -120 10 L -20 20 L -20 -20 Z" fill="url(#bladeGrad2)" />
          <path d="M 120 -10 L 120 10 L 20 20 L 20 -20 Z" fill="url(#bladeGrad2)" />
          <rect x="-4" y="-110" width="8" height="90" fill="#00ffff" filter="url(#bladeGlow2)" />
          <rect x="-4" y="20" width="8" height="90" fill="#00ffff" filter="url(#bladeGlow2)" />
          <rect x="-110" y="-4" width="90" height="8" fill="#00ffff" filter="url(#bladeGlow2)" />
          <rect x="20" y="-4" width="90" height="8" fill="#00ffff" filter="url(#bladeGlow2)" />
          <circle cx="0" cy="0" r="25" fill="#222222" stroke="#00ffff" stroke-width="4" filter="url(#bladeGlow2)" />
          <circle cx="0" cy="0" r="10" fill="#00ffff" />
        </g>
      </svg>
    `
  },
  {
    name: 'obstacle_portal.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="portalGlow">
            <feGaussianBlur stdDeviation="15" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="portalCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="30%" stop-color="#eebbff" />
            <stop offset="70%" stop-color="#9933ff" />
            <stop offset="100%" stop-color="#330088" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="128" cy="128" r="110" fill="url(#portalCore)" filter="url(#portalGlow)" />
        <circle cx="128" cy="128" r="100" fill="none" stroke="#cc66ff" stroke-width="6" stroke-dasharray="20 10" opacity="0.8" />
        <circle cx="128" cy="128" r="75" fill="none" stroke="#ee99ff" stroke-width="4" opacity="0.6" />
        <circle cx="128" cy="128" r="40" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.9" />
      </svg>
    `
  },
  {
    name: 'obstacle_blackhole.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="bhGlow">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="bhAura" cx="50%" cy="50%" r="50%">
            <stop offset="40%" stop-color="#000000" />
            <stop offset="70%" stop-color="#4b0082" />
            <stop offset="100%" stop-color="#8a2be2" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="128" cy="128" r="120" fill="url(#bhAura)" filter="url(#bhGlow)" />
        <path d="M 128 128 C 160 50, 240 100, 128 128" fill="none" stroke="#9932cc" stroke-width="6" opacity="0.6" />
        <path d="M 128 128 C 50 160, 100 240, 128 128" fill="none" stroke="#9932cc" stroke-width="6" opacity="0.6" />
        <path d="M 128 128 C 200 200, 240 160, 128 128" fill="none" stroke="#ba55d3" stroke-width="4" opacity="0.8" />
        <path d="M 128 128 C 50 50, 100 50, 128 128" fill="none" stroke="#ba55d3" stroke-width="4" opacity="0.8" />
        <circle cx="128" cy="128" r="45" fill="#080011" />
      </svg>
    `
  },
  {
    name: 'obstacle_whitehole.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="whGlow">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="whAura" cx="50%" cy="50%" r="50%">
            <stop offset="20%" stop-color="#ffffff" />
            <stop offset="60%" stop-color="#ff99ff" />
            <stop offset="100%" stop-color="#ff33cc" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="128" cy="128" r="120" fill="url(#whAura)" filter="url(#whGlow)" />
        <path d="M 128 128 C 180 60, 250 120, 128 128" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.8" />
        <path d="M 128 128 C 60 180, 120 250, 128 128" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.8" />
        <path d="M 128 128 C 200 200, 240 160, 128 128" fill="none" stroke="#ffccff" stroke-width="5" opacity="0.9" />
        <path d="M 128 128 C 50 50, 100 50, 128 128" fill="none" stroke="#ffccff" stroke-width="5" opacity="0.9" />
        <circle cx="128" cy="128" r="30" fill="#ffffff" filter="url(#whGlow)" />
      </svg>
    `
  },
  {
    name: 'obstacle_hole.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="holeDepth" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#000000" />
            <stop offset="80%" stop-color="#110000" />
            <stop offset="100%" stop-color="#ff0000" />
          </radialGradient>
          <filter id="holeGlow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <circle cx="128" cy="128" r="110" fill="url(#holeDepth)" stroke="#ff0000" stroke-width="12" filter="url(#holeGlow)" />
        <circle cx="128" cy="128" r="110" fill="none" stroke="#ff4444" stroke-width="4" stroke-dasharray="15 15" />
        <circle cx="128" cy="128" r="80" fill="none" stroke="#aa0000" stroke-width="2" />
        <circle cx="128" cy="128" r="40" fill="#000000" />
      </svg>
    `
  },
  {
    name: 'obstacle_piston.png',
    width: 256, height: 64, // Tileable horizontally
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pistonBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4a4a4a" />
            <stop offset="50%" stop-color="#2a2a2a" />
            <stop offset="100%" stop-color="#1a1a1a" />
          </linearGradient>
          <pattern id="warningStripes" patternUnits="userSpaceOnUse" width="32" height="64">
            <path d="M -16 64 L 16 -16 L 48 -16 L 16 64 Z" fill="#ffcc00" />
            <path d="M 16 64 L 48 -16 L 80 -16 L 48 64 Z" fill="#000000" />
          </pattern>
        </defs>
        <!-- Main body -->
        <rect x="0" y="8" width="256" height="48" fill="url(#pistonBg)" rx="4" ry="4" />
        
        <!-- Warning stripes (middle area) -->
        <rect x="0" y="16" width="256" height="32" fill="url(#warningStripes)" />
        
        <!-- Top and bottom metallic edge highlights -->
        <rect x="0" y="8" width="256" height="4" fill="#888888" />
        <rect x="0" y="52" width="256" height="4" fill="#000000" />
        
        <!-- Rivets -->
        <circle cx="16" cy="12" r="2" fill="#aaaaaa" />
        <circle cx="240" cy="12" r="2" fill="#aaaaaa" />
        <circle cx="16" cy="52" r="2" fill="#555555" />
        <circle cx="240" cy="52" r="2" fill="#555555" />
      </svg>
    `
  }
];

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const asset of assets) {
    console.log("Rendering " + asset.name + "...");
    await page.setViewportSize({ width: asset.width, height: asset.height });
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
            svg { display: block; }
          </style>
        </head>
        <body>
          ${asset.svg}
        </body>
      </html>
    `);
    
    // Ensure element is fully rendered before taking screenshot
    await page.waitForLoadState('networkidle');

    const outPath = path.join(OUT_DIR, asset.name);
    await page.screenshot({ 
      path: outPath, 
      omitBackground: true, // Key for true transparency
      clip: { x: 0, y: 0, width: asset.width, height: asset.height }
    });
    console.log("Saved to " + outPath);
  }

  await browser.close();
  console.log('All obstacles rendered successfully!');
}

if (!fs.existsSync(OUT_DIR)){
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

main().catch(console.error);
