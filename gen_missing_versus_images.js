'use strict';
const { createCanvas } = require('C:/Cortex/node_modules/canvas');
const fs = require('fs');

function makeVersusImage(label1, label2, category, outPath) {
  const W = 1440, H = 810;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Dark background gradient
  const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
  bg.addColorStop(0, '#0d1a2d');
  bg.addColorStop(1, '#050508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Cyan glow in center
  const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 250);
  glow.addColorStop(0, 'rgba(0,212,255,0.10)');
  glow.addColorStop(1, 'rgba(0,212,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Category label
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#00d4ff';
  ctx.textAlign = 'center';
  ctx.fillText(category.toUpperCase(), W/2, 140);

  // Left product panel
  const panelY = 200, panelH = 340, panelW = 500;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(100, panelY, panelW, panelH, 12);
  ctx.fill();
  ctx.stroke();

  // Right product panel
  ctx.beginPath();
  ctx.roundRect(W-100-panelW, panelY, panelW, panelH, 12);
  ctx.fill();
  ctx.stroke();

  // VS badge
  const vsX = W/2, vsY = panelY + panelH/2;
  ctx.fillStyle = 'rgba(0,212,255,0.15)';
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(vsX, vsY, 44, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#00d4ff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', vsX, vsY);

  // Product names
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  // Wrap long names
  const wrap = (text, maxW) => {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW) { lines.push(line); line = w; }
      else line = test;
    }
    lines.push(line);
    return lines;
  };

  const leftLines = wrap(label1, panelW - 60);
  const rightLines = wrap(label2, panelW - 60);

  leftLines.forEach((l, i) => ctx.fillText(l, 100 + panelW/2, panelY + panelH/2 + (i - (leftLines.length-1)/2) * 38));
  rightLines.forEach((l, i) => ctx.fillText(l, W-100-panelW/2, panelY + panelH/2 + (i - (rightLines.length-1)/2) * 38));

  // Bottom URL
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('cosmicgameshub.com', W/2, H - 30);

  fs.writeFileSync(outPath, canvas.toBuffer('image/jpeg', { quality: 0.88 }));
  console.log('Created: ' + outPath);
}

makeVersusImage(
  'Secretlab Titan Evo 2022',
  'DXRacer Formula Series',
  '🪑 Gaming Chairs',
  'C:/CosmicGamesHub/images/versus-chair-titan-dxracer.jpg'
);

makeVersusImage(
  'HyperX Cloud II',
  'SteelSeries Arctis Nova 7 Wireless',
  '🎧 Headsets · Wired vs Wireless',
  'C:/CosmicGamesHub/images/versus-headset-cloud2-nova7.jpg'
);

makeVersusImage(
  'Logitech G305',
  'Razer DeathAdder V3 HyperSpeed',
  '🖱️ Mice · Budget Wireless',
  'C:/CosmicGamesHub/images/versus-mouse-g305-dav3hs.jpg'
);
