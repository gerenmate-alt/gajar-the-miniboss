// Super Big Head Bros. - Main 2D Mario Platformer Engine

(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const W = 960;
  const H = 540;
  const T = 40; // Tile size in pixels
  const GROUND_Y = 11 * T; // y = 440

  canvas.width = W;
  canvas.height = H;

  // Load cutout images from window.GAME_ASSETS
  const imgs = {};
  let assetsLoaded = 0;
  const assetKeys = [
    'character', 'character_sticker', 'head', 'torso', 'left_leg', 'right_leg', 'head_icon',
    'enemy_bandit', 'enemy_bandit_squashed', 'enemy_egyptian', 'enemy_egyptian_squashed'
  ];
  assetKeys.forEach((key) => {
    const im = new Image();
    im.onload = () => {
      assetsLoaded++;
    };
    im.src = (window.GAME_ASSETS && window.GAME_ASSETS[key]) ? window.GAME_ASSETS[key] : `assets/${key}.png`;
    imgs[key] = im;
  });

  // Set HUD & Title screen images
  window.addEventListener('DOMContentLoaded', () => {
    const heroImg = document.getElementById('heroStickerImg');
    const hudIcon = document.getElementById('hudHeadIcon');
    if (heroImg && window.GAME_ASSETS) heroImg.src = window.GAME_ASSETS.character_sticker;
    if (hudIcon && window.GAME_ASSETS) hudIcon.src = window.GAME_ASSETS.head_icon;
  });

  // Input State
  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    run: false,
    jumpPressed: false,
    shootPressed: false
  };

  function handleKey(e, isDown) {
    const code = e.code;
    if (['ArrowLeft', 'KeyA'].includes(code)) keys.left = isDown;
    if (['ArrowRight', 'KeyD'].includes(code)) keys.right = isDown;
    if (['ArrowUp', 'KeyW', 'Space'].includes(code)) {
      if (isDown && !keys.up) keys.jumpPressed = true;
      keys.up = isDown;
    }
    if (['ArrowDown', 'KeyS'].includes(code)) keys.down = isDown;
    if (['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyF', 'Enter'].includes(code)) {
      if (isDown && !keys.run) keys.shootPressed = true;
      keys.run = isDown;
    }
    if (isDown && code === 'KeyM') {
      toggleAudioMute();
    }
    if (isDown && (code === 'KeyP' || code === 'Escape')) {
      if (game.state === 'playing') pauseGame();
      else if (game.state === 'paused') resumeGame();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }
  }

  window.addEventListener('keydown', (e) => handleKey(e, true));
  window.addEventListener('keyup', (e) => handleKey(e, false));

  // Touch / On-screen Buttons Setup
  function bindTouchBtn(id, keyName, isAction = false) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      keys[keyName] = true;
      if (keyName === 'up') keys.jumpPressed = true;
      if (keyName === 'run') keys.shootPressed = true;
    };
    const end = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      keys[keyName] = false;
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }

  bindTouchBtn('btnLeft', 'left');
  bindTouchBtn('btnRight', 'right');
  bindTouchBtn('btnJump', 'up', true);
  bindTouchBtn('btnFire', 'run', true);

  // Game State Object
  const game = {
    state: 'title', // 'title' | 'playing' | 'flagpole' | 'levelclear' | 'paused' | 'gameover' | 'victory'
    levelIndex: 0,
    score: 0,
    coins: 0,
    lives: 3,
    timeLeft: 300,
    timeTick: 0,
    cameraX: 0,
    frame: 0,
    shakeTimer: 0,
    flagSlideTimer: 0,
    bridgeCollapseTimer: 0
  };

  // Player Object ("Big Head")
  const player = {
    x: 100,
    y: GROUND_Y - 68,
    vx: 0,
    vy: 0,
    w: 30,
    h: 68,
    dir: 1, // 1 right, -1 left
    onGround: false,
    coyoteTimer: 0,
    jumpBuffer: 0,
    power: 1, // Start as 1 (MEGA BIG HEAD!) so he can take a hit right away, 0 = Kicsi Big Head, 2 = Lájk Király (Fire/Thumbs-Up)
    starTimer: 0,
    invulnTimer: 0,
    walkPhase: 0,
    scaleX: 1,
    scaleY: 1,
    shootCooldown: 0,
    dead: false
  };

  // Level Dynamic Collections
  let currentLevel = null;
  let blocks = [];
  let pipes = [];
  let platforms = [];
  let coins = [];
  let items = [];
  let enemies = [];
  let projectiles = [];
  let particles = [];
  let popups = [];
  let boss = null;
  let clouds = [];
  let hills = [];

  function initDecorations(widthTiles) {
    clouds = [];
    hills = [];
    for (let x = 2; x < widthTiles; x += 7 + Math.floor(Math.random() * 5)) {
      clouds.push({
        x: x * T,
        y: 45 + (x % 3) * 38,
        w: 76 + (x % 2) * 34,
        speed: 0.15 + (x % 3) * 0.05
      });
    }
    for (let x = 0; x < widthTiles; x += 9) {
      hills.push({
        x: x * T,
        w: 140 + (x % 3) * 60,
        h: 75 + (x % 2) * 45,
        bush: (x % 2 === 0)
      });
    }
  }

  function loadLevel(idx, resetPlayerPower = false) {
    game.levelIndex = idx;
    const def = window.GAME_LEVELS[idx];
    currentLevel = def;

    game.timeLeft = def.timeLimit || 300;
    game.timeTick = 0;
    game.cameraX = 0;
    game.flagSlideTimer = 0;
    game.bridgeCollapseTimer = 0;

    if (resetPlayerPower) {
      player.power = 1;
    }
    updatePlayerSize();

    player.x = 2.5 * T;
    player.y = GROUND_Y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.dir = 1;
    player.onGround = true;
    player.dead = false;
    player.invulnTimer = 0;
    player.starTimer = 0;
    player.scaleX = 1;
    player.scaleY = 1;

    // Clone blocks
    blocks = (def.blocks || []).map((b) => ({
      x: b.x * T,
      y: b.y * T,
      tileX: b.x,
      tileY: b.y,
      w: T,
      h: T,
      type: b.type,
      content: b.content || null,
      coinsLeft: b.content === 'multicoin' ? 6 : 1,
      used: false,
      bumpY: 0,
      bumpVy: 0
    }));

    // Clone pipes
    pipes = (def.pipes || []).map((p) => ({
      x: p.x * T,
      y: GROUND_Y - p.height * T,
      w: 2 * T,
      h: p.height * T,
      hasPiranha: !!p.piranha,
      piranhaOffset: 0, // 0 = hidden, up to 46 = fully extended
      piranhaTimer: Math.floor(Math.random() * 100),
      piranhaState: 'wait_down',
      piranhaDead: false
    }));

    // Clone moving platforms
    platforms = (def.platforms || []).map((pl) => ({
      startX: pl.x * T,
      startY: pl.y * T,
      x: pl.x * T,
      y: pl.y * T,
      w: pl.w * T,
      h: 18,
      dx: pl.dx || 0,
      dy: pl.dy || 0,
      range: pl.range || 0,
      speed: pl.speed || 1.5,
      phase: 0,
      vx: 0,
      vy: 0
    }));

    // Clone coins
    coins = (def.coins || []).map(([cx, cy]) => ({
      x: cx * T + 8,
      y: cy * T + 6,
      w: 24,
      h: 28,
      collected: false
    }));

    items = [];
    projectiles = [];
    particles = [];
    popups = [];

    // Clone enemies
    enemies = (def.enemies || []).map((e) => ({
      x: e.x * T,
      y: e.y * T - (e.type === 'koopa' ? 46 : 36),
      baseY: e.y * T - 36,
      vx: -1.25,
      vy: 0,
      w: 36,
      h: e.type === 'koopa' ? 46 : 36,
      type: e.type,
      state: 'walk', // 'walk' | 'shell_idle' | 'shell_move' | 'squashed'
      deadTimer: 0,
      animPhase: Math.random() * 10,
      dir: -1
    }));

    // Boss Setup (for World 1-3)
    if (def.boss) {
      boss = {
        x: def.boss.x * T,
        y: def.boss.y * T,
        vx: -1.1,
        vy: 0,
        w: 68,
        h: 82,
        hp: def.boss.hp,
        maxHp: def.boss.hp,
        state: 'fight', // 'fight' | 'falling' | 'dead'
        jumpTimer: 90,
        fireTimer: 75,
        hurtTimer: 0,
        axeX: def.boss.axeX * T,
        axeY: def.boss.axeY * T,
        axeTouched: false
      };
    } else {
      boss = null;
    }

    initDecorations(def.widthTiles);
    updateHUD();

    // Update active level button in HUD
    document.querySelectorAll('.lvl-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });
  }

  function updatePlayerSize() {
    const oldH = player.h;
    if (player.power === 0) {
      player.w = 28;
      player.h = 58;
    } else {
      player.w = 32;
      player.h = 74;
    }
    player.y -= (player.h - oldH);
  }

  function addPopup(x, y, text, color = '#ffffff') {
    popups.push({ x, y, text, color, life: 48, maxLife: 48 });
  }

  function addParticles(x, y, color, count = 8, speed = 4) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = (0.4 + Math.random() * 0.8) * speed;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 2,
        size: 4 + Math.random() * 5,
        color,
        life: 24 + Math.floor(Math.random() * 18)
      });
    }
  }

  function addScore(pts, x, y, customLabel = null) {
    game.score += pts;
    if (x !== undefined && y !== undefined) {
      addPopup(x, y, customLabel || `+${pts}`, '#fde68a');
    }
    updateHUD();
  }

  function collectCoin(x, y) {
    game.coins++;
    window.soundFX.coin();
    addParticles(x, y, '#fbbf24', 6, 3.2);
    if (game.coins >= 50) {
      game.coins -= 50;
      game.lives++;
      window.soundFX.oneUp();
      addPopup(x, y - 16, '1-UP! (+1 ÉLET)', '#4ade80');
    } else {
      addScore(100, x, y, '+100');
    }
    updateHUD();
  }

  // Check if tile column tx has ground
  function hasGroundAtTile(tx) {
    if (tx < 0 || tx >= currentLevel.widthTiles) return false;
    for (const [gStart, gEnd] of currentLevel.groundGaps) {
      if (tx >= gStart && tx <= gEnd) return false;
    }
    return true;
  }

  function aabb(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  // Spawn Item from Question/Brick Block
  function triggerBlock(b) {
    if (b.used || b.type === 'hard' || b.type === 'bridge') return;

    b.bumpVy = -6;
    window.soundFX.bump();

    // Check if an enemy is standing right on top of this block!
    enemies.forEach((en) => {
      if (en.state !== 'squashed' && Math.abs((en.x + en.w / 2) - (b.x + b.w / 2)) < T * 0.9 && Math.abs((en.y + en.h) - b.y) < 10) {
        en.vy = -8;
        en.state = 'squashed';
        en.deadTimer = 25;
        window.soundFX.kick();
        addScore(200, en.x, en.y, '+200 KO!');
      }
    });

    if (b.type === 'question' || b.content) {
      if (b.content === 'coin') {
        b.used = true;
        collectCoin(b.x + 20, b.y - 16);
      } else if (b.content === 'multicoin') {
        collectCoin(b.x + 20, b.y - 16);
        b.coinsLeft--;
        if (b.coinsLeft <= 0) b.used = true;
      } else if (b.content === 'powerup') {
        b.used = true;
        window.soundFX.powerupAppear();
        const itemType = player.power === 0 ? 'mega' : 'fire';
        items.push({
          x: b.x + 4,
          y: b.y - 34,
          vx: itemType === 'mega' ? 1.8 : 0,
          vy: -3,
          w: 32,
          h: 32,
          type: itemType
        });
      } else if (b.content === 'star') {
        b.used = true;
        window.soundFX.powerupAppear();
        items.push({
          x: b.x + 4,
          y: b.y - 34,
          vx: 2.4,
          vy: -6,
          w: 32,
          h: 32,
          type: 'star'
        });
      } else if (b.content === '1up') {
        b.used = true;
        window.soundFX.powerupAppear();
        items.push({
          x: b.x + 4,
          y: b.y - 34,
          vx: 1.9,
          vy: -3,
          w: 32,
          h: 32,
          type: '1up'
        });
      }
    } else if (b.type === 'brick') {
      if (player.power >= 1) {
        // Shatter brick in Mega Big Head mode!
        window.soundFX.breakBlock();
        addParticles(b.x + 20, b.y + 20, currentLevel.brickColor, 12, 6);
        addScore(50, b.x + 10, b.y);
        blocks = blocks.filter((blk) => blk !== b);
      }
    }
  }

  function hurtPlayer() {
    if (player.invulnTimer > 0 || player.starTimer > 0 || player.dead) return;

    if (player.power > 0) {
      player.power--;
      updatePlayerSize();
      player.invulnTimer = 95;
      game.shakeTimer = 14;
      window.soundFX.hurt();
      addPopup(player.x, player.y, 'VIGYÁZZ!', '#f87171');
      updateHUD();
    } else {
      killPlayer();
    }
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    player.vy = -11.5;
    player.vx = 0;
    game.lives--;
    game.shakeTimer = 18;
    window.soundFX.gameOver();
    updateHUD();

    setTimeout(() => {
      if (game.lives > 0) {
        loadLevel(game.levelIndex, true);
        game.state = 'playing';
        window.soundFX.startMusic(currentLevel.theme);
      } else {
        showOverlay('gameover');
      }
    }, 1800);
  }

  // Shoot Thumbs-Up Fireball ("Lájkgolyó")
  function shootProjectile() {
    if (player.power < 2 || player.shootCooldown > 0) return;
    if (projectiles.filter((p) => p.friendly).length >= 3) return;

    player.shootCooldown = 16;
    window.soundFX.shoot();
    projectiles.push({
      x: player.dir === 1 ? player.x + player.w : player.x - 18,
      y: player.y + player.h * 0.45,
      vx: player.dir * 8.5,
      vy: 2.2,
      w: 22,
      h: 22,
      friendly: true,
      bounces: 0,
      life: 140
    });
  }

  // Resolve horizontal & vertical solid collisions for an entity
  function getSolidRects() {
    const solids = [];
    // Ground segments
    for (let tx = Math.max(0, Math.floor((game.cameraX - 120) / T)); tx < Math.min(currentLevel.widthTiles, Math.ceil((game.cameraX + W + 240) / T)); tx++) {
      if (hasGroundAtTile(tx)) {
        solids.push({ x: tx * T, y: GROUND_Y, w: T, h: H - GROUND_Y, kind: 'ground' });
      }
    }
    // Blocks
    for (const b of blocks) {
      solids.push({ x: b.x, y: b.y + b.bumpY, w: b.w, h: b.h, kind: 'block', ref: b });
    }
    // Pipes
    for (const p of pipes) {
      solids.push({ x: p.x, y: p.y, w: p.w, h: p.h, kind: 'pipe', ref: p });
    }
    // Moving platforms
    for (const pl of platforms) {
      solids.push({ x: pl.x, y: pl.y, w: pl.w, h: pl.h, kind: 'platform', ref: pl });
    }
    return solids;
  }

  function update() {
    game.frame++;
    if (game.shakeTimer > 0) game.shakeTimer--;

    if (game.state === 'flagpole') {
      updateFlagpoleSequence();
      return;
    }

    if (game.state !== 'playing') return;

    // Update Timer
    game.timeTick++;
    if (game.timeTick >= 60) {
      game.timeTick = 0;
      game.timeLeft = Math.max(0, game.timeLeft - 1);
      updateHUD();
      if (game.timeLeft === 0 && !player.dead) {
        killPlayer();
      }
    }

    // If player is dead, just animate death jump
    if (player.dead) {
      player.vy += 0.48;
      player.y += player.vy;
      return;
    }

    if (player.invulnTimer > 0) player.invulnTimer--;
    if (player.shootCooldown > 0) player.shootCooldown--;
    if (player.starTimer > 0) {
      player.starTimer--;
      if (player.starTimer % 4 === 0) {
        addParticles(player.x + player.w / 2, player.y + player.h / 2, '#fde047', 1, 2);
      }
      if (player.starTimer === 0) {
        window.soundFX.startMusic(currentLevel.theme);
        updateHUD();
      }
    }

    // Bridge collapse animation when Boss Axe is touched!
    if (game.bridgeCollapseTimer > 0) {
      game.bridgeCollapseTimer++;
      if (game.bridgeCollapseTimer % 4 === 0) {
        const bridgeBlocks = blocks.filter((b) => b.type === 'bridge');
        if (bridgeBlocks.length > 0) {
          const lastB = bridgeBlocks[bridgeBlocks.length - 1];
          addParticles(lastB.x + 20, lastB.y + 20, '#94a3b8', 6, 4);
          window.soundFX.breakBlock();
          blocks = blocks.filter((b) => b !== lastB);
        } else if (boss && boss.state === 'fight') {
          boss.state = 'falling';
          window.soundFX.kick();
          addScore(5000, boss.x, boss.y, '+5000 BOSS KO!');
        }
      }
    }

    // Update Moving Platforms
    for (const pl of platforms) {
      const prevX = pl.x;
      const prevY = pl.y;
      pl.phase += 0.025 * pl.speed;
      pl.x = pl.startX + Math.sin(pl.phase) * pl.range * pl.dx;
      pl.y = pl.startY + Math.sin(pl.phase) * pl.range * pl.dy;
      pl.vx = pl.x - prevX;
      pl.vy = pl.y - prevY;
    }

    // Update Block bumps
    for (const b of blocks) {
      if (b.bumpY < 0 || b.bumpVy !== 0) {
        b.bumpY += b.bumpVy;
        b.bumpVy += 1.2;
        if (b.bumpY >= 0) {
          b.bumpY = 0;
          b.bumpVy = 0;
        }
      }
    }

    // Player Horizontal Movement - tuned for smooth, responsive classic Mario feel
    const maxSpeed = keys.run ? 4.5 : 3.2;
    const accel = player.onGround ? 0.32 : 0.22;
    const friction = player.onGround ? 0.84 : 0.94;

    if (keys.left) {
      player.vx = Math.max(player.vx - accel, -maxSpeed);
      player.dir = -1;
    } else if (keys.right) {
      player.vx = Math.min(player.vx + accel, maxSpeed);
      player.dir = 1;
    } else {
      player.vx *= friction;
      if (Math.abs(player.vx) < 0.08) player.vx = 0;
    }

    // Shooting Fireballs
    if (keys.shootPressed) {
      keys.shootPressed = false;
      shootProjectile();
    }

    // Coyote time & Jump buffer
    if (player.onGround) {
      player.coyoteTimer = 7;
    } else if (player.coyoteTimer > 0) {
      player.coyoteTimer--;
    }

    if (keys.jumpPressed) {
      player.jumpBuffer = 7;
      keys.jumpPressed = false;
    } else if (player.jumpBuffer > 0) {
      player.jumpBuffer--;
    }

    // Execute Jump - tuned for high, satisfying jump reach
    if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
      const speedBonus = Math.abs(player.vx) * 0.18;
      player.vy = -(11.8 + speedBonus);
      player.onGround = false;
      player.coyoteTimer = 0;
      player.jumpBuffer = 0;
      player.scaleX = 0.82;
      player.scaleY = 1.22;
      window.soundFX.jump(player.power > 0);
      addParticles(player.x + player.w / 2, player.y + player.h, '#e2e8f0', 5, 2.5);
    }

    // Variable Jump Height (release jump early for shorter hop)
    if (!keys.up && player.vy < -4.2) {
      player.vy *= 0.65;
    }

    // Gravity
    player.vy = Math.min(player.vy + 0.46, 11.0);

    const solids = getSolidRects();

    // Move Player X & Resolve X Collisions
    player.x += player.vx;
    if (player.x < game.cameraX) {
      player.x = game.cameraX;
      player.vx = 0;
    }

    for (const s of solids) {
      if (s.kind === 'platform') continue; // Moving platforms are one-way from top
      if (aabb(player, s)) {
        if (player.vx > 0) {
          player.x = s.x - player.w;
          player.vx = 0;
        } else if (player.vx < 0) {
          player.x = s.x + s.w;
          player.vx = 0;
        }
      }
    }

    // Move Player Y & Resolve Y Collisions
    const wasOnGround = player.onGround;
    const prevBottom = player.y + player.h;
    player.y += player.vy;
    player.onGround = false;

    for (const s of solids) {
      if (s.kind === 'platform') {
        // One-way platform landing
        if (player.vy >= 0 && prevBottom <= s.y + 12 && aabb(player, s)) {
          player.y = s.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.x += s.ref.vx;
        }
        continue;
      }

      if (aabb(player, s)) {
        if (player.vy > 0) {
          player.y = s.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0) {
          player.y = s.y + s.h;
          player.vy = 1.5;
          if (s.kind === 'block') {
            triggerBlock(s.ref);
          } else {
            window.soundFX.bump();
          }
        }
      }
    }

    // Landing squash animation
    if (!wasOnGround && player.onGround) {
      player.scaleX = 1.2;
      player.scaleY = 0.82;
      addParticles(player.x + player.w / 2, player.y + player.h, '#cbd5e1', 4, 2);
    }

    // Smoothly relax squash & stretch
    player.scaleX += (1 - player.scaleX) * 0.22;
    player.scaleY += (1 - player.scaleY) * 0.22;

    // Walk animation phase
    if (player.onGround && Math.abs(player.vx) > 0.2) {
      player.walkPhase += Math.abs(player.vx) * 0.085;
      if (game.frame % 9 === 0 && Math.abs(player.vx) > 4.2) {
        addParticles(player.x + (player.dir === 1 ? 4 : player.w - 4), player.y + player.h - 2, 'rgba(255,255,255,0.6)', 1, 1.2);
      }
    } else {
      player.walkPhase *= 0.8;
    }

    // Check Pit Fall
    if (player.y > H + 30) {
      player.power = 0;
      killPlayer();
      return;
    }

    // Camera smoothly follows Big Head
    const targetCamX = Math.max(game.cameraX, player.x - W * 0.35);
    const maxCamX = currentLevel.widthTiles * T - W;
    game.cameraX = Math.max(0, Math.min(maxCamX, game.cameraX + (targetCamX - game.cameraX) * 0.18));

    // Collect Floating Coins
    for (const c of coins) {
      if (!c.collected && aabb(player, c)) {
        c.collected = true;
        collectCoin(c.x + 12, c.y + 12);
      }
    }

    // Update & Collect Power-Up Items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.type === 'star') {
        it.vy += 0.42;
      } else if (it.type !== 'fire') {
        it.vy += 0.45;
      } else {
        it.vy = 0;
      }

      it.x += it.vx;
      for (const s of solids) {
        if (s.kind !== 'platform' && aabb(it, s)) {
          if (it.vx > 0) it.x = s.x - it.w;
          else if (it.vx < 0) it.x = s.x + s.w;
          it.vx *= -1;
        }
      }

      it.y += it.vy;
      for (const s of solids) {
        if (aabb(it, s)) {
          if (it.vy > 0) {
            it.y = s.y - it.h;
            it.vy = it.type === 'star' ? -7.5 : 0;
          }
        }
      }

      if (aabb(player, it)) {
        window.soundFX.powerupCollect();
        if (it.type === 'mega') {
          if (player.power < 1) player.power = 1;
          updatePlayerSize();
          addScore(1000, it.x, it.y, '₿ BITCOIN POWER!');
        } else if (it.type === 'fire') {
          player.power = 2;
          updatePlayerSize();
          addScore(1000, it.x, it.y, '👍 LÁJK KIRÁLY!');
        } else if (it.type === 'star') {
          player.starTimer = 540; // 9 seconds of rainbow invincibility!
          window.soundFX.startMusic('star');
          addScore(1000, it.x, it.y, '⭐ VIP CSILLAG!');
        } else if (it.type === '1up') {
          game.lives++;
          window.soundFX.oneUp();
          addPopup(it.x, it.y, '1-UP! (+1 ÉLET)', '#4ade80');
        }
        player.scaleX = 1.25;
        player.scaleY = 1.25;
        updateHUD();
        items.splice(i, 1);
      }
    }

    // Update Pipe Piranha Plants
    for (const p of pipes) {
      if (!p.hasPiranha || p.piranhaDead) continue;
      p.piranhaTimer++;
      const playerNearPipe = Math.abs((player.x + player.w / 2) - (p.x + p.w / 2)) < 68;

      if (p.piranhaState === 'wait_down') {
        p.piranhaOffset = 0;
        if (p.piranhaTimer > 80 && !playerNearPipe) {
          p.piranhaState = 'rising';
          p.piranhaTimer = 0;
        }
      } else if (p.piranhaState === 'rising') {
        p.piranhaOffset = Math.min(44, p.piranhaOffset + 1.4);
        if (p.piranhaOffset >= 44) {
          p.piranhaState = 'wait_up';
          p.piranhaTimer = 0;
        }
      } else if (p.piranhaState === 'wait_up') {
        if (p.piranhaTimer > 75) {
          p.piranhaState = 'sinking';
          p.piranhaTimer = 0;
        }
      } else if (p.piranhaState === 'sinking') {
        p.piranhaOffset = Math.max(0, p.piranhaOffset - 1.4);
        if (p.piranhaOffset <= 0) {
          p.piranhaState = 'wait_down';
          p.piranhaTimer = 0;
        }
      }

      if (p.piranhaOffset > 10) {
        const plantRect = { x: p.x + 18, y: p.y - p.piranhaOffset + 6, w: 44, h: p.piranhaOffset };
        if (aabb(player, plantRect)) {
          if (player.starTimer > 0) {
            p.piranhaDead = true;
            window.soundFX.kick();
            addScore(200, p.x + 20, p.y - 20);
          } else {
            hurtPlayer();
          }
        }
      }
    }

    // Update Projectiles (Player Thumbs-Up Fireballs & Boss Fireballs)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life--;
      if (pr.life <= 0) {
        projectiles.splice(i, 1);
        continue;
      }

      pr.x += pr.vx;
      if (pr.friendly) {
        pr.vy += 0.45;
        pr.y += pr.vy;
        for (const s of solids) {
          if (aabb(pr, s)) {
            if (pr.vy > 0 && pr.y + pr.h - pr.vy <= s.y + 10) {
              pr.y = s.y - pr.h;
              pr.vy = -6.2;
            } else {
              addParticles(pr.x, pr.y, '#fbbf24', 5, 3);
              pr.life = 0;
            }
          }
        }

        // Check hit on Piranha plants
        for (const p of pipes) {
          if (p.hasPiranha && !p.piranhaDead && p.piranhaOffset > 8) {
            const plantRect = { x: p.x + 14, y: p.y - p.piranhaOffset, w: 52, h: p.piranhaOffset };
            if (aabb(pr, plantRect)) {
              p.piranhaDead = true;
              pr.life = 0;
              window.soundFX.kick();
              addParticles(pr.x, pr.y, '#22c55e', 8, 4);
              addScore(200, p.x + 20, p.y - 20, '+200');
            }
          }
        }

        // Check hit on Enemies
        for (const en of enemies) {
          if (en.state !== 'squashed' && aabb(pr, en)) {
            en.state = 'squashed';
            en.deadTimer = 20;
            pr.life = 0;
            window.soundFX.kick();
            addParticles(en.x + 18, en.y + 18, '#fbbf24', 8, 4);
            addScore(200, en.x, en.y, '👍 +200');
            break;
          }
        }

        // Check hit on Boss
        if (boss && boss.state === 'fight' && aabb(pr, boss)) {
          pr.life = 0;
          boss.hp--;
          boss.hurtTimer = 14;
          window.soundFX.kick();
          addParticles(pr.x, pr.y, '#ef4444', 8, 4);
          if (boss.hp <= 0) {
            boss.state = 'falling';
            addScore(5000, boss.x, boss.y, '+5000 BOSS KO!');
          } else {
            addScore(250, boss.x, boss.y, '👍 TALÁLAT!');
          }
        }
      } else {
        // Boss Fireball
        pr.y += pr.vy;
        if (aabb(player, pr)) {
          pr.life = 0;
          hurtPlayer();
        }
      }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      if (en.x > game.cameraX + W + 180 || en.x < game.cameraX - 220) continue;

      if (en.state === 'squashed') {
        en.deadTimer--;
        if (en.deadTimer <= 0) enemies.splice(i, 1);
        continue;
      }

      en.animPhase += 0.16;

      if (en.type === 'paragoomba' && en.state === 'walk' && en.onGround && Math.sin(en.animPhase) > 0.92) {
        en.vy = -7.8;
        en.onGround = false;
      }

      en.vy = Math.min(en.vy + 0.48, 11);
      en.x += en.vx;

      for (const s of solids) {
        if (s.kind !== 'platform' && aabb(en, s)) {
          if (en.vx > 0) en.x = s.x - en.w;
          else if (en.vx < 0) en.x = s.x + s.w;
          en.vx *= -1;
          en.dir = Math.sign(en.vx) || 1;
          if (en.state === 'shell_move') window.soundFX.bump();
        }
      }

      en.y += en.vy;
      en.onGround = false;
      for (const s of solids) {
        if (aabb(en, s)) {
          if (en.vy > 0) {
            en.y = s.y - en.h;
            en.vy = 0;
            en.onGround = true;
          }
        }
      }

      // Moving Koopa shell bowls over other enemies!
      if (en.state === 'shell_move') {
        for (const other of enemies) {
          if (other !== en && other.state !== 'squashed' && aabb(en, other)) {
            other.state = 'squashed';
            other.deadTimer = 20;
            window.soundFX.kick();
            addParticles(other.x + 18, other.y + 18, '#4ade80', 8, 4);
            addScore(400, other.x, other.y, 'STRIKE! +400');
          }
        }
      }

      // Player vs Enemy Collision
      if (aabb(player, en)) {
        if (player.starTimer > 0) {
          en.state = 'squashed';
          en.deadTimer = 20;
          window.soundFX.kick();
          addParticles(en.x + 18, en.y + 18, '#fde047', 10, 4);
          addScore(200, en.x, en.y, '⭐ +200');
          continue;
        }

        // Forgiving Mario Stomp check: player is moving downward OR feet are in the top 55% of enemy
        const isStomp = player.vy > -1.0 && (player.y + player.h - player.vy) <= (en.y + en.h * 0.65);

        if (isStomp) {
          player.y = en.y - player.h;
          player.vy = keys.up ? -10.5 : -7.5; // Hold Jump for high bounce!
          player.scaleX = 1.22;
          player.scaleY = 0.8;
          window.soundFX.stomp();
          addParticles(en.x + en.w / 2, en.y, '#ffffff', 6, 3);

          if (en.type === 'paragoomba') {
            en.type = 'goomba';
            addScore(100, en.x, en.y, '+100');
          } else if (en.type === 'koopa' && en.state === 'walk') {
            en.state = 'shell_idle';
            en.vx = 0;
            en.h = 34;
            en.y += 12;
            addScore(100, en.x, en.y, 'PÁNCÉL! +100');
          } else if (en.state === 'shell_idle') {
            en.state = 'shell_move';
            en.vx = player.dir * 8.6;
            window.soundFX.kick();
            addScore(200, en.x, en.y, 'RÚGÁS! +200');
          } else if (en.state === 'shell_move') {
            en.state = 'shell_idle';
            en.vx = 0;
            addScore(100, en.x, en.y, '+100');
          } else {
            en.state = 'squashed';
            en.deadTimer = 24;
            addScore(100, en.x, en.y, '+100');
          }
        } else if (en.state === 'shell_idle') {
          // Kick stationary shell from the side!
          en.state = 'shell_move';
          en.vx = (player.x < en.x ? 1 : -1) * 8.6;
          player.x += player.x < en.x ? -6 : 6;
          window.soundFX.kick();
          addScore(100, en.x, en.y, 'RÚGÁS!');
        } else {
          hurtPlayer();
        }
      }

      if (en.y > H + 60) {
        enemies.splice(i, 1);
      }
    }

    // Update BOSS (World 1-3)
    if (boss && boss.state !== 'dead') {
      if (boss.hurtTimer > 0) boss.hurtTimer--;

      if (boss.state === 'falling') {
        boss.vy += 0.5;
        boss.y += boss.vy;
        if (boss.y > H + 100) {
          boss.state = 'dead';
        }
      } else if (boss.state === 'fight' && Math.abs(player.x - boss.x) < W * 0.9) {
        // Boss movement on bridge (tiles 82..95)
        boss.x += boss.vx;
        if (boss.x < 82.5 * T) boss.vx = Math.abs(boss.vx);
        if (boss.x > 93.5 * T) boss.vx = -Math.abs(boss.vx);

        boss.jumpTimer--;
        if (boss.jumpTimer <= 0) {
          boss.vy = -9.5;
          boss.jumpTimer = 85 + Math.floor(Math.random() * 45);
        }

        boss.vy += 0.42;
        boss.y += boss.vy;

        for (const s of solids) {
          if (aabb(boss, s) && boss.vy > 0) {
            boss.y = s.y - boss.h;
            boss.vy = 0;
          }
        }

        // Boss breathes fire
        boss.fireTimer--;
        if (boss.fireTimer <= 0) {
          boss.fireTimer = 90 + Math.floor(Math.random() * 40);
          window.soundFX.shoot();
          projectiles.push({
            x: boss.x - 16,
            y: boss.y + 26,
            vx: -5.2,
            vy: (player.y - boss.y) * 0.015,
            w: 28,
            h: 18,
            friendly: false,
            life: 160
          });
        }

        // Player vs Boss
        if (aabb(player, boss)) {
          const isStomp = player.vy > 0 && (player.y + player.h - player.vy) <= (boss.y + 30);
          if (isStomp || player.starTimer > 0) {
            player.vy = -10.5;
            boss.hp -= 2;
            boss.hurtTimer = 20;
            window.soundFX.stomp();
            addParticles(boss.x + boss.w / 2, boss.y, '#fde047', 10, 4);
            if (boss.hp <= 0) {
              boss.state = 'falling';
              addScore(5000, boss.x, boss.y, '+5000 BOSS KO!');
            } else {
              addScore(500, boss.x, boss.y, 'FEJES! +500');
            }
          } else if (boss.hurtTimer === 0) {
            hurtPlayer();
          }
        }

        // Check if player touches the Golden VIP Axe at the end of the bridge!
        if (!boss.axeTouched && aabb(player, { x: boss.axeX, y: boss.axeY, w: 38, h: 48 })) {
          boss.axeTouched = true;
          game.bridgeCollapseTimer = 1;
          game.shakeTimer = 30;
          window.soundFX.powerupCollect();
          addPopup(boss.axeX, boss.axeY - 20, 'HÍD LEOMLÁS!', '#fbbf24');
        }
      }
    }

    // Check Flagpole Goal!
    const flagPoleX = currentLevel.flagX * T;
    if (player.x + player.w >= flagPoleX + 12 && player.x <= flagPoleX + 36 && player.y + player.h >= 3 * T) {
      startFlagpoleSequence(flagPoleX);
    }

    // Update Particles & Popups
    updateParticlesAndPopups();
  }

  function updateParticlesAndPopups() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.25;
      pt.life--;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const pp = popups[i];
      pp.y -= 1.1;
      pp.life--;
      if (pp.life <= 0) popups.splice(i, 1);
    }
  }

  function startFlagpoleSequence(flagPoleX) {
    game.state = 'flagpole';
    game.flagSlideTimer = 0;
    player.x = flagPoleX - 6;
    player.vx = 0;
    player.vy = 0;
    player.dir = 1;

    // Bonus points based on how high on the flagpole Big Head grabbed!
    const heightRatio = Math.max(0, Math.min(1, (GROUND_Y - player.y) / (GROUND_Y - 3 * T)));
    const bonus = Math.round((500 + heightRatio * 4500) / 100) * 100;
    window.soundFX.flagpole();
    addScore(bonus, player.x, player.y, `ZÁSZLÓ BÓNUSZ +${bonus}!`);
  }

  function updateFlagpoleSequence() {
    game.flagSlideTimer++;
    updateParticlesAndPopups();

    const castleDoorX = (currentLevel.castleX + 1.8) * T;

    if (player.y + player.h < GROUND_Y) {
      // Slide down flagpole
      player.y = Math.min(GROUND_Y - player.h, player.y + 4.5);
    } else if (player.x < castleDoorX) {
      // Walk into VIP Castle
      player.x += 3.2;
      player.walkPhase += 0.28;
      if (game.flagSlideTimer === 45) {
        window.soundFX.levelClear();
      }
      // Celebratory fireworks!
      if (game.flagSlideTimer % 18 === 0) {
        const fx = currentLevel.castleX * T + Math.random() * 160;
        const fy = 80 + Math.random() * 120;
        const colors = ['#fbbf24', '#ef4444', '#4ade80', '#38bdf8', '#e879f9'];
        addParticles(fx, fy, colors[Math.floor(Math.random() * colors.length)], 16, 4.5);
      }
    } else {
      // Reached Castle Door!
      if (game.flagSlideTimer > 135) {
        const timeBonus = game.timeLeft * 10;
        game.score += timeBonus;
        updateHUD();
        if (game.levelIndex < window.GAME_LEVELS.length - 1) {
          showOverlay('levelclear', timeBonus);
        } else {
          showOverlay('victory', timeBonus);
        }
      }
    }
  }

  // =========================================================================
  // RENDERING
  // =========================================================================
  function draw() {
    ctx.save();

    // Screen shake effect
    if (game.shakeTimer > 0) {
      const dx = (Math.random() - 0.5) * 7;
      const dy = (Math.random() - 0.5) * 7;
      ctx.translate(dx, dy);
    }

    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, currentLevel ? currentLevel.skyColorTop : '#3b82f6');
    skyGrad.addColorStop(1, currentLevel ? currentLevel.skyColorBottom : '#93c5fd');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    if (!currentLevel) {
      ctx.restore();
      return;
    }

    // 2. Parallax Clouds / Neon Grid / Castle Torches
    drawBackgroundScenery();

    ctx.save();
    ctx.translate(-Math.floor(game.cameraX), 0);

    // 3. Castle & Flagpole at end of level
    drawCastleAndFlagpole();

    // 4. Pipes & Piranha Plants
    drawPipes();

    // 5. Ground & Lava Pits
    drawGround();

    // 6. Moving Platforms
    drawPlatforms();

    // 7. Blocks (Question, Brick, Hard, Bridge)
    drawBlocks();

    // 8. Coins & Power-Up Items
    drawCoinsAndItems();

    // 9. Enemies & Boss
    drawEnemies();
    if (boss && boss.state !== 'dead') {
      drawBoss();
    }

    // 10. Player ("Big Head" Articulated Cutout!)
    const castleDoorX = (currentLevel.castleX + 1.8) * T;
    if (!(game.state === 'flagpole' && player.x >= castleDoorX)) {
      drawPlayer();
    }

    // 11. Projectiles, Particles & Floating Score Popups
    drawProjectiles();
    drawParticlesAndPopups();

    ctx.restore();

    // Boss HP Bar on screen if near Boss
    if (boss && boss.state === 'fight' && player.x > 74 * T) {
      drawBossHud();
    }

    ctx.restore();
  }

  function drawBackgroundScenery() {
    // Clouds / Stars
    for (const c of clouds) {
      const sx = ((c.x - game.cameraX * 0.35) % (currentLevel.widthTiles * T * 0.6));
      if (sx < -150 || sx > W + 150) continue;

      if (currentLevel.theme === 'overworld') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.arc(sx, c.y, 22, 0, Math.PI * 2);
        ctx.arc(sx + 24, c.y - 8, 28, 0, Math.PI * 2);
        ctx.arc(sx + 52, c.y, 22, 0, Math.PI * 2);
        ctx.fill();
      } else if (currentLevel.theme === 'underground') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.fillRect(sx, c.y, c.w, 8);
      } else {
        // Castle embers
        ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
        ctx.beginPath();
        ctx.arc(sx, c.y + Math.sin(game.frame * 0.05 + sx) * 15, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hills & Bushes
    for (const h of hills) {
      const hx = h.x - game.cameraX * 0.6;
      if (hx < -250 || hx > W + 250) continue;

      if (currentLevel.theme === 'overworld') {
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(hx + h.w / 2, GROUND_Y, h.w / 2, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (currentLevel.theme === 'underground') {
        ctx.fillStyle = 'rgba(30, 58, 138, 0.45)';
        ctx.fillRect(hx, GROUND_Y - h.h * 1.4, 36, h.h * 1.4);
      } else {
        ctx.fillStyle = 'rgba(69, 10, 10, 0.6)';
        ctx.fillRect(hx, GROUND_Y - h.h * 1.6, 52, h.h * 1.6);
      }
    }
  }

  function drawGround() {
    const startTile = Math.max(0, Math.floor(game.cameraX / T) - 1);
    const endTile = Math.min(currentLevel.widthTiles, Math.ceil((game.cameraX + W) / T) + 2);

    for (let tx = startTile; tx < endTile; tx++) {
      const gx = tx * T;
      if (hasGroundAtTile(tx)) {
        // Main dirt/stone body
        ctx.fillStyle = currentLevel.groundFillColor;
        ctx.fillRect(gx, GROUND_Y, T, H - GROUND_Y);

        // Brick pattern on ground
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx + 1, GROUND_Y + 14, T - 2, 26);
        ctx.strokeRect(gx + 1, GROUND_Y + 42, T - 2, 28);

        // Top grass/neon lip
        ctx.fillStyle = currentLevel.groundTopColor;
        ctx.fillRect(gx, GROUND_Y, T, 13);
      } else if (currentLevel.hasLava) {
        // Bubbling Lava in gaps!
        const wave = Math.sin(game.frame * 0.1 + tx) * 4;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(gx, GROUND_Y + 22 + wave, T + 1, H - GROUND_Y);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(gx, GROUND_Y + 22 + wave, T + 1, 7);
      }
    }
  }

  function drawPipes() {
    for (const p of pipes) {
      if (p.x + p.w < game.cameraX - 60 || p.x > game.cameraX + W + 60) continue;

      // Draw Piranha Plant behind pipe lip
      if (p.hasPiranha && !p.piranhaDead && p.piranhaOffset > 2) {
        const px = p.x + p.w / 2;
        const py = p.y - p.piranhaOffset;

        // Stem
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(px - 6, py + 18, 12, p.piranhaOffset);

        // Head
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(px, py + 16, 18, 0, Math.PI * 2);
        ctx.fill();

        // White spots
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px - 7, py + 12, 4, 0, Math.PI * 2);
        ctx.arc(px + 8, py + 18, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Snapping jaw
        const mouthOpen = Math.abs(Math.sin(game.frame * 0.18)) * 0.45;
        ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.moveTo(px, py + 16);
        ctx.arc(px, py + 16, 18, -Math.PI / 2 - mouthOpen, -Math.PI / 2 + mouthOpen);
        ctx.closePath();
        ctx.fill();
      }

      // Pipe Body
      const grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
      grad.addColorStop(0, '#15803d');
      grad.addColorStop(0.3, '#4ade80');
      grad.addColorStop(0.7, '#22c55e');
      grad.addColorStop(1, '#14532d');

      ctx.fillStyle = grad;
      ctx.fillRect(p.x + 4, p.y + 22, p.w - 8, p.h - 22);
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x + 4, p.y + 22, p.w - 8, p.h - 22);

      // Pipe Top Rim
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, 24);
      ctx.strokeRect(p.x, p.y, p.w, 24);
    }
  }

  function drawPlatforms() {
    for (const pl of platforms) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);

      // Rivets
      ctx.fillStyle = '#fef3c7';
      for (let rx = pl.x + 10; rx < pl.x + pl.w - 6; rx += 22) {
        ctx.beginPath();
        ctx.arc(rx, pl.y + pl.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBlocks() {
    for (const b of blocks) {
      if (b.x + b.w < game.cameraX - 40 || b.x > game.cameraX + W + 40) continue;
      const by = b.y + b.bumpY;

      if (b.used) {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(b.x, by, b.w, b.h);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(b.x + 1, by + 1, b.w - 2, b.h - 2);
      } else if (b.type === 'question') {
        const pulse = Math.sin(game.frame * 0.12) * 15;
        ctx.fillStyle = `rgb(245, ${158 + pulse}, 11)`;
        ctx.fillRect(b.x, by, b.w, b.h);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x + 1.5, by + 1.5, b.w - 3, b.h - 3);

        // Corner bolts
        ctx.fillStyle = '#78350f';
        ctx.fillRect(b.x + 4, by + 4, 3, 3);
        ctx.fillRect(b.x + b.w - 7, by + 4, 3, 3);
        ctx.fillRect(b.x + 4, by + b.h - 7, 3, 3);
        ctx.fillRect(b.x + b.w - 7, by + b.h - 7, 3, 3);

        // Question mark
        ctx.fillStyle = '#fffbeb';
        ctx.font = 'bold 20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', b.x + b.w / 2 + 1, by + 28);
      } else if (b.type === 'brick') {
        ctx.fillStyle = currentLevel.brickColor;
        ctx.fillRect(b.x, by, b.w, b.h);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(b.x + 1, by + 1, b.w - 2, b.h - 2);
        // Mortar lines
        ctx.beginPath();
        ctx.moveTo(b.x, by + b.h / 2);
        ctx.lineTo(b.x + b.w, by + b.h / 2);
        ctx.moveTo(b.x + b.w / 2, by);
        ctx.lineTo(b.x + b.w / 2, by + b.h / 2);
        ctx.stroke();
      } else if (b.type === 'hard') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(b.x, by, b.w, b.h);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x + 1.5, by + 1.5, b.w - 3, b.h - 3);
        ctx.strokeRect(b.x + 7, by + 7, b.w - 14, b.h - 14);
      } else if (b.type === 'bridge') {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(b.x, by, b.w, 18);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, by, b.w, 18);
      }
    }
  }

  function drawCoinsAndItems() {
    // Floating Coins
    const spinWidth = Math.max(5, Math.abs(Math.cos(game.frame * 0.1)) * 18);
    for (const c of coins) {
      if (c.collected) continue;
      if (c.x < game.cameraX - 40 || c.x > game.cameraX + W + 40) continue;

      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2 + Math.sin(game.frame * 0.08 + c.x) * 3;

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(cx, cy, spinWidth / 2, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Power-Up Items
    for (const it of items) {
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;

      if (it.type === 'mega' || it.type === '1up') {
        // Glowing BITCOIN Coin that powers up character!
        ctx.save();
        ctx.translate(cx, cy);
        const btcPulse = Math.sin(game.frame * 0.12) * 2;
        
        // Outer glow
        ctx.shadowColor = it.type === '1up' ? '#4ade80' : '#f59e0b';
        ctx.shadowBlur = 10;

        // Gold coin base
        ctx.fillStyle = it.type === '1up' ? '#16a34a' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 15 + btcPulse * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner coin ring
        ctx.strokeStyle = it.type === '1up' ? '#bbf7d0' : '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Bitcoin Symbol ₿
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('₿', 0, 1);
        ctx.restore();
      } else if (it.type === 'fire') {
        // Golden Thumbs-Up Flower!
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(cx - 3, cy + 4, 6, 12);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👍', cx, cy + 4);
      } else if (it.type === 'star') {
        // VIP Rainbow Star
        ctx.fillStyle = `hsl(${(game.frame * 8) % 360}, 95%, 60%)`;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐', cx, cy + 6);
      }
    }
  }

  function drawEnemies() {
    for (const en of enemies) {
      if (en.x + en.w < game.cameraX - 60 || en.x > game.cameraX + W + 60) continue;

      ctx.save();
      const cx = en.x + en.w / 2;
      const cy = en.y + en.h / 2;

      // 1. SQUASHED STATE (After being stomped)
      if (en.state === 'squashed') {
        const sqImg = (en.type === 'koopa') ? imgs.enemy_egyptian_squashed : imgs.enemy_bandit_squashed;
        if (sqImg && sqImg.complete) {
          ctx.drawImage(sqImg, en.x - 10, en.y + en.h - 22, en.w + 20, 22);
        } else {
          ctx.translate(cx, en.y + en.h - 6);
          ctx.scale(1.3, 0.35);
          ctx.fillStyle = '#92400e';
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        continue;
      }

      // 2. ENEMY 1: LE BANDIT (Goomba / Para-Goomba)
      if (en.type === 'goomba' || en.type === 'paragoomba') {
        // Wings for Para-Goomba
        if (en.type === 'paragoomba') {
          const flap = Math.sin(game.frame * 0.28) * 8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(en.x - 8, en.y + 16 + flap, 12, 7, -0.4, 0, Math.PI * 2);
          ctx.ellipse(en.x + en.w + 8, en.y + 16 + flap, 12, 7, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw High-Res LE BANDIT Character!
        const bImg = imgs.enemy_bandit;
        if (bImg && bImg.complete) {
          const tilt = Math.sin(en.animPhase) * 0.05;
          ctx.translate(cx, en.y + en.h);
          ctx.rotate(tilt);
          // High-res, crisp display: 52px width x 64px height
          const bw = 52;
          const bh = 64;
          ctx.drawImage(bImg, -bw / 2, -bh, bw, bh);
        } else {
          ctx.fillStyle = '#b45309';
          ctx.fillRect(en.x, en.y, en.w, en.h);
        }
      } 
      // 3. ENEMY 2: EGYPTIAN BANDIT (Koopa)
      else if (en.type === 'koopa') {
        if (en.state === 'shell_idle' || en.state === 'shell_move') {
          // Flattened/rolling Egyptian Staff Shell
          const sqImg = imgs.enemy_egyptian_squashed;
          if (sqImg && sqImg.complete) {
            ctx.drawImage(sqImg, en.x - 8, en.y + en.h - 26, en.w + 16, 26);
          } else {
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(cx, en.y + 18, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        } else {
          // Walking Egyptian Pharaoh Bandit Monster
          const egImg = imgs.enemy_egyptian;
          if (egImg && egImg.complete) {
            const tilt = Math.sin(en.animPhase) * 0.05;
            ctx.translate(cx, en.y + en.h);
            ctx.scale(en.dir, 1);
            ctx.rotate(tilt);
            // High-res, crisp display: 54px width x 64px height
            const ew = 54;
            const eh = 64;
            ctx.drawImage(egImg, -ew / 2, -eh, ew, eh);
          } else {
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(en.x, en.y, en.w, en.h);
          }
        }
      }

      ctx.restore();
    }
  }

  function drawBoss() {
    ctx.save();
    if (boss.hurtTimer > 0 && boss.hurtTimer % 2 === 0) {
      ctx.filter = 'brightness(2.2)';
    }

    const bx = boss.x;
    const by = boss.y;

    // Spiky Shell
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(bx + 40, by + 44, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Body
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx + 12, by + 24, 44, 48);

    // Boss Head
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(bx + 22, by + 22, 24, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(bx + 14, by + 4);
    ctx.lineTo(bx + 6, by - 14);
    ctx.lineTo(bx + 24, by + 2);
    ctx.fill();

    // Glowing yellow eye
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bx + 8, by + 14, 9, 7);

    // Draw Golden VIP Axe at end of bridge
    if (!boss.axeTouched) {
      const ax = boss.axeX;
      const ay = boss.axeY;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(ax + 14, ay + 10, 8, 38);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(ax + 12, ay + 16, 16, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBossHud() {
    ctx.save();
    const barW = 280;
    const barH = 18;
    const bx = W / 2 - barW / 2;
    const by = 18;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(bx - 6, by - 22, barW + 12, barH + 30);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 6, by - 22, barW + 12, barH + 30);

    ctx.fillStyle = '#fca5a5';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('👑 MEGA HATER KIRÁLY (BOSS)', W / 2, by - 6);

    ctx.fillStyle = '#334155';
    ctx.fillRect(bx, by, barW, barH);
    const pct = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(bx, by, barW * pct, barH);
    ctx.restore();
  }

  function drawCastleAndFlagpole() {
    const fx = currentLevel.flagX * T + 18;
    const topY = 3 * T;

    // Flagpole Base
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(fx - 18, GROUND_Y - 36, 36, 36);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.strokeRect(fx - 18, GROUND_Y - 36, 36, 36);

    // Pole
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(fx - 4, topY, 8, GROUND_Y - topY - 36);

    // Golden Top Ball
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(fx, topY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Flag Banner
    const flagY = game.state === 'flagpole'
      ? Math.min(GROUND_Y - 85, topY + 12 + game.flagSlideTimer * 4)
      : topY + 12;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(fx + 4, flagY);
    ctx.lineTo(fx + 68, flagY + 22);
    ctx.lineTo(fx + 4, flagY + 44);
    ctx.closePath();
    ctx.fill();

    // Draw Big Head mini icon on the flag!
    if (imgs.head_icon && imgs.head_icon.complete) {
      ctx.drawImage(imgs.head_icon, fx + 12, flagY + 6, 26, 30);
    }

    // VIP Castle
    const cx = currentLevel.castleX * T;
    const cw = 160;
    const ch = 150;
    const cy = GROUND_Y - ch;

    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx, cy + 40, cw, ch - 40);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx, cy + 40, cw, ch - 40);

    // Upper tower
    ctx.fillStyle = '#92400e';
    ctx.fillRect(cx + 30, cy, cw - 60, 42);
    ctx.strokeRect(cx + 30, cy, cw - 60, 42);

    // Battlements
    for (let bx = cx; bx < cx + cw; bx += 32) {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(bx, cy + 26, 20, 16);
      ctx.strokeRect(bx, cy + 26, 20, 16);
    }

    // Castle Arch Door
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(cx + cw / 2, GROUND_Y - 34, 24, Math.PI, 0);
    ctx.lineTo(cx + cw / 2 + 24, GROUND_Y);
    ctx.lineTo(cx + cw / 2 - 24, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // VIP Sign
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VIP CLUB', cx + cw / 2, cy + 68);
  }

  // =========================================================================
  // ARTICULATED "BIG HEAD" PLAYER RENDERER
  // =========================================================================
  function drawPlayer() {
    if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 3) % 2 === 1) {
      return; // Blink when invulnerable
    }

    ctx.save();

    // Rainbow glow in Star mode or Golden glow in Fire/Thumbs-Up mode
    if (player.starTimer > 0) {
      ctx.shadowColor = `hsl(${(game.frame * 15) % 360}, 100%, 60%)`;
      ctx.shadowBlur = 18;
    } else if (player.power === 2) {
      ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
      ctx.shadowBlur = 12;
    }

    // Anchor at bottom-center of player hitbox
    const footX = player.x + player.w / 2;
    const footY = player.y + player.h;

    ctx.translate(footX, footY);
    ctx.scale(player.dir * player.scaleX, player.scaleY);

    // Map original 130x248 cutout sprite to player visual height
    const visualH = player.power === 0 ? 64 : 80;
    const s = visualH / 232; // Feet in cutout are around y=242, top of head y=10
    ctx.scale(s, s);

    // Translate so (64, 242) in the 130x248 cutout aligns with (0, 0) at the feet!
    ctx.translate(-64, -242);

    // Compute real-time limb angles
    const isMoving = Math.abs(player.vx) > 0.25;
    let leftLegRot = 0;
    let rightLegRot = 0;
    let torsoRot = 0;
    let headRot = 0;
    let headBobY = 0;

    if (!player.onGround) {
      // Dynamic Jump / Fall pose!
      leftLegRot = 0.34;
      rightLegRot = -0.42;
      torsoRot = -0.05;
      headRot = player.vy < 0 ? -0.12 : 0.08;
      headBobY = -2;
    } else if (isMoving) {
      // Running cycle
      const swing = Math.sin(player.walkPhase) * 0.44;
      leftLegRot = swing;
      rightLegRot = -swing;
      torsoRot = 0.06; // Lean forward into run
      headRot = Math.sin(player.walkPhase * 2) * 0.06;
      headBobY = Math.abs(Math.cos(player.walkPhase)) * 4;
    } else {
      // Idle breathing
      headRot = Math.sin(game.frame * 0.06) * 0.03;
      headBobY = Math.sin(game.frame * 0.06) * 1.8;
    }

    // Mega Big Head mode enlarges his head even more!
    const headExtraScale = player.power >= 1 ? 1.24 : 1.0;

    const hasParts = imgs.head && imgs.head.complete && imgs.torso && imgs.torso.complete &&
                     imgs.left_leg && imgs.left_leg.complete && imgs.right_leg && imgs.right_leg.complete;

    if (hasParts) {
      const drawPart = (img, px, py, rot, extraScale = 1, dy = 0) => {
        ctx.save();
        ctx.translate(px, py + dy);
        ctx.rotate(rot);
        ctx.scale(extraScale, extraScale);
        ctx.drawImage(img, -px, -py, 130, 248);
        ctx.restore();
      };

      // 1. Back/Right Leg (pivot at hip 78, 186)
      drawPart(imgs.right_leg, 78, 186, rightLegRot);

      // 2. Front/Left Leg (pivot at hip 46, 186)
      drawPart(imgs.left_leg, 46, 186, leftLegRot);

      // 3. Suit Torso & Thumbs-Up Hand (pivot at waist 62, 175)
      drawPart(imgs.torso, 62, 175, torsoRot);

      // In Lájk Király (Power 2) mode, draw a Golden VIP Tie accent on the torso!
      if (player.power === 2) {
        ctx.save();
        ctx.translate(62, 175);
        ctx.rotate(torsoRot);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(8, -56);
        ctx.lineTo(15, -24);
        ctx.lineTo(10, -14);
        ctx.lineTo(4, -24);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 4. Giant Smiling Head (pivot at neck 62, 114)
      ctx.save();
      ctx.translate(62, 114 + headBobY);
      ctx.rotate(headRot);
      ctx.scale(headExtraScale, headExtraScale);
      ctx.drawImage(imgs.head, -62, -114, 130, 248);

      // In Lájk Király (Power 2) mode, draw cool VIP Sunglasses on his face!
      if (player.power === 2) {
        ctx.fillStyle = '#090d16';
        // Bridge & frames aligned with his eyes in the 130x248 head image
        ctx.fillRect(-18, -58, 62, 5);
        ctx.fillRect(-12, -57, 24, 14);
        ctx.fillRect(18, -60, 22, 14);
        // White pixel shine on sunglasses
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-8, -54, 6, 3);
        ctx.fillRect(22, -57, 6, 3);
      }
      ctx.restore();
    } else if (imgs.character && imgs.character.complete) {
      ctx.drawImage(imgs.character, 0, 0, 130, 248);
    }

    ctx.restore();
  }

  function drawProjectiles() {
    for (const pr of projectiles) {
      ctx.save();
      ctx.translate(pr.x + pr.w / 2, pr.y + pr.h / 2);
      if (pr.friendly) {
        ctx.rotate(game.frame * 0.25);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👍', 0, 1);
      } else {
        // Boss Fireball
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(-2, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticlesAndPopups() {
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }

    for (const pp of popups) {
      const alpha = Math.min(1, pp.life / 18);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(pp.text, pp.x + 2, pp.y + 2);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, pp.x, pp.y);
      ctx.restore();
    }
  }

  // Leaderboard / Scoreboard Manager
  const Leaderboard = {
    STORAGE_KEY: 'sbhb_scoreboard_v1',
    getScores: function () {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) return JSON.parse(data);
      } catch (e) {}
      // Default initial champions if empty
      return [
        { name: 'BIG HEAD 👑', score: 14500, world: '1-3' },
        { name: 'LE BANDIT 🦝', score: 9800, world: '1-2' },
        { name: 'BITCOIN HODL ₿', score: 6200, world: '1-1' }
      ];
    },
    saveScore: function (name, score, world) {
      if (!name) name = 'JÁTÉKOS';
      const list = this.getScores();
      list.push({ name: name.toUpperCase().slice(0, 14), score, world });
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, 8);
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(top));
      } catch (e) {}
      return top;
    }
  };

  // =========================================================================
  // UI / HUD & OVERLAY CONTROLLERS
  // =========================================================================
  function updateHUD() {
    const scoreEl = document.getElementById('hudScore');
    const coinsEl = document.getElementById('hudCoins');
    const worldEl = document.getElementById('hudWorld');
    const timeEl = document.getElementById('hudTime');
    const livesEl = document.getElementById('hudLives');
    const badgeEl = document.getElementById('hudPowerBadge');

    if (scoreEl) scoreEl.textContent = String(game.score).padStart(6, '0');
    if (coinsEl) coinsEl.textContent = `🪙 x${String(game.coins).padStart(2, '0')}`;
    if (worldEl && currentLevel) worldEl.textContent = currentLevel.id;
    if (timeEl) timeEl.textContent = String(game.timeLeft).padStart(3, '0');
    if (livesEl) livesEl.textContent = `x${game.lives}`;

    if (badgeEl) {
      badgeEl.className = 'power-badge';
      if (player.starTimer > 0) {
        badgeEl.classList.add('star');
        badgeEl.textContent = '⭐ VIP CSILLAG (SEBEZHETETLEN)';
      } else if (player.power === 2) {
        badgeEl.classList.add('fire');
        badgeEl.textContent = '😎 LÁJK KIRÁLY (X / SHIFT = LÖVÉS)';
      } else if (player.power === 1) {
        badgeEl.classList.add('mega');
        badgeEl.textContent = '₿ BITCOIN POWER';
      } else {
        badgeEl.textContent = '👔 KICSI BIG HEAD';
      }
    }
  }

  function renderLeaderboardHTML() {
    const scores = Leaderboard.getScores();
    return `
      <div class="scoreboard-box">
        <h3 class="scoreboard-title">🏆 TOPLISTA / SCORE BOARD</h3>
        <table class="scoreboard-table">
          <thead>
            <tr><th>#</th><th>NÉV</th><th>VILÁG</th><th>PONT</th></tr>
          </thead>
          <tbody>
            ${scores.map((s, idx) => `
              <tr class="${idx === 0 ? 'top1' : ''}">
                <td>${idx + 1}.</td>
                <td>${s.name}</td>
                <td>${s.world || '1-1'}</td>
                <td class="gold">${s.score}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function showOverlay(mode, bonus = 0) {
    game.state = mode;
    const overlay = document.getElementById('gameOverlay');
    const badge = document.getElementById('overlayBadge');
    const title = document.getElementById('overlayTitle');
    const subtitle = document.getElementById('overlaySubtitle');
    const primaryBtn = document.getElementById('primaryActionBtn');

    if (!overlay) return;
    overlay.classList.remove('hidden');

    if (mode === 'title') {
      badge.textContent = 'MARIO KLASSZIKUS';
      title.textContent = 'GAJAR THE MINIBOSS';
      subtitle.innerHTML = `
        Kapd el a lebegő <b>Bitcoinokat</b> ₿, változz át <b>Lájk Királlyá</b> 😎, taposd le <b>Le Bandit</b> mérges fejeit 🦝 és mássz fel a toplista élére!
        ${renderLeaderboardHTML()}
      `;
      primaryBtn.textContent = '▶ ÚJ RANDOM PÁLYA INDÍTÁSA';
      primaryBtn.onclick = () => window.BigHeadGame.startRandomLevel();
    } else if (mode === 'paused') {
      badge.textContent = 'SZÜNET';
      title.textContent = 'JÁTÉK MEGÁLLÍTVA';
      subtitle.innerHTML = `Készen állsz a folytatásra?${renderLeaderboardHTML()}`;
      primaryBtn.textContent = '▶ FOLYTATÁS';
      primaryBtn.onclick = () => resumeGame();
    } else if (mode === 'levelclear') {
      badge.textContent = `PÁLYA TELJESÍTVE!`;
      title.textContent = 'SZÉP MUNKA, GAJAR!';
      subtitle.innerHTML = `Időbónusz: <b>+${bonus} pont</b> | Összpontszám: <b>${game.score}</b><br>Készülj fel a következő egyedi generált pályára!${renderLeaderboardHTML()}`;
      primaryBtn.textContent = '▶ KÖVETKEZŐ RANDOM PÁLYA';
      primaryBtn.onclick = () => window.BigHeadGame.startRandomLevel();
    } else if (mode === 'victory') {
      badge.textContent = '🏆 GYŐZELEM!';
      title.textContent = 'GAJAR THE MINIBOSS A BAJNOK!';
      const defaultName = localStorage.getItem('sbhb_last_name') || 'BIG HEAD';
      subtitle.innerHTML = `
        Legyőzted a Mega Hater Királyt és elfoglaltad a VIP Kastélyt!<br>
        Végső pontszám: <b style="color:#fbbf24">${game.score} pont</b>
        <div class="name-entry-box">
          <label>ÍRD BE A NEVED A TOPLISTÁHOZ:</label><br>
          <input type="text" id="playerNameInput" maxlength="12" value="${defaultName}" />
          <button id="saveScoreBtn" class="hud-btn" style="display:inline-block; margin-top:6px;">💾 MENTÉS A TOPLISTÁRA</button>
        </div>
        ${renderLeaderboardHTML()}
      `;
      setTimeout(() => {
        const saveBtn = document.getElementById('saveScoreBtn');
        const nameInp = document.getElementById('playerNameInput');
        if (saveBtn && nameInp) {
          saveBtn.onclick = () => {
            const n = nameInp.value.trim() || 'JÁTÉKOS';
            localStorage.setItem('sbhb_last_name', n);
            Leaderboard.saveScore(n, game.score, currentLevel ? currentLevel.id : '1-3');
            showOverlay('title');
          };
        }
      }, 50);

      primaryBtn.textContent = '🔄 ÚJ JÁTÉK INDÍTÁSA';
      primaryBtn.onclick = () => {
        game.score = 0;
        game.coins = 0;
        game.lives = 3;
        startGame(0, true);
      };
    } else if (mode === 'gameover') {
      badge.textContent = 'GAME OVER';
      title.textContent = 'ELFOGYOTT AZ ÉLETED!';
      const defaultName = localStorage.getItem('sbhb_last_name') || 'JÁTÉKOS';
      subtitle.innerHTML = `
        Elért pontszám: <b>${game.score}</b> (Világ: <b>${currentLevel ? currentLevel.id : '1-1'}</b>).
        <div class="name-entry-box">
          <label>ÍRD BE A NEVED A SCORE BOARDRA:</label><br>
          <input type="text" id="playerNameInput" maxlength="12" value="${defaultName}" />
          <button id="saveScoreBtn" class="hud-btn" style="display:inline-block; margin-top:6px;">💾 MENTÉS A TOPLISTÁRA</button>
        </div>
        ${renderLeaderboardHTML()}
      `;
      setTimeout(() => {
        const saveBtn = document.getElementById('saveScoreBtn');
        const nameInp = document.getElementById('playerNameInput');
        if (saveBtn && nameInp) {
          saveBtn.onclick = () => {
            const n = nameInp.value.trim() || 'JÁTÉKOS';
            localStorage.setItem('sbhb_last_name', n);
            Leaderboard.saveScore(n, game.score, currentLevel ? currentLevel.id : '1-1');
            showOverlay('title');
          };
        }
      }, 50);

      primaryBtn.textContent = '🔄 ÚJRAKEZDÉS';
      primaryBtn.onclick = () => {
        game.score = 0;
        game.coins = 0;
        game.lives = 3;
        startGame(game.levelIndex, true);
      };
    }
  }

  function startGame(lvlIdx = 0, resetPower = false) {
    const overlay = document.getElementById('gameOverlay');
    if (overlay) overlay.classList.add('hidden');
    window.soundFX.init();
    loadLevel(lvlIdx, resetPower);
    game.state = 'playing';
    window.soundFX.startMusic(currentLevel.theme);
  }

  function pauseGame() {
    window.soundFX.stopMusic();
    showOverlay('paused');
  }

  function resumeGame() {
    const overlay = document.getElementById('gameOverlay');
    if (overlay) overlay.classList.add('hidden');
    game.state = 'playing';
    window.soundFX.startMusic(player.starTimer > 0 ? 'star' : currentLevel.theme);
  }

  function toggleAudioMute() {
    const muted = window.soundFX.toggleMute();
    const btn = document.getElementById('muteBtn');
    if (btn) btn.textContent = muted ? '🔇 Hang: KI' : '🔊 Hang: BE';
  }

  // Expose UI helpers globally for HUD buttons
  window.BigHeadGame = {
    startRandomLevel: () => {
      if (game.lives <= 0) {
        game.lives = 3;
        game.score = 0;
      }
      const seed = Math.floor(Math.random() * 900000) + 100000;
      const rndLevel = window.generateRandomLevel(seed);
      window.GAME_LEVELS = [rndLevel];
      startGame(0, false);
    },
    toggleScoreboard: () => {
      // Toggle showing scoreboard in overlay
      if (game.state === 'playing') {
        pauseGame();
      } else if (game.state === 'paused') {
        resumeGame();
      } else {
        showOverlay('title');
      }
    },
    toggleMute: toggleAudioMute,
    toggleTouchControls: () => {
      const tc = document.getElementById('touchControls');
      if (tc) tc.classList.toggle('visible');
    },
    toggleFullscreen: () => {
      const wrap = document.getElementById('app-wrapper');
      if (!document.fullscreenElement) {
        (wrap || document.documentElement).requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Initialize Level 1-1 in background for Title Screen preview & start 60 FPS loop
  loadLevel(0, true);
  showOverlay('title');

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
