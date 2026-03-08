document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  initStarfield();
  initNavMenus();
  initRotatingText();
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

function initNavMenus() {
  const menus = Array.from(document.querySelectorAll(".nav-item-menu"));
  if (!menus.length) return;

  menus.forEach((menu) => {
    let closeTimer = null;
    const open = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      menu.classList.add("nav-open");
    };
    const close = () => {
      closeTimer = window.setTimeout(() => menu.classList.remove("nav-open"), 220);
    };

    menu.addEventListener("mouseenter", open);
    menu.addEventListener("mouseleave", close);
    menu.addEventListener("focusin", open);
    menu.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!menu.contains(document.activeElement)) {
          menu.classList.remove("nav-open");
        }
      }, 0);
    });
  });
}

function initRotatingText() {
  const nodes = Array.from(document.querySelectorAll("[data-rotate-options]"));
  nodes.forEach((node) => {
    const options = (node.dataset.rotateOptions || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);

    if (options.length < 2) return;

    let index = 0;
    node.textContent = options[index];
    window.setInterval(() => {
      index = (index + 1) % options.length;
      node.textContent = options[index];
    }, 4200);
  });
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
  const nameNoteEl = document.getElementById("name-note");
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
  const idleNameNotes = [
    "Pick a player name before the first run, then go commit tasteful reptile crimes.",
    "Name the creature. It feels weird without paperwork.",
    "Pick something memorable, stupid, or both.",
    "A name helps the leaderboard know who to blame.",
  ];
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
  let boardWidth = 0;
  let boardHeight = 0;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
  let cols = 0;
  let rows = 0;
  let snake = [];
  let food = { x: 0, y: 0 };
  let score = 0;
  let best = Number(localStorage.getItem(LS_BEST) || 0);
  let direction = { x: 0, y: 0 };
  let queuedDirections = [];
  let running = false;
  let paused = false;
  let tickMs = BASE_MS;
  let accumulator = 0;
  let lastTimestamp = 0;
  let loopActive = false;
  let hasStartedOnce = false;
  let awaitingRestart = false;

  let firebase = null;
  let firestoreApi = null;
  let nameNoteTimer = null;
  let nameNoteIndex = 0;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function stopIdleNameRotation() {
    if (nameNoteTimer) {
      window.clearInterval(nameNoteTimer);
      nameNoteTimer = null;
    }
  }

  function startIdleNameRotation() {
    if (!nameNoteEl || getStoredName()) return;
    stopIdleNameRotation();

    const rotate = () => {
      nameNoteEl.dataset.state = "normal";
      nameNoteEl.textContent = idleNameNotes[nameNoteIndex % idleNameNotes.length];
      nameNoteIndex += 1;
    };

    rotate();
    nameNoteTimer = window.setInterval(rotate, 4200);
  }

  function setNameNote(text, isError = false) {
    if (!nameNoteEl) return;
    stopIdleNameRotation();
    nameNoteEl.textContent = text;
    nameNoteEl.dataset.state = isError ? "error" : "normal";
  }

  function sanitizeName(rawValue, fallback = "Guest") {
    const cleaned = (rawValue || "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);

    return cleaned || fallback;
  }

  function getStoredName() {
    return sanitizeName(localStorage.getItem(LS_NAME) || "", "");
  }

  function currentPlayerName() {
    return sanitizeName(playerEl.textContent || "", "Guest");
  }

  function updateNameUi(name) {
    const resolved = sanitizeName(name || "", "");
    playerEl.textContent = resolved || "Unset";
    nameInput.value = resolved;
    if (resolved) {
      setNameNote(`Saved as ${resolved}. Good enough.`, false);
    } else {
      startIdleNameRotation();
    }
  }

  function saveName() {
    const name = sanitizeName(nameInput.value, "");
    if (!name) {
      localStorage.removeItem(LS_NAME);
      playerEl.textContent = "Unset";
      nameInput.value = "";
      setNameNote("Enter a player name first.", true);
      if (!running && !hasStartedOnce) {
        setStatus("Pick a name");
      }
      nameInput.focus();
      return false;
    }

    localStorage.setItem(LS_NAME, name);
    updateNameUi(name);

    if (!running) {
      setStatus(awaitingRestart ? "Waiting for restart" : "Ready");
    }
    return true;
  }

  function ensureNameBeforePlay() {
    if (getStoredName()) return true;
    setStatus("Pick a name");
    setNameNote("You need a player name before the first run.", true);
    nameInput.focus();
    return false;
  }

  function setLeaderboardNote(text) {
    if (leaderboardNoteEl) {
      leaderboardNoteEl.textContent = text;
    }
  }

  function loadName() {
    updateNameUi(getStoredName());
  }

  function resizeCanvas() {
    const shell = canvas.parentElement;
    const shellWidth = Math.max(CELL * 12, Math.floor(shell.clientWidth));
    const shellHeight = Math.max(CELL * 12, Math.floor(shell.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.floor(shellWidth * dpr));
    canvas.height = Math.max(1, Math.floor(shellHeight * dpr));
    canvas.style.width = `${shellWidth}px`;
    canvas.style.height = `${shellHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    logicalWidth = shellWidth;
    logicalHeight = shellHeight;
    cols = Math.max(12, Math.floor(logicalWidth / CELL));
    rows = Math.max(12, Math.floor(logicalHeight / CELL));
    boardWidth = cols * CELL;
    boardHeight = rows * CELL;
    boardOffsetX = Math.floor((logicalWidth - boardWidth) / 2);
    boardOffsetY = Math.floor((logicalHeight - boardHeight) / 2);

    if (snake.length === 0) {
      resetBoard(getStoredName() ? "Ready" : "Pick a name");
    } else {
      draw();
    }

    syncLeaderboardHeight();
  }

  function syncLeaderboardHeight() {
    const gamePanel = document.querySelector(".game-panel");
    const leaderboardCard = document.querySelector(".leaderboard-card");
    if (!gamePanel || !leaderboardCard) return;
    if (window.innerWidth <= 980) {
      leaderboardCard.style.minHeight = "";
      return;
    }
    leaderboardCard.style.minHeight = `${Math.round(gamePanel.getBoundingClientRect().height)}px`;
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

  function dedupeEntries(entries, limit = 10) {
    const bestByName = new Map();

    entries.forEach((entry) => {
      const name = sanitizeName(entry.name || "Guest");
      const scoreValue = Number(entry.score) || 0;
      const atValue = Number(entry.at) || 0;
      const key = nameToDocId(name);
      const existing = bestByName.get(key);

      if (!existing || scoreValue > existing.score || (scoreValue === existing.score && atValue < existing.at)) {
        bestByName.set(key, { name, score: scoreValue, at: atValue });
      }
    });

    return Array.from(bestByName.values())
      .sort((a, b) => (b.score - a.score) || (a.at - b.at))
      .slice(0, limit);
  }

  function getSavedScores() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_SCORES) || "[]");
      return dedupeEntries(Array.isArray(parsed) ? parsed : [], 8);
    } catch {
      return [];
    }
  }

  function saveScoreHistory() {
    const scores = getSavedScores();
    scores.push({
      name: currentPlayerName(),
      score,
      at: Date.now(),
    });

    localStorage.setItem(LS_SCORES, JSON.stringify(dedupeEntries(scores, 8)));
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
      const parsed = JSON.parse(localStorage.getItem(LS_LB_CACHE) || "[]");
      return dedupeEntries(Array.isArray(parsed) ? parsed : []);
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

      const app = initializeApp(firebaseConfig);
      firestoreApi = firestore;
      firebase = firestore.getFirestore(app);
      firestore.enableIndexedDbPersistence(firebase).catch(() => {});
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
        firestoreApi.limit(50),
      );
      const snap = await firestoreApi.getDocs(topQuery);
      const entries = dedupeEntries(snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          name: sanitizeName(data.name || "Guest"),
          score: Number(data.score) || 0,
          at: 0,
        };
      }));
      localStorage.setItem(LS_LB_CACHE, JSON.stringify(entries));
      setLeaderboardNote("Online top scores. One best score per name.");
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

    const playerName = currentPlayerName();
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

  function nameToDocId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "guest";
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    for (let x = 0; x <= cols; x += 1) {
      const px = boardOffsetX + x * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, boardOffsetY);
      ctx.lineTo(px, boardOffsetY + boardHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= rows; y += 1) {
      const py = boardOffsetY + y * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(boardOffsetX, py);
      ctx.lineTo(boardOffsetX + boardWidth, py);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(boardOffsetX + x * CELL + 1, boardOffsetY + y * CELL + 1, CELL - 2, CELL - 2);
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

  function resetBoard(statusText = "Ready") {
    const centerX = Math.max(3, Math.floor(cols / 2));
    const centerY = Math.max(3, Math.floor(rows / 2));

    snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    food = randomFoodPosition();
    score = 0;
    direction = { x: 0, y: 0 };
    queuedDirections.length = 0;
    tickMs = BASE_MS;
    accumulator = 0;
    lastTimestamp = 0;
    paused = false;
    scoreEl.textContent = "0";
    setStatus(statusText);
    draw();
  }

  function beginRun() {
    if (!ensureNameBeforePlay()) return;
    hasStartedOnce = true;
    awaitingRestart = false;
    running = true;
    resetBoard("Playing");
    if (!loopActive) {
      loopActive = true;
      requestAnimationFrame(loop);
    }
  }

  function startGame() {
    if (awaitingRestart && hasStartedOnce) {
      setStatus("Hit Restart or R");
      return;
    }
    beginRun();
  }

  function restartGame() {
    beginRun();
  }

  function stopGame(finalStatus = "Game over") {
    running = false;
    paused = false;
    awaitingRestart = true;
    setStatus(`${finalStatus} — hit Restart or R`);
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
  }

  function loop(timestamp) {
    if (!running) {
      draw();
      loopActive = false;
      return;
    }

    if (paused) {
      lastTimestamp = timestamp;
      accumulator = 0;
      draw();
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
    } else {
      loopActive = false;
    }
  }

  function queueDirection(nextX, nextY) {
    if (!running) return;

    const reference = queuedDirections[queuedDirections.length - 1] || direction;
    const wouldReverse =
      reference.x !== 0 || reference.y !== 0
        ? (nextX === -reference.x && nextY === -reference.y)
        : false;

    if (wouldReverse) return;
    if (reference.x === nextX && reference.y === nextY) return;

    queuedDirections.push({ x: nextX, y: nextY });
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    accumulator = 0;
    lastTimestamp = 0;
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
    if (key === "r") restartGame();
    if (key === " " || key === "p") togglePause();
  });

  let touchStart = null;
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  canvas.addEventListener("touchend", (event) => {
    if (!touchStart || !running) return;

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
  restartBtn.addEventListener("click", restartGame);
  saveNameBtn.addEventListener("click", saveName);
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveName();
      nameInput.blur();
    }
  });

  bestEl.textContent = String(best);
  loadName();
  resizeCanvas();
  window.addEventListener("resize", () => {
    clearTimeout(window.__snakeResizeTimer);
    window.__snakeResizeTimer = setTimeout(() => {
      resizeCanvas();
      syncLeaderboardHeight();
    }, 80);
  });

  resetBoard(getStoredName() ? "Ready" : "Pick a name");
  if (!getStoredName()) {
    startIdleNameRotation();
  }
  renderLocalLeaderboard();
  await bootRemoteLeaderboard();
  syncLeaderboardHeight();
}
