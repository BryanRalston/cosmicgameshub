'use strict';
const fs = require('fs');
const BASE = 'https://cosmicgameshub.com';

const gameImages = {
  'aim-trainer': 'game-aim-trainer.jpg',
  'asteroid-dodge': 'game-asteroid-dodge.jpg',
  'beat-lab': 'game-beatlab.jpg',
  'brix3d': 'game-brix3d.jpg',
  'color-memory': 'game-color-memory.jpg',
  'crossword': 'game-crossword.jpg',
  'daily-challenge': 'game-dailychallenge.jpg',
  'dream-machine': 'game-brix3d.jpg',
  'gamerdle': 'game-gamerdle.jpg',
  'gaming-trivia': 'game-trivia.jpg',
  'memory-match': 'game-memory-match.jpg',
  'minesweeper': 'game-minesweeper.jpg',
  'pixle': 'game-pixle.jpg',
  'price-guesser': 'game-priceguesser.jpg',
  'reaction-trainer': 'game-reaction-trainer.jpg',
  'rift': 'rift-hero.jpg',
  'sudoku': 'game-sudoku.jpg',
  'type-racer': 'game-typeracer.jpg',
  'void-keeper': 'game-voidkeeper.jpg',
  'word-scramble': 'game-wordscramble.jpg',
};

const files = fs.readdirSync('C:/CosmicGamesHub/games/').filter(f => f.endsWith('.html') && f !== 'index.html');

files.forEach(f => {
  const slug = f.replace('.html', '');
  const path = `C:/CosmicGamesHub/games/${f}`;
  let src = fs.readFileSync(path, 'utf8');

  if (src.includes('twitter:card')) { console.log(slug + ': already has twitter meta'); return; }

  const titleMatch = src.match(/<title>(.*?)<\/title>/);
  const descMatch = src.match(/<meta name="description" content="([^"]+)"/);
  const imgFile = gameImages[slug] || 'game-brix3d.jpg';

  const title = titleMatch ? titleMatch[1] : slug;
  const desc = descMatch ? descMatch[1].substring(0, 200) : `Play ${slug} free on CosmicGamesHub`;
  const imgUrl = `${BASE}/images/${imgFile}`;
  const pageUrl = `${BASE}/games/${slug}`;

  const twitterMeta = `  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@CosmicGamesHub">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${imgUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="CosmicGamesHub">
  <meta property="og:url" content="${pageUrl}">
`;

  // Insert before </head>
  src = src.replace('</head>', twitterMeta + '</head>');
  fs.writeFileSync(path, src, 'utf8');
  console.log(slug + ': twitter + og meta added');
});
