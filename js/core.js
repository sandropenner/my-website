(function () {
  const Site = window.Site || (window.Site = {});

  function initYear() {
    const yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

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

  Site.initPagePrefetching = initPagePrefetching;
  Site.initNavMenus = initNavMenus;

  function bootstrap() {
    initYear();
    Site.initPagePrefetching();
    Site.initNavMenus();

    if (typeof Site.initStarfield === "function") {
      Site.initStarfield();
    }
    if (typeof Site.initRotatingText === "function") {
      Site.initRotatingText();
    }

    const isSnekPage =
      ((document.body && document.body.dataset && document.body.dataset.page === "snek") ||
      !!document.getElementById("snake-canvas"));

    if (isSnekPage && typeof Site.initSnakeGame === "function") {
      Site.initSnakeGame();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();