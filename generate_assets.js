const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public', 'images', 'assets', 'skins');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const assets = {
  'chip_base_1': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#ffffff" /><circle cx="32" cy="32" r="26" fill="none" stroke="#000000" stroke-width="2" stroke-dasharray="4,4"/><circle cx="32" cy="32" r="15" fill="none" stroke="#000000" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="#000000" /></svg>',
  'chip_base_2': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#ffffff" /><circle cx="32" cy="32" r="22" fill="none" stroke="#000000" stroke-width="6" /><path d="M32 4 L32 14 M32 60 L32 50 M4 32 L14 32 M60 32 L50 32" stroke="#000000" stroke-width="4"/></svg>',
  'chip_base_3': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#ffffff" /><polygon points="32,8 38,26 56,26 42,36 48,54 32,44 16,54 22,36 8,26 26,26" fill="#000000" /></svg>',
  'chip_base_4': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#ffffff" /><circle cx="32" cy="32" r="24" fill="none" stroke="#000000" stroke-width="2" /><path d="M16 16 L48 48 M16 48 L48 16" stroke="#000000" stroke-width="6"/></svg>',
  'chip_base_5': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#ffffff" /><circle cx="32" cy="32" r="10" fill="#000000" /><path d="M32 4 A28 28 0 0 1 60 32 L32 32 Z" fill="#bbbbbb" /><path d="M32 60 A28 28 0 0 1 4 32 L32 32 Z" fill="#bbbbbb" /><circle cx="32" cy="32" r="30" fill="none" stroke="#000000" stroke-width="2"/></svg>',
  'chip_base_6': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#ffffff" /><rect x="20" y="20" width="24" height="24" fill="none" stroke="#000000" stroke-width="4" transform="rotate(45 32 32)"/><circle cx="32" cy="32" r="6" fill="#000000" /></svg>',
  'horse': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M14 46 L20 20 L30 10 L44 14 L46 26 L36 30 L40 46 L30 46 L26 36 L20 46 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round"/><circle cx="38" cy="18" r="2" fill="#000000"/></svg>',
  'spaceship': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 8 L44 40 L32 34 L20 40 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round"/><path d="M26 40 L20 54 L32 46 L44 54 L38 40" fill="#bbbbbb" stroke="#000000" stroke-width="2"/><circle cx="32" cy="28" r="4" fill="#000000"/></svg>',
  'shuriken': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 4 L38 26 L60 32 L38 38 L32 60 L26 38 L4 32 L26 26 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="32" r="6" fill="none" stroke="#000000" stroke-width="2"/></svg>',
  'car': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="24" width="36" height="16" rx="4" fill="#ffffff" stroke="#000000" stroke-width="2"/><rect x="22" y="16" width="20" height="8" rx="2" fill="#bbbbbb" stroke="#000000" stroke-width="2"/><circle cx="20" cy="40" r="6" fill="#000000"/><circle cx="44" cy="40" r="6" fill="#000000"/></svg>',
  'cat': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M16 20 L24 32 L40 32 L48 20 L44 48 L20 48 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round"/><circle cx="26" cy="36" r="3" fill="#000000"/><circle cx="38" cy="36" r="3" fill="#000000"/><path d="M32 40 L30 42 L34 42 Z" fill="#000000"/></svg>',
  'blackhole': '<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" fill="#ffffff" stroke="#000000" stroke-width="2"/><path d="M32 10 Q40 32 32 54 Q24 32 32 10" fill="none" stroke="#000000" stroke-width="2"/><path d="M10 32 Q32 40 54 32 Q32 24 10 32" fill="none" stroke="#000000" stroke-width="2"/><circle cx="32" cy="32" r="10" fill="#000000"/></svg>',
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  for (const [name, svgContent] of Object.entries(assets)) {
    const html = '<!DOCTYPE html><html><head><style>body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; }</style></head><body><div id="target" style="width:64px;height:64px;">' + svgContent + '</div></body></html>';
    
    await page.setContent(html);
    const element = await page.$('#target');
    const outPath = path.join(outDir, name + '.png');
    await element.screenshot({ path: outPath, omitBackground: true });
    console.log('Generated ' + outPath);
  }
  
  await browser.close();
})();
