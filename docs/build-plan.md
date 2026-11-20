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
- [x] Deccan Roadlines mid-trial; “complete third trip” demo action → go-live at Bronze (Demo toolbar → Scenarios; the hero trip TRP-2026-0931 arrives for real if it is on the road, otherwise it is scored for the trial only)
- [x] Hindi for the web portals: fill the missing Hindi strings in the Customer Portal, Partner Portal and ERP screens built so far (client §14: English + Hindi in every app); new screens ship with Hindi (847 strings added; `src/shared/i18n/i18n.test.ts` fails if a key or placeholder is missing in Hindi)

## Phase 4 — Exceptions and money
- [x] Weight revision: PA-16 “Measure larger” → CP-19 / CP-20 → ERP Finance (CP-19 exception queue, CP-20 accept / dispute with evidence and AI check, ERP-31 Weight disputes tab; 48-hour auto-accept on the demo clock)
- [x] NDR: PA-35 → CP-21 + WhatsApp preview (CP-18) → reattempt task back to PA (first response applies; 24 h no response → reattempt next working day; 3rd failed attempt → RTO with RTO charge)
- [x] Control Tower: ERP-06 at-risk list, ERP-07 exceptions, ERP-08 reassign (000790 → QuickLink), ERP-09, ERP-10 (auto-tickets for pickup missed, delay and e-way bill expiry; SOS panel fills with PA-12)
- [x] Claims: CP-22 → ERP-36 / ERP-37 (liability engine) → PP-22 deduction (CLM-2026-0142 settled / deducted, CLM-2026-0151 under investigation)
  - [ ] Maker-checker on claim settlement: ERP-37 spec has Claims Officer (maker) and Claims Head (approver); seed-data.md has only Farhan Ali, so he decides and approves for now
  - [ ] Claim outcome feeds the partner's damage / on-time / responsiveness KPIs (source §10 Step 5) — with the Phase 5 scoring item
- [x] Customer money: CP-23 wallet, CP-24 invoices, CP-25 COD, PA-34 COD collection, ERP-31, ERP-34
- [x] Partner money: PP-25 to PP-28; ERP-32 3-way match (₹72), ERP-33 payout batch with maker-checker
- [x] PP-20 escalations, PP-21 delivery exceptions, PA-18 pickup failed, PA-30 short / excess, PA-12 SOS (acknowledge / resolve times recorded for the Responsiveness KPI; scored with weekly scoring in Phase 5)

## Phase 5 — Depth
- [x] Scoring: ERP-16 run, PP-23 scorecard, PP-24 tier, ERP-17 / PP-39 suspension (FastTrack Logistics)
- [x] Network: ERP-18 to ERP-21; PP-18 capacity, PP-19 coverage
- [x] Pricing: ERP-24 margin monitor, ERP-25 simulator
- [x] Leadership ERP-04; Sales ERP-28, ERP-29; light departments ERP-39 to ERP-41; ERP-45 placeholders
- [x] Settings and admin: CP-28 to CP-37, PP-29 to PP-38, PA-08 to PA-13, PA-36, ERP-42 to ERP-44 (CP-35, PP-37, PA-11 AI assistants come with the next item; per-event notification channels, tracking-page branding, recurring pickups, partner support tickets, rate-revision requests, bulk vehicle upload and approval limits left out: no basis in the client document)
- [x] AI assistants (scripted intents) in all four apps; AI decision log entries (assistant actions, credit risk, lead score, SKU outlier, document OCR, weight check)

## Phase 6 — Polish and QA
- [x] Hindi translations: Partner App complete; key screens in the other apps (notification text worded in Hindi via `src/shared/i18n/dataText.ts`)
- [x] Guided tour on the launcher (10-step demo script from ERP spec §11.3; `src/launcher/tour/`, e2e test `demo-script.test.ts`)
- [x] Empty, loading and error states on every list (lazy apps with skeleton, error boundary)
- [x] Reset demo, then run every journey in the four specs’ “main journeys” tables (all 89 menu screens opened without errors; §11.3 script run end to end)
- [ ] Deploy to Vercel / Netlify; share link
