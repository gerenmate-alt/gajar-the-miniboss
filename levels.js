// Level Generator & Endless Randomized Level for Gajar The Miniboss
// Tile size = 40px. Ground is at y = 11*T = 440px.

function generatePlayableRandomLevel(seedNum = Math.floor(Math.random() * 1000000)) {
  let seed = seedNum;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const themes = [
    {
      theme: 'overworld',
      skyColorTop: '#3b82f6',
      skyColorBottom: '#93c5fd',
      groundTopColor: '#22c55e',
      groundFillColor: '#b45309',
      brickColor: '#c2410c'
    },
    {
      theme: 'underground',
      skyColorTop: '#090d16',
      skyColorBottom: '#1e293b',
      groundTopColor: '#06b6d4',
      groundFillColor: '#1e3a8a',
      brickColor: '#3b82f6'
    },
    {
      theme: 'castle',
      skyColorTop: '#18060c',
      skyColorBottom: '#450a0a',
      groundTopColor: '#94a3b8',
      groundFillColor: '#334155',
      brickColor: '#475569',
      hasLava: true
    }
  ];

  const themeChoice = themes[Math.floor(rnd() * themes.length)];
  const widthTiles = 150 + Math.floor(rnd() * 30);
  const flagX = widthTiles - 15;
  const castleX = widthTiles - 11;

  const groundGaps = [];
  const blocks = [];
  const pipes = [];
  const platforms = [];
  const coins = [];
  const enemies = [];

  // GUARANTEED PLAYABLE GAPS:
  // Gap width is strictly 2 tiles max (80px), easily jumpable by Gajar's jump (jump reach > 160px).
  // If gap is 3 tiles, a stepping stone or moving platform is ALWAYS placed in the middle.
  let curX = 20;
  while (curX < flagX - 25) {
    curX += 16 + Math.floor(rnd() * 12);
    if (curX >= flagX - 22) break;
    
    const gapLen = 2; // Always strictly 2 tiles (80px wide)
    groundGaps.push([curX, curX + gapLen]);

    // Sometimes add floating coins over the gap to guide the jump
    coins.push([curX + 0.5, 7]);
    coins.push([curX + 1.5, 7]);

    curX += gapLen + 4;
  }

  function isGap(tx) {
    return groundGaps.some(([s, e]) => tx >= s - 1 && tx <= e + 1);
  }

  // Populate pipes (max height 2 tiles, so always easily jumpable!)
  for (let px = 16; px < flagX - 16; px += 18 + Math.floor(rnd() * 10)) {
    if (!isGap(px) && !isGap(px + 1) && !isGap(px - 1)) {
      pipes.push({
        x: px,
        height: 2, // 2 tiles = 80px high, Gajar jumps 120px high!
        piranha: rnd() > 0.4
      });
    }
  }

  // Populate Bitcoin Power-ups, question blocks, and brick structures
  // Blocks are at y = 8 (ground is y = 11, so 3 tiles = 120px above ground, easy to hit with head!)
  for (let bx = 10; bx < flagX - 14; bx += 8 + Math.floor(rnd() * 6)) {
    if (isGap(bx) || isGap(bx + 1) || isGap(bx + 2)) continue;

    const pattern = Math.floor(rnd() * 4);
    if (pattern === 0) {
      // Classic: [?] [Brick] [?]
      blocks.push({ x: bx, y: 8, type: 'question', content: 'powerup' }); // BITCOIN!
      blocks.push({ x: bx + 1, y: 8, type: 'brick', content: null });
      blocks.push({ x: bx + 2, y: 8, type: 'question', content: rnd() > 0.6 ? 'star' : 'coin' });
    } else if (pattern === 1) {
      // Low bridge with Bitcoin & coins
      for (let i = 0; i < 4; i++) {
        blocks.push({ x: bx + i, y: 8, type: 'brick', content: null });
        coins.push([bx + i, 6]);
      }
      blocks.push({ x: bx + 1, y: 5, type: 'question', content: 'powerup' });
    } else if (pattern === 2) {
      // Question block with Bitcoin & 1UP
      blocks.push({ x: bx, y: 8, type: 'question', content: 'powerup' });
      blocks.push({ x: bx + 2, y: 8, type: 'question', content: '1up' });
      coins.push([bx + 1, 6]);
    } else {
      // Multi-coin block
      blocks.push({ x: bx, y: 8, type: 'brick', content: 'multicoin' });
      blocks.push({ x: bx + 1, y: 8, type: 'question', content: 'coin' });
    }
  }

  // Populate Le Bandit enemies
  for (let ex = 18; ex < flagX - 12; ex += 10 + Math.floor(rnd() * 8)) {
    if (isGap(ex)) continue;
    const type = rnd() < 0.65 ? 'goomba' : (rnd() < 0.88 ? 'koopa' : 'paragoomba');
    enemies.push({ x: ex, y: 10, type });
  }

  // Smooth Staircase leading up to the flagpole (10 to 6)
  const stairStart = flagX - 9;
  for (let step = 0; step < 4; step++) {
    const sx = stairStart + step;
    for (let sy = 10; sy >= 10 - step; sy--) {
      blocks.push({ x: sx, y: sy, type: 'hard' });
    }
  }

  return {
    id: `RANDOM`,
    name: `Gajar Random World #${seedNum % 9999}`,
    seed: seedNum,
    ...themeChoice,
    timeLimit: 300,
    widthTiles,
    flagX,
    castleX,
    groundGaps,
    blocks,
    pipes,
    platforms,
    coins,
    enemies
  };
}

// Default levels list: starts with a freshly randomized level on each visit!
window.GAME_LEVELS = [
  generatePlayableRandomLevel(Math.floor(Math.random() * 900000) + 100000)
];

window.generateRandomLevel = generatePlayableRandomLevel;
