# Logisco prototype — project rules

## What this is
A frontend-only, clickable prototype of Logisco’s AI-enabled B2B Parcel & PTL platform (Model B: multi-leg stitched network). **No backend, no database, no real APIs.** All data is static seed data held in a browser store. The goal is a production-like experience a reviewer can play with.

One launcher opens four apps that share the same data:
1. **Customer Portal** (`/customer`) — B2B shippers. Spec: `docs/01-customer-portal.md` (CP-xx)
2. **Partner Portal** (`/partner`) — partner company office. Spec: `docs/02-partner-portal.md` (PP-xx)
3. **Partner App** (`/app`) — riders, drivers, hub staff, shown in a phone frame. Spec: `docs/03-partner-app.md` (PA-xx)
4. **Logisco ERP + Control Tower** (`/erp`) — Logisco staff. Spec: `docs/04-erp-control-tower.md` (ERP-xx)

Client’s original document: `docs/00-source-workflow.md`.

## Read before building
- The spec section for the screen(s) you are building — find it with `grep -n "^### CP-13" docs/01-customer-portal.md`. Do not read whole spec files unless asked.
- `docs/data-model.md` for entities and engines.
- `docs/seed-data.md` for every name, ID and number. **Never invent demo data that conflicts with it.**
- `docs/design-system.md` for colours, fonts, layout and components.
- `docs/build-plan.md` for what to build next. Tick items when done.

## Stack
React + TypeScript + Vite · Tailwind CSS + shadcn/ui · React Router · Zustand (persist to localStorage, BroadcastChannel sync) · i18next (English + Hindi) · Recharts · Leaflet + OpenStreetMap · SheetJS · Vitest. Static hosting (Vercel / Netlify).

## Folder layout
```
src/
  apps/customer/        screens named by ID, e.g. CP13BookShipment.tsx
  apps/partner-portal/
  apps/partner-app/
  apps/erp/
  launcher/
  shared/
    ui/                 shared components (design-system.md §6)
    store/              Zustand store, actions, demo clock, reset
    engines/            pure business logic + tests
    i18n/               en.json, hi.json
    types.ts
  data/                 seed JSON + seeded generator
public/brand/           logo
```

## Hard rules
1. **Specs are the source of truth.** Build the fields, options, actions and rules in the spec table for that screen ID. If something is missing or contradictory, ask; don’t guess silently.
2. **All state goes through the store.** No component keeps business data of its own. Apps change state by calling store actions; shipment status changes only by adding an `Event` that the status engine reduces (data-model.md).
3. **Business logic lives in `src/shared/engines/`** as pure functions with Vitest tests using the seed-data numbers (e.g. hero shipment total ₹3,628.26).
4. **Time comes from `demoNow`** in the store, never `Date.now()`.
5. **Simulated things are marked** with a `// SIMULATED:` comment (OTP, KYC checks, payment, e-sign, GPS, AI outputs) and wrapped in helpers in `src/shared/sim/` so they can be swapped for real services later.
6. **Every user-facing string goes through i18n** (`t('…')`), English first; Hindi keys may be filled later.
7. Use shared UI components; style with design tokens and `var(--accent)`; no hard-coded colours in screens.
8. Indian formats: `₹1,80,000.00` via `Intl.NumberFormat('en-IN')`, dates `23-Nov-2026`, 24-hour time.
9. Keep screens realistic: loading skeleton, empty state, success toast, confirm dialog for money / destructive actions.
10. Small, reviewable changes. After each build-plan item: `npm run typecheck && npm run test`, check in the browser, commit with the screen IDs in the message (e.g. `feat(customer): CP-12 get quote`).

## Commands
- `npm run dev` — start
- `npm run typecheck` — TypeScript check
- `npm run test` — Vitest
- `npm run build` — production build

## Gotchas (learned in Phases 0–1)
- **Windows drive letter (`c:` vs `C:`) duplicates modules.** Keep the aliases in `vite.config.ts` root-relative (`/src/...`), never absolute file paths, or Vite serves one module under two URLs (two stores, two i18n instances, broken tab sync). Import shared code via `@shared/...` everywhere, including `main.tsx`. Don't `import … from 'vitest'` in `src/test-setup.ts`; use the globals.
- **Colours:** the app accent is `primary` (`bg-primary`, `text-primary`, `bg-primary-soft`, `hover:bg-primary-hover`). shadcn's `accent` means the light hover background. Semantic tokens are declared on `[data-app]` as well as `:root`, so each app's `--accent` takes effect.
- **Custom type sizes** (`text-table`, `text-caption`, …) are registered with tailwind-merge in `src/shared/lib/utils.ts`; add new ones there, or `cn()` will drop text colours.
- **Shipments are created with `bookShipment()`** (`src/shared/store/booking.ts`), never by hand. LR serials are unique across city codes because job ids carry only the serial. `LGS-DEL-000781` is reserved for the live hero booking.
- **Background movement:** shipments with a `sim` plan move when the demo clock advances (`src/shared/sim/journey.ts`). A live action on a background shipment should remove its `sim` plan.
- **Menus are data** (`src/apps/*/nav.ts`): the same `visible` rules hide menu items and block their URLs. Register a built screen in that app's routes by screen id; until then it shows a placeholder.
- **`npx shadcn add …`** writes components into `src/shared/ui/` but imports `cn` from a package called `"cn"` and installs that unrelated npm package. After every add: `npm uninstall cn` and replace `from "cn"` with `from "@/shared/lib/utils"`.
- After changing the seed or data shape, bump `STORE_VERSION` in `src/shared/store/store.ts` so browsers drop old saved data.

## Do not
- Add a backend, database, auth service or paid API key.
- Change seed-data.md values to make code easier; change code instead, or ask.
- Build placeholder departments (ERP-45) beyond the template.
