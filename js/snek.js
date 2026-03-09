(function () {
  const Site = window.Site || (window.Site = {});

async function initSnakeGame() {
  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const statusEl = document.getElementById("status");
  const playerEl = document.getElementById("player-name");
  const nameInput = document.getElementById("name-input");
  const nameNoteEl = document.getElementById("name-note");
  const leaderboardEl = document.getElementById("leaderboard");
  const leaderboardNoteEl = document.getElementById("leaderboard-note");

  const startBtn = document.getElementById("btn-start");
  const pauseBtn = document.getElementById("btn-pause");
  const restartBtn = document.getElementById("btn-restart");

  const CELL = 20;
  const snekMessageData = (window.SiteData && window.SiteData.snekMessages) || {};
  const fallbackMessage = ["You broke it. Again. Impressively."];
  const fallbackNamePools = {
    live: { general: ["Saved as {name}. Proceed with controlled incompetence."] },
    saved: { general: ["{name} restored. Legacy nonsense continues."] },
  };
  const fallbackDeathPools = {
    generic: { mid: ["{name} died at {score}. Tragic and fully expected."] },
  };
  const fallbackHighScorePools = {
    tiny: { mid: ["{name} new best {score} (+{delta}). Noted with suspicion."] },
  };
  const fallbackClassification = {
    defaultishNames: ["guest", "player", "user", "anon", "default", "test", "admin", "name"],
    edgyTokens: ["dark", "death", "doom", "killer", "slayer", "reaper", "blood", "demon", "grim", "void", "shadow", "666", "xx"],
  };

  const idleNameNotes = Array.isArray(snekMessageData.idleNameNotes) && snekMessageData.idleNameNotes.length
    ? snekMessageData.idleNameNotes
    : [
      "Type a name first. Anonymous failure has no legacy.",
      "Name your snake. We need someone to blame cleanly.",
      "No name, no run, no excuses. Pick one.",
      "Enter a name. The wall wants a target.",
    ];
  const nameRoastPools = snekMessageData.name || fallbackNamePools;
  const deathRoastPools = snekMessageData.death || fallbackDeathPools;
  const highScoreRoastPools = snekMessageData.highScore || fallbackHighScorePools;
  const messageClassification = snekMessageData.classification || fallbackClassification;
  const defaultishNames = new Set((Array.isArray(messageClassification.defaultishNames) ? messageClassification.defaultishNames : fallbackClassification.defaultishNames)
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean));
  const edgyTokens = (Array.isArray(messageClassification.edgyTokens) ? messageClassification.edgyTokens : fallbackClassification.edgyTokens)
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);
  const BASE_MS = 132;
  const SPEEDUP_EVERY = 6;
  const SPEED_FACTOR = 0.96;
  const MIN_TICK_MS = 64;
  const LS_NAME = "portfolio_snake_player_name";
  const LS_BEST = "portfolio_snake_best_score";
  const LS_BEST_BY_NAME = "portfolio_snake_best_score_by_name";
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
  let localBestByName = {};
  let legacyBestPending = Number(localStorage.getItem(LS_BEST) || 0);
  let best = 0;
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
  let visibleLeaderboardEntries = [];
  let activeName = "";
  let liveNameCommitTimer = null;
  let lastCommittedName = "";
  let runStartingBest = 0;
  let runHighScoreTier = null;
  const lastMessageByChannel = new Map();

  function setStatus(text) {
    statusEl.textContent = text;
    statusEl.title = text;
  }

  function stopIdleNameRotation() {
    if (nameNoteTimer) {
      window.clearInterval(nameNoteTimer);
      nameNoteTimer = null;
    }
  }

  function startIdleNameRotation() {
    if (!nameNoteEl || activeName) return;
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

  function normalizeNameForMatch(name) {
    return sanitizeName(name || "", "").toLowerCase();
  }

  function loadLocalBestByName() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_BEST_BY_NAME) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      const normalizedMap = {};
      Object.entries(parsed).forEach(([rawName, rawScore]) => {
        const normalized = normalizeNameForMatch(rawName);
        const scoreValue = Math.floor(Number(rawScore) || 0);
        if (!normalized || scoreValue <= 0) return;
        normalizedMap[normalized] = Math.max(normalizedMap[normalized] || 0, scoreValue);
      });

      return normalizedMap;
    } catch {
      return {};
    }
  }

  function saveLocalBestByName() {
    localStorage.setItem(LS_BEST_BY_NAME, JSON.stringify(localBestByName));
  }

  function getLocalBestForName(name) {
    const normalized = normalizeNameForMatch(name);
    if (!normalized) return 0;
    return Number(localBestByName[normalized]) || 0;
  }

  function setLocalBestForName(name, scoreValue) {
    const normalized = normalizeNameForMatch(name);
    const nextBest = Math.floor(Number(scoreValue) || 0);
    if (!normalized || nextBest <= 0) return false;

    const previousBest = Number(localBestByName[normalized]) || 0;
    if (nextBest <= previousBest) return false;

    localBestByName[normalized] = nextBest;
    saveLocalBestByName();
    return true;
  }

  function maybeMigrateLegacyBest(name) {
    const legacyBest = Math.floor(Number(legacyBestPending) || 0);
    if (legacyBest <= 0) {
      legacyBestPending = 0;
      return;
    }

    if (!normalizeNameForMatch(name)) return;
    setLocalBestForName(name, legacyBest);
    localStorage.removeItem(LS_BEST);
    legacyBestPending = 0;
  }

  localBestByName = loadLocalBestByName();

  function pickMessage(channelKey, lines) {
    if (!Array.isArray(lines) || !lines.length) return "";

    const previousMessage = String(lastMessageByChannel.get(channelKey) || "");
    let nextMessage = lines[Math.floor(Math.random() * lines.length)];

    if (lines.length > 1 && nextMessage === previousMessage) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = lines[Math.floor(Math.random() * lines.length)];
        if (candidate !== previousMessage) {
          nextMessage = candidate;
          break;
        }
      }
    }

    lastMessageByChannel.set(channelKey, nextMessage);
    return nextMessage;
  }

  function fillRoast(template, values) {
    return String(template || "").replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
  }

  function readPoolLines(pool, key) {
    if (!pool || !key || !Array.isArray(pool[key])) return [];
    return pool[key].filter(Boolean);
  }

  function collectPoolLines(pool, keys, fallbackKeys = ["general"]) {
    const collected = [];
    const seen = new Set();

    keys.forEach((key) => {
      readPoolLines(pool, key).forEach((line) => {
        if (seen.has(line)) return;
        seen.add(line);
        collected.push(line);
      });
    });

    if (!collected.length && fallbackKeys.length) {
      fallbackKeys.forEach((key) => {
        readPoolLines(pool, key).forEach((line) => {
          if (seen.has(line)) return;
          seen.add(line);
          collected.push(line);
        });
      });
    }

    if (collected.length) return collected;
    return fallbackKeys.length ? fallbackMessage : [];
  }

  function classifyScoreBracket(rawScore) {
    const scoreValue = Number(rawScore) || 0;
    if (scoreValue <= 3) return "awful";
    if (scoreValue <= 10) return "rough";
    if (scoreValue <= 22) return "mid";
    if (scoreValue <= 40) return "strong";
    return "elite";
  }

  function classifyImprovementTier(rawDelta, oldBestScore = 0) {
    const delta = Math.max(0, Number(rawDelta) || 0);
    const baseline = Math.max(1, Number(oldBestScore) || 0);
    const tinyLimit = Math.max(2, Math.floor(baseline * 0.08));
    const moderateLimit = Math.max(7, Math.floor(baseline * 0.35));
    const bigLimit = Math.max(18, Math.floor(baseline * 0.75));

    if (delta <= tinyLimit) return "tiny";
    if (delta <= moderateLimit) return "moderate";
    if (delta <= bigLimit) return "big";
    return "absurd";
  }

  function classifyDeathFlavor(finalScore) {
    const scoreValue = Math.max(0, Number(finalScore) || 0);
    const improvement = scoreValue - Math.max(0, Number(runStartingBest) || 0);
    if (scoreValue <= 2) return "instant";
    if (scoreValue >= 18 && improvement >= 8) return "choke";
    if (scoreValue >= 45) return "choke";
    return "normal";
  }

  function isDefaultishName(normalizedName) {
    if (!normalizedName) return false;
    if (defaultishNames.has(normalizedName)) return true;

    for (const alias of defaultishNames) {
      if (normalizedName.startsWith(alias) && normalizedName.length <= alias.length + 3) {
        return true;
      }
    }
    return false;
  }

  function hasAlternatingCase(rawName) {
    const lettersOnly = String(rawName || "").replace(/[^a-zA-Z]/g, "");
    if (lettersOnly.length < 6) return false;
    return /(?:[a-z][A-Z]|[A-Z][a-z]){3,}/.test(lettersOnly);
  }

  function isLeetTryhard(rawName) {
    const value = String(rawName || "");
    return /[A-Za-z]/.test(value) && /[4301$!7]/.test(value);
  }

  function hasEdgyToken(loweredName) {
    if (!loweredName) return false;
    return edgyTokens.some((token) => loweredName.includes(token));
  }

  function classifyNameProfile(rawName) {
    const name = String(rawName || "");
    const compact = name.replace(/[\s_-]/g, "");
    const lowered = compact.toLowerCase();
    const normalized = lowered.replace(/[^a-z0-9]/g, "");
    const letters = lowered.replace(/[^a-z]/g, "");
    const digits = (lowered.match(/[0-9]/g) || []).length;
    const vowels = (letters.match(/[aeiou]/g) || []).length;
    const uniqueLetters = letters.length ? (new Set(letters.split("")).size / letters.length) : 0;
    const repeated = /(.)\1{2,}/i.test(name);
    const edgy = hasEdgyToken(lowered);
    const allCaps = /[A-Z]/.test(name) && name === name.toUpperCase();
    const mostlyNumbers = compact.length >= 3 && (digits / Math.max(compact.length, 1)) >= 0.6;
    const keyboardSmash =
      letters.length >= 5 &&
      (vowels / letters.length) < 0.24 &&
      uniqueLetters > 0.58 &&
      !repeated;
    const tinyName = compact.length > 0 && compact.length <= 2;
    const shortName = compact.length > 0 && compact.length <= 4;
    const longName = compact.length >= 12;
    const veryLongName = compact.length >= 15;
    const defaultish = isDefaultishName(normalized);
    const tryhard = !mostlyNumbers && (hasAlternatingCase(name) || isLeetTryhard(name));

    let primary = "general";
    if (defaultish) primary = "defaultish";
    else if (tinyName) primary = "tiny";
    else if (mostlyNumbers) primary = "numeric";
    else if (allCaps) primary = "allcaps";
    else if (keyboardSmash) primary = "smash";
    else if (repeated) primary = "repeated";
    else if (edgy) primary = "edgy";
    else if (tryhard) primary = "tryhard";
    else if (veryLongName) primary = "verylong";
    else if (longName) primary = "long";
    else if (shortName) primary = "short";

    const categories = [];
    const pushCategory = (category) => {
      if (category && !categories.includes(category)) {
        categories.push(category);
      }
    };

    pushCategory(primary);
    if (tinyName) pushCategory("tiny");
    if (shortName) pushCategory("short");
    if (longName) pushCategory("long");
    if (veryLongName) pushCategory("verylong");
    if (allCaps) pushCategory("allcaps");
    if (mostlyNumbers) pushCategory("numeric");
    if (keyboardSmash) pushCategory("smash");
    if (repeated) pushCategory("repeated");
    if (edgy) pushCategory("edgy");
    if (tryhard) pushCategory("tryhard");
    pushCategory("general");

    return { categories };
  }

  function currentPlayerName() {
    return activeName || sanitizeName(playerEl.textContent || "", "Guest");
  }

  function showNameRoast(name, source = "live") {
    const resolvedName = sanitizeName(name || "", "");
    if (!resolvedName) return;

    const sourcePools = source === "saved" ? (nameRoastPools.saved || {}) : (nameRoastPools.live || {});
    const profile = classifyNameProfile(resolvedName);
    const pool = collectPoolLines(sourcePools, profile.categories, ["general"]);
    const template = pickMessage(`name-${source}`, pool);
    if (!template) return;
    setNameNote(fillRoast(template, { name: resolvedName }), false);
  }

  function showDeathRoast(cause = "generic", finalScore = score) {
    const scoreBracket = classifyScoreBracket(finalScore);
    const deathFlavor = classifyDeathFlavor(finalScore);
    const causePools = deathRoastPools[cause] || deathRoastPools.generic || {};
    const genericPools = deathRoastPools.generic || {};
    const keys = deathFlavor === "normal" ? [scoreBracket] : [deathFlavor, scoreBracket];
    const pool = Array.from(new Set([
      ...collectPoolLines(causePools, keys, []),
      ...collectPoolLines(genericPools, keys, ["mid"]),
    ]));
    const template = pickMessage(`death-${cause}-${deathFlavor}-${scoreBracket}`, pool);
    if (!template) return;

    setNameNote(fillRoast(template, {
      name: currentPlayerName(),
      score: finalScore,
    }), true);
  }

  function showHighScoreRoast(newBestScore, oldBestScore) {
    const normalizedNewBest = Number(newBestScore) || 0;
    const normalizedOldBest = Number(oldBestScore) || 0;
    const delta = Math.max(0, normalizedNewBest - normalizedOldBest);
    const improvementTier = classifyImprovementTier(delta, normalizedOldBest);
    const scoreBracket = classifyScoreBracket(normalizedNewBest);
    const tierPools = highScoreRoastPools[improvementTier] || highScoreRoastPools.tiny || {};
    const basePool = collectPoolLines(tierPools, [scoreBracket], ["mid"]);
    const specialPool = (normalizedOldBest <= 0 && highScoreRoastPools.special && Array.isArray(highScoreRoastPools.special.first))
      ? highScoreRoastPools.special.first.filter(Boolean)
      : [];
    const pool = Array.from(new Set([...specialPool, ...basePool]));
    const template = pickMessage(`highscore-${improvementTier}-${scoreBracket}`, pool);
    if (!template) return;

    setNameNote(fillRoast(template, {
      name: currentPlayerName(),
      score: normalizedNewBest,
      oldBest: normalizedOldBest,
      delta,
    }), false);
  }

  function getVisibleTopBestForName(name) {
    const targetName = normalizeNameForMatch(name);
    if (!targetName) return null;
    let highest = null;

    visibleLeaderboardEntries.forEach((entry) => {
      const entryName = normalizeNameForMatch(entry.name || "");
      if (!entryName || entryName !== targetName) return;
      const scoreValue = Number(entry.score) || 0;
      highest = highest === null ? scoreValue : Math.max(highest, scoreValue);
    });

    return highest;
  }

  function knownBestForCurrentName() {
    const playerName = activeName || getStoredName() || sanitizeName(playerEl.textContent || "", "");
    const leaderboardBest = getVisibleTopBestForName(playerName);
    return leaderboardBest === null ? getLocalBestForName(playerName) : leaderboardBest;
  }

  function syncBestDisplay() {
    const baselineBest = knownBestForCurrentName();
    best = Math.max(baselineBest, score);
    bestEl.textContent = String(best);
  }

  function updateNameUi(name, options = {}) {
    const { syncInput = false } = options;
    const resolved = sanitizeName(name || "", "");
    activeName = resolved;
    maybeMigrateLegacyBest(resolved);
    playerEl.textContent = resolved || "Unset";
    if (syncInput) {
      nameInput.value = resolved;
    }
    syncBestDisplay();
    return resolved;
  }

  function updateGameplayBackgroundFps() {
    if (typeof window.__setStarfieldTargetFps !== "function") return;
    window.__setStarfieldTargetFps(running && !paused ? 30 : 60);
  }

  function commitLiveName(showRoast = true) {
    if (liveNameCommitTimer) {
      window.clearTimeout(liveNameCommitTimer);
      liveNameCommitTimer = null;
    }

    if (!activeName) {
      localStorage.removeItem(LS_NAME);
      lastCommittedName = "";
      if (!running && !hasStartedOnce) {
        setStatus("Pick a name");
      }
      startIdleNameRotation();
      return false;
    }

    localStorage.setItem(LS_NAME, activeName);
    if (showRoast && activeName !== lastCommittedName) {
      showNameRoast(activeName, "live");
    }
    lastCommittedName = activeName;

    if (!running) {
      setStatus(awaitingRestart ? "Waiting for restart" : "Ready");
    }
    return true;
  }

  function scheduleLiveNameCommit() {
    if (liveNameCommitTimer) {
      window.clearTimeout(liveNameCommitTimer);
    }
    liveNameCommitTimer = window.setTimeout(() => {
      commitLiveName(true);
    }, 180);
  }

  function handleNameInput() {
    const nextName = updateNameUi(nameInput.value);
    if (!nextName) {
      setNameNote("Enter a name so your failures have legal ownership.", true);
      if (!running && !hasStartedOnce) {
        setStatus("Pick a name");
      }
      scheduleLiveNameCommit();
      return;
    }
    scheduleLiveNameCommit();
  }

  function ensureNameBeforePlay() {
    if (activeName) return true;
    updateNameUi(nameInput.value);
    if (activeName) {
      commitLiveName(false);
      return true;
    }
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
    const storedName = getStoredName();
    maybeMigrateLegacyBest(storedName);
    updateNameUi(storedName, { syncInput: true });
    lastCommittedName = storedName;
    if (storedName) {
      showNameRoast(storedName, "saved");
    } else {
      startIdleNameRotation();
    }
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
      resetBoard(activeName ? "Ready" : "Pick a name");
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
    const playerName = currentPlayerName();
    setLocalBestForName(playerName, score);
    syncBestDisplay();

    if (!running || score <= runStartingBest) return;
    const nextTier = classifyImprovementTier(score - runStartingBest, runStartingBest);
    if (nextTier !== runHighScoreTier) {
      runHighScoreTier = nextTier;
      showHighScoreRoast(score, runStartingBest);
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
    const visibleRows = (Array.isArray(entries) ? entries : [])
      .slice(0, 10)
      .map((entry) => ({
        name: sanitizeName(entry.name || "Guest"),
        score: Number(entry.score) || 0,
      }));

    visibleLeaderboardEntries = visibleRows;
    leaderboardEl.innerHTML = "";

    if (!visibleRows.length) {
      leaderboardEl.textContent = "No runs yet. Go crash into a wall with purpose.";
      syncBestDisplay();
      return;
    }

    visibleRows.forEach((entry, index) => {
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

    syncBestDisplay();
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
    syncBestDisplay();
    setStatus(statusText);
    draw();
  }

  function beginRun() {
    if (!ensureNameBeforePlay()) return;
    runStartingBest = knownBestForCurrentName();
    runHighScoreTier = null;
    hasStartedOnce = true;
    awaitingRestart = false;
    running = true;
    resetBoard("Playing");
    updateGameplayBackgroundFps();
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

  function stopGame(cause = "generic", finalStatus = "Game over") {
    running = false;
    paused = false;
    awaitingRestart = true;
    setStatus(`${finalStatus} - hit Restart or R`);
    updateGameplayBackgroundFps();
    showDeathRoast(cause, score);
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
      tickMs = Math.max(MIN_TICK_MS, tickMs * SPEED_FACTOR);
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

    if (hitWall) {
      stopGame("wall", "Game over");
      return;
    }

    if (hitSelf) {
      stopGame("self", "Game over");
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
    updateGameplayBackgroundFps();
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
    if (!touch) return;
    touchStart = { x: touch.clientX, y: touch.clientY };
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (event) => {
    if (!touchStart) return;
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    event.preventDefault();

    const touch = event.changedTouches[0];
    if (!touch) {
      touchStart = null;
      return;
    }
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;

    if (!running) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? 1 : -1, 0);
    } else {
      queueDirection(0, dy > 0 ? 1 : -1);
    }

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, { passive: false });

  canvas.addEventListener("touchcancel", () => {
    touchStart = null;
  }, { passive: true });

  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", restartGame);
  nameInput.addEventListener("input", handleNameInput);
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      updateNameUi(nameInput.value, { syncInput: true });
      commitLiveName(true);
      nameInput.blur();
    }
  });
  nameInput.addEventListener("blur", () => {
    updateNameUi(nameInput.value, { syncInput: true });
    commitLiveName(true);
  });

  loadName();
  syncBestDisplay();
  updateGameplayBackgroundFps();
  resizeCanvas();
  window.addEventListener("resize", () => {
    clearTimeout(window.__snakeResizeTimer);
    window.__snakeResizeTimer = setTimeout(() => {
      resizeCanvas();
      syncLeaderboardHeight();
    }, 80);
  });

  resetBoard(activeName ? "Ready" : "Pick a name");
  renderLocalLeaderboard();
  await bootRemoteLeaderboard();
  syncLeaderboardHeight();
}

  Site.initSnakeGame = initSnakeGame;
})();
