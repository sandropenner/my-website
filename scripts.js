document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  initStarfield();
  initSnakeGame();
});

function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let stars = [];
  let shootingStar = null;
  let lastShot = 0;

  function resizeStarfield() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    buildStars();
  }

  function buildStars() {
    const count = Math.min(220, Math.floor((width * height) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.2,
      alpha: Math.random() * 0.8 + 0.08,
      speed: Math.random() * 0.0008 + 0.0002,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function spawnShot(timestamp) {
    shootingStar = {
      x: Math.random() * width * 0.65,
      y: Math.random() * height * 0.3,
      length: Math.random() * 90 + 110,
      speedX: Math.random() * 7 + 9,
      speedY: Math.random() * 4 + 6,
      life: 0,
      maxLife: 55,
    };
    lastShot = timestamp;
  }

  function drawShot() {
    if (!shootingStar) return;
    const tailX = shootingStar.x - shootingStar.length;
    const tailY = shootingStar.y - shootingStar.length * 0.6;
    const opacity = 1 - shootingStar.life / shootingStar.maxLife;
    const gradient = ctx.createLinearGradient(shootingStar.x, shootingStar.y, tailX, tailY);
    gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.moveTo(shootingStar.x, shootingStar.y);
    ctx.lineTo(tailX, tailY);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    shootingStar.x += shootingStar.speedX;
    shootingStar.y += shootingStar.speedY;
    shootingStar.life += 1;

    if (shootingStar.life >= shootingStar.maxLife) {
      shootingStar = null;
    }
  }

  function animateStarfield(timestamp = 0) {
    ctx.clearRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.15, height * 1.05, 0, width * 0.15, height * 1.05, width * 0.72);
    glow.addColorStop(0, "rgba(47, 90, 255, 0.24)");
    glow.addColorStop(0.38, "rgba(18, 45, 120, 0.12)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const alpha = star.alpha + Math.sin(timestamp * star.speed + star.pulse) * 0.18;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.08, alpha)})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (!shootingStar && timestamp - lastShot > 3200) {
      spawnShot(timestamp);
    }
    drawShot();

    window.requestAnimationFrame(animateStarfield);
  }

  resizeStarfield();
  animateStarfield();
  window.addEventListener("resize", resizeStarfield);
}

async function initSnakeGame() {
  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const statusEl = document.getElementById("status");
  const playerEl = document.getElementById("player-name");
  const nameInput = document.getElementById("name-input");
  const saveNameBtn = document.getElementById("name-save");
  const leaderboardEl = document.getElementById("leaderboard");
  const leaderboardNoteEl = document.getElementById("leaderboard-note");

  const startBtn = document.getElementById("btn-start");
  const pauseBtn = document.getElementById("btn-pause");
  const restartBtn = document.getElementById("btn-restart");

  const dpad = {
    up: document.getElementById("m-up"),
    left: document.getElementById("m-left"),
    down: document.getElementById("m-down"),
    right: document.getElementById("m-right"),
  };

  const CELL = 20;
  const BASE_MS = 125;
  const SPEEDUP_EVERY = 5;
  const SPEED_FACTOR = 0.92;
  const LS_NAME = "portfolio_snake_player_name";
  const LS_BEST = "portfolio_snake_best_score";
  const LS_SCORES = "portfolio_snake_recent_scores";
  const LS_LB_CACHE = "portfolio_snake_online_cache";

  const firebaseConfig = {
    apiKey: "AIzaSyAOD8znQkOOR6_4d4sm7_1OHPUmBmqL4FE",
    authDomain: "snek-c1532.firebaseapp.com",
    databaseURL: "https://snek-c1532-default-rtdb.firebaseio.com",
    projectId: "snek-c1532",
    storageBucket: "snek-c1532.appspot.com",
    messagingSenderId: "837892367719",
    appId: "1:837892367719:web:30711ba63232ade7c7bbc2",
    measurementId: "G-WR1FYYMCK6",
  };

  const colors = {
    background: "#07101f",
    food: "#ff6d8b",
    snake: "#8affb0",
    snakeHead: "#d7ffe4",
    grid: "rgba(255,255,255,0.05)",
  };

  let logicalWidth = 0;
  let logicalHeight = 0;
  let cols = 0;
  let rows = 0;
  let snake = [];
  let food = { x: 0, y: 0 };
  let score = 0;
  let best = Number(localStorage.getItem(LS_BEST) || 0);
  let direction = { x: 0, y: 0 };
  let queuedDirections = [];
  let lastDirection = { x: 0, y: 0 };
  let running = false;
  let paused = false;
  let tickMs = BASE_MS;
  let accumulator = 0;
  let lastTimestamp = 0;

  let firebase = null;
  let firestoreApi = null;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function sanitizeName(rawValue) {
    return (rawValue || "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16) || "Guest";
  }

  function nameToDocId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "guest";
  }

  function setLeaderboardNote(text) {
    if (leaderboardNoteEl) {
      leaderboardNoteEl.textContent = text;
    }
  }

  function loadName() {
    const name = sanitizeName(localStorage.getItem(LS_NAME) || "Guest");
    playerEl.textContent = name;
    nameInput.value = name === "Guest" ? "" : name;
  }

  function saveName() {
    const name = sanitizeName(nameInput.value || "Guest");
    localStorage.setItem(LS_NAME, name);
    playerEl.textContent = name;
    nameInput.value = name === "Guest" ? "" : name;
  }

  function resizeCanvas() {
    const shell = canvas.parentElement;
    const cssWidth = Math.max(CELL * 12, Math.floor(shell.clientWidth / CELL) * CELL);
    const cssHeight = Math.floor((cssWidth * 0.75) / CELL) * CELL;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    logicalWidth = cssWidth;
    logicalHeight = cssHeight;
    cols = Math.floor(logicalWidth / CELL);
    rows = Math.floor(logicalHeight / CELL);

    if (!running && snake.length === 0) {
      snake = [
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 3, y: 6 },
      ];
      food = { x: 11, y: 6 };
    }

    draw();
  }

  function randomFoodPosition() {
    let next;
    do {
      next = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    } while (snake.some((part) => part.x === next.x && part.y === next.y));
    return next;
  }

  function updateBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(LS_BEST, String(best));
      bestEl.textContent = String(best);
    }
  }

  function getSavedScores() {
    try {
      return JSON.parse(localStorage.getItem(LS_SCORES) || "[]");
    } catch {
      return [];
    }
  }

  function saveScoreHistory() {
    const name = sanitizeName(playerEl.textContent || "Guest");
    const scores = getSavedScores();
    scores.push({
      name,
      score,
      at: Date.now(),
    });

    scores.sort((a, b) => (b.score - a.score) || (a.at - b.at));
    localStorage.setItem(LS_SCORES, JSON.stringify(scores.slice(0, 8)));
  }

  function renderLeaderboardRows(entries) {
    leaderboardEl.innerHTML = "";

    if (!entries.length) {
      leaderboardEl.textContent = "No runs yet. Go crash into a wall with purpose.";
      return;
    }

    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "score-row";

      const rank = document.createElement("span");
      rank.className = "score-rank";
      rank.textContent = `#${index + 1}`;

      const name = document.createElement("span");
      name.className = "score-name";
      name.textContent = sanitizeName(entry.name || "Guest");

      const value = document.createElement("span");
      value.className = "score-value";
      value.textContent = String(Number(entry.score) || 0);

      row.append(rank, name, value);
      leaderboardEl.appendChild(row);
    });
  }

  function renderLocalLeaderboard() {
    setLeaderboardNote("Showing local scores while the online board sleeps it off.");
    renderLeaderboardRows(getSavedScores());
  }

  function getCachedOnlineLeaderboard() {
    try {
      return JSON.parse(localStorage.getItem(LS_LB_CACHE) || "[]");
    } catch {
      return [];
    }
  }

  async function bootRemoteLeaderboard() {
    try {
      const [{ initializeApp }, firestore] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      ]);

      firebase = initializeApp(firebaseConfig);
      firestoreApi = firestore;
      const db = firestore.getFirestore(firebase);
      firebase = db;
      firestore.enableIndexedDbPersistence(db).catch(() => {});
      await loadRemoteLeaderboard();
    } catch (error) {
      const cached = getCachedOnlineLeaderboard();
      if (cached.length) {
        setLeaderboardNote("Online board unavailable. Showing cached scores.");
        renderLeaderboardRows(cached);
      } else {
        renderLocalLeaderboard();
      }
    }
  }

  async function loadRemoteLeaderboard() {
    if (!firebase || !firestoreApi) {
      renderLocalLeaderboard();
      return;
    }

    try {
      const topQuery = firestoreApi.query(
        firestoreApi.collection(firebase, "leaderboard"),
        firestoreApi.orderBy("score", "desc"),
        firestoreApi.limit(10),
      );
      const snap = await firestoreApi.getDocs(topQuery);
      const entries = snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          name: sanitizeName(data.name || "Guest"),
          score: Number(data.score) || 0,
        };
      });
      localStorage.setItem(LS_LB_CACHE, JSON.stringify(entries));
      setLeaderboardNote("Online top scores. Player name keeps your best run.");
      renderLeaderboardRows(entries);
    } catch (error) {
      const cached = getCachedOnlineLeaderboard();
      if (cached.length) {
        setLeaderboardNote("Online board unavailable. Showing cached scores.");
        renderLeaderboardRows(cached);
      } else {
        renderLocalLeaderboard();
      }
    }
  }

  async function submitRemoteScore() {
    if (!firebase || !firestoreApi || score <= 0) return;

    const playerName = sanitizeName(playerEl.textContent || "Guest");
    const playerRef = firestoreApi.doc(firebase, "leaderboard", nameToDocId(playerName));

    try {
      const existingSnap = await firestoreApi.getDoc(playerRef);
      const existingScore = existingSnap.exists() ? Number(existingSnap.data().score) || 0 : 0;
      if (score >= existingScore) {
        await firestoreApi.setDoc(playerRef, {
          name: playerName,
          score,
          updatedAt: firestoreApi.serverTimestamp(),
        }, { merge: true });
      }
      await loadRemoteLeaderboard();
    } catch (error) {
      renderLocalLeaderboard();
    }
  }

  function drawGrid() {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= logicalWidth; x += CELL) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= logicalHeight; y += CELL) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(logicalWidth, y);
      ctx.stroke();
    }
  }

  function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function draw() {
    if (!logicalWidth || !logicalHeight) return;

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    drawGrid();
    drawPixel(food.x, food.y, colors.food);

    snake.forEach((part, index) => {
      drawPixel(part.x, part.y, index === 0 ? colors.snakeHead : colors.snake);
    });
  }

  function resetGame() {
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    food = randomFoodPosition();
    score = 0;
    direction = { x: 0, y: 0 };
    lastDirection = { x: 0, y: 0 };
    queuedDirections.length = 0;
    tickMs = BASE_MS;
    accumulator = 0;
    lastTimestamp = 0;
    paused = false;
    scoreEl.textContent = "0";
    setStatus("Ready");
    draw();
  }

  function startGame() {
    resetGame();
    running = true;
    setStatus("Playing");
    requestAnimationFrame(loop);
  }

  function stopGame(finalStatus = "Crashed") {
    running = false;
    paused = false;
    setStatus(finalStatus);
    saveScoreHistory();
    submitRemoteScore().catch(() => renderLocalLeaderboard());
    if (!firebase || !firestoreApi) {
      renderLocalLeaderboard();
    }
  }

  function eatFood() {
    score += 1;
    scoreEl.textContent = String(score);
    updateBest();
    if (score % SPEEDUP_EVERY === 0) {
      tickMs = Math.max(55, tickMs * SPEED_FACTOR);
    }
    food = randomFoodPosition();
  }

  function step() {
    if (queuedDirections.length) {
      direction = queuedDirections.shift();
    }

    if (direction.x === 0 && direction.y === 0) {
      return;
    }

    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };

    const hitWall =
      head.x < 0 ||
      head.y < 0 ||
      head.x >= cols ||
      head.y >= rows;

    const hitSelf = snake.some((part, index) => index > 0 && part.x === head.x && part.y === head.y);

    if (hitWall || hitSelf) {
      stopGame("Game over");
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      eatFood();
    } else {
      snake.pop();
    }

    lastDirection = { ...direction };
  }

  function loop(timestamp) {
    if (!running) {
      draw();
      return;
    }

    if (paused) {
      requestAnimationFrame(loop);
      return;
    }

    if (!lastTimestamp) {
      lastTimestamp = timestamp;
    }

    accumulator += timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    while (accumulator >= tickMs) {
      step();
      accumulator -= tickMs;
      if (!running) break;
    }

    draw();

    if (running) {
      requestAnimationFrame(loop);
    }
  }

  function queueDirection(nextX, nextY) {
    const lastQueued = queuedDirections[queuedDirections.length - 1] || direction;
    const wouldReverse =
      (nextX === -lastDirection.x && nextY === 0 && lastDirection.y === 0) ||
      (nextY === -lastDirection.y && nextX === 0 && lastDirection.x === 0);

    if (wouldReverse) return;
    if (lastQueued.x === nextX && lastQueued.y === nextY) return;

    queuedDirections.push({ x: nextX, y: nextY });

    if (!running) {
      startGame();
      queuedDirections = [{ x: nextX, y: nextY }];
    }
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    setStatus(paused ? "Paused" : "Playing");
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      event.preventDefault();
    }

    if (key === "w" || key === "arrowup") queueDirection(0, -1);
    if (key === "a" || key === "arrowleft") queueDirection(-1, 0);
    if (key === "s" || key === "arrowdown") queueDirection(0, 1);
    if (key === "d" || key === "arrowright") queueDirection(1, 0);
    if (key === "r") startGame();
    if (key === " " || key === "p") togglePause();
  });

  let touchStart = null;
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  canvas.addEventListener("touchend", (event) => {
    if (!touchStart) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? 1 : -1, 0);
    } else {
      queueDirection(0, dy > 0 ? 1 : -1);
    }

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, { passive: true });

  dpad.up.addEventListener("click", () => queueDirection(0, -1));
  dpad.left.addEventListener("click", () => queueDirection(-1, 0));
  dpad.down.addEventListener("click", () => queueDirection(0, 1));
  dpad.right.addEventListener("click", () => queueDirection(1, 0));

  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", startGame);
  saveNameBtn.addEventListener("click", saveName);
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      saveName();
      nameInput.blur();
    }
  });

  bestEl.textContent = String(best);
  loadName();
  resizeCanvas();
  window.addEventListener("resize", () => {
    clearTimeout(window.__snakeResizeTimer);
    window.__snakeResizeTimer = setTimeout(resizeCanvas, 80);
  });

  resetGame();
  renderLocalLeaderboard();
  await bootRemoteLeaderboard();
}
