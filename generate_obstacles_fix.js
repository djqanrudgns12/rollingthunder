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
  },
  {
    name: 'obstacle_blower.png',
    width: 256, height: 256,
    svg: `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blowerBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#444444" />
            <stop offset="50%" stop-color="#2a2a2a" />
            <stop offset="100%" stop-color="#111111" />
          </linearGradient>
          <linearGradient id="nozzleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#666666" />
            <stop offset="100%" stop-color="#222222" />
          </linearGradient>
          <filter id="windGlow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <!-- Wind Flow (Upwards) -->
        <path d="M 80 120 L 70 30" fill="none" stroke="#00ffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="15 25" filter="url(#windGlow)" opacity="0.6" />
        <path d="M 128 130 L 128 10" fill="none" stroke="#00ffff" stroke-width="8" stroke-linecap="round" stroke-dasharray="30 20" filter="url(#windGlow)" opacity="0.9" />
        <path d="M 176 120 L 186 30" fill="none" stroke="#00ffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="15 25" filter="url(#windGlow)" opacity="0.6" />
        
        <!-- Main Body -->
        <rect x="64" y="140" width="128" height="96" rx="16" fill="url(#blowerBody)" stroke="#00ffff" stroke-width="2" />
        
        <!-- Nozzle -->
        <polygon points="64,140 192,140 170,110 86,110" fill="url(#nozzleGrad)" />
        <rect x="76" y="100" width="104" height="10" rx="4" fill="#111111" stroke="#00ffff" stroke-width="1" filter="url(#windGlow)" />
        
        <!-- Internal Fan (Static representation) -->
        <circle cx="128" cy="188" r="32" fill="#0a0a0a" stroke="#333333" stroke-width="4" />
        <path d="M 128 188 L 128 160 M 128 188 L 152 202 M 128 188 L 104 202" stroke="#555555" stroke-width="6" stroke-linecap="round" />
        <circle cx="128" cy="188" r="10" fill="#888888" />
        
        <!-- Mounting Base -->
        <rect x="48" y="220" width="160" height="16" rx="4" fill="#222222" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_neon.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="neonPink"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
          <filter id="neonBlue"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
          <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#222" stroke-width="1" />
          </pattern>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#111" />
        <rect x="0" y="8" width="256" height="48" fill="url(#grid)" />
        <rect x="0" y="4" width="256" height="4" fill="#ff00ff" filter="url(#neonPink)" />
        <rect x="0" y="56" width="256" height="4" fill="#00ffff" filter="url(#neonBlue)" />
        <path d="M 32 16 L 224 48 M 32 48 L 224 16" fill="none" stroke="#ff00ff" stroke-width="2" opacity="0.3" filter="url(#neonPink)" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_circuit.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="8" width="256" height="48" fill="#0f380f" />
        <path d="M 0 16 L 32 16 L 48 32 L 256 32" fill="none" stroke="#b87333" stroke-width="2" />
        <path d="M 0 48 L 64 48 L 80 16 L 256 16" fill="none" stroke="#b87333" stroke-width="2" />
        <circle cx="32" cy="16" r="4" fill="#00ff00" />
        <circle cx="48" cy="32" r="4" fill="#00ff00" />
        <circle cx="64" cy="48" r="4" fill="#00ff00" />
        <circle cx="80" cy="16" r="4" fill="#00ff00" />
        <rect x="0" y="8" width="256" height="2" fill="#00ff00" opacity="0.5" />
        <rect x="0" y="54" width="256" height="2" fill="#00ff00" opacity="0.5" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_matrix.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="matrixGlow"><feGaussianBlur stdDeviation="2" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#000" />
        <text x="16" y="24" fill="#00ff00" font-family="monospace" font-size="12" filter="url(#matrixGlow)">1 0 1 1 0 1</text>
        <text x="80" y="48" fill="#00ff00" font-family="monospace" font-size="12" filter="url(#matrixGlow)">0 1 0 0 1 0</text>
        <text x="160" y="32" fill="#00ff00" font-family="monospace" font-size="12" filter="url(#matrixGlow)">1 1 0 1 0 0</text>
        <rect x="0" y="6" width="256" height="2" fill="#00ff00" filter="url(#matrixGlow)" />
        <rect x="0" y="56" width="256" height="2" fill="#00ff00" filter="url(#matrixGlow)" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_lava.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="lavaGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#1a0a00" />
        <path d="M 0 24 Q 32 40 64 24 T 128 32 T 192 16 T 256 32" fill="none" stroke="#ff3300" stroke-width="4" filter="url(#lavaGlow)" />
        <path d="M 0 40 Q 32 24 64 40 T 128 48 T 192 32 T 256 48" fill="none" stroke="#ff6600" stroke-width="2" filter="url(#lavaGlow)" />
        <rect x="0" y="8" width="256" height="4" fill="#331100" />
        <rect x="0" y="52" width="256" height="4" fill="#331100" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_ice.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="iceBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ccffff" />
            <stop offset="50%" stop-color="#88ccff" />
            <stop offset="100%" stop-color="#4488ff" />
          </linearGradient>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="url(#iceBg)" opacity="0.8" />
        <path d="M 16 8 L 32 32 L 48 8 Z" fill="#ffffff" opacity="0.4" />
        <path d="M 80 56 L 96 32 L 112 56 Z" fill="#ffffff" opacity="0.4" />
        <path d="M 160 8 L 180 40 L 200 8 Z" fill="#ffffff" opacity="0.3" />
        <rect x="0" y="6" width="256" height="4" fill="#ffffff" opacity="0.9" />
        <rect x="0" y="54" width="256" height="4" fill="#ffffff" opacity="0.9" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_toxic.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="warningStripes2" patternUnits="userSpaceOnUse" width="32" height="64">
            <path d="M -16 64 L 16 -16 L 48 -16 L 16 64 Z" fill="#ffff00" />
            <path d="M 16 64 L 48 -16 L 80 -16 L 48 64 Z" fill="#000000" />
          </pattern>
          <filter id="toxicGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="url(#warningStripes2)" />
        <rect x="0" y="32" width="256" height="24" fill="#33ff00" opacity="0.4" filter="url(#toxicGlow)" />
        <circle cx="128" cy="32" r="12" fill="#000" />
        <circle cx="128" cy="32" r="8" fill="#33ff00" filter="url(#toxicGlow)" />
        <rect x="0" y="8" width="256" height="4" fill="#222" />
        <rect x="0" y="52" width="256" height="4" fill="#33ff00" opacity="0.8" filter="url(#toxicGlow)" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_crystal.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="crystalGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#1a0033" />
        <path d="M 32 56 L 40 24 L 48 56 Z" fill="#ff00ff" opacity="0.8" filter="url(#crystalGlow)" />
        <path d="M 40 56 L 48 16 L 56 56 Z" fill="#9900ff" opacity="0.8" filter="url(#crystalGlow)" />
        <path d="M 160 8 L 168 40 L 176 8 Z" fill="#ff00ff" opacity="0.8" filter="url(#crystalGlow)" />
        <path d="M 168 8 L 176 48 L 184 8 Z" fill="#9900ff" opacity="0.8" filter="url(#crystalGlow)" />
        <rect x="0" y="8" width="256" height="2" fill="#ff00ff" opacity="0.5" />
        <rect x="0" y="54" width="256" height="2" fill="#ff00ff" opacity="0.5" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_grass.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="8" width="256" height="48" fill="#3a2a1a" />
        <rect x="0" y="8" width="256" height="12" fill="#44aa22" />
        <path d="M 0 20 Q 8 28 16 20 T 32 20 T 48 20 T 64 20 T 80 20 T 96 20 T 112 20 T 128 20 T 144 20 T 160 20 T 176 20 T 192 20 T 208 20 T 224 20 T 240 20 T 256 20 L 256 8 L 0 8 Z" fill="#44aa22" />
        <path d="M 16 16 L 20 8 M 48 16 L 52 8 M 128 16 L 124 8 M 200 16 L 204 8" stroke="#66cc44" stroke-width="2" stroke-linecap="round" />
        <circle cx="32" cy="40" r="4" fill="#2a1a0a" />
        <circle cx="160" cy="48" r="6" fill="#2a1a0a" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_gold.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffee66" />
            <stop offset="50%" stop-color="#ccaaoo" />
            <stop offset="100%" stop-color="#886600" />
          </linearGradient>
          <filter id="goldGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#332211" />
        <rect x="0" y="8" width="256" height="6" fill="url(#goldGrad)" filter="url(#goldGlow)" />
        <rect x="0" y="50" width="256" height="6" fill="url(#goldGrad)" filter="url(#goldGlow)" />
        <path d="M 32 24 L 48 24 L 48 40 L 32 40 Z M 96 24 L 112 24 L 112 40 L 96 40 Z M 160 24 L 176 24 L 176 40 L 160 40 Z M 224 24 L 240 24 L 240 40 L 224 40 Z" fill="none" stroke="url(#goldGrad)" stroke-width="2" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_steampunk.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="8" width="256" height="48" fill="#8b5a2b" />
        <rect x="0" y="8" width="256" height="4" fill="#a0522d" />
        <rect x="0" y="52" width="256" height="4" fill="#5c3317" />
        <circle cx="32" cy="32" r="16" fill="none" stroke="#cd853f" stroke-width="4" stroke-dasharray="4 4" />
        <circle cx="32" cy="32" r="6" fill="#cd853f" />
        <circle cx="224" cy="32" r="16" fill="none" stroke="#cd853f" stroke-width="4" stroke-dasharray="4 4" />
        <circle cx="224" cy="32" r="6" fill="#cd853f" />
        <circle cx="16" cy="16" r="2" fill="#000" />
        <circle cx="128" cy="16" r="2" fill="#000" />
        <circle cx="240" cy="16" r="2" fill="#000" />
        <circle cx="16" cy="48" r="2" fill="#000" />
        <circle cx="128" cy="48" r="2" fill="#000" />
        <circle cx="240" cy="48" r="2" fill="#000" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_gothic.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="mist"><feGaussianBlur stdDeviation="6" result="blur" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#1a1a24" />
        <rect x="0" y="8" width="256" height="4" fill="#0d0d12" />
        <rect x="0" y="52" width="256" height="4" fill="#0d0d12" />
        <path d="M 32 12 L 32 52 M 64 12 L 64 52 M 96 12 L 96 52 M 128 12 L 128 52 M 160 12 L 160 52 M 192 12 L 192 52 M 224 12 L 224 52" stroke="#333" stroke-width="4" />
        <path d="M 32 12 L 30 8 M 64 12 L 66 8" stroke="#333" stroke-width="2" />
        <ellipse cx="128" cy="48" rx="60" ry="10" fill="#ff0000" opacity="0.3" filter="url(#mist)" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_space.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="starGlow"><feGaussianBlur stdDeviation="1" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#05051a" />
        <circle cx="32" cy="24" r="1.5" fill="#fff" filter="url(#starGlow)" />
        <circle cx="128" cy="40" r="2" fill="#aaccff" filter="url(#starGlow)" />
        <circle cx="200" cy="16" r="1.5" fill="#ffccaa" filter="url(#starGlow)" />
        <ellipse cx="128" cy="32" rx="100" ry="20" fill="#9900ff" opacity="0.2" filter="url(#starGlow)" />
        <rect x="0" y="8" width="256" height="2" fill="#5500aa" opacity="0.8" />
        <rect x="0" y="54" width="256" height="2" fill="#5500aa" opacity="0.8" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_candy.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="candyStripe" patternUnits="userSpaceOnUse" width="32" height="64">
            <path d="M -16 64 L 16 -16 L 32 -16 L 0 64 Z" fill="#ff66b2" />
            <path d="M 0 64 L 32 -16 L 48 -16 L 16 64 Z" fill="#ffffff" />
            <path d="M 16 64 L 48 -16 L 64 -16 L 32 64 Z" fill="#ff66b2" />
          </pattern>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="url(#candyStripe)" rx="8" />
        <rect x="0" y="8" width="256" height="6" fill="#ffffff" opacity="0.5" rx="2" />
        <rect x="0" y="50" width="256" height="6" fill="#000000" opacity="0.2" rx="2" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_arcade.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="bricks" patternUnits="userSpaceOnUse" width="32" height="16">
            <rect x="0" y="0" width="32" height="16" fill="#cc3333" />
            <rect x="0" y="0" width="32" height="2" fill="#ff6666" />
            <rect x="30" y="0" width="2" height="16" fill="#990000" />
            <rect x="0" y="14" width="32" height="2" fill="#990000" />
          </pattern>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="url(#bricks)" />
        <rect x="0" y="8" width="256" height="4" fill="#ff0000" opacity="0.5" />
      </svg>
    `
  },
  {
    name: 'obstacle_wall_plasma.png', width: 256, height: 64,
    svg: `
      <svg width="256" height="64" viewBox="0 0 256 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="plasmaGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <rect x="0" y="8" width="256" height="48" fill="#001133" rx="4" />
        <path d="M 0 32 L 32 16 L 64 48 L 96 24 L 128 40 L 160 16 L 192 48 L 224 24 L 256 32" fill="none" stroke="#00ffff" stroke-width="3" filter="url(#plasmaGlow)" />
        <path d="M 0 32 L 32 16 L 64 48 L 96 24 L 128 40 L 160 16 L 192 48 L 224 24 L 256 32" fill="none" stroke="#ffffff" stroke-width="1" />
        <rect x="0" y="8" width="256" height="4" fill="#00ffff" opacity="0.6" filter="url(#plasmaGlow)" />
        <rect x="0" y="52" width="256" height="4" fill="#00ffff" opacity="0.6" filter="url(#plasmaGlow)" />
        <rect x="0" y="8" width="256" height="48" fill="none" stroke="#666" stroke-width="4" rx="4" />
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
