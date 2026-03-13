# UX Cycle Report

## Findings
- `src/components/Navbar.tsx` still relied on heavy inline layout styling, which made top-nav polish inconsistent and harder to tune across breakpoints.
- `src/app/(auth)/login/page.tsx` used large inline style blocks for hero messaging/proof cards, reducing readability and visual consistency with shared premium primitives.
- `src/app/globals.css` had reusable auth primitives, but lacked dedicated layout tokens for the login hero and structured navbar shell.

## Proposals considered (quality gate)
- ✅ **Accepted**: Introduce dedicated premium layout classes in `src/app/globals.css` for auth hero (`auth-hero-*`) and navbar shell (`wot-navbar-*`) to enforce spacing rhythm, responsive behavior, and token consistency.
- ✅ **Accepted**: Refactor `src/app/(auth)/login/page.tsx` to remove ad-hoc inline styling and use semantic auth hero classes with clearer copy/proof composition.
- ✅ **Accepted**: Refactor `src/components/Navbar.tsx` to class-based structure, preserving behavior while improving maintainability and consistent premium branding.
- ❌ **Rejected**: Navigation information architecture change (reordering controls and adding new menu groups) due to out-of-scope UX risk for this cycle.

## Implemented changes
- `src/app/globals.css`
  - Added `auth-hero-*` classes for shell, layout, headings, proof cards, and form positioning.
  - Added `wot-navbar-*` classes for frame/layout/search/actions/guest state.
  - Added responsive refinements for auth hero spacing/typography and navbar compact behavior on mobile.
- `src/app/(auth)/login/page.tsx`
  - Replaced inline style-heavy structure with semantic class-driven hero layout.
  - Consolidated proof items into a typed local array for cleaner render readability.
- `src/components/Navbar.tsx`
  - Replaced inline nav container/action/search styling with class-driven structure.
  - Preserved all existing logic (admin access, share link, privacy/theme toggles, auth state actions).

## Verification results
- `./node_modules/.bin/eslint src/components/Navbar.tsx 'src/app/(auth)/login/page.tsx'` → **Pass**
- `npm run type-check` → **Pass**

## review_ready
- [x] Navbar now follows a consistent premium shell and spacing system via reusable classes.
- [x] Login hero content is more readable and maintainable with semantic auth-hero primitives.
- [x] Auth and nav surfaces now share stronger token-driven visual consistency and responsive polish.

## Git
- Commit hash: `39b7296`
- Commit message: `Refine navbar and login hero with premium UX styling`

---

## Cycle Date
- March 13, 2026

## Findings
- `src/components/LandingPage.tsx` still had ad-hoc inline styling for the closing CTA and build tag, reducing consistency with shared premium primitives.
- Shared branded surfaces (landing cards and brand lockup) lacked consistent interactive polish and motion/accessibility behavior.
- `src/app/globals.css` navbar treatment stayed visually heavy in light mode compared to the rest of the premium surface system.

## Proposals considered (quality gate)
- ✅ **Accepted**: Add reusable landing CTA/build-tag classes in `src/app/globals.css` and apply them in `src/components/LandingPage.tsx` to reduce one-off styling and strengthen branding consistency.
- ✅ **Accepted**: Introduce `premium-panel-hover` + lightweight entrance motion classes, then apply them to landing proof/feature/metric cards for clearer affordance and premium feel.
- ✅ **Accepted**: Add brand lockup hover/focus states and reduced-motion handling to improve usability and accessibility.
- ✅ **Accepted**: Add a light-theme override for `.wot-navbar` so visual elevation is balanced across themes.
- ❌ **Rejected**: Full landing-page class extraction (all inline styles) because it is large-scope refactor risk for this focused cycle.

## Implemented changes
- `src/components/LandingPage.tsx`
  - Applied `premium-panel-hover` and staggered `rise-in` classes to proof cards, feature cards, and metric cards.
  - Replaced inline CTA section styling with semantic class-based structure (`landing-cta-*`).
  - Replaced inline build-tag styling with shared `landing-build-tag`.
- `src/app/globals.css`
  - Added `landing-cta-*`, `landing-build-tag`, `premium-panel-hover`, and `rise-in` utility classes.
  - Added brand lockup interaction states (`hover` + `focus-visible`).
  - Added light-mode navbar refinement (`body.light .wot-navbar`) for cleaner premium balance.
  - Added `prefers-reduced-motion` safeguards for the new motion/hover transitions.

## Verification results
- `npm run type-check` → **Pass**
- `npm run lint -- 'src/components/LandingPage.tsx' 'src/app/page.tsx' 'src/components/Navbar.tsx' 'src/app/(auth)/login/page.tsx'` → **Pass**
- Note: Initial lint command failed once due unquoted shell path with parentheses; retried once with quoted paths and passed.

