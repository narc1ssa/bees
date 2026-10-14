(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // UI Elements
  const cellsCountEl = document.getElementById('cells-count');
  const miniCombGridEl = document.getElementById('mini-comb-grid');
  const jarsCountEl = document.getElementById('jars-count');
  const jarsShelfEl = document.getElementById('jars-shelf');
  const livesHeartsEl = document.getElementById('lives-hearts');
  const statusHintEl = document.getElementById('status-hint');

  const startOverlay = document.getElementById('start-overlay');
  const rewardOverlay = document.getElementById('reward-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const rewardTextEl = document.getElementById('reward-text');
  const gameoverStatsEl = document.getElementById('gameover-stats');

  const btnStartGame = document.getElementById('btn-start-game');
  const btnContinueGame = document.getElementById('btn-continue-game');
  const btnRetryGame = document.getElementById('btn-retry-game');
  const btnDemoCat = document.getElementById('btn-demo-cat');
  const btnSound = document.getElementById('btn-sound');
  const btnRestart = document.getElementById('btn-restart');

  const TOTAL_CELLS = 16;
  const MAX_LIVES = 3;

  // Build 16 mini honeycomb cells in the top HUD
  const miniCells = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cell = document.createElement('div');
    cell.className = 'mini-cell';
    miniCombGridEl.appendChild(cell);
    miniCells.push(cell);
  }

  // Load all pixel-art sprites extracted from map.png & jar.png
  const sprites = {
    bg: new Image(),
    cat: new Image(),
    jar: new Image(),
    beeR1: new Image(),
    beeR2: new Image(),
    beeL1: new Image(),
    beeL2: new Image(),
    bkBody: new Image(),
    bkEmpty: new Image(),
    bkJar: new Image(),
    frameOnly16: new Image(),
    frames: []
  };

  sprites.bg.src = 'assets/bg.png';
  sprites.cat.src = 'assets/cat.png';
  sprites.jar.src = 'assets/jar.png';
  sprites.beeR1.src = 'assets/bee_right_1.png';
  sprites.beeR2.src = 'assets/bee_right_2.png';
  sprites.beeL1.src = 'assets/bee_left_1.png';
  sprites.beeL2.src = 'assets/bee_left_2.png';
  sprites.bkBody.src = 'assets/beekeeper_body.png';
  sprites.bkEmpty.src = 'assets/beekeeper_empty.png';
  sprites.bkJar.src = 'assets/beekeeper_jar.png';
  sprites.frameOnly16.src = 'assets/frame_only_16.png';

  for (let i = 0; i <= TOTAL_CELLS; i++) {
    const img = new Image();
    img.src = `assets/frame_${i}.png`;
    sprites.frames.push(img);
  }

  // Retro Web Audio Synthesizer ("Электроника ИМ-02" style beeps & fanfare)
  let soundEnabled = true;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function playTone(freq, duration = 0.08, type = 'square', gainVal = 0.06, delay = 0) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (_) {}
  }

  function sfxStep(track) {
    const freqs = [310, 260, 350, 285];
    playTone(freqs[track % 4], 0.035, 'square', 0.025);
  }

  function sfxCatch(cellIndex) {
    const base = 520 + cellIndex * 28;
    playTone(base, 0.07, 'triangle', 0.08, 0);
    playTone(base * 1.25, 0.11, 'triangle', 0.08, 0.055);
  }

  function sfxMiss() {
    playTone(190, 0.14, 'sawtooth', 0.07, 0);
    playTone(135, 0.22, 'sawtooth', 0.07, 0.12);
  }

  function sfxCatAppear() {
    // Cute rising meow + victory jingle
    const notes = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    notes.forEach((n, idx) => {
      playTone(n, 0.14, 'triangle', 0.08, idx * 0.11);
    });
  }

  function sfxJarGiven() {
    const notes = [587.33, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((n, idx) => {
      playTone(n, 0.16, 'sine', 0.09, idx * 0.09);
    });
  }

  // The 4 Beehive Tracks (matching exact coordinates on assets/bg.png 1672x941)
  // 0: Верхний левый (Top-Left)
  // 1: Нижний левый (Bottom-Left)
  // 2: Верхний правый (Top-Right)
  // 3: Нижний правый (Bottom-Right)
  const TRACKS = [
    {
      id: 0,
      name: 'Верхний левый улей',
      side: 'left',
      level: 'top',
      waypoints: [
        { x: 266, y: 334 },
        { x: 334, y: 386 },
        { x: 396, y: 444 },
        { x: 472, y: 502 },
        { x: 545, y: 545 } // Frame catch point
      ],
      catchBox: { x: 535, y: 545 }
    },
    {
      id: 1,
      name: 'Нижний левый улей',
      side: 'left',
      level: 'bottom',
      waypoints: [
        { x: 218, y: 656 },
        { x: 288, y: 676 },
        { x: 365, y: 696 },
        { x: 452, y: 714 },
        { x: 548, y: 678 } // Frame catch point
      ],
      catchBox: { x: 548, y: 672 }
    },
    {
      id: 2,
      name: 'Верхний правый улей',
      side: 'right',
      level: 'top',
      waypoints: [
        { x: 1384, y: 438 },
        { x: 1308, y: 468 },
        { x: 1218, y: 504 },
        { x: 1125, y: 538 },
        { x: 1015, y: 555 } // Frame catch point
      ],
      catchBox: { x: 1020, y: 552 }
    },
    {
      id: 3,
      name: 'Нижний правый улей',
      side: 'right',
      level: 'bottom',
      waypoints: [
        { x: 1378, y: 762 },
        { x: 1296, y: 752 },
        { x: 1208, y: 748 },
        { x: 1118, y: 742 },
        { x: 1012, y: 685 } // Frame catch point
      ],
      catchBox: { x: 1012, y: 680 }
    }
  ];

  // Game State
  const state = {
    mode: 'playing', // 'start' | 'playing' | 'cat_cutscene' | 'reward_modal' | 'gameover'
    score: 0,
    filledCells: 0,
    jarsCollected: 0,
    lives: MAX_LIVES,
    quadrant: 1, // 0: TL, 1: BL, 2: TR, 3: BR
    mouseX: 590,
    mouseY: 680,
    mouseActive: false,
    // Smoothly interpolated beekeeper & frame transforms
    bkX: 705,
    bkY: 655,
    facing: 'left', // 'left' | 'right'
    frameOffsetX: 0,
    frameOffsetY: 0,
    frameAngle: 0,
    currentFrameWorldX: 555,
    currentFrameWorldY: 670,
    // Bees & Particles
    bees: [],
    particles: [],
    floatingTexts: [],
    spawnTimer: 0.6,
    spawnInterval: 1.35,
    beeSpeed: 0.44, // progress (0..1) per second
    // Cat Cutscene State
    catCutscene: {
      active: false,
      timer: 0,
      duration: 4.5,
      phase: 0, // 0: cat jumps in, 1: cat takes frame, 2: cat gives jar
      catX: 405,
      catY: 250
    }
  };

  function updateHUD() {
    cellsCountEl.textContent = `${state.filledCells} / ${TOTAL_CELLS}`;
    miniCells.forEach((c, idx) => {
      c.classList.toggle('filled', idx < state.filledCells);
    });
    jarsCountEl.textContent = `${state.jarsCollected}`;
    livesHeartsEl.textContent =
      '❤️'.repeat(Math.max(0, state.lives)) +
      '🖤'.repeat(Math.max(0, MAX_LIVES - state.lives));
  }

  function addJarToShelf() {
    const thumb = document.createElement('img');
    thumb.src = 'assets/jar.png';
    thumb.alt = 'Мёд';
    thumb.className = 'mini-jar-thumb';
    jarsShelfEl.appendChild(thumb);
  }

  function clearShelfThumbs() {
    const thumbs = jarsShelfEl.querySelectorAll('.mini-jar-thumb');
    thumbs.forEach((t) => t.remove());
  }

  function setQuadrant(q) {
    state.quadrant = q;
    state.facing = q === 0 || q === 1 ? 'left' : 'right';
    const names = [
      '↖ Верхний левый улей',
      '↙ Нижний левый улей',
      '↗ Верхний правый улей',
      '↘ Нижний правый улей'
    ];
    if (state.mode === 'playing') {
      statusHintEl.textContent = `Рамка направлена: ${names[q]} • Сот заполнено: ${state.filledCells}/${TOTAL_CELLS}`;
    }
  }

  // Convert mouse client coordinates to internal 1672x941 canvas coordinates
  function handlePointerMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    state.mouseX = Math.max(0, Math.min(canvas.width, x));
    state.mouseY = Math.max(0, Math.min(canvas.height, y));
    state.mouseActive = true;

    if (state.mode !== 'playing') return;

    // Determine quadrant relative to beekeeper center (x=780, y=595)
    const isRight = state.mouseX >= 780;
    const isBottom = state.mouseY >= 595;
    let q = 0;
    if (!isRight && !isBottom) q = 0; // Top-Left
    else if (!isRight && isBottom) q = 1; // Bottom-Left
    else if (isRight && !isBottom) q = 2; // Top-Right
    else q = 3; // Bottom-Right

    setQuadrant(q);
  }

  window.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  canvas.addEventListener('mousedown', (e) => {
    ensureAudio();
    handlePointerMove(e.clientX, e.clientY);
  });

  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    'touchstart',
    (e) => {
      ensureAudio();
      if (e.touches && e.touches[0]) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );

  // Keyboard support (Q/A/P/L, WASD, Arrows, C for cat demo)
  window.addEventListener('keydown', (e) => {
    ensureAudio();
    const key = e.key.toLowerCase();
    if (key === 'q' || key === 'й' || key === 'numpad7') {
      state.mouseActive = false;
      setQuadrant(0);
    } else if (key === 'a' || key === 'ф' || key === 'numpad1') {
      state.mouseActive = false;
      setQuadrant(1);
    } else if (key === 'p' || key === 'з' || key === 'e' || key === 'у' || key === 'numpad9') {
      state.mouseActive = false;
      setQuadrant(2);
    } else if (key === 'l' || key === 'д' || key === 'd' || key === 'в' || key === 'numpad3') {
      state.mouseActive = false;
      setQuadrant(3);
    } else if (e.key === 'ArrowLeft') {
      state.mouseActive = false;
      setQuadrant(state.quadrant === 2 ? 0 : state.quadrant === 3 ? 1 : state.quadrant);
    } else if (e.key === 'ArrowRight') {
      state.mouseActive = false;
      setQuadrant(state.quadrant === 0 ? 2 : state.quadrant === 1 ? 3 : state.quadrant);
    } else if (e.key === 'ArrowUp') {
      state.mouseActive = false;
      setQuadrant(state.quadrant === 1 ? 0 : state.quadrant === 3 ? 2 : state.quadrant);
    } else if (e.key === 'ArrowDown') {
      state.mouseActive = false;
      setQuadrant(state.quadrant === 0 ? 1 : state.quadrant === 2 ? 3 : state.quadrant);
    }
  });

  // Spawn a bee on one of the 4 tracks
  function spawnBee(forcedTrack = null) {
    let trackId =
      forcedTrack !== null ? forcedTrack : Math.floor(Math.random() * 4);
    // Avoid spawning two bees right on top of each other on the same track
    const busy = state.bees.some((b) => b.track === trackId && b.progress < 0.32);
    if (busy && forcedTrack === null) {
      trackId = (trackId + 1) % 4;
    }

    state.bees.push({
      track: trackId,
      progress: 0, // 0.0 -> 1.0 along the 5 waypoints
      lastStepIndex: 0,
      wobbleSeed: Math.random() * Math.PI * 2,
      flapTimer: 0,
      flapFrame: 0,
      x: TRACKS[trackId].waypoints[0].x,
      y: TRACKS[trackId].waypoints[0].y
    });
  }

  function getPointOnTrack(trackId, progress) {
    const pts = TRACKS[trackId].waypoints;
    const totalSegments = pts.length - 1;
    const clamped = Math.max(0, Math.min(0.9999, progress));
    const exactSeg = clamped * totalSegments;
    const segIdx = Math.floor(exactSeg);
    const localT = exactSeg - segIdx;
    const p0 = pts[segIdx];
    const p1 = pts[segIdx + 1];
    return {
      x: p0.x + (p1.x - p0.x) * localT,
      y: p0.y + (p1.y - p0.y) * localT,
      stepIdx: segIdx
    };
  }

  function spawnHoneyBurst(x, y, color = '#ffca28', count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 90 + Math.random() * 190;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        size: 5 + Math.floor(Math.random() * 6),
        color: i % 2 === 0 ? color : '#fff59d',
        alpha: 1,
        life: 0.55 + Math.random() * 0.35
      });
    }
  }

  function addFloatingText(text, x, y, color = '#ffe57f') {
    state.floatingTexts.push({
      text,
      x,
      y,
      vy: -65,
      alpha: 1,
      life: 1.0,
      color
    });
  }

  // Trigger the Cat Cutscene when all 16 honeycomb cells are filled!
  function startCatCutscene() {
    state.mode = 'cat_cutscene';
    state.bees = []; // Clear remaining flying bees so cutscene is uninterrupted
    state.catCutscene.active = true;
    state.catCutscene.timer = 0;
    state.catCutscene.phase = 0;
    state.catCutscene.catX = 405;
    state.catCutscene.catY = 250;
    statusHintEl.textContent =
      '🐱 Все 16 сот заполнены! Кот спешит забрать медовую рамку и дать банку мёда!';
    sfxCatAppear();
    spawnHoneyBurst(state.currentFrameWorldX, state.currentFrameWorldY, '#ffd54f', 28);
  }

  // Called when a bee is caught in the honeycomb frame
  function catchBee(bee) {
    state.score += 1;
    state.filledCells = Math.min(TOTAL_CELLS, state.filledCells + 1);
    sfxCatch(state.filledCells);
    updateHUD();

    spawnHoneyBurst(bee.x, bee.y, '#ffbf1f', 16);
    addFloatingText(
      `+1 СОТА (${state.filledCells}/${TOTAL_CELLS})`,
      bee.x,
      bee.y - 28,
      '#ffe57f'
    );

    if (state.filledCells >= TOTAL_CELLS) {
      startCatCutscene();
    }
  }

  // Called when a bee is missed
  function missBee(bee) {
    state.lives -= 1;
    sfxMiss();
    updateHUD();
    spawnHoneyBurst(bee.x, bee.y, '#ef4444', 12);
    addFloatingText('УЛЕТЕЛА! -1 ❤️', bee.x, bee.y - 20, '#fca5a5');

    if (state.lives <= 0) {
      state.mode = 'gameover';
      gameoverStatsEl.textContent = `Поймано пчёл: ${state.score} • Собрано банок мёда: ${state.jarsCollected}`;
      gameoverOverlay.classList.remove('hidden');
    }
  }

  function updateGame(dt) {
    // Update particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt; // gravity
      p.life -= dt;
      p.alpha = Math.max(0, p.life * 1.6);
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life);
      if (ft.life <= 0) state.floatingTexts.splice(i, 1);
    }

    // Smoothly interpolate Beekeeper & Frame position toward active quadrant + mouse
    const targetSide = state.quadrant === 0 || state.quadrant === 1 ? 'left' : 'right';
    const targetTop = state.quadrant === 0 || state.quadrant === 2;

    state.facing = targetSide;

    // Beekeeper center X shifts slightly toward the active side
    const targetBkX =
      state.mode === 'cat_cutscene'
        ? 745
        : targetSide === 'left'
        ? 710
        : 830;
    state.bkX += (targetBkX - state.bkX) * Math.min(1, dt * 12);

    // Frame offset & angle relative to Beekeeper sprite
    let targetOffsetX = 0;
    let targetOffsetY = targetTop ? -115 : 8;
    let targetAngle = targetTop ? -0.25 : 0.04;

    // Add subtle direct mouse tracking so moving the mouse directly moves the frame smoothly
    if (state.mouseActive && state.mode === 'playing') {
      const catchRef = TRACKS[state.quadrant].catchBox;
      const dxMouse = Math.max(-55, Math.min(55, (state.mouseX - catchRef.x) * 0.25));
      const dyMouse = Math.max(-45, Math.min(45, (state.mouseY - catchRef.y) * 0.25));
      targetOffsetX += targetSide === 'left' ? dxMouse : -dxMouse;
      targetOffsetY += dyMouse;
    }

    state.frameOffsetX += (targetOffsetX - state.frameOffsetX) * Math.min(1, dt * 15);
    state.frameOffsetY += (targetOffsetY - state.frameOffsetY) * Math.min(1, dt * 15);
    state.frameAngle += (targetAngle - state.frameAngle) * Math.min(1, dt * 15);

    // Calculate current world position of the Honeycomb Frame center
    const localFrameCenterX = 135 + state.frameOffsetX;
    const localFrameCenterY = 252 + state.frameOffsetY;
    if (state.facing === 'left') {
      state.currentFrameWorldX = state.bkX - 165 + localFrameCenterX;
    } else {
      state.currentFrameWorldX = state.bkX + 165 - localFrameCenterX;
    }
    state.currentFrameWorldY = 395 + localFrameCenterY;

    // Handle Cat Cutscene
    if (state.mode === 'cat_cutscene') {
      state.facing = 'left'; // Face the cat on the left
      state.catCutscene.timer += dt;
      const t = state.catCutscene.timer;

      if (t < 1.2) {
        state.catCutscene.phase = 0; // Cat jumps down from top-left bush (405,250) to (520,685)
        const u = Math.min(1, t / 1.1);
        const ease = 1 - Math.pow(1 - u, 3);
        state.catCutscene.catX = 405 + (520 - 405) * ease;
        state.catCutscene.catY =
          250 + (685 - 250) * ease - Math.sin(u * Math.PI) * 95;
      } else if (t < 2.6) {
        if (state.catCutscene.phase === 0) {
          state.catCutscene.phase = 1; // Cat takes the filled frame
          addFloatingText('Кот забирает рамку с сотами!', 650, 490, '#fde047');
          playTone(660, 0.12, 'triangle', 0.08);
        }
        state.catCutscene.catX = 520;
        state.catCutscene.catY = 685;
      } else if (t < 4.4) {
        if (state.catCutscene.phase === 1) {
          state.catCutscene.phase = 2; // Cat gives the Honey Jar (jar.png)
          state.jarsCollected += 1;
          addJarToShelf();
          updateHUD();
          sfxJarGiven();
          spawnHoneyBurst(700, 620, '#ffca28', 32);
          addFloatingText('Взамен кот дал МЁД В БАНКЕ! 🍯', 700, 450, '#fff59d');
        }
      } else {
        // Cutscene finished -> show reward modal (player can click to continue with a new frame)
        state.mode = 'reward_modal';
        rewardTextEl.textContent = `Кот забрал заполненную медовую рамку (16/16 сот) и дал пчеловоду банку мёда №${state.jarsCollected}!`;
        rewardOverlay.classList.remove('hidden');
      }
      return;
    }

    if (state.mode !== 'playing') return;

    // Spawn bees periodically
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnBee();
      // Gently increase pace as more bees/jars are collected
      const speedFactor = Math.min(0.45, state.jarsCollected * 0.08 + state.score * 0.008);
      state.spawnInterval = Math.max(0.75, 1.32 - speedFactor);
      state.beeSpeed = Math.min(0.72, 0.44 + speedFactor * 0.35);
      state.spawnTimer = state.spawnInterval;
    }

    // Update active bees
    for (let i = state.bees.length - 1; i >= 0; i--) {
      const bee = state.bees[i];
      bee.progress += state.beeSpeed * dt;
      bee.flapTimer += dt;
      if (bee.flapTimer >= 0.065) {
        bee.flapTimer = 0;
        bee.flapFrame = 1 - bee.flapFrame;
      }

      const pt = getPointOnTrack(bee.track, bee.progress);
      const bob = Math.sin(bee.progress * 14 + bee.wobbleSeed) * 6;
      bee.x = pt.x;
      bee.y = pt.y + bob;

      if (pt.stepIdx !== bee.lastStepIndex) {
        bee.lastStepIndex = pt.stepIdx;
        sfxStep(bee.track);
      }

      // Check if bee is caught by the honeycomb frame!
      const distToFrame = Math.hypot(
        bee.x - state.currentFrameWorldX,
        bee.y - state.currentFrameWorldY
      );

      // Catch if bee is in catch zone and player is guarding this quadrant OR frame directly touches bee
      if (
        (bee.progress >= 0.78 && state.quadrant === bee.track) ||
        (bee.progress >= 0.62 && distToFrame < 115)
      ) {
        catchBee(bee);
        state.bees.splice(i, 1);
        continue;
      }

      // Missed bee if it goes past the end of the track (1.03)
      if (bee.progress >= 1.03) {
        missBee(bee);
        state.bees.splice(i, 1);
      }
    }
  }

  // Draw authentic pixel-art 7-segment golden digits right above "ТЫСЯЧ" (x=955, y=62)
  const SEGMENT_MAP = {
    '0': [1, 1, 1, 0, 1, 1, 1],
    '1': [0, 0, 1, 0, 0, 1, 0],
    '2': [1, 0, 1, 1, 1, 0, 1],
    '3': [1, 0, 1, 1, 0, 1, 1],
    '4': [0, 1, 1, 1, 0, 1, 0],
    '5': [1, 1, 0, 1, 0, 1, 1],
    '6': [1, 1, 0, 1, 1, 1, 1],
    '7': [1, 0, 1, 0, 0, 1, 0],
    '8': [1, 1, 1, 1, 1, 1, 1],
    '9': [1, 1, 1, 1, 0, 1, 1]
  };

  function drawPixelSegment(x, y, w, h, lit) {
    ctx.save();
    if (!lit) {
      ctx.fillStyle = 'rgba(10, 42, 78, 0.22)';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      return;
    }
    // Outer black pixel border
    ctx.fillStyle = '#1b0f04';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    // Dark amber bottom shadow
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x, y, w, h);
    // Main golden honey fill
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 3, y + 3, w - 6, h - 7);
    // Bright pixel highlight
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 5, y + 5, Math.max(4, w - 14), Math.max(4, Math.floor((h - 10) * 0.45)));
    ctx.restore();
  }

  function drawScoreboard(scoreVal) {
    const str = String(Math.min(9999, scoreVal)).padStart(4, '0');
    const startX = 958;
    const startY = 64;
    const digitW = 74;
    const digitH = 140;
    const thick = 20;
    const gap = 88;

    for (let i = 0; i < 4; i++) {
      const segs = SEGMENT_MAP[str[i]] || SEGMENT_MAP['0'];
      const dx = startX + i * gap;
      const dy = startY;
      const halfH = Math.floor(digitH / 2);

      // 0: Top horizontal
      drawPixelSegment(dx + 10, dy, digitW - 20, thick, segs[0]);
      // 1: Top-left vertical
      drawPixelSegment(dx, dy + 12, thick, halfH - 16, segs[1]);
      // 2: Top-right vertical
      drawPixelSegment(dx + digitW - thick, dy + 12, thick, halfH - 16, segs[2]);
      // 3: Middle horizontal
      drawPixelSegment(dx + 10, dy + halfH - Math.floor(thick / 2), digitW - 20, thick, segs[3]);
      // 4: Bottom-left vertical
      drawPixelSegment(dx, dy + halfH + 4, thick, halfH - 16, segs[4]);
      // 5: Bottom-right vertical
      drawPixelSegment(dx + digitW - thick, dy + halfH + 4, thick, halfH - 16, segs[5]);
      // 6: Bottom horizontal
      drawPixelSegment(dx + 10, dy + digitH - thick, digitW - 20, thick, segs[6]);
    }
  }

  // Draw subtle LCD-style track guides & active catch indicator
  function drawTrackGuides() {
    TRACKS.forEach((tr) => {
      const isSelected = state.quadrant === tr.id && state.mode === 'playing';

      // Draw subtle waypoint dots along each bee trajectory
      for (let i = 0; i < tr.waypoints.length - 1; i++) {
        const wp = tr.waypoints[i];
        ctx.save();
        ctx.fillStyle = isSelected
          ? 'rgba(255, 230, 100, 0.45)'
          : 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw target catch ring at the end of the active track
      if (isSelected) {
        const cb = tr.catchBox;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 235, 110, 0.75)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(cb.x, cb.y, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawBeekeeperAndCat() {
    // 1. If in Cat Cutscene or Reward Modal, render the special Cat + Frame + Honey Jar exchange!
    if (state.mode === 'cat_cutscene' || state.mode === 'reward_modal') {
      const t = state.catCutscene.timer;
      const phase = state.catCutscene.phase;
      const bkDrawX = Math.round(state.bkX - 165);
      const bkDrawY = 395;

      if (phase === 0) {
        // Beekeeper holds the completely full 16/16 frame while Cat jumps down from the bush!
        if (sprites.bkBody.complete) {
          ctx.drawImage(sprites.bkBody, bkDrawX, bkDrawY);
        }
        const fullFrame = sprites.frames[TOTAL_CELLS];
        if (fullFrame && fullFrame.complete) {
          ctx.drawImage(fullFrame, bkDrawX, bkDrawY);
        }
      } else if (phase === 1) {
        // Cat takes the filled honeycomb frame from the beekeeper!
        if (sprites.bkEmpty.complete) {
          ctx.drawImage(sprites.bkEmpty, bkDrawX, bkDrawY);
        }
        const u = Math.min(1, (t - 1.2) / 1.2);
        const frameX = bkDrawX + (440 - bkDrawX) * u;
        const frameY = bkDrawY + (520 - bkDrawY) * u - Math.sin(u * Math.PI) * 35;
        if (sprites.frameOnly16.complete) {
          ctx.drawImage(sprites.frameOnly16, frameX, frameY);
        }
      } else {
        // Phase 2: Cat gives the Honey Jar (jar.png) to the Beekeeper!
        const u = Math.min(1, (t - 2.6) / 0.9);
        if (u < 0.65) {
          if (sprites.bkEmpty.complete) {
            ctx.drawImage(sprites.bkEmpty, bkDrawX, bkDrawY);
          }
          // Jar flies from Cat (520, 650) into Beekeeper's hands (bkDrawX + 58, bkDrawY + 168)
          const p = u / 0.65;
          const jx = 500 + (bkDrawX + 58 - 500) * p;
          const jy = 620 + (bkDrawY + 168 - 620) * p - Math.sin(p * Math.PI) * 45;
          if (sprites.jar.complete) {
            ctx.drawImage(sprites.jar, jx, jy, 165, 180);
          }
        } else {
          // Beekeeper holds the Honey Jar (jar.png) in his gloved hands!
          if (sprites.bkJar.complete) {
            ctx.drawImage(sprites.bkJar, bkDrawX, bkDrawY);
          }
        }

        // Cat sits proudly next to the filled honeycomb frame it took
        if (sprites.frameOnly16.complete) {
          ctx.drawImage(sprites.frameOnly16, 365, 535, 250, 390);
        }
      }

      // Draw the Cat sprite
      if (sprites.cat.complete) {
        ctx.drawImage(
          sprites.cat,
          Math.round(state.catCutscene.catX - 107),
          Math.round(state.catCutscene.catY - 118)
        );
      }

      // Draw speech bubble above Cat/Beekeeper during cutscene
      drawCutsceneBanner(phase);
      return;
    }

    // 2. Normal Gameplay: Draw Beekeeper facing Left or Right + Honeycomb Frame at active height/angle
    ctx.save();
    ctx.translate(Math.round(state.bkX), 395);
    if (state.facing === 'right') {
      ctx.scale(-1, 1);
    }

    // Draw Beekeeper Body
    if (sprites.bkBody.complete) {
      ctx.drawImage(sprites.bkBody, -165, 0);
    }

    // Draw Honeycomb Frame + Gloved Hands with current number of filled cells (0..16)
    const frameSprite =
      sprites.frames[Math.min(TOTAL_CELLS, state.filledCells)] || sprites.frames[0];
    if (frameSprite && frameSprite.complete) {
      ctx.save();
      // Pivot around center of frame (140, 250) in bk sprite space
      ctx.translate(
        -165 + 140 + state.frameOffsetX,
        250 + state.frameOffsetY
      );
      ctx.rotate(state.frameAngle);
      ctx.drawImage(frameSprite, -140, -250);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawCutsceneBanner(phase) {
    const messages = [
      '🐱 Все соты заполнены! Появляется кот!',
      '🐾 Кот забирает медовую рамку у пчеловода...',
      '🍯 Взамен кот даёт пчеловоду МЁД В БАНКЕ!'
    ];
    const msg = messages[phase] || messages[2];

    ctx.save();
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    const textW = ctx.measureText(msg).width;
    const boxW = textW + 48;
    const boxH = 54;
    const bx = (canvas.width - boxW) / 2;
    const by = 285;

    ctx.fillStyle = 'rgba(24, 38, 16, 0.92)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, canvas.width / 2, by + boxH / 2);
    ctx.restore();
  }

  function drawBees() {
    state.bees.forEach((bee) => {
      const isLeftTrack = bee.track === 0 || bee.track === 1;
      const sprite = isLeftTrack
        ? bee.flapFrame === 0
          ? sprites.beeR1
          : sprites.beeR2
        : bee.flapFrame === 0
        ? sprites.beeL1
        : sprites.beeL2;

      if (sprite && sprite.complete) {
        ctx.drawImage(
          sprite,
          Math.round(bee.x - sprite.width / 2),
          Math.round(bee.y - sprite.height / 2)
        );
      }
    });
  }

  function drawParticlesAndText() {
    // Particles
    state.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
      ctx.strokeStyle = '#1b0f04';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
      ctx.restore();
    });

    // Floating texts
    state.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = '900 24px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#1a0f02';
      ctx.lineWidth = 5;
      ctx.strokeText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.restore();
    });
  }

  // Draw collected Honey Jars on the ground next to the Beekeeper as well!
  function drawGroundJars() {
    if (!sprites.jar.complete || state.jarsCollected <= 0) return;
    const maxVisible = Math.min(6, state.jarsCollected);
    for (let i = 0; i < maxVisible; i++) {
      const jx = 895 + i * 54;
      const jy = 835 + (i % 2) * 8;
      ctx.drawImage(sprites.jar, jx, jy, 64, 70);
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Clean Pixel-Art Background (assets/bg.png)
    if (sprites.bg.complete) {
      ctx.drawImage(sprites.bg, 0, 0, canvas.width, canvas.height);
    }

    // 2. Dynamic Golden 7-Segment Scoreboard above "ТЫСЯЧ"
    drawScoreboard(state.score);

    // 3. Track Guides & Catch Zone Indicator
    drawTrackGuides();

    // 4. Collected Honey Jars standing on the path
    drawGroundJars();

    // 5. Beekeeper, Honeycomb Frame (with 0..16 filled cells), Cat, and Jar Exchange
    drawBeekeeperAndCat();

    // 6. Flying Bees from the 4 Beehives
    drawBees();

    // 7. Honey Droplet Particles & Floating Labels
    drawParticlesAndText();
  }

  // Main Animation Loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    updateGame(dt);
    render();
    requestAnimationFrame(loop);
  }

  // Controls & Buttons
  function resetFullGame() {
    state.score = 0;
    state.filledCells = 0;
    state.jarsCollected = 0;
    state.lives = MAX_LIVES;
    state.bees = [];
    state.particles = [];
    state.floatingTexts = [];
    state.spawnTimer = 0.5;
    state.mode = 'playing';
    clearShelfThumbs();
    updateHUD();
    startOverlay.classList.add('hidden');
    rewardOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    setQuadrant(1);
    spawnBee(1);
  }

  btnStartGame.addEventListener('click', () => {
    ensureAudio();
    startOverlay.classList.add('hidden');
    state.mode = 'playing';
    if (state.bees.length === 0) {
      spawnBee(1);
    }
  });

  btnContinueGame.addEventListener('click', () => {
    ensureAudio();
    rewardOverlay.classList.add('hidden');
    state.filledCells = 0; // Fresh empty honeycomb frame!
    state.mode = 'playing';
    state.spawnTimer = 0.5;
    updateHUD();
    setQuadrant(state.quadrant);
    spawnBee();
  });

  btnRetryGame.addEventListener('click', () => {
    ensureAudio();
    resetFullGame();
  });

  btnRestart.addEventListener('click', () => {
    ensureAudio();
    resetFullGame();
  });

  // Demo button: fill 15/16 cells (or if already at 15, trigger the 16th cell & Cat immediately!)
  btnDemoCat.addEventListener('click', () => {
    ensureAudio();
    startOverlay.classList.add('hidden');
    rewardOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');

    if (state.filledCells < TOTAL_CELLS - 1) {
      state.filledCells = TOTAL_CELLS - 1;
      state.mode = 'playing';
      updateHUD();
      // Spawn a bee right near the active frame so the next catch immediately fills the 16th cell!
      state.bees = [
        {
          track: state.quadrant,
          progress: 0.72,
          lastStepIndex: 2,
          wobbleSeed: 0,
          flapTimer: 0,
          flapFrame: 0,
          x: TRACKS[state.quadrant].waypoints[3].x,
          y: TRACKS[state.quadrant].waypoints[3].y
        }
      ];
      statusHintEl.textContent =
        '🍯 Почти все соты заполнены (15/16)! Поймай последнюю пчелу (или нажми кнопку ещё раз), чтобы пришёл кот!';
    } else {
      // Immediately fill the 16th cell and launch the Cat cutscene!
      state.score += 1;
      state.filledCells = TOTAL_CELLS;
      updateHUD();
      startCatCutscene();
    }
  });

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.textContent = soundEnabled ? '🔊 Звук' : '🔇 Без звука';
  });

  // Initialize game immediately in playing mode (with start overlay dismissible or auto-ready)
  startOverlay.classList.add('hidden');
  updateHUD();
  setQuadrant(1);
  spawnBee(1);
  requestAnimationFrame(loop);
})();
