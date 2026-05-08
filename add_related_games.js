'use strict';
const fs = require('fs');

const gameData = {
  'gamerdle':        { name: 'Gamerdle', desc: 'Guess the mystery game in 6 tries', img: 'game-gamerdle.jpg', tags: ['Daily','Word'] },
  'pixle':           { name: 'Pixle', desc: 'Identify the game from a blurring screenshot', img: 'game-pixle.jpg', tags: ['Daily','Image'] },
  'word-scramble':   { name: 'Word Scramble', desc: 'Unscramble the daily gaming word', img: 'game-wordscramble.jpg', tags: ['Daily','Word'] },
  'rift':            { name: 'RIFT', desc: 'Three daily word zones — chain, grow, decode', img: 'rift-hero.jpg', tags: ['Daily','Word'] },
  'gaming-trivia':   { name: 'Gaming Trivia', desc: '10 quiz questions, race the clock for bonus pts', img: 'game-trivia.jpg', tags: ['Daily','Trivia'] },
  'daily-challenge': { name: 'Daily Challenge', desc: 'Mixed daily challenge — earn your grade', img: 'game-dailychallenge.jpg', tags: ['Daily','Mixed'] },
  'type-racer':      { name: 'Type Racer', desc: 'Test your WPM with gaming quotes', img: 'game-typeracer.jpg', tags: ['Typing','Speed'] },
  'asteroid-dodge':  { name: 'Asteroid Dodge', desc: 'Pilot through a growing asteroid field', img: 'game-asteroid-dodge.jpg', tags: ['Arcade'] },
  'beat-lab':        { name: 'Beat Lab', desc: '4-lane rhythm game, chain combos for S rank', img: 'game-beatlab.jpg', tags: ['Music','Rhythm'] },
  'void-keeper':     { name: 'Void Keeper', desc: 'Catch particles of light, avoid the noise', img: 'game-voidkeeper.jpg', tags: ['Arcade','Ambient'] },
  'aim-trainer':     { name: 'Aim Trainer', desc: 'Click targets before they disappear', img: 'game-aim-trainer.jpg', tags: ['Action','FPS'] },
  'reaction-trainer':{ name: 'Reaction Test', desc: 'Test your reaction time and chase your record', img: 'game-reaction-trainer.jpg', tags: ['Action'] },
  'sudoku':          { name: 'Sudoku', desc: 'Daily 9×9 grid, easy to expert difficulty', img: 'game-sudoku.jpg', tags: ['Daily','Puzzle'] },
  'minesweeper':     { name: 'Minesweeper', desc: 'Flag mines, clear the field as fast as you can', img: 'game-minesweeper.jpg', tags: ['Puzzle'] },
  'crossword':       { name: 'Crossword', desc: 'Daily 5×5 gaming crossword', img: 'game-crossword.jpg', tags: ['Daily','Word'] },
  'memory-match':    { name: 'Memory Match', desc: 'Flip cards to find matching pairs', img: 'game-memory-match.jpg', tags: ['Puzzle'] },
  'color-memory':    { name: 'Color Memory', desc: 'Simon Says with gaming colors', img: 'game-color-memory.jpg', tags: ['Puzzle'] },
  'price-guesser':   { name: 'Price Guesser', desc: 'Guess Amazon prices of gaming gear', img: 'game-priceguesser.jpg', tags: ['Daily','Trivia'] },
};

const related = {
  'gamerdle':        ['pixle','rift','gaming-trivia'],
  'pixle':           ['gamerdle','word-scramble','rift'],
  'word-scramble':   ['gamerdle','pixle','gaming-trivia'],
  'rift':            ['gamerdle','crossword','word-scramble'],
  'gaming-trivia':   ['gamerdle','pixle','daily-challenge'],
  'daily-challenge': ['gaming-trivia','sudoku','gamerdle'],
  'type-racer':      ['reaction-trainer','aim-trainer','asteroid-dodge'],
  'reaction-trainer':['aim-trainer','type-racer','asteroid-dodge'],
  'aim-trainer':     ['reaction-trainer','type-racer','void-keeper'],
  'sudoku':          ['minesweeper','crossword','memory-match'],
  'minesweeper':     ['sudoku','crossword','color-memory'],
  'crossword':       ['sudoku','gaming-trivia','rift'],
  'memory-match':    ['color-memory','sudoku','minesweeper'],
  'color-memory':    ['memory-match','minesweeper','sudoku'],
  'price-guesser':   ['gaming-trivia','daily-challenge','reaction-trainer'],
};

const css = `
<style>
.rg-section { padding: 2.5rem 0 3rem; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); margin-top: 2rem; }
.rg-heading { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-lo, #666); margin: 0 0 1.25rem; }
.rg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.rg-card { display: flex; gap: 0.75rem; background: var(--bg-card, #111); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 10px; padding: 0.75rem; text-decoration: none; color: inherit; transition: border-color 0.15s, transform 0.15s; }
.rg-card:hover { border-color: var(--accent, #22d3ee); transform: translateY(-2px); }
.rg-card img { width: 100px; height: 43px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.rg-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.rg-tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.rg-tag { font-size: 0.65rem; font-weight: 700; color: var(--accent, #22d3ee); background: rgba(34,211,238,0.1); border-radius: 4px; padding: 0.1rem 0.35rem; letter-spacing: 0.04em; }
.rg-name { font-size: 0.88rem; font-weight: 700; color: var(--text-hi, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rg-desc { font-size: 0.75rem; color: var(--text-lo, #888); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@media (max-width: 640px) {
  .rg-grid { grid-template-columns: 1fr; }
  .rg-card img { width: 80px; height: 35px; }
}
</style>`;

function buildSection(slugs) {
  const cards = slugs.map(slug => {
    const g = gameData[slug];
    const tagHtml = g.tags.map(t => `<span class="rg-tag">${t}</span>`).join('');
    return `      <a href="/games/${slug}" class="rg-card">
        <img src="/images/${g.img}" alt="${g.name}" loading="lazy" width="200" height="86">
        <div class="rg-info">
          <div class="rg-tags">${tagHtml}</div>
          <div class="rg-name">${g.name}</div>
          <div class="rg-desc">${g.desc}</div>
        </div>
      </a>`;
  }).join('\n');

  return `\n<section class="rg-section">\n  <div class="container">\n    <h3 class="rg-heading">More Games</h3>\n    <div class="rg-grid">\n${cards}\n    </div>\n  </div>\n</section>${css}`;
}

const targets = Object.keys(related);

targets.forEach(slug => {
  const path = `C:/CosmicGamesHub/games/${slug}.html`;
  if (!fs.existsSync(path)) { console.log(slug + ': not found'); return; }
  let src = fs.readFileSync(path, 'utf8');
  if (src.includes('rg-section')) { console.log(slug + ': already has it'); return; }
  src = src.replace('</body>', buildSection(related[slug]) + '\n</body>');
  fs.writeFileSync(path, src, 'utf8');
  console.log(slug + ': done');
});
