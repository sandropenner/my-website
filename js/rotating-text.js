(function () {
  const Site = window.Site || (window.Site = {});

function initRotatingText() {
  const pageKey = (document.body && document.body.dataset && document.body.dataset.page) || "default";
  const heroData = (window.SiteData && window.SiteData.heroLines && window.SiteData.heroLines.byPage) || {};
  const fallbackOptions = ["Not corporate, not sorry, still usable."];

  const nodes = Array.from(document.querySelectorAll("[data-rotate-options]"));
  nodes.forEach((node) => {
    const inlineOptions = (node.dataset.rotateOptions || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);
    const extraOptions = heroData[pageKey] || heroData.default || fallbackOptions;
    const options = Array.from(new Set([...inlineOptions, ...extraOptions].filter(Boolean)));

    if (!options.length) return;
    const index = Math.floor(Math.random() * options.length);
    node.textContent = options[index];
  });
}

  Site.initRotatingText = initRotatingText;
})();
