Personal site v6

What changed:
- Home, Projects, Snek, and Contact are now separate pages.
- Projects nav has a hover/focus dropdown so you can jump directly to ChromeTabber or Snek.
- Snek has its own cleaner page instead of living on the projects shelf.
- Contact is its own page instead of a scroll target.
- Open Graph / Twitter preview tags were added to each page.
- og-preview.png was added as the social preview image.
- ChromeTabber and Snek now use local preview art files instead of cluttering every page.

Deployment notes:
- Keep CNAME at the root for GitHub Pages custom domain support.
- Keep og-preview.png at the root so the Open Graph tags resolve correctly.
- Snek still uses the Firebase client config already wired in scripts.js.
