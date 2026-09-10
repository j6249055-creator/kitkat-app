const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'public', 'img');

// Copy user uploaded pack if not copied
const userImg = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\917f3d8c-5418-4ee3-9751-d17ce300f61b\\.user_uploaded\\media_1788807725182.jpg';
if (fs.existsSync(userImg)) {
  fs.copyFileSync(userImg, path.join(imgDir, 'kitkat_pack.jpg'));
  fs.copyFileSync(userImg, path.join(imgDir, 'logo.png'));
  fs.copyFileSync(userImg, path.join(imgDir, 'banner.jpg'));
  fs.copyFileSync(userImg, path.join(imgDir, 'plan1.png'));
  fs.copyFileSync(userImg, path.join(imgDir, 'plan2.png'));
  fs.copyFileSync(userImg, path.join(imgDir, 'plan3.png'));
  fs.copyFileSync(userImg, path.join(imgDir, 'plan4.png'));
  fs.copyFileSync(userImg, path.join(imgDir, 'plan5.png'));
  console.log('Images copied successfully from user upload!');
}

// Also create sleek SVG badges for plan cards
const plans = [
  { id: 1, title: "KitKat 2-Finger", code: "PLAN 1", color: "#e01a22" },
  { id: 2, title: "KitKat Chunky", code: "PLAN 2", color: "#e01a22" },
  { id: 3, title: "KitKat Dessert", code: "PLAN 3", color: "#ff5722" },
  { id: 4, title: "KitKat Dark Gold", code: "PLAN 4", color: "#d32f2f" },
  { id: 5, title: "KitKat Mega Pack", code: "PLAN 5", color: "#b71c1c" }
];

plans.forEach(p => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
    <defs>
      <linearGradient id="grad${p.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2a0e0b"/>
        <stop offset="100%" stop-color="#120504"/>
      </linearGradient>
      <radialGradient id="glow${p.id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${p.color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${p.color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="160" height="100" rx="14" fill="url(#grad${p.id})" stroke="${p.color}" stroke-width="1.5"/>
    <circle cx="80" cy="50" r="45" fill="url(#glow${p.id})"/>
    
    <!-- KitKat Oval Plate -->
    <ellipse cx="80" cy="50" rx="60" ry="32" fill="#d3121b" stroke="#ffffff" stroke-width="2.5"/>
    
    <!-- Wafer Bars Behind -->
    <rect x="36" y="44" width="88" height="12" rx="2" fill="#fff" opacity="0.15"/>
    
    <text x="80" y="58" font-family="'Inter', sans-serif" font-weight="900" font-style="italic" font-size="24" fill="#ffffff" text-anchor="middle" letter-spacing="-1">KitKat</text>
    
    <rect x="50" y="74" width="60" height="16" rx="8" fill="#140605" stroke="${p.color}" stroke-width="1"/>
    <text x="80" y="86" font-family="'Inter', sans-serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">${p.code}</text>
  </svg>`;
  fs.writeFileSync(path.join(imgDir, `plan_badge_${p.id}.svg`), svg, 'utf8');
});
console.log('SVG badges created!');
