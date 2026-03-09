(function () {
  const Site = window.Site || (window.Site = {});

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

  Site.initStarfield = initStarfield;
})();