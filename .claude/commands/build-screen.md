---
description: Build one or more prototype screens from the specs by screen ID (e.g. /build-screen CP-12 CP-13)
---

Build these screens: $ARGUMENTS

1. For each screen ID, find its section in the matching spec (`grep -n "^### <ID>" docs/0*.md`) and read only that section plus any screen it links to.
2. Check `docs/data-model.md` and `docs/seed-data.md` for the entities and demo values the screen needs. Check `docs/design-system.md` for components and styling.
3. Show a short plan first: files to create or change, store actions and engines needed, any gaps or contradictions in the spec. Wait for my OK.
4. Build it following CLAUDE.md rules: store actions only, engines with tests, i18n strings, shared UI components, simulated parts marked `// SIMULATED:`.
5. Run `npm run typecheck` and `npm run test` and fix failures.
6. Tell me how to see it in the browser (route and persona), and list anything from the spec you could not build.
7. Tick the item in `docs/build-plan.md`.
