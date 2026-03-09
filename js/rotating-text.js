(function () {
  const Site = window.Site || (window.Site = {});

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

  Site.initRotatingText = initRotatingText;
})();