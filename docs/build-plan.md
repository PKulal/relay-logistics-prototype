# Build plan

Work top to bottom. One unchecked item (or a small group) per Claude Code session. After each item: type-check, run tests, look at it in the browser, tick the box here, commit.

Screen IDs: CP = Customer Portal (01), PP = Partner Portal (02), PA = Partner App (03), ERP = ERP & Control Tower (04).

## Phase 0 — Project setup
- [x] Vite + React + TypeScript project; Tailwind; shadcn/ui; React Router; Zustand; i18next; Recharts; Leaflet; SheetJS; Vitest
- [x] Folder structure as in CLAUDE.md; path aliases (`@shared`, `@apps`, `@data`)
- [x] Fonts and colour tokens from design-system.md; `--accent` per app
- [x] Lint, type-check and test scripts working

## Phase 1 — Foundation
- [x] Types (`src/shared/types.ts`) from data-model.md
- [x] Store with persistence, `demoNow`, `resetDemo()`, BroadcastChannel sync between tabs
- [x] Seed data JSON from seed-data.md (hero shipment, customers, partners, staff, rate cards, pincodes, lanes, settings) + seeded generator for ~120 background shipments
- [x] Engines with unit tests: chargeableWeight, pricing, ewayBill, assignment, margin, status (event reducer)
- [x] Shared UI kit (design-system.md §6)
- [x] Launcher: four app cards → persona picker → mock login (OTP 123456)
- [x] Four app shells: Customer Portal, Partner Portal, ERP (sidebar layouts); Partner App (PhoneFrame + bottom tabs per role)
- [x] Demo toolbar: switch app / persona, advance time, inject exception, run weekly scoring, offline toggle, simulation labels, reset

## Phase 2 — Shipment spine (hero shipment end to end)
- [x] CP-11 Dashboard (live counts)
- [x] CP-12 Get quote (real calculation) → must show ₹3,628.26 for the hero inputs
- [x] CP-13 Book shipment (6 steps) → CP-14 Confirmation (labels, LR, e-way bill)
- [x] Leg planner runs on booking (assignment engine) → 5 legs created
- [x] ERP-05 Live job board, ERP-03 Shipment 360
- [x] PP-11 Dashboard, PP-12 Job inbox, PP-13 Job detail, PP-14 Assign to staff
- [x] PA-05 Home, PA-06 Tasks, PA-07 Scanner, PA-14 to PA-17 Pickup
- [x] PA-19 / PA-20 Hand-over give / receive (two phone frames)
- [x] PA-25 to PA-29 Hub flow
- [x] PA-21 to PA-24 Driver trip (moving map marker)
- [x] PA-31 to PA-33 Delivery with e-POD
- [x] CP-16 Shipments list, CP-17 Tracking (timeline updates live), CP-18 Public tracking + appointment
- [x] End-to-end check: book → deliver across all four apps with no page refresh

## Phase 3 — Onboarding
- [x] Customer: CP-04 to CP-10; ERP-26, ERP-27 (Sales), ERP-30 (credit), ERP-22/23 (rate card)
  - [x] Part 3a: CP-04 sign-up, CP-05 qualification, CP-06 KYC, CP-07 credit; ERP-26 pipeline, ERP-27 review (qualification, lane-cost, track, KYC), ERP-30 credit review; Demo toolbar "Manual onboarding approvals"
  - [x] Part 3b: CP-08 rate card and contract, CP-09 integration, CP-10 tracker and pilot; ERP-22/23 rate cards and approvals; ERP-27 issue contract, pilot plan, Mark live
- [x] Partner: PP-04 to PP-10; ERP-11 to ERP-14 (applications, KYC desk, commercials, trial)
  - [x] Part 4a: PP-04 registration (/partner/apply), PP-05 status and network fit, PP-06 documents and KYC (§4.1 checklist, GSTIN / PAN / penny-drop / Vahan / Sarathi / DigiLocker, OCR flags), PP-07 outcome and hub audit; ERP-11 applications, ERP-12 KYC desk and hub audit; automatic partner decisions under "Manual onboarding approvals"
  - [x] Part 4b: PP-08 rate card and agreement (counter-proposals, AI margin check, Aadhaar OTP / DSC e-sign, self-billing consent), PP-09 go-live setup (API sandbox for A / E, Partner App staff with photo and ID, training), PP-10 tracker and trial; ERP-13 commercials with Pricing approval below target, ERP-14 trial and go-live at Bronze. Arriving line-haul trips score as trial jobs (the hero trip TRP-2026-0931 is Deccan's third)
- [ ] Deccan Roadlines mid-trial; “complete third trip” demo action → go-live at Bronze
- [ ] Hindi for the web portals: fill the missing Hindi strings in the Customer Portal, Partner Portal and ERP screens built so far (client §14: English + Hindi in every app); new screens ship with Hindi

## Phase 4 — Exceptions and money
- [ ] Weight revision: PA-16 “Measure larger” → CP-19 / CP-20 → ERP Finance
- [ ] NDR: PA-35 → CP-21 + WhatsApp preview (CP-18) → reattempt task back to PA
- [ ] Control Tower: ERP-06 at-risk list, ERP-07 exceptions, ERP-08 reassign (000790 → QuickLink), ERP-09, ERP-10
- [ ] Claims: CP-22 → ERP-36 / ERP-37 (liability engine) → PP-22 deduction
- [ ] Customer money: CP-23 wallet, CP-24 invoices, CP-25 COD, PA-34 COD collection, ERP-31, ERP-34
- [ ] Partner money: PP-25 to PP-28; ERP-32 3-way match (₹72), ERP-33 payout batch with maker-checker
- [ ] PP-20 escalations, PP-21 delivery exceptions, PA-18 pickup failed, PA-30 short / excess, PA-12 SOS

## Phase 5 — Depth
- [ ] Scoring: ERP-16 run, PP-23 scorecard, PP-24 tier, ERP-17 / PP-39 suspension (FastTrack Logistics)
- [ ] Network: ERP-18 to ERP-21; PP-18 capacity, PP-19 coverage
- [ ] Pricing: ERP-24 margin monitor, ERP-25 simulator
- [ ] Leadership ERP-04; Sales ERP-28, ERP-29; light departments ERP-39 to ERP-41; ERP-45 placeholders
- [ ] Settings and admin: CP-28 to CP-37, PP-29 to PP-38, PA-08 to PA-13, PA-36, ERP-42 to ERP-44
- [ ] AI assistants (scripted intents) in all four apps; AI decision log entries

## Phase 6 — Polish and QA
- [ ] Hindi translations: Partner App complete; key screens in the other apps
- [ ] Guided tour on the launcher (10-step demo script from ERP spec §11.3)
- [ ] Empty, loading and error states on every list
- [ ] Reset demo, then run every journey in the four specs’ “main journeys” tables
- [ ] Deploy to Vercel / Netlify; share link
