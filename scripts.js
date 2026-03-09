document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  initPagePrefetching();
  initStarfield();
  initNavMenus();
  initRotatingText();
  if ((document.body && document.body.dataset.page === "snek") || document.getElementById("snake-canvas")) {
    initSnakeGame();
  }
});

function initPagePrefetching() {
  const linkEl = document.createElement("link");
  const supportsPrefetch = !!(linkEl.relList && typeof linkEl.relList.supports === "function" && linkEl.relList.supports("prefetch"));
  if (!supportsPrefetch) return;

  const prefetched = new Set();

  function toPrefetchUrl(rawHref) {
    try {
      const url = new URL(rawHref, window.location.href);
      if (url.origin !== window.location.origin) return null;
      if (!/^https?:$/.test(url.protocol)) return null;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }

  function isInternalLink(anchor) {
    if (!anchor || !anchor.href) return false;
    if (anchor.hasAttribute("download")) return false;

    const target = (anchor.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") return false;

    const rel = (anchor.getAttribute("rel") || "").toLowerCase();
    if (rel.includes("external")) return false;

    return !!toPrefetchUrl(anchor.href);
  }

  function prefetchHref(rawHref) {
    const normalizedUrl = toPrefetchUrl(rawHref);
    if (!normalizedUrl || prefetched.has(normalizedUrl)) return;

    const prefetchLink = document.createElement("link");
    prefetchLink.rel = "prefetch";
    prefetchLink.as = "document";
    prefetchLink.href = normalizedUrl;
    document.head.appendChild(prefetchLink);
    prefetched.add(normalizedUrl);
  }

  const prefetchableAnchors = Array.from(document.querySelectorAll("a[href]")).filter(isInternalLink);
  prefetchableAnchors.forEach((anchor) => {
    const warm = () => prefetchHref(anchor.href);
    anchor.addEventListener("mouseenter", warm, { passive: true });
    anchor.addEventListener("focus", warm);
    anchor.addEventListener("touchstart", warm, { passive: true });
  });

  const likelyAnchors = Array.from(document.querySelectorAll(".site-nav a[href], .footer-links a[href], .hero-actions a[href]"));
  const idleCandidates = Array.from(new Set(
    likelyAnchors
      .filter(isInternalLink)
      .map((anchor) => toPrefetchUrl(anchor.href))
      .filter(Boolean),
  )).slice(0, 2);

  if (!idleCandidates.length) return;

  const scheduleIdle = window.requestIdleCallback
    ? (callback) => window.requestIdleCallback(callback, { timeout: 1800 })
    : (callback) => window.setTimeout(() => callback(null), 1400);

  scheduleIdle((deadline) => {
    idleCandidates.forEach((href, index) => {
      if (deadline && typeof deadline.timeRemaining === "function" && index > 0 && deadline.timeRemaining() < 5) {
        return;
      }
      prefetchHref(href);
    });
  });
}

function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let stars = [];
  let shootingStar = null;
  let lastShot = 0;
  let glowGradient = null;
  let starfieldRaf = 0;
  let starfieldActive = false;
  let resizeTimer = 0;
  let targetFrameMs = 1000 / 60;
  let lastRenderTimestamp = 0;

  function setStarfieldTargetFps(fps) {
    const value = Number(fps);
    const normalized = Number.isFinite(value) && value > 0 ? Math.min(60, Math.max(10, value)) : 60;
    targetFrameMs = 1000 / normalized;
    lastRenderTimestamp = 0;
  }

  window.__setStarfieldTargetFps = setStarfieldTargetFps;
  setStarfieldTargetFps(60);

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

    glowGradient = ctx.createRadialGradient(width * 0.15, height * 1.05, 0, width * 0.15, height * 1.05, width * 0.72);
    glowGradient.addColorStop(0, "rgba(47, 90, 255, 0.24)");
    glowGradient.addColorStop(0.38, "rgba(18, 45, 120, 0.12)");
    glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
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
    if (!starfieldActive) return;

    if (lastRenderTimestamp && (timestamp - lastRenderTimestamp) < targetFrameMs) {
      starfieldRaf = window.requestAnimationFrame(animateStarfield);
      return;
    }
    lastRenderTimestamp = timestamp;

    ctx.clearRect(0, 0, width, height);

    if (glowGradient) {
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
    for (const star of stars) {
      const alpha = star.alpha + Math.sin(timestamp * star.speed + star.pulse) * 0.18;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.08, alpha)})`;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (!shootingStar && timestamp - lastShot > 3200) {
      spawnShot(timestamp);
    }
    drawShot();

    starfieldRaf = window.requestAnimationFrame(animateStarfield);
  }

  function startStarfield() {
    if (starfieldActive) return;
    starfieldActive = true;
    lastRenderTimestamp = 0;
    starfieldRaf = window.requestAnimationFrame(animateStarfield);
  }

  function stopStarfield() {
    starfieldActive = false;
    if (starfieldRaf) {
      window.cancelAnimationFrame(starfieldRaf);
      starfieldRaf = 0;
    }
  }

  resizeStarfield();
  if (!document.hidden) {
    startStarfield();
  }

  window.addEventListener("resize", () => {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      resizeTimer = 0;
      resizeStarfield();
    }, 80);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopStarfield();
      return;
    }
    lastRenderTimestamp = 0;
    lastShot = performance.now();
    startStarfield();
  });
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
  const pageKey = (document.body && document.body.dataset && document.body.dataset.page) || "default";
  const extraOptionsByPage = {
    home: [
      "This site is held together by caffeine and denial.",
      "Functional chaos with surprisingly few legal issues.",
      "Everything here started as a bad idea and got promoted.",
      "A personal museum of controlled technical disasters.",
      "Built first, questioned later, fixed eventually.",
      "Not polished, just aggressively debugged.",
      "What if nonsense had version control?",
      "The vibes are unstable but the links work.",
      "Low ceremony, high weirdness, usable outcomes.",
      "A peaceful place to store loud ideas.",
      "Half engineering, half goblin impulse.",
      "This page has survived multiple questionable decisions.",
      "Still not a brand. Still somehow functional.",
      "Yes, this is the clean version.",
      "If it looks intentional, that was an accident.",
      "Curated nonsense with acceptable uptime.",
      "Ship now, roast later, patch forever.",
      "A tiny kingdom of practical bad decisions.",
    ],
    projects: [
      "Two projects, both suspiciously functional.",
      "A compact shelf of things that refused to die.",
      "Small list, big personality disorder.",
      "Proof that stubbornness can be productive.",
      "Everything here was born from mild annoyance.",
      "Minimal clutter, maximum side quest energy.",
      "Features first, dignity later.",
      "A short lineup of overcommitted ideas.",
      "Tiny portfolio, loud intent.",
      "Projects selected by survivability, not elegance.",
      "Built under pressure, named under duress.",
      "These shipped despite my better judgement.",
      "No filler, just polished weirdness.",
      "A controlled leak of my side projects.",
      "Workable chaos, neatly categorized.",
      "Fewer projects, fewer lies.",
      "Each card is a solved problem with attitude.",
      "Small roster, unreasonable commitment.",
    ],
    contact: [
      "Email is open. Regret is optional.",
      "Yes, a real inbox exists.",
      "Send bugs, ideas, or respectful chaos.",
      "No form builder. Just direct communication.",
      "Corporate tone gets filtered by gravity.",
      "If something broke, say so.",
      "If something worked, that is suspicious.",
      "Questions welcome, buzzwords discouraged.",
      "Reach out if your idea is strange but useful.",
      "Support inbox with mild emotional damage.",
      "Still easier than scheduling a meeting.",
      "Serious messages accepted. Weird ones encouraged.",
      "One email, many possible bad decisions.",
      "Yes, this is the official goblin hotline.",
      "If it is urgent, include context and mercy.",
      "No bots, no forms, no fake friendliness.",
      "Contact page powered by basic literacy.",
      "Ask clearly, get a real answer.",
    ],
    default: [
      "Pick a lane, then drift through it.",
      "Stable enough for public viewing.",
      "Neatly packaged nonsense.",
      "Built with intent and occasional concern.",
      "Technical chaos, responsibly deployed.",
      "Not corporate, not sorry, still usable.",
    ],
  };

  const nodes = Array.from(document.querySelectorAll("[data-rotate-options]"));
  nodes.forEach((node) => {
    const inlineOptions = (node.dataset.rotateOptions || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);
    const extraOptions = extraOptionsByPage[pageKey] || extraOptionsByPage.default;
    const options = Array.from(new Set([...inlineOptions, ...extraOptions]));

    if (!options.length) return;
    const index = Math.floor(Math.random() * options.length);
    node.textContent = options[index];
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
  const nameNoteEl = document.getElementById("name-note");
  const leaderboardEl = document.getElementById("leaderboard");
  const leaderboardNoteEl = document.getElementById("leaderboard-note");

  const startBtn = document.getElementById("btn-start");
  const pauseBtn = document.getElementById("btn-pause");
  const restartBtn = document.getElementById("btn-restart");

  const CELL = 20;
  const idleNameNotes = [
    "Type a name first. Anonymous failure has no legacy.",
    "Name your snake. We need someone to blame cleanly.",
    "No name, no run, no excuses. Pick one.",
    "Give it a name so the leaderboard can laugh correctly.",
    "No paperwork, no public shaming.",
    "Enter a name. The wall wants a target.",
  ];
  const nameRoastPools = {
    live: {
      defaultish: [
        "Saved as {name}. Brave to pick the default setting for your identity.",
        "Saved as {name}. Corporate placeholder energy, zero shame.",
        "Saved as {name}. Your creativity died before the first turn.",
        "Saved as {name}. The walls did not need this little effort.",
      ],
      short: [
        "Saved as {name}. Short name, short fuse, short run incoming.",
        "Saved as {name}. Minimal letters, maximal liability.",
        "Saved as {name}. Compact branding for compact disasters.",
        "Saved as {name}. Cute and efficient, like your future crash.",
      ],
      long: [
        "Saved as {name}. Long name, same tiny reaction time.",
        "Saved as {name}. You spent all your budget on syllables.",
        "Saved as {name}. Epic title, beginner movement.",
        "Saved as {name}. Novel length identity, speedrun lifespan.",
      ],
      allcaps: [
        "Saved as {name}. All caps cannot out-yell the wall.",
        "Saved as {name}. Loud typography, quiet skill.",
        "Saved as {name}. Shouting noted. Directional competence not found.",
        "Saved as {name}. Peak volume, average survival.",
      ],
      numeric: [
        "Saved as {name}. Serial number confirmed. Human judgement unclear.",
        "Saved as {name}. Looks like a password, plays like a mistake.",
        "Saved as {name}. Spreadsheet name, tragic pathing.",
        "Saved as {name}. You named yourself a code and still decode into walls.",
      ],
      smash: [
        "Saved as {name}. That name looks like a keyboard panic.",
        "Saved as {name}. Excellent gibberish, suspiciously on-brand.",
        "Saved as {name}. Did your cat file this name for you?",
        "Saved as {name}. Random letters, consistent failure trajectory.",
      ],
      repeated: [
        "Saved as {name}. Repeating letters like your mistakes.",
        "Saved as {name}. Pattern detected: commitment to bad loops.",
        "Saved as {name}. You really trusted one letter this much.",
        "Saved as {name}. Duplicate characters, duplicate regrets.",
      ],
      edgy: [
        "Saved as {name}. Dark name, bright wall impact.",
        "Saved as {name}. Intimidating label, very calm collapse.",
        "Saved as {name}. Villain branding, side-character reflexes.",
        "Saved as {name}. You named a final boss and drove like an intern.",
      ],
      general: [
        "Saved as {name}. The board is eager to witness your decline.",
        "Saved as {name}. Confidence entered the chat. Skill is buffering.",
        "Saved as {name}. Premium label, discount decision making.",
        "Saved as {name}. The snake has concerns and no legal defense.",
        "Saved as {name}. You are now accountable for this timeline.",
        "Saved as {name}. Good. Your failures are now properly attributed.",
      ],
    },
    saved: {
      defaultish: [
        "{name} was loaded from storage. Still generic, still cursed.",
        "{name} is back. The minimum effort legend continues.",
        "{name} restored. Originality remains on leave.",
      ],
      short: [
        "{name} restored. Efficient branding for inefficient steering.",
        "{name} loaded. Tiny name, big collision energy.",
        "{name} is back. Still concise, still dangerous to yourself.",
      ],
      long: [
        "{name} restored. Long name, short patience.",
        "{name} loaded. Dramatic title, familiar problems.",
        "{name} is back. Still overnamed, still underprepared.",
      ],
      allcaps: [
        "{name} restored in full volume.",
        "{name} loaded. Still yelling into the void.",
        "{name} is back. Caps lock could not save you.",
      ],
      numeric: [
        "{name} restored. Barcode personality, human errors.",
        "{name} loaded. Numeric identity, emotional gameplay.",
        "{name} is back. Still reading like a failed unlock code.",
      ],
      smash: [
        "{name} restored. Keyboard chaos returns.",
        "{name} loaded. Random letters, predictable outcomes.",
        "{name} is back. Still looks like a panic typo.",
      ],
      repeated: [
        "{name} restored. Repetition is your lifestyle.",
        "{name} loaded. Echoed letters, echoed mistakes.",
        "{name} is back. Loop behavior confirmed.",
      ],
      edgy: [
        "{name} restored. Edgy name, same fragile route.",
        "{name} loaded. Grim branding, comedic endings.",
        "{name} is back. Menacing title, polite crash speed.",
      ],
      general: [
        "{name} restored. History has resumed its bad decisions.",
        "{name} loaded. Welcome back to intentional chaos.",
        "{name} is back. The walls remember you.",
        "{name} restored. Legacy mode: public embarrassment.",
      ],
    },
  };
  const deathRoastPools = {
    wall: {
      awful: [
        "{name} hit a wall at {score}. Fastest route to humiliation found.",
        "{name} reached {score} and headbutted architecture.",
        "{name} lost to a straight line at {score}.",
      ],
      rough: [
        "{name} met the boundary at {score}. Early and loud.",
        "{name} clipped a wall at {score}. Confidence exceeded skill.",
        "{name} reached {score} then argued with concrete.",
      ],
      mid: [
        "{name} hit a wall at {score}. Respectable run, bad ending.",
        "{name} made it to {score}, then forgot edges exist.",
        "{name} reached {score} and donated the run to geometry.",
      ],
      strong: [
        "{name} posted {score} then threw it at a wall.",
        "{name} had {score} and still picked brick as a destination.",
        "{name} got to {score}. Choke delivered with precision.",
      ],
      elite: [
        "{name} reached {score} and still died to a wall. Historic throw.",
        "{name} had a monster run at {score}, then faceplanted the border.",
        "{name} scored {score} and ended it with premium stupidity.",
      ],
    },
    self: {
      awful: [
        "{name} self-collided at {score}. You trapped yourself immediately.",
        "{name} tied a knot at {score}. Catastrophically efficient.",
        "{name} hit your own tail at {score}. Friendly fire speedrun.",
      ],
      rough: [
        "{name} folded into yourself at {score}. Artistic but fatal.",
        "{name} reached {score} then body-checked your own history.",
        "{name} self-destructed at {score}. Very on-brand.",
      ],
      mid: [
        "{name} self-collided at {score}. Decent run, tragic awareness.",
        "{name} reached {score} then invented a personal traffic jam.",
        "{name} looped into doom at {score}.",
      ],
      strong: [
        "{name} had {score} and still ate your own tail.",
        "{name} reached {score}, then executed a deluxe self-own.",
        "{name} put up {score} and lost to yourself anyway.",
      ],
      elite: [
        "{name} reached {score} and still managed self-sabotage.",
        "{name} had an elite run at {score}, then folded in half.",
        "{name} posted {score}. Final boss defeated: yourself.",
      ],
    },
    generic: {
      awful: [
        "{name} died at {score}. Not even the warmup survived.",
        "{name} ended at {score}. Brief, loud, memorable for bad reasons.",
        "{name} crashed at {score}. The snake did not consent to this.",
      ],
      rough: [
        "{name} died at {score}. Enough to hurt, not enough to brag.",
        "{name} finished at {score}. Mediocre chaos achieved.",
        "{name} ended at {score}. Tragic middle-management energy.",
      ],
      mid: [
        "{name} died at {score}. Solid run, criminal finish.",
        "{name} ended at {score}. Good effort, questionable final turn.",
        "{name} crashed at {score}. Could have been worse, somehow.",
      ],
      strong: [
        "{name} died at {score}. Strong run, catastrophic closing act.",
        "{name} ended at {score}. That was almost respectable.",
        "{name} finished at {score}. Painful but impressive.",
      ],
      elite: [
        "{name} died at {score}. Elite score, deeply cursed ending.",
        "{name} ended at {score}. The throw was cinematic.",
        "{name} crashed at {score}. Everyone is both impressed and upset.",
      ],
    },
  };
  const highScoreRoastPools = {
    tiny: {
      awful: [
        "{name} set a new best: {score}. Improvement by inches, ego by miles.",
        "{name} new best {score} (+{delta}). Barely progress, still progress.",
      ],
      rough: [
        "{name} new best {score} (+{delta}). Congratulations on minimal growth.",
        "{name} improved to {score}. Tiny upgrade, loud celebration pending.",
      ],
      mid: [
        "{name} nudged the best to {score} (+{delta}). Reluctantly noted.",
        "{name} squeezed out a new best: {score}. Bare minimum heroics.",
      ],
      strong: [
        "{name} hit a new best of {score} by {delta}. Annoyingly competent.",
        "{name} updated best to {score}. Small delta, large attitude.",
      ],
      elite: [
        "{name} reached {score} and still only beat best by {delta}. Petty greatness.",
        "{name} new best {score}. Tiny margin, massive smug potential.",
      ],
    },
    moderate: {
      awful: [
        "{name} raised best to {score} (+{delta}). Unpleasantly effective.",
        "{name} improved by {delta} to {score}. Better than expected.",
      ],
      rough: [
        "{name} new best {score} (+{delta}). Fine. Keep acting surprised.",
        "{name} moved the record to {score}. This is becoming a pattern.",
      ],
      mid: [
        "{name} posted a new best: {score} (+{delta}). I hate to admit that was solid.",
        "{name} improved to {score}. Moderate jump, maximum annoyance.",
      ],
      strong: [
        "{name} shoved best to {score} (+{delta}). Reluctant respect granted.",
        "{name} dropped a real upgrade: {score}. This is getting inconvenient.",
      ],
      elite: [
        "{name} reached {score} (+{delta}). You are making this harder to mock.",
        "{name} set best to {score}. The snake is visibly annoyed.",
      ],
    },
    big: {
      awful: [
        "{name} leaped to {score} (+{delta}). Suddenly competent and obnoxious.",
        "{name} nuked the old best with {score}. Disturbing behavior.",
      ],
      rough: [
        "{name} smashed best to {score} (+{delta}). That was not supposed to happen.",
        "{name} jumped by {delta} to {score}. Someone has been practicing, sadly.",
      ],
      mid: [
        "{name} blasted past old best: {score} (+{delta}). Painfully legit.",
        "{name} posted {score}. Big jump. Terrible for my narrative.",
      ],
      strong: [
        "{name} detonated the old record with {score} (+{delta}). Grossly effective.",
        "{name} hit {score}. Large improvement. Confidence now unbearable.",
      ],
      elite: [
        "{name} dropped {score} (+{delta}). Huge gain, deeply upsetting.",
        "{name} crushed the previous best at {score}. I object on principle.",
      ],
    },
    absurd: {
      awful: [
        "{name} somehow jumped to {score} (+{delta}). This timeline is broken.",
        "{name} posted a ridiculous new best: {score}. I am filing a complaint.",
      ],
      rough: [
        "{name} exploded best to {score} (+{delta}). Completely rude.",
        "{name} made a huge leap to {score}. Statistically offensive.",
      ],
      mid: [
        "{name} launched the best to {score} (+{delta}). Unreasonably strong.",
        "{name} rewrote your record at {score}. I hate this for me.",
      ],
      strong: [
        "{name} posted {score} (+{delta}). That was a hostile takeover.",
        "{name} obliterated old best with {score}. I am annoyed and impressed.",
      ],
      elite: [
        "{name} set a monstrous best: {score} (+{delta}). Disgusting excellence.",
        "{name} hit {score}. Catastrophic improvement. Please calm down.",
      ],
    },
  };
  const BASE_MS = 132;
  const SPEEDUP_EVERY = 6;
  const SPEED_FACTOR = 0.96;
  const MIN_TICK_MS = 64;
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
  let storedBest = Number(localStorage.getItem(LS_BEST) || 0);
  let best = storedBest;
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

  function classifyScoreBracket(rawScore) {
    const scoreValue = Number(rawScore) || 0;
    if (scoreValue <= 3) return "awful";
    if (scoreValue <= 10) return "rough";
    if (scoreValue <= 22) return "mid";
    if (scoreValue <= 40) return "strong";
    return "elite";
  }

  function classifyImprovementTier(rawDelta) {
    const delta = Math.max(0, Number(rawDelta) || 0);
    if (delta <= 2) return "tiny";
    if (delta <= 7) return "moderate";
    if (delta <= 18) return "big";
    return "absurd";
  }

  function classifyNameProfile(rawName) {
    const name = String(rawName || "");
    const compact = name.replace(/[\s_-]/g, "");
    const lowered = compact.toLowerCase();
    const letters = lowered.replace(/[^a-z]/g, "");
    const digits = (lowered.match(/[0-9]/g) || []).length;
    const vowels = (letters.match(/[aeiou]/g) || []).length;
    const defaultishSet = new Set([
      "guest",
      "player",
      "user",
      "anon",
      "anonymous",
      "default",
      "newplayer",
      "snake",
      "snek",
      "test",
      "admin",
      "name",
    ]);
    const repeated = /(.)\1{2,}/i.test(name);
    const edgy = /(dark|death|doom|killer|slayer|reaper|rage|blood|demon|devil|grim|void|shadow|night|war|lord|king|666|xx+)/i.test(lowered);
    const allCaps = /[A-Z]/.test(name) && name === name.toUpperCase();
    const mostlyNumbers = compact.length >= 3 && (digits / Math.max(compact.length, 1)) >= 0.6;
    const keyboardSmash =
      letters.length >= 5 &&
      (vowels / letters.length) < 0.22 &&
      (new Set(letters.split("")).size / letters.length) > 0.58;
    const shortName = compact.length > 0 && compact.length <= 3;
    const longName = compact.length >= 13;
    const defaultish = defaultishSet.has(lowered);

    let primary = "general";
    if (defaultish) primary = "defaultish";
    else if (mostlyNumbers) primary = "numeric";
    else if (allCaps) primary = "allcaps";
    else if (keyboardSmash) primary = "smash";
    else if (repeated) primary = "repeated";
    else if (edgy) primary = "edgy";
    else if (shortName) primary = "short";
    else if (longName) primary = "long";

    const categories = [primary];
    if (primary !== "allcaps" && allCaps) categories.push("allcaps");
    if (primary !== "numeric" && mostlyNumbers) categories.push("numeric");
    if (primary !== "smash" && keyboardSmash) categories.push("smash");
    if (primary !== "repeated" && repeated) categories.push("repeated");
    if (primary !== "edgy" && edgy) categories.push("edgy");
    if (primary !== "short" && shortName) categories.push("short");
    if (primary !== "long" && longName) categories.push("long");
    if (!categories.includes("general")) categories.push("general");

    return { categories };
  }

  function currentPlayerName() {
    return activeName || sanitizeName(playerEl.textContent || "", "Guest");
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
    return leaderboardBest === null ? storedBest : leaderboardBest;
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
    playerEl.textContent = resolved || "Unset";
    if (syncInput) {
      nameInput.value = resolved;
    }
    syncBestDisplay();
    return resolved;
  }

  function showNameRoast(name, source = "live") {
    const resolvedName = sanitizeName(name || "", "");
    if (!resolvedName) return;

    const sourcePools = source === "saved" ? nameRoastPools.saved : nameRoastPools.live;
    const profile = classifyNameProfile(resolvedName);
    const lines = profile.categories
      .flatMap((category) => sourcePools[category] || [])
      .filter(Boolean);
    const pool = lines.length ? lines : (sourcePools.general || []);
    const template = pickMessage(`name-${source}`, pool);
    if (!template) return;
    setNameNote(fillRoast(template, { name: resolvedName }), false);
  }

  function showDeathRoast(cause = "generic", finalScore = score) {
    const scoreBracket = classifyScoreBracket(finalScore);
    const causePools = deathRoastPools[cause] || deathRoastPools.generic;
    const pool = causePools[scoreBracket] || deathRoastPools.generic[scoreBracket] || deathRoastPools.generic.mid;
    const template = pickMessage(`death-${cause}`, pool);
    if (!template) return;
    setNameNote(fillRoast(template, {
      name: currentPlayerName(),
      score: finalScore,
    }), true);
  }

  function showHighScoreRoast(newBestScore, oldBestScore) {
    const delta = Math.max(0, (Number(newBestScore) || 0) - (Number(oldBestScore) || 0));
    const improvementTier = classifyImprovementTier(delta);
    const scoreBracket = classifyScoreBracket(newBestScore);
    const tierPools = highScoreRoastPools[improvementTier] || highScoreRoastPools.tiny;
    const pool = tierPools[scoreBracket] || tierPools.mid || highScoreRoastPools.tiny.mid;
    const template = pickMessage(`highscore-${improvementTier}`, pool);
    if (!template) return;

    setNameNote(fillRoast(template, {
      name: currentPlayerName(),
      score: Number(newBestScore) || 0,
      oldBest: Number(oldBestScore) || 0,
      delta,
    }), false);
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
    if (score > storedBest) {
      storedBest = score;
      localStorage.setItem(LS_BEST, String(storedBest));
    }
    syncBestDisplay();

    if (!running || score <= runStartingBest) return;
    const nextTier = classifyImprovementTier(score - runStartingBest);
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
