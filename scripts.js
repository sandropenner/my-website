const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

const stars = [];
const STAR_COUNT = 140;
let shootingStar = null;
let width = 0;
let height = 0;
let animationFrameId = null;
let lastShot = 0;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  stars.length = 0;
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.2,
      alpha: Math.random() * 0.65 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.003,
    });
  }
}

function spawnShootingStar(timestamp) {
  shootingStar = {
    x: Math.random() * width * 0.7,
    y: Math.random() * height * 0.35,
    length: Math.random() * 90 + 120,
    speedX: Math.random() * 8 + 9,
    speedY: Math.random() * 5 + 6,
    life: 0,
    maxLife: 55,
  };
  lastShot = timestamp;
}

function drawBackgroundGlow() {
  const gradient = ctx.createRadialGradient(width * 0.15, height * 1.05, 0, width * 0.15, height * 1.05, width * 0.7);
  gradient.addColorStop(0, 'rgba(44, 88, 255, 0.2)');
  gradient.addColorStop(0.35, 'rgba(17, 43, 116, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(timestamp) {
  for (const star of stars) {
    const alpha = star.alpha + Math.sin(timestamp * star.speed + star.pulse) * 0.18;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, alpha)})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawShootingStar() {
  if (!shootingStar) return;

  const tailX = shootingStar.x - shootingStar.length;
  const tailY = shootingStar.y - shootingStar.length * 0.65;
  const opacity = 1 - shootingStar.life / shootingStar.maxLife;

  const gradient = ctx.createLinearGradient(shootingStar.x, shootingStar.y, tailX, tailY);
  gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

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

function animate(timestamp = 0) {
  ctx.clearRect(0, 0, width, height);
  drawBackgroundGlow();
  drawStars(timestamp);

  if (!shootingStar && timestamp - lastShot > 2800) {
    spawnShootingStar(timestamp);
  }

  drawShootingStar();
  animationFrameId = window.requestAnimationFrame(animate);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('beforeunload', () => {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
  }
});

resizeCanvas();
animate();
