# Student-Valut UI/UX audit

Date: 2026-11-20

## Current product state

The deployed architecture is a Fastify web service that serves the built React SPA under `/app/` and redirects `/` there; Vite and React Router both use the `/app/` base. The React app already has a shared emerald/sage token system, responsive workspace shell, compact mobile navigation, reduced-motion support, Framer Motion page transitions, a lazily loaded R3F/ShaderGradient decoration, API-backed student records, Clerk-hosted authentication redirects, GuruGraph insights, and a role-scoped teacher workflow. The UI pass preserves those data and security boundaries.

## Critical usability problems

- Authentication uses Clerk's supported sign-in/sign-up redirect flow. A custom credential modal would replace or obscure verification and redirect handling, so the account actions must remain clear and use the existing provider flow.
- No critical data-loss or authorization defect was observed in the UI paths reviewed. The teacher screens continue to use the existing server-authorized APIs.

## Major visual inconsistencies

- The public route was a short list of four study tools. It did not explain the wider topic → evidence → next-step workflow or distinguish student and teacher use.
- The hero's shader art was decorative and did not show the actual product's academic workspace.
- The student dashboard used a generic greeting and did not surface GuruGraph's existing evidence-aware summary or subject-level assessment averages.
- Teacher pages were functionally complete but dense; their form and class-workspace hierarchy needed clearer shared styling.

## Missing interaction feedback

- Global button/card feedback existed, but the public brand had no pointer-proximity treatment and the hero had no pointer-responsive light.
- Shared controls had no named motion tokens, making transition timing difficult to keep consistent.

## Responsive and accessibility issues

- The public page had no responsive feature/story sections or compact product preview.
- Product features and navigation needed direct, meaningful destinations and clear keyboard focus.
- Decorative previews needed to be identified as illustrative so they could not be mistaken for account records.

## Optional polish

- An extensive Sakuga canvas would add duplicate canvas work, top-layer effects, and Japanese/cloud effects the brief explicitly excludes. A lightweight adaptation of its spring/tactile interaction principles fits the existing Framer Motion and CSS system better.
- The original Sakuga repository describes 12 no-dependency web controls and a shared effects canvas. Its button source includes cloud and Japanese lettering effects; the project is MIT licensed. No upstream source code or assets were copied, so no third-party source/license file was added. Reference: https://github.com/finktheartist/sakuga-vfx

## Implementation and verification notes

This audit was followed by a public-page redesign, a real-data dashboard improvement, shared motion-token refinements, and responsive interaction styling. The dashboard now surfaces saved handwriting records and authenticated student follow-up plans from the existing API. The local preview uses the existing Clerk `openSignIn`/`openSignUp` flow; there is no local publishable key, so local account actions correctly report that authentication is unavailable and preserve guest access.

The Vite preview rendered in the in-app browser at its default narrow viewport and a landing-page screenshot was captured. A read-only public request returned HTTP 200. The live HTML had an empty Clerk key because the key was only wired as a Docker build-time value; the backend now injects the validated public `CLERK_PUBLISHABLE_KEY` into the SPA HTML at runtime, with an injection/security regression test. After deployment, confirm the variable exists in Render and verify that the public HTML contains the public key without printing it. The exact 1440×900, 768×1024, and 390×844 screenshots, protected dashboard routes, live Clerk interaction, browser console/network, and post-release rendering are not yet verified. The browser's viewport-control capability and Playwright CLI were unavailable; the npm registry request for the CLI failed with DNS `ENOTFOUND`. The UI/UX Pro Max search helper was also unavailable because Python was not installed; responsive and motion guidance was applied from the skill checklist.

The Sakuga gallery itself was inaccessible to the web reader, but the upstream GitHub repository was reviewed. It uses springy control interactions alongside smoke effects and Japanese lettering; Student-Valut borrows only the restrained spring/tactile interaction idea. No upstream code/assets were copied. Reference/license: https://github.com/finktheartist/sakuga-vfx (MIT).

Verification: frontend tests 38 files/249 passed using two Vitest workers; frontend lint and production build passed (the existing lazy ShaderGradient chunk remains above Vite's 500 kB advisory). Backend tests 50 total (49 passed; isolated PostgreSQL test skipped), typecheck and build passed; backend lint had zero errors and two pre-existing `any` warnings. The npm Playwright CLI could not be fetched because registry DNS was unavailable.