## review_ready
- [x] Landing CTA and build-tag styling now use reusable premium classes.
- [x] Landing cards now have consistent interaction affordance and restrained entrance motion.
- [x] Brand lockup and motion behavior now include explicit accessibility-conscious interaction handling.
- [x] Light-theme navbar elevation now better matches surrounding premium surfaces.

---

## Cycle Date
- March 13, 2026 (06:30 Europe/Amsterdam cycle)

## Findings
- `src/components/LandingPage.tsx` hero headline and signed-in state still relied on one-off inline styling, making typography rhythm and premium state messaging less consistent.
- Hero reassurance copy (“No credit card · 2-minute setup · Free forever”) rendered as plain text, underplaying trust/value cues.
- `src/app/globals.css` lacked dedicated classes for signed-in hero status and trust microcopy, reducing reuse and cross-breakpoint consistency.

## Proposals considered (quality gate)
- ✅ **Accepted**: Create dedicated landing hero classes (`landing-hero-title`, `landing-hero-title-accent`) in `src/app/globals.css` and replace inline hero heading styles in `src/components/LandingPage.tsx`.
- ✅ **Accepted**: Add signed-in status chip classes (`landing-signed-in-*`) and apply to the authenticated hero CTA area for clearer hierarchy and premium polish.
- ✅ **Accepted**: Convert reassurance line into semantic trust-row markup (`landing-trust-row`) for improved readability and visual structure.
- ❌ **Rejected**: Full landing inline-style migration for all sections in this run due scope risk and potential regression surface.

## Implemented changes
- `src/components/LandingPage.tsx`
  - Replaced inline hero title styling with reusable class-based headline/accent structure.
  - Reworked authenticated user state into a styled status chip with clearer label/link hierarchy.
  - Converted trust copy into semantic segmented row with separators.
- `src/app/globals.css`
  - Added `landing-hero-title` and `landing-hero-title-accent` for responsive premium heading behavior.
  - Added `landing-signed-in`, `landing-signed-in-label`, `landing-signed-in-link` (+ hover/focus-visible) for authenticated hero polish and accessibility.
  - Added `landing-trust-row` and mobile refinements to preserve readability/alignment on small screens.

## Verification results
- `npm run lint -- 'src/components/LandingPage.tsx'` → **Pass**
- `npm run type-check` → **Pass**
- `npm run lint -- 'src/components/LandingPage.tsx' 'src/app/globals.css'` → TSX pass; CSS path ignored by ESLint config (non-blocking warning).

## review_ready
- [x] Hero headline now uses reusable responsive typography classes for cleaner visual consistency.
- [x] Signed-in hero state now presents account context in a premium status chip with improved hierarchy.
- [x] Trust reassurance microcopy now has structured, scannable presentation instead of raw inline text.

---

## Cycle Date
- March 13, 2026 (07:00 Europe/Amsterdam cycle)

## Findings
- `src/components/PublicPortfolioView.tsx` relied on dense inline styling across the entire public allocation surface, making consistency and maintainability weak versus newer premium class-based pages.
- Category rows had minimal hierarchy (no holdings count/expand affordance), reducing scan speed for users reviewing public portfolios.
- Mobile readability for return pills and weight values was cramped due a fixed 4-column row layout.

## Proposals considered (quality gate)
- ✅ **Accepted**: Replace inline styling in `src/components/PublicPortfolioView.tsx` with semantic class names and centralized token-driven styles in `src/app/globals.css` for premium consistency.
- ✅ **Accepted**: Add category-level micro-hierarchy (holdings count + expand chevron state) to improve UX discoverability without changing behavior.
- ✅ **Accepted**: Add responsive grid adaptation for allocation rows on small screens to improve readability and tap-target clarity.
- ❌ **Rejected**: Introducing drag handles/icons per row this cycle because it adds visual noise and interaction complexity relative to current scope.

## Implemented changes
- `src/components/PublicPortfolioView.tsx`
  - Refactored component from inline-style-heavy layout to semantic classes (`public-allocation-*`).
  - Added category microcopy (`N holdings`) and chevron open/closed indicator for clearer interaction cues.
  - Kept drag/drop and move-category API behavior unchanged; improved structural readability.
- `src/app/globals.css`
  - Added complete public allocation style system (`public-allocation-*`) with premium surface treatment, hover/focus transitions, and theme-aware light-mode refinements.
  - Added reusable positive/negative/neutral performance pill styles.
  - Added mobile breakpoint rules for two-row compact item layout.

## Verification results
- `npm run lint -- 'src/components/PublicPortfolioView.tsx'` → **Pass**
- `npm run type-check` → **Pass**

## review_ready
- [x] Public portfolio allocation view now uses centralized premium styling primitives instead of ad-hoc inline styles.
- [x] Category headers provide clearer hierarchy (name, holdings count, percentage, expand state).
- [x] Mobile row layout is more readable with better spacing and preserved information density.

## Git
- Commit hash: `68a7590`
- Commit message: `Polish public allocation view with premium styling system`
