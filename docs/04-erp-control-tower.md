# Logisco — ERP & Control Tower Specification (v0.1, 18-Nov-2026)

Source of truth for this app. Screen IDs are used in code and commits. "Source §x" = client workflow document (00-source-workflow.md); "Assumed" = our proposal, listed in Section 12.

# 1. Introduction

## 1.1 Purpose

This document specifies the Logisco ERP and its Operations Control Tower: the web application Logisco staff use to run the business. Logisco owns no fleet or hubs. It runs a virtual control tower over partners, and the ERP is where it plans the network, prices, assigns legs, watches every shipment, handles exceptions and claims, and moves money between customers and partners (source §1, §2).

The document is the build reference for the clickable prototype. In the prototype the ERP is the demo hub: every action taken in the Customer Portal, Partner Portal or Partner App shows up here, and actions here (reassign, approve, publish scores, release payouts) flow back to those apps.

## 1.2 Scope and depth

The source lists a Leadership office and 16 departments (§11). Building all of them in depth is not needed to prove Model B. This specification builds the departments that carry the Model B story in full, gives three more a light version, and shows the rest as placeholder pages (Section 2.2).

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>In scope</strong></th>
<th><strong>Out of scope</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p>Login, shell, Shipment 360, Leadership dashboard.</p>
<p>Full: Control Tower, Partner Management, Network Planning, Pricing, Sales &amp; Key Accounts, Finance, Claims.</p>
<p>Light: Customer Success, Hub &amp; PTL Operations, Compliance &amp; Legal.</p>
<p>Administration: users and roles, audit and AI logs, system settings.</p></td>
<td><p>Marketing &amp; Growth, Quality &amp; Audit, HR &amp; Admin, Procurement, Sustainability (placeholder pages only).</p>
<p>Real integrations (NIC e-way bill / e-invoice, GSTN, bank, payment gateway, insurance, ULIP); these are simulated.</p>
<p>Real AI models; outputs are pre-computed or scripted.</p></td>
</tr>
</tbody>
</table>

## 1.3 Traceability and how to read

- Every screen states its basis: “Source §x” or “Assumed”. Assumptions needing confirmation are listed in Section 12.

- Field tables: Field, Type, Req., Rules / options, Sample (demo data). For list screens, the “fields” are the columns.

- Worked numbers use the same demo shipment as the other three specifications: LGS-DEL-000781, Sharma Electricals, Delhi → Hubballi, Express PTL, 162 kg.

# 2. ERP Overview

## 2.1 What the ERP does in Model B

In Model B every shipment is one master shipment with 2–5 legs, each run by a different partner. Billing, tracking, claims and partner scoring all work on legs (source §2.2). The ERP is where those legs are planned, priced, watched and paid.

## 2.2 Departments and prototype depth

| **\#** | **Department** | **Group** | **Depth** | **Screens** |
|---|---|---|---|---|
| 0 | Leadership & Strategy | Leadership | Full (dashboard) | ERP-04 |
| 1 | Sales & Key Accounts | Revenue | Full | ERP-26 to ERP-29 |
| 2 | Marketing & Growth | Revenue | Placeholder | ERP-45 |
| 3 | Pricing & Revenue Mgmt | Revenue | Full | ERP-22 to ERP-25 |
| 4 | Customer Success & Support | Revenue | Light | ERP-39 |
| 5 | Partner (Vendor) Mgmt | Network & Operations | Full | ERP-11 to ERP-17 |
| 6 | Network Planning | Network & Operations | Full | ERP-18 to ERP-21 |
| 7 | Operations Control Tower | Network & Operations | Full | ERP-05 to ERP-10 |
| 8 | Hub & PTL Operations | Network & Operations | Light | ERP-40 |
| 9 | Finance & Accounts | Control & Support | Full | ERP-30 to ERP-35 |
| 10 | Claims, Risk & Insurance | Control & Support | Full | ERP-36 to ERP-38 |
| 11 | Compliance & Legal | Control & Support | Light | ERP-41 |
| 12 | Quality & Audit | Control & Support | Placeholder | ERP-45 |
| 13 | HR & Admin | Enablers | Placeholder | ERP-45 |
| 14 | Technology, Data & AI | Enablers | Admin screens | ERP-42 to ERP-44 |
| 15 | Procurement | Enablers | Placeholder | ERP-45 |
| 16 | Sustainability (ESG) | Enablers | Placeholder | ERP-45 |

## 2.3 Engines inside the ERP

| **Engine** | **What it does** | **Used in** | **Source** |
|---|---|---|---|
| Leg planner and assignment | Splits a shipment into legs; picks a partner per leg by eligibility then score, cost, transit | Booking, ERP-08, ERP-20 | §8 |
| Rate and margin engine | Prices quotes; checks every quote and rate line against partner costs and target margin; learns loss-making lanes | Quotes, ERP-13, ERP-22 to ERP-25 | §8.1 |
| SLA and ETA prediction | Predicts delays and ranks shipments likely to fail today | ERP-05, ERP-06 | §11.1, §12 |
| Partner scoring and tiers | Weekly score on 6 KPIs; tier changes and consequences | ERP-16 | §5.2, §5.3 |
| 3-way match | Partner invoice lines vs rate card × verified weight × e-POD | ERP-32 | §9 |
| Liability engine | Finds the leg and partner holding the shipment at the fault point | ERP-37 | §10 |

## 2.4 How the ERP connects to the other apps

| **Comes in from** | **Goes out to** |
|---|---|
| Customer Portal: sign-ups, bookings, weight-revision responses, NDR choices, claims, payments | Customer Portal: credit decisions, contracts, ETAs, invoices, claim settlements, COD remittances |
| Partner Portal: applications, documents, acceptances / flags, escalation responses, disputes, coverage requests | Partner Portal: fit result, KYC outcome, agreement, jobs, tier, deductions, payouts |
| Partner App: every scan, hand-over, trip event, delivery, failure, SOS | Partner App: reassigned jobs, reattempt instructions, e-way bill updates |

# 3. Users, Roles and Approvals

## 3.1 Roles (proposed)

The source says Logisco staff across 16 departments use the ERP with role-based access, single sign-on and two-factor login (§1, §14), but does not list roles. The roles below follow the departments built in this prototype.

| **Role** | **Department** | **Main jobs** | **Demo persona** |
|---|---|---|---|
| Leadership | 0 | Command dashboard, board pack, approvals above limits | Rahul Khanna, CEO |
| Sales Executive / KAM | 1 | Leads, onboarding review, contracts, account 360, RFQs | Arjun Mehta, KAM |
| Pricing Analyst / Head | 3 | Rate cards, approvals, margin monitor, simulator | Divya Nair, Pricing Head |
| Customer Success Agent | 4 | Tickets, NDR follow-ups, account health | Farah Khan |
| Partner Manager / Onboarding Coordinator | 5 | Applications, KYC desk, commercials, trials, scorecards, suspension | Meera Iyer |
| Network Planner | 6 | Pincodes, lanes, leg rules, coverage gaps | Karthik Rao |
| Control Tower Operator / Ops Lead | 7 | Live board, at-risk list, exceptions, reassignments, partner health | Sanjay Rao (Operator) |
| Hub Ops Coordinator | 8 | Hub monitor, appointment desk | Pooja Menon |
| Finance Executive / Finance Head | 9 | Credit, invoicing, collections, 3-way match, payouts, COD | Lakshmi N. (Executive) |
| Claims Officer / Claims Head | 10 | Claims desk, investigation, settlement, insurer claims | Farhan Ali |
| Compliance Officer | 11 | E-way bill monitor, registers | Neeta Joshi |
| Super Admin | 14 | Users, roles, settings, logs; sees everything (useful for demos) | Admin |

## 3.2 Access by role

Full = view and act in the department; View = read-only; every role can open Shipment 360 and the screens of its own department.

| **Role** | **Full access** | **View access** |
|---|---|---|
| Leadership | ERP-04, approvals above limits | All departments |
| Sales / KAM | ERP-26 to ERP-29 | Pricing simulator, customer credit status, Shipment 360 (without leg costs) |
| Pricing | ERP-22 to ERP-25; approval of partner rate lines (ERP-13) | Lane P&L, partner directory |
| Customer Success | ERP-39 | Exceptions queue, account 360 |
| Partner Management | ERP-11 to ERP-17 | Partner health, coverage gaps, payouts |
| Network Planning | ERP-18 to ERP-21 | Partner directory |
| Control Tower | ERP-05 to ERP-10 | Partner directory, hub monitor |
| Hub Ops | ERP-40 | Live job board |
| Finance | ERP-30 to ERP-35 | Customer and partner 360, claims |
| Claims | ERP-36 to ERP-38 | Shipment 360 evidence, partner 360 |
| Compliance | ERP-41 | Audit log |
| Super Admin | Everything, including ERP-42 to ERP-44 | — |

## 3.3 Maker-checker approvals

The source requires that AI never changes a contract rate, pays money or closes a claim on its own: a person approves (§12). This specification adds a second-person check on the money and partner-status actions below (assumed).

| **Action** | **Maker** | **Checker / approver** | **Screen** |
|---|---|---|---|
| Customer rate card or discount | Pricing Analyst / KAM | Pricing Head (Leadership if margin gap \> 3 points) | ERP-22, ERP-23 |
| Partner rate line below target margin | Partner Manager | Pricing Head | ERP-13 |
| Credit limit | Finance Executive | Finance Head (above ₹10 lakh) | ERP-30 |
| Partner payout batch / COD remittance | Finance Executive | Finance Head | ERP-33, ERP-34 |
| Claim settlement | Claims Officer | Claims Head | ERP-37 |
| Partner suspension final step | Partner Manager | Ops Lead | ERP-17 |
| Leg rules and cut-offs change | Network Planner | Ops Lead | ERP-20 |

# 4. Navigation and Cross-Department Flows

## 4.1 Menu

- Leadership: Command dashboard.

- Revenue: Sales & Key Accounts · Marketing & Growth · Pricing & Revenue · Customer Success.

- Network & Operations: Partner Management · Network Planning · Control Tower · Hub & PTL Operations.

- Control & Support: Finance · Claims · Compliance · Quality & Audit.

- Enablers: HR & Admin · Technology (users, logs, settings) · Procurement · Sustainability.

## 4.2 Flows that cross departments

| **Flow** | **Departments and screens in order** |
|---|---|
| Partner onboarding | Partner Mgmt ERP-11 (fit) → ERP-12 (KYC, audit) → ERP-13 (commercials; Pricing approves) → ERP-14 (trial, go-live) → Network Planning sees new coverage |
| Customer onboarding | Sales ERP-26 → ERP-27 (qualification, track) → Finance ERP-30 (credit) → Pricing ERP-22 / ERP-23 (rate card) → Sales issues contract → pilot → live |
| Shipment day | Booking → leg planner → Control Tower ERP-05 / ERP-06 → exceptions ERP-07 → reassign ERP-08 → delivered |
| Weekly partner cycle | Partner Mgmt ERP-16 scoring run → tiers published → assignment priority and payout speed change → Finance ERP-33 payouts by tier |
| Month-end | Finance ERP-31 invoices with e-PODs → collections → ERP-32 3-way match → ERP-33 payouts → ERP-35 lane P&L → Leadership board pack |
| Claim | Customer Portal claim → Claims ERP-36 → ERP-37 liability → settle customer in 7 days → partner deduction in ERP-33 → partner score updated |

# 5. Screen Inventory

The ERP has 45 screens, grouped in 11 modules. ERP-45 is a single template used for five placeholder departments.

| **ID** | **Screen** | **Module** | **Used by** | **Basis** |
|---|---|---|---|---|
| ERP-01 | Staff login (SSO + two-factor) | Access, home and shared screens | All Logisco staff | Source |
| ERP-02 | Home and app shell | Access, home and shared screens | All | Source |
| ERP-03 | Shipment 360 | Access, home and shared screens | All (sections by role) | Source |
| ERP-04 | Command dashboard | Leadership and strategy (Department 0) | Leadership, Super Admin | Source |
| ERP-05 | Live job board | Operations Control Tower (Department 7) | Control Tower Operator, Ops Lead (others view) | Source |
| ERP-06 | SLA risk list (AI) | Operations Control Tower (Department 7) | Control Tower Operator, Ops Lead | Source |
| ERP-07 | Exceptions queue | Operations Control Tower (Department 7) | Control Tower Operator, Ops Lead, Customer Success (view) | Source |
| ERP-08 | Reassign leg (manual override) | Operations Control Tower (Department 7) | Control Tower Operator, Ops Lead | Source |
| ERP-09 | Partner health | Operations Control Tower (Department 7) | Control Tower, Partner Management | Source |
| ERP-10 | Daily review pack | Operations Control Tower (Department 7) | Ops Lead, Leadership | Source |
| ERP-11 | Partner applications | Partner (Vendor) Management (Department 5) | Partner Manager, Onboarding Coordinator | Source |
| ERP-12 | KYC verification desk and hub audit | Partner (Vendor) Management (Department 5) | Onboarding Coordinator, Partner Manager (approves) | Source |
| ERP-13 | Partner commercials and agreement | Partner (Vendor) Management (Department 5) | Partner Manager (maker), Pricing (checker) | Source |
| ERP-14 | Trial monitoring and go-live | Partner (Vendor) Management (Department 5) | Partner Manager | Source |
| ERP-15 | Partner directory and partner 360 | Partner (Vendor) Management (Department 5) | Partner Management, Control Tower, Network Planning (view), Finance (view) | Source |
| ERP-16 | Scorecard run and tier review | Partner (Vendor) Management (Department 5) | Partner Manager (publish) | Source |
| ERP-17 | Suspension and offboarding case | Partner (Vendor) Management (Department 5) | Partner Manager (maker), Ops Lead (checker) | Source |
| ERP-18 | Pincode and ODA master | Network Planning (Department 6) | Network Planner (edit), others view | Source |
| ERP-19 | Lanes, hubs and transit times | Network Planning (Department 6) | Network Planner | Source |
| ERP-20 | Leg rules, cut-offs and assignment settings | Network Planning (Department 6) | Network Planner (edit), Ops Lead (approve) | Source |
| ERP-21 | Coverage gaps and forecasts | Network Planning (Department 6) | Network Planner, Partner Management | Source |
| ERP-22 | Customer rate cards | Pricing and Revenue Management (Department 3) | Pricing Analyst (edit), Pricing Head (approve) | Source |
| ERP-23 | Discount and rate approvals | Pricing and Revenue Management (Department 3) | Pricing Head, Leadership (above limit) | Source |
| ERP-24 | Margin monitor and lane-loss alerts | Pricing and Revenue Management (Department 3) | Pricing, Leadership, Finance | Source |
| ERP-25 | Quote and margin simulator | Pricing and Revenue Management (Department 3) | Pricing, Sales / KAM | Source |
| ERP-26 | Leads and pipeline | Sales and Key Accounts (Department 1) | Sales Executive, KAM, Sales Head | Source |
| ERP-27 | Customer onboarding review | Sales and Key Accounts (Department 1) | Sales Executive / KAM, Sales Head | Source |
| ERP-28 | Customer account 360 | Sales and Key Accounts (Department 1) | KAM, Customer Success, Finance (view) | Source |
| ERP-29 | RFQ, tenders and proposals (light) | Sales and Key Accounts (Department 1) | KAM, Sales Head | Source |
| ERP-30 | Credit review | Finance and Accounts (Department 9) | Finance Executive (maker), Finance Head (approve) | Source |
| ERP-31 | Customer invoicing and collections | Finance and Accounts (Department 9) | Finance Executive (AR) | Source |
| ERP-32 | Partner payables: 3-way match and dispute desk | Finance and Accounts (Department 9) | Finance Executive (AP) | Source |
| ERP-33 | Payout batches | Finance and Accounts (Department 9) | Finance Executive (maker), Finance Head (approver) | Source |
| ERP-34 | COD reconciliation | Finance and Accounts (Department 9) | Finance Executive | Source |
| ERP-35 | Accounting and P&L (light) | Finance and Accounts (Department 9) | Finance Head, Leadership | Source |
| ERP-36 | Claims desk | Claims, Risk and Insurance (Department 10) | Claims Officer, Claims Head | Source |
| ERP-37 | Claim investigation and liability | Claims, Risk and Insurance (Department 10) | Claims Officer (maker), Claims Head (approve settlement) | Source |
| ERP-38 | Insurer claims (light) | Claims, Risk and Insurance (Department 10) | Claims Officer | Source |
| ERP-39 | Customer Success: tickets and account health | Customer Success, Hub Ops and Compliance (light) | Customer Success Agent, CS Lead | Source |
| ERP-40 | Hub & PTL Operations: hub monitor and appointment desk | Customer Success, Hub Ops and Compliance (light) | Hub Ops Coordinator | Source |
| ERP-41 | Compliance & Legal: e-way bill monitor and registers | Customer Success, Hub Ops and Compliance (light) | Compliance Officer | Source |
| ERP-42 | Users, roles and access control | Technology and administration (Department 14) | Super Admin | Source |
| ERP-43 | Audit log and AI decision log | Technology and administration (Department 14) | Super Admin, Compliance, Technology | Source |
| ERP-44 | System settings (configurable parameters) | Technology and administration (Department 14) | Super Admin (edit); department heads (view) | Source |
| ERP-45 | Placeholder department page | Technology and administration (Department 14) | Users of that department | Source |

# 6. Screen Specifications

## 6.1 Access, home and shared screens

### ERP-01 Staff login (SSO + two-factor)

| | |
|---|---|
| **Purpose** | Logisco staff sign in with single sign-on and a second factor. |
| **Used by** | All Logisco staff |
| **Opened from** | ERP URL; launcher card in the prototype |
| **Basis** | Source §14 (single sign-on, two-factor login for staff) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Sign in with company account | Button | Yes | Single sign-on (e.g. Microsoft / Google Workspace) | — |
| Second factor | OTP / authenticator code | Yes | 6 digits | 123456 |
| Language | Dropdown | Yes | English \| हिन्दी | English |

**Actions**

| **Action** | **What happens** |
|---|---|
| Sign in | Opens the user’s home department (ERP-02) |

**Business rules**

- Sessions expire after 8 hours or 30 minutes idle (assumed). Every login is written to the audit log (ERP-43).

**Prototype notes**

- Role chips instead of SSO: Leadership, Control Tower, Partner Management, Network Planning, Pricing, Sales / KAM, Finance, Claims, Super Admin.

### ERP-02 Home and app shell

| | |
|---|---|
| **Purpose** | Frame around every ERP screen: department menu, global search, alerts and the AI briefing for the user’s role. |
| **Used by** | All |
| **Opened from** | After login |
| **Basis** | Source §11 (16 departments in 4 groups + Leadership); §12 (AI assistant for segment C) |

**Elements**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Left menu | Grouped menu | — | Leadership \| Revenue (Sales, Marketing, Pricing, Customer Success) \| Network & Operations (Partner Mgmt, Network Planning, Control Tower, Hub & PTL Ops) \| Control & Support (Finance, Claims, Compliance, Quality) \| Enablers (HR, Technology, Procurement, Sustainability). Only departments the role can open are shown. | — |
| Global search | Text | — | LR / AWB, customer, partner, invoice, claim, ticket, trip, application | LGS-DEL-000781 |
| Alerts bell | Icon + count | — | SLA breaches, approvals waiting, SOS, AI flags | 7 |
| Approvals inbox | Icon + count | — | Items waiting for this user’s approval (maker-checker) | 3 |
| Home cards | Cards | — | Role-specific: e.g. Control Tower → at-risk count; Finance → payouts to approve; Partner Mgmt → applications waiting | Applications waiting: 4 |
| AI assistant | Floating panel | — | Ask in English or Hindi; e.g. “Which lanes lost money last week?” | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Search | Opens the matching record (Shipment 360, partner, customer…) |
| Open approval | Opens the item with Approve / Reject |

**Business rules**

- Department screens a role cannot use are hidden. Placeholder departments show a “coming in a later phase” page (ERP-45).

**Prototype notes**

- A demo toolbar is always visible in the ERP: advance time, inject an exception, trigger a scoring run, reset data.

### ERP-03 Shipment 360

| | |
|---|---|
| **Purpose** | The full record of one master shipment and its 2–5 legs: customer, legs and partners, every hand-over, documents, money and tickets. Opened from every department. |
| **Used by** | All (sections by role) |
| **Opened from** | Global search; any shipment link |
| **Basis** | Source §2.2 Design Rule (one master shipment with 2–5 legs; billing, tracking, claims and scoring work on legs) |

**Header**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR, customer, service, status, ETA, SLA | Header | — | | LGS-DEL-000781 · Sharma Electricals · Express PTL · In Transit · ETA 26-Nov · Amber |

**Legs panel (one row per leg)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Leg | Text | — | 1 First mile \| 2 Origin hub \| 3 Line-haul \| 4 Destination hub \| 5 Last mile | 3 Line-haul |
| Partner (type, tier) | Link | — | | Deccan Roadlines (E, Bronze) |
| Status and SLA | Chip + timer | — | Leg status | In progress · amber |
| Hand-over in / out | Scan record | — | Time, staff, photo, seal, both-side confirmation | In 23-Nov 23:04 · SL-44817 |
| Leg cost | Currency | — | From the partner rate card × verified weight | ₹1,458 |

**Tabs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Timeline | List | — | Every event from all apps with source app | — |
| Map | Map | — | Route, hubs, live truck | — |
| Money | Table | — | Customer price build-up, leg costs, risk buffer, margin; invoice and payout links | Margin ₹562.80 (18.3%) |
| Documents | List | — | LR, labels, invoice, e-way bill (validity, Part B), manifests, e-POD, GRN, photos | — |
| Tickets and claims | List | — | | None |
| AI decisions | List | — | ETA predictions, partner ranking, margin check, each with its reason | Delay +2.5 h (traffic) |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reassign leg | ERP-08 |
| Message customer | Template message via WhatsApp / email |
| Call partner (masked) | — |
| Open claim | ERP-37 |
| Extend e-way bill / update Part B | Simulated NIC call |

**Business rules**

- Money tab is visible to Leadership, Pricing, Finance and Super Admin only (assumed).

**Prototype notes**

- The central screen for demos: every action in the other apps appears here.

## 6.2 Leadership and strategy (Department 0)

### ERP-04 Command dashboard

| | |
|---|---|
| **Purpose** | One-page view of the business for leadership, with a daily AI briefing. |
| **Used by** | Leadership, Super Admin |
| **Opened from** | Leadership menu; home for Leadership role |
| **Basis** | Source §11 Dept 0 (command dashboard, OKRs, board packs; daily AI briefing; scenario modelling) |

**KPI tiles (period selector: today / MTD / QTD)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Shipments | Number + trend | — | Booked, delivered | 8,420 MTD |
| Revenue / gross margin | ₹ + % | — | Customer revenue minus leg costs | ₹1.92 Cr / 17.6% |
| On-time delivery | % | — | | 93.1% |
| Claims rate | Per 10,000 pieces | — | | 5.2 |
| Active customers / partners | Numbers | — | | 214 / 86 |
| Cash | ₹ | — | Collections due, payouts due, COD held | — |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Daily AI briefing | Text card | — | 5–7 plain-language bullets: what changed, risks, actions | Delhi→Karnataka margin up 2 pts; 2 Bronze partners near Probation |
| Lane P&L heat map | Heat map | — | Origin × destination region coloured by margin | — |
| Network health | Cards | — | Partners by tier; coverage gaps; hub dwell | Gold 21 · Bronze 18 |
| OKRs | Table | — | Objective, key result, target, actual, owner | On-time ≥ 95% · 93.1% |
| Scenario modelling (light) | Sliders | — | Change volume, fuel %, partner cost → projected margin | Fuel +5% → margin −0.8 pt |

**Actions**

| **Action** | **What happens** |
|---|---|
| Download board pack | PDF of the dashboard for a period |
| Drill into a tile | Opens the owning department screen |

**Prototype notes**

- All numbers are pre-computed seed values except shipment counts, which are live.

## 6.3 Operations Control Tower (Department 7)

### ERP-05 Live job board

| | |
|---|---|
| **Purpose** | Every shipment and leg live, filterable by customer, lane, partner, hub and status. |
| **Used by** | Control Tower Operator, Ops Lead (others view) |
| **Opened from** | Control Tower menu; home for CT roles |
| **Basis** | Source §11.1 (Live Job Board); §11 Dept 7 |

**Filters**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Customer / lane / partner / hub / status / service / SLA state | Multi-selects | — | Saved views per user | SLA: At risk |
| View | Toggle | — | Shipments \| Legs \| Map | Legs |

**Columns (legs view)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR / leg | Link | — | Opens Shipment 360 | LGS-DEL-000781 · L3 |
| Customer | Text | — | | Sharma Electricals |
| Partner (tier) | Text | — | | Deccan Roadlines (Bronze) |
| Leg status | Chip | — | | In progress |
| SLA timer | Timer | — | Green → amber → red | Amber 2 h 10 m |
| Last event | Text | — | Event, place, time | Halt reported, near Nagpur, 06:00 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Row actions | Reassign leg · masked call partner · message customer · open claim · extend e-way bill (source §11.1 One-Click Actions) |

**Prototype notes**

- Rows update live as the other apps act.

### ERP-06 SLA risk list (AI)

| | |
|---|---|
| **Purpose** | AI ranks the 20 shipments most likely to fail today so operators act before the breach. |
| **Used by** | Control Tower Operator, Ops Lead |
| **Opened from** | Control Tower → At risk |
| **Basis** | Source §11.1 (SLA Timers: AI ranks the 20 most likely to fail); §12 (ETA & SLA breach prediction) |

**Columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Rank | Number | — | 1–20 | 3 |
| LR / leg at risk | Link | — | | LGS-DEL-000790 · L1 |
| Risk | % | — | Probability of missing SLA | 78% |
| Why | Text | — | Top reasons from the model | Rider has 7 pending pickups; 25 min left in window |
| Suggested action | Button | — | Reassign to backup \| Call partner \| Inform customer | Reassign to QuickLink |

**Actions**

| **Action** | **What happens** |
|---|---|
| Apply suggestion | Operator confirms; the action runs and is logged with the AI reason |
| Dismiss | With a reason |

**Business rules**

- AI suggests; a person confirms (source §12 guardrails).

**Prototype notes**

- Risk scores are seeded; the demo toolbar can push a shipment into the top 5.

### ERP-07 Exceptions queue

| | |
|---|---|
| **Purpose** | Auto-created tickets for every exception, with the action and target time for each type. |
| **Used by** | Control Tower Operator, Ops Lead, Customer Success (view) |
| **Opened from** | Control Tower → Exceptions |
| **Basis** | Source §10 Steps 1–3 |

**Columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Ticket | Link | — | | EXC-2026-11871 |
| Type | Chip | — | Missed scan \| ETA breach \| Seal mismatch \| Damage photo \| NDR \| Short delivery \| Pickup missed \| E-way bill near expiry \| SOS | Pickup missed |
| Owner | Text | — | Responsible leg partner + Logisco desk | SwiftCity + CT desk |
| Action target | Timer | — | Pickup missed: reassign in 2 h · Seal / short: investigate in 4 h · NDR: same day (source §10) | 1 h 40 m |
| Root cause (AI) | Chip | — | Classified by AI | Partner capacity |
| Customer confirmation | Chip | — | Ticket cannot close without it (source §10 Step 2) | Pending |

**Ticket detail actions by type**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pickup missed | Action | — | Reassign to backup first-mile partner | — |
| Line-haul delay | Action | — | Send new ETA; transfer to faster lane if possible | — |
| Seal mismatch / short | Action | — | Hold, collect photo evidence, investigate previous leg | — |
| NDR | Action | — | WhatsApp with buttons to consignee and shipper | — |
| E-way bill near expiry | Action | — | Extend or update Part B | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Take action | Runs the action for the type |
| Close | Only after customer confirmation is recorded |

### ERP-08 Reassign leg (manual override)

| | |
|---|---|
| **Purpose** | Operator moves a leg to another partner, overriding the assignment engine. |
| **Used by** | Control Tower Operator, Ops Lead |
| **Opened from** | Any reassign action |
| **Basis** | Source §8 (Manual Override: Control Tower can override any leg); §7 Step 3 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Leg | Read-only | — | | LGS-DEL-000790 · L1 First mile |
| Current partner | Read-only | — | | SwiftCity Couriers (Gold 86) |
| Eligible partners | Ranked table | — | Engine ranking: score ↓, cost ↑, transit ↑; capacity left; cost difference | QuickLink (Silver 74, ₹220, capacity ✓) |
| New partner | Select | Yes | | QuickLink Express |
| Reason | Dropdown | Yes | SLA risk \| Partner request \| Capacity \| Quality \| Customer request \| Other | SLA risk |
| Notify | Checkboxes | — | Old partner, new partner, customer | All |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reassign | Old job withdrawn, new job offered in Partner Portal; logged |

**Business rules**

- Reassigning after pickup needs a hand-over plan (e.g. at a hub) (assumed).

### ERP-09 Partner health

| | |
|---|---|
| **Purpose** | Who is behind on pickups, which hubs have high dwell time and which trucks have stopped. |
| **Used by** | Control Tower, Partner Management |
| **Opened from** | Control Tower → Partner health |
| **Basis** | Source §11.1 (Partner Health) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pickups behind | Table | — | Partner, pickups due, done, late, oldest late | SwiftCity · 3 late |
| Hub dwell | Table | — | Hub, average dwell, items over 12 h | Gurugram · 5.2 h |
| Stopped trucks | Table + map | — | Trip, last movement, stop duration, reason if reported | TRP-2026-0931 · 3 h · traffic |
| SOS alerts | List | — | Live SOS from the Partner App | None |

**Actions**

| **Action** | **What happens** |
|---|---|
| Call / message partner | — |
| Open trip / hub | — |

### ERP-10 Daily review pack

| | |
|---|---|
| **Purpose** | Auto-generated operations summary for the morning review. |
| **Used by** | Ops Lead, Leadership |
| **Opened from** | Control Tower → Daily pack |
| **Basis** | Source §11.1 (Daily Review Pack auto-generated at 9 am) |

**Sections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Yesterday | Table | — | Shipments, on-time %, exceptions by type, claims opened | — |
| Partner league | Table | — | Best and worst 5 partners by on-time | — |
| Open risks | List | — | Carried-over exceptions, stuck trucks, hubs over dwell | — |
| AI summary | Text | — | Plain-language summary | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Download / share | PDF; email to the ops group |

**Business rules**

- Generated daily at 9:00 (source).

## 6.4 Partner (Vendor) Management (Department 5)

### ERP-11 Partner applications

| | |
|---|---|
| **Purpose** | All partner applications with their AI network-gap fit score; invite or waitlist. |
| **Used by** | Partner Manager, Onboarding Coordinator |
| **Opened from** | Partner Mgmt → Applications |
| **Basis** | Source §4 Phase 1 Step 2; §11 Dept 5; §12 (Network-Gap Fit Score) |

**Columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Application | Link | — | | APP-2026-0412 |
| Partner / type / legs | Text | — | | Deccan Roadlines · E · Line-haul |
| Coverage | Text | — | Pincodes or lanes | Delhi → Hubballi, Delhi → Belagavi |
| Fit score | 0–100 + reason | — | AI: does Logisco need this partner on these legs? | 88 · no partner on Delhi → Hubballi |
| Status | Chip | — | New \| Invited \| Waitlisted \| Rejected | New |
| Received | Date | — | Target decision same day | 17-Nov 10:20 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Invite | Assign coordinator; onboarding pack sent; Partner Portal shows Invited |
| Waitlist | Re-scored monthly |
| Reject | Reason required |

**Business rules**

- Waitlisted applications are re-scored monthly (source §4 Step 2).

### ERP-12 KYC verification desk and hub audit

| | |
|---|---|
| **Purpose** | Review the partner’s documents and automatic checks, decide the outcome, and run hub audits. |
| **Used by** | Onboarding Coordinator, Partner Manager (approves) |
| **Opened from** | Application → KYC |
| **Basis** | Source §4 Phase 2 Steps 3–4; §12 (Document OCR & KYC Fraud) |

**Checks**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| API checks | Results list | — | GSTIN, PAN, penny-drop, Vahan, Sarathi, DigiLocker | 5 ✓ · 0 ✗ |
| Documents | Viewer + OCR panel | — | Each document with OCR-read values and AI flags (tampered / duplicate / mismatch) | Insurance: expired 30-Sep (flag) |
| Checklist by type | Checklist | — | Required documents for the partner type (§4.1) | 11 of 12 |

**Decision**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Outcome | Radio | Yes | Approved \| Conditionally approved \| Rejected | Conditionally approved |
| Conditions / reasons | Text rows + due date | Cond. | | Renewed GIT insurance in 7 days |

**Hub audit (Type F; E with hub)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Auditor / date | Select / date | Yes | Within 5 days | Kiran P. · 26-Nov |
| Checklist | Pass / Fail / Observation + geo-tagged photos | Yes | Security \| CCTV \| Fire safety \| Docks \| Scale calibration | 5 Pass |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save decision | Partner Portal shows the outcome |
| Request re-upload | Document flagged with reason |

**Business rules**

- Target: KYC within 48 hours; audit within 5 days (source).

### ERP-13 Partner commercials and agreement

| | |
|---|---|
| **Purpose** | Set the partner’s rate card per leg and lane with an AI margin check, SLA, penalties, liability and payment cycle; issue the agreement for e-sign. |
| **Used by** | Partner Manager (maker), Pricing (checker) |
| **Opened from** | Application → Commercials; partner profile |
| **Basis** | Source §4 Phase 3 Step 5 |

**Rate lines**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Leg type / lane or cluster / service | Selects | Yes | | Line-haul · Delhi → Hubballi · Express PTL |
| Rate and unit | ₹ + unit | Yes | Per shipment \| per kg (min) \| per trip \| per piece \| storage per day | ₹9.00 / kg, min 50 kg |
| Partner counter-proposal | Read-only | — | From Partner Portal | — |
| Margin check | Chip | — | AI: does this rate leave Logisco above target margin on this lane at current customer prices? | OK (lane margin 18.3%) |

**Terms**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hand-over windows, cut-offs | Table | Yes | | Hub drop by 21:00 |
| SLA and penalty matrix | Table | Yes | | Late arrival: ₹500 per trip |
| Liability cap | ₹ | Yes | | ₹100 / kg, max ₹10,000 |
| Payment cycle | Read-only | — | Follows tier | Fortnightly (Bronze) |
| Security deposit | ₹ | No | Optional | ₹50,000 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit for approval | Pricing approves lines below target margin |
| Issue agreement | Generated from template; sent for e-sign |
| Load rate card | After signature, into the rate engine |

**Business rules**

- Lines below target margin need Pricing approval (assumed maker-checker).

**Prototype notes**

- Delhi → Belagavi line shows “Below target margin”.

### ERP-14 Trial monitoring and go-live

| | |
|---|---|
| **Purpose** | Follow trial jobs with AI anomaly flags and decide go-live, extension or decline. |
| **Used by** | Partner Manager |
| **Opened from** | Partner Mgmt → Trials |
| **Basis** | Source §4 Phase 5 Steps 7–8 |

**Trial view**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Partner / trial type | Text | — | 10 parcel jobs or 3 PTL / line-haul trips | Deccan Roadlines · 3 trips |
| Jobs | Table | — | Job, on time, scan compliance, anomalies (scans, weights, timings), score | TRP-2026-0931 · 86 |
| Trial score | Gauge | — | Pass ≥ 80 | 84 |
| Decision | Radio | Yes | Go live \| Extend trial \| Decline (reasons) | Go live |

**Actions**

| **Action** | **What happens** |
|---|---|
| Confirm decision | Go live → partner joins the assignment pool at Bronze |

**Business rules**

- See open question 1 (trial pass 80 vs starting tier Bronze).

### ERP-15 Partner directory and partner 360

| | |
|---|---|
| **Purpose** | All partners with type, tier, score, coverage, capacity, documents and contract; one page per partner. |
| **Used by** | Partner Management, Control Tower, Network Planning (view), Finance (view) |
| **Opened from** | Partner Mgmt → Partners |
| **Basis** | Source §11 Dept 5 (onboarding, scorecards, tiers, contracts) |

**Directory columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Partner, type, tier, score, legs, cities / lanes, capacity used, status, docs expiring | Table | — | Status: Onboarding \| Trial \| Live \| Probation \| Suspended \| Offboarded | SwiftCity · B · Gold 86 · Live |

**Partner 360 tabs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Overview | Cards | — | Contacts, coordinator, coverage map, capacity | — |
| Performance | Charts | — | Weekly score by KPI, tier history | — |
| Jobs | Table | — | Live and recent jobs | — |
| Money | Table | — | Earnings, deductions, payouts | — |
| Documents | Table | — | Expiry status | — |
| Contract | PDF + rate card | — | | — |
| Churn risk (AI) | Chip | — | Likely to leave (source §12) | Low |

**Actions**

| **Action** | **What happens** |
|---|---|
| Open improvement plan / start suspension review | ERP-16 / ERP-17 |

### ERP-16 Scorecard run and tier review

| | |
|---|---|
| **Purpose** | Weekly calculation of partner scores and tier changes, reviewed before publishing. |
| **Used by** | Partner Manager (publish) |
| **Opened from** | Partner Mgmt → Scorecards |
| **Basis** | Source §5.2, §5.3; §4 Step 8 (weekly scorecard, tier reviews) |

**Run view**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Week | Select | — | | 16–22 Nov 2026 |
| Results | Table | — | Partner, profile (Parcel / PTL), 6 KPIs, total, current tier, proposed tier, rule applied | FastTrack Logistics · 57 · Bronze → Probation |
| Overrides | Text | No | Change a proposed tier with a reason (assumed) | — |
| Improvement plans | List | — | Auto-created for Gold dropping below band | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Publish | Scores and tiers appear in Partner Portal; payout speed and assignment priority change |

**Business rules**

- Tier rules in Section 7.3. Claims outcomes feed the damage, on-time and responsiveness KPIs (source §10 Step 5).

**Prototype notes**

- Demo toolbar “Run weekly scoring” recalculates from seeded KPIs.

### ERP-17 Suspension and offboarding case

| | |
|---|---|
| **Purpose** | Runs the 3-step suspension and offboarding protocol with a log visible to the partner. |
| **Used by** | Partner Manager (maker), Ops Lead (checker) |
| **Opened from** | Partner 360 → Start case; automatic trigger |
| **Basis** | Source §5.4 |

**Case**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Trigger | Select | Yes | Score \< 60 for 2 weeks \| Fraud / theft / tampering \| Repeated document expiry \| Partner request | Score \< 60 for 2 weeks |
| Step 1: Freeze | Toggle + date | Yes | Stops new allocations | Frozen 10-Nov |
| Step 2: In-flight shipments | Table | Yes | Each: let partner finish \| transfer to backup partner | 3 finish, 2 transfer |
| Step 3: Settle and close | Checklist | Yes | Claims and deductions settled → final payout → revoke app / API access → archive | Final payout ₹42,300 |
| Log | List | — | Every step with reason; visible in Partner Portal | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Advance step | Needs checker approval for Step 3 (assumed) |

## 6.5 Network Planning (Department 6)

### ERP-18 Pincode and ODA master

| | |
|---|---|
| **Purpose** | Every serviceable pincode with zone, ODA flag and the partners covering each leg. |
| **Used by** | Network Planner (edit), others view |
| **Opened from** | Network → Pincodes |
| **Basis** | Source §11 Dept 6 (Pincode / ODA master) |

**Columns and form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pincode, area, city, state | Text | Yes | | 580030 · Amargol · Hubballi · Karnataka |
| Zone | Select | Yes | A–E (parcel zones, assumed) | D |
| ODA | Toggle + surcharge | Yes | | No |
| Serviceable | Toggle | Yes | | Yes |
| First-mile / last-mile partners | Counts + list | — | Partners registered for this pincode | 2 / 1 |
| Coverage risk | Chip | — | Single partner = risk | Last mile: single partner |

**Actions**

| **Action** | **What happens** |
|---|---|
| Bulk upload | Excel |
| Edit | Logged |

### ERP-19 Lanes, hubs and transit times

| | |
|---|---|
| **Purpose** | Lanes between origin and destination regions, the hubs on them and promised transit times per service. |
| **Used by** | Network Planner |
| **Opened from** | Network → Lanes |
| **Basis** | Source §11 Dept 6 (lanes, hubs, transit times) |

**Lane form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Origin / destination | Region or city | Yes | | Delhi NCR → Hubballi |
| Origin hub / destination hub | Select | Yes | Partner hubs (Type F / E) | NCR CrossDock / Hubli Warehousing |
| Transit days by service | Numbers | Yes | Economy / Standard / Express / Express PTL / Standard PTL | Express PTL 3 |
| Distance | km | Yes | Used for e-way bill validity | 1,880 |
| Line-haul partners | List | — | | Deccan Roadlines |
| Departure schedule | Times | Yes | | Daily 23:00 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | Quotes and ETAs use the new values |

### ERP-20 Leg rules, cut-offs and assignment settings

| | |
|---|---|
| **Purpose** | How shipments are split into legs, the cut-offs and hand-over windows that connect legs, and the assignment engine settings. |
| **Used by** | Network Planner (edit), Ops Lead (approve) |
| **Opened from** | Network → Leg rules |
| **Basis** | Source §8 (Leg Planning; assignment rules); §2.2 (2–5 legs) |

**Leg templates**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Shipment pattern | Select | Yes | Intra-city (2 legs: pickup + delivery) \| Intra-region (3 legs) \| Long-haul (5 legs) — assumed patterns | Long-haul 5 legs |
| Leg sequence | Ordered list | Yes | First mile → origin hub → line-haul → destination hub → last mile | — |

**Cut-offs and windows**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pickup cut-off | Time | Yes | | 14:00 |
| Origin hub drop deadline | Time | Yes | | 21:00 |
| Line-haul departure | Time per lane | Yes | | 23:00 |
| Destination hub to out-for-delivery | Hours | Yes | | 8 h |

**Assignment engine**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Eligibility checks | Read-only list | — | Pincode / lane registered · service tier offered · within declared capacity (source §8) | — |
| Sort order | Read-only | — | Score ↓ → cost ↑ → transit ↑ (source §8) | — |
| Auto-assign | Toggle | — | Highest-ranked eligible partner per leg | On |
| Tier rules in assignment | Read-only | — | Platinum first choice; Gold priority; Bronze capped; Probation essential only | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | Needs Ops Lead approval (assumed) |

### ERP-21 Coverage gaps and forecasts

| | |
|---|---|
| **Purpose** | Map of where partners are needed and lane volume forecasts for capacity planning. |
| **Used by** | Network Planner, Partner Management |
| **Opened from** | Network → Gaps |
| **Basis** | Source §11 Dept 6 (coverage-gap maps, lane forecasts, route optimisation); §12 (Demand Forecasting, Phase 2) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Coverage map | Map | — | Pincodes coloured: covered by 2+ partners \| 1 partner \| none | — |
| Gap list | Table | — | Area / lane, leg type, demand, partners, suggested action | Belagavi last mile · 1 partner · recruit |
| Forecast | Line chart | — | Volume by lane and day, next 14 days, vs declared capacity | Delhi → Karnataka +18% next week |
| Change requests from partners | Table | — | Add / remove pincodes or lanes (from Partner Portal PP-19) | SwiftCity · +6 Noida pincodes |

**Actions**

| **Action** | **What happens** |
|---|---|
| Approve / reject change request | — |
| Create recruitment need | Raises the fit score for matching applicants |

**Prototype notes**

- Forecasts are seeded values (Phase 2 feature).

## 6.6 Pricing and Revenue Management (Department 3)

### ERP-22 Customer rate cards

| | |
|---|---|
| **Purpose** | Standard and negotiated rate cards: parcel weight slabs by zone and tier, PTL rates per lane, and surcharges. |
| **Used by** | Pricing Analyst (edit), Pricing Head (approve) |
| **Opened from** | Pricing → Rate cards |
| **Basis** | Source §11 Dept 3; §8.1 |

**Rate card header**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Name / type | Text / select | Yes | Standard \| Negotiated (customer) \| Contract (RFQ) | Sharma Electricals 2026 |
| Customer | Select | Cond. | For negotiated | Sharma Electricals |
| Valid from / to | Dates | Yes | | 01-Dec-2026 / 30-Nov-2027 |
| Status | Chip | — | Draft \| Pending approval \| Active \| Expired | Active |

**Lines**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Parcel | Grid | — | Zone × tier: first 0.5 kg, each additional 0.5 kg; volumetric divisor | Zone D Standard ₹55 / ₹25 |
| PTL | Table | — | Lane, service, ₹/kg, minimum kg, CFT factor | Delhi NCR → Karnataka · ₹14.00 · 50 kg · 8 |
| Surcharges | Table | — | Fuel %, ODA, docket, appointment, COD fee, To-Pay fee, FOV %, special handling | Fuel 10% |
| Margin check per line | Chip | — | AI margin engine vs current partner costs | OK 18.3% |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit for approval | — |
| Clone | Start a new card from an existing one |

**Business rules**

- Every line is checked against partner costs and target margin before activation (source §6 Step 5, §8.1).

### ERP-23 Discount and rate approvals

| | |
|---|---|
| **Purpose** | Approve rate cards, discounts and rate lines below target margin. |
| **Used by** | Pricing Head, Leadership (above limit) |
| **Opened from** | Approvals inbox; Pricing → Approvals |
| **Basis** | Source §11 Dept 3 (discount approvals) |

**Approval item**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Item | Text | — | Rate card / discount / partner rate line | Sharma Electricals rate card |
| Requested by | Text | — | | Arjun Mehta (KAM) |
| Lines below target | Table | — | Line, price, leg cost, margin, target, gap | None |
| Decision | Radio + comment | Yes | Approve \| Reject \| Send back | Approve |

**Actions**

| **Action** | **What happens** |
|---|---|
| Decide | Logged; requester notified |

**Business rules**

- Approval limits: margin below target by up to 3 points → Pricing Head; more → Leadership (assumed).

### ERP-24 Margin monitor and lane-loss alerts

| | |
|---|---|
| **Purpose** | Lane-level margin, loss-making lanes and the AI margin engine’s alerts. |
| **Used by** | Pricing, Leadership, Finance |
| **Opened from** | Pricing → Margin |
| **Basis** | Source §8.1 (AI margin engine learns loss-making lanes); §11 Dept 3 (lane-loss alerts); §9 (lane-level P&L) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Lane table | Table | — | Lane, shipments, revenue, leg costs, claims cost, margin %, trend | Delhi → Hubballi · 18.3% |
| Alerts | List | — | Lanes below target, rising partner cost, frequent weight revisions | Delhi → Belagavi 9.8% |
| Quote checks | Table | — | Recent quotes the engine flagged and what it suggested | — |
| Dynamic pricing (Phase 2) | Settings card (disabled) | — | Spot price limits by lane demand, capacity, season, fuel; contract customers excluded | Phase 2 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Open lane | Shipments and costs behind the number |

### ERP-25 Quote and margin simulator

| | |
|---|---|
| **Purpose** | Internal view of any quote: customer price build-up, planned legs and partner costs, risk buffer and margin. |
| **Used by** | Pricing, Sales / KAM |
| **Opened from** | Pricing → Simulator; Sales during negotiation |
| **Basis** | Source §8, §8.1 |

**Inputs and output**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Customer / rate card | Select | Yes | | Sharma Electricals |
| Origin, destination, service, pieces, dims, value, add-ons | Same as Customer Portal quote | Yes | | 110020 → 580030 · Express PTL · 6 × 60×40×40 · ₹1,80,000 |
| Customer price | Breakdown | — | As customer sees it | ₹3,074.80 + GST |
| Planned legs and costs | Table | — | Engine-chosen partner per leg and cost | ₹2,332 |
| Risk buffer | ₹ | — | For re-attempts and damage (2% of revenue, assumed) | ₹61.50 |
| Margin | ₹ + % | — | Before and after buffer vs target | ₹562.80 (18.3%) → ₹501.30 (16.3%) ✓ |

**Actions**

| **Action** | **What happens** |
|---|---|
| Try another partner mix | Recalculates |

**Prototype notes**

- Fully calculated in the browser from seed rate cards.

## 6.7 Sales and Key Accounts (Department 1)

### ERP-26 Leads and pipeline

| | |
|---|---|
| **Purpose** | CRM pipeline of leads from all sources with AI lead score and win probability. |
| **Used by** | Sales Executive, KAM, Sales Head |
| **Opened from** | Sales → Pipeline |
| **Basis** | Source §6 Phase 1; §11 Dept 1 (CRM, leads; lead scoring, win probability) |

**Board**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Stages | Kanban | — | New \| Qualified \| KYC \| Credit \| Contract \| Pilot \| Live \| Lost | — |
| Lead card | Card | — | Company, source, declared volume, AI lead score, owner, next step | Sharma Electricals · Sales visit · 92 · Arjun |
| Filters | Selects | — | Source, owner, industry, track | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Assign owner / KAM | — |
| Move stage | — |
| Log activity | Call, visit, email |

**Business rules**

- Duplicate check by GSTIN (source §6 Step 1).

### ERP-27 Customer onboarding review

| | |
|---|---|
| **Purpose** | Review a sign-up: qualification, lane-cost preview, track, KYC results and contract issue. |
| **Used by** | Sales Executive / KAM, Sales Head |
| **Opened from** | Pipeline card |
| **Basis** | Source §6 Phases 1–3 |

**Sections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Qualification | Read-only | — | Volume, mix, lanes, special handling, payment preference | 450 / month · 70% PTL |
| Lane-cost preview (AI) | Table | — | Per declared lane: serviceable, expected margin | Delhi → Hubballi · 18% |
| Track | Select | Yes | Self-serve SME \| Inside sales \| KAM \| KAM + solutions \| API / ONDC | Inside sales |
| KYC results | Checklist | — | GSTIN, PAN, CIN, bank, addresses | All ✓ |
| Rate card to offer | Select | Yes | Standard or negotiated (from Pricing) | Sharma Electricals 2026 |
| Pilot plan | Dates + KPIs | Cond. | 2-week hyper-care | 24-Nov to 7-Dec |

**Actions**

| **Action** | **What happens** |
|---|---|
| Issue contract | Customer Portal shows contract for e-sign |
| Mark live | After pilot |

### ERP-28 Customer account 360

| | |
|---|---|
| **Purpose** | Everything about one customer account: users, rate card, credit, volume, SLA, tickets, health and churn risk. |
| **Used by** | KAM, Customer Success, Finance (view) |
| **Opened from** | Search; Sales → Accounts |
| **Basis** | Source §6 Step 8 (QBRs, churn-risk, upsell); §11 Dept 1, 4 |

**Tabs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Overview | Cards | — | Type, track, KAM, users, pickup locations | Manufacturer · KAM Arjun |
| Volume and SLA | Charts | — | Shipments, on-time %, damage rate by lane | — |
| Commercials | Links | — | Rate card, contract, credit limit, outstanding | ₹3,44,200 of ₹5,00,000 |
| Health | Score + chips | — | AI churn risk; upsell suggestions (new lanes, Parcel / PTL mix) | Churn low · Upsell: Mumbai lane |
| QBRs | List | — | Quarterly business reviews with notes | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Schedule QBR | — |
| Log note | — |

### ERP-29 RFQ, tenders and proposals (light)

| | |
|---|---|
| **Purpose** | Track RFQs and tenders from enterprises and draft proposals with AI help. |
| **Used by** | KAM, Sales Head |
| **Opened from** | Sales → RFQs |
| **Basis** | Source §6 (Enterprise: RFQ / tender); §11 Dept 1 (proposal drafts) |

**RFQ**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Customer, due date, lanes, volumes, status | Form | Yes | Status: Received \| Pricing \| Submitted \| Won \| Lost | Due 05-Dec · Pricing |
| Proposal draft | Document | — | AI first draft from rate card and lanes | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Send to Pricing | — |
| Mark won / lost | — |

**Prototype notes**

- Light: list and one detail page.

## 6.8 Finance and Accounts (Department 9)

### ERP-30 Credit review

| | |
|---|---|
| **Purpose** | Set customer credit limits, terms and deposits using the AI credit-risk score. |
| **Used by** | Finance Executive (maker), Finance Head (approve) |
| **Opened from** | Finance → Credit |
| **Basis** | Source §6 Phase 2 Step 4; §12 (Credit-Risk Scoring) |

**Review**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Applicant | Read-only | — | | Sharma Electricals |
| AI credit-risk score | 0–100 + reasons | — | GST filing regularity, business age, payment behaviour | 81 · Low risk |
| Requested limit / terms | Read-only | — | | ₹5,00,000 · 30 days |
| Approved limit | ₹ | Yes | | ₹5,00,000 |
| Terms | Select | Yes | 15 \| 30 \| 45 days | 30 |
| Security deposit / bank guarantee | ₹ | No | | ₹50,000 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Approve / approve lower / decline | Customer Portal shows the decision |

**Business rules**

- Limits above ₹10 lakh need Finance Head approval (assumed).

### ERP-31 Customer invoicing and collections

| | |
|---|---|
| **Purpose** | Generate GST invoices (per shipment or monthly), e-invoices, and chase collections with AI priority. |
| **Used by** | Finance Executive (AR) |
| **Opened from** | Finance → Receivables |
| **Basis** | Source §9 (Customer Invoicing); §11 Dept 9 (collections priority, cash forecast) |

**Invoice runs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Billing period / customers | Select | Yes | Monthly customers for the period | Nov 2026 · 142 customers |
| Preview | Table | — | Customer, shipments, taxable, GST, total, missing e-PODs | Sharma · 412 · ₹2,41,800 |
| E-invoice | Chip | — | IRN generated where applicable | IRN ✓ |

**Collections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Receivables ageing | Table | — | 0–30, 31–60, 61–90, 90+ days by customer | — |
| Collections priority (AI) | Ranked list | — | Who to chase first and why | Customer X · 47 days · ₹3.1 lakh |
| Credit hold | Toggle per customer | — | Blocks new bookings in Customer Portal | Off |

**Actions**

| **Action** | **What happens** |
|---|---|
| Generate invoices | Invoices appear in Customer Portal with e-PODs attached |
| Send reminder | Email / WhatsApp |
| Apply credit hold | — |

### ERP-32 Partner payables: 3-way match and dispute desk

| | |
|---|---|
| **Purpose** | Match each partner invoice line against rate card × verified weight × e-POD and resolve mismatches within 48 hours. |
| **Used by** | Finance Executive (AP) |
| **Opened from** | Finance → Payables |
| **Basis** | Source §9 (Partner Invoicing, 3-Way Match, 48-hour SLA); §12 (Invoice 3-Way Match) |

**Match view**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Invoice / partner / cycle | Header | — | Self-billed or uploaded | DR/0099 · Deccan Roadlines · 16–22 Nov |
| Lines | Table | — | Job, rate, verified weight, e-POD / hand-over, billed, matched, result | JOB-000781-L3 · ₹1,530 billed · ₹1,458 matched |
| Disputes | Queue | — | Mismatch, partner reason, evidence, 48-hour timer | ₹72 · 31 h left |
| Decision | Radio + note | Yes | Pay matched \| Pay billed \| Partial | Pay matched |

**Actions**

| **Action** | **What happens** |
|---|---|
| Resolve dispute | Partner Portal shows the outcome |
| Approve for payout | Lines move to the next payout batch |

### ERP-33 Payout batches

| | |
|---|---|
| **Purpose** | Build, approve and release partner payouts by tier, including early-pay requests. |
| **Used by** | Finance Executive (maker), Finance Head (approver) |
| **Opened from** | Finance → Payouts |
| **Basis** | Source §9 (Platform Pays Partner); §5.3 (payout speed by tier); §12 guardrails (AI never pays money on its own) |

**Batch**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Batch date / tiers | Header | — | Platinum (3-day), Gold & Silver (weekly), Bronze (fortnightly) | 27-Nov · Gold, Silver |
| Lines | Table | — | Partner, matched earnings, deductions (with evidence links), COD offsets, TDS, net | SwiftCity · ₹1,84,063 |
| Early-pay requests | Table | — | Partner, amount, fee | — |
| Total | ₹ | — | | ₹38.6 lakh |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit for approval | — |
| Approve and release | Approver only; NEFT / IMPS file generated; UTRs back to Partner Portal |

**Business rules**

- Maker and approver must be different people (assumed).

**Prototype notes**

- Release is simulated; UTRs generated.

### ERP-34 COD reconciliation

| | |
|---|---|
| **Purpose** | Track COD from rider collection to partner deposit (24 h) to shipper remittance (T+2, T+1 for top tier). |
| **Used by** | Finance Executive |
| **Opened from** | Finance → COD |
| **Basis** | Source §9 (COD Handling) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Collected, not deposited | Table | — | Partner, LRs, amount, hours since collection (red over 24 h) | SwiftCity · ₹21,600 · 9 h |
| Deposited, not remitted | Table | — | Customer, amount, remittance date | — |
| Remittance batches | Table | — | Date, customers, amount, UTR | — |
| Shortages | Table | — | Partner, LR, amount, evidence, deduction status | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Create remittance batch | Maker-checker as for payouts |
| Raise shortage | Deduction with evidence |

### ERP-35 Accounting and P&L (light)

| | |
|---|---|
| **Purpose** | Revenue, leg costs and margin per shipment and lane, GL posting status, GST ITC reconciliation and cash forecast. |
| **Used by** | Finance Head, Leadership |
| **Opened from** | Finance → Accounting |
| **Basis** | Source §9 (Accounting); §11 Dept 9 (cash forecast) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Shipment / lane P&L | Tables | — | Revenue, leg costs, claims, margin | — |
| Daily GL posting | Status list | — | Date, entries, status | 23-Nov ✓ |
| GST ITC reconciliation | Monthly table | — | Partner invoices vs GSTR-2B | Oct ✓ |
| Cash forecast (AI) | Line chart | — | Next 30 days in / out | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Export | Excel |

**Prototype notes**

- Light: read-only seeded tables.

## 6.9 Claims, Risk and Insurance (Department 10)

### ERP-36 Claims desk

| | |
|---|---|
| **Purpose** | All customer claims with the 7-day settlement clock. |
| **Used by** | Claims Officer, Claims Head |
| **Opened from** | Claims → Desk |
| **Basis** | Source §10 Step 4; §11 Dept 10 |

**Columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Claim, LR, customer, type, amount | Table | — | | CLM-2026-0142 · LGS-DEL-000769 · Short · ₹30,000 |
| Settle by | Timer | — | 7 days from claim (source) | 2 days |
| Liable leg (AI) | Text | — | From liability engine | Leg 2 · NCR CrossDock |
| Fraud signal (AI) | Chip | — | Suspicious claim patterns (source §12) | None |
| Status | Chip | — | New \| Investigating \| Approved \| Partly approved \| Rejected \| Settled \| Closed | Investigating |

**Actions**

| **Action** | **What happens** |
|---|---|
| Open | ERP-37 |

### ERP-37 Claim investigation and liability

| | |
|---|---|
| **Purpose** | Chain-of-custody evidence for the claim, the leg and partner at fault, customer settlement and recovery. |
| **Used by** | Claims Officer (maker), Claims Head (approve settlement) |
| **Opened from** | Claims desk |
| **Basis** | Source §10 Steps 4–5; §12 (Claims Liability & Fraud) |

**Evidence timeline**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Per leg | Table | — | Partner, in-scan count and photo, out-scan count and photo, seal in / out, staff | Leg 2: in 6, out 5, seal intact on arrival |
| Liability engine result | Card | — | Leg and partner holding the shipment at the fault point, with reasoning | Leg 2 NCR CrossDock: 6 in, 5 sealed out |

**Decision**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Approved amount | ₹ | Yes | Up to invoice value of affected pieces; insurance terms apply | ₹30,000 |
| Settle customer by | Radio | Yes | Credit note \| Bank transfer | Credit note |
| Recover from | Radio | Yes | Partner payout (up to liability cap) \| Partner’s insurer \| Logisco insurer | Partner payout ₹10,000 + Logisco insurer ₹20,000 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Approve settlement | Approver only; customer settled; partner deduction scheduled; Partner Portal PP-22 updated |
| Request customer confirmation | Ticket closes only after it |

**Business rules**

- AI never closes a claim on its own; a person approves (source §12).

### ERP-38 Insurer claims (light)

| | |
|---|---|
| **Purpose** | Claims filed with insurers and their recovery status. |
| **Used by** | Claims Officer |
| **Opened from** | Claims → Insurers |
| **Basis** | Source §11 Dept 10 (insurer claims); §13 (Insurance API) |

**Columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Insurer claim no., linked claims, amount, filed, status | Table | — | Filed \| Under survey \| Approved \| Paid \| Rejected | INS-88213 · ₹20,000 · Filed |

**Actions**

| **Action** | **What happens** |
|---|---|
| File claim | Simulated insurance API |

## 6.10 Customer Success, Hub Ops and Compliance (light)

### ERP-39 Customer Success: tickets and account health

| | |
|---|---|
| **Purpose** | Customer tickets with AI triage, NDR follow-ups, NPS and churn alerts. |
| **Used by** | Customer Success Agent, CS Lead |
| **Opened from** | Customer Success menu |
| **Basis** | Source §11 Dept 4 (tickets, account health, QBRs, NPS; AI assistant, ticket triage, churn prediction) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Ticket queue | Table | — | Ticket, customer, category, AI priority, SLA, owner | TKT-2026-3381 · Pickup · High |
| NDR follow-up | Table | — | NDRs without customer response by cut-off | 2 |
| Account health | Table | — | Customer, NPS, on-time, open tickets, churn risk | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reply / resolve | Visible in Customer Portal CP-37 |

### ERP-40 Hub & PTL Operations: hub monitor and appointment desk

| | |
|---|---|
| **Purpose** | Hub scans, manifests, seals and load planning across partner hubs; appointment desk for DC / modern-trade deliveries. |
| **Used by** | Hub Ops Coordinator |
| **Opened from** | Hub & PTL Ops menu |
| **Basis** | Source §11 Dept 8 (hub scans, manifests, seals, load planning, appointment desk; load / cube optimisation, short-excess detection) |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hub board | Table | — | Hub, inbound, in-scanned, dwell, short / excess | Gurugram · 5.2 h · 1 short |
| Manifests and seals | Table | — | | MAN-GGN-1123 · SL-44817 |
| Appointment desk | Calendar | — | Consignee slots by DC; gate passes; unconfirmed slots | Hubballi · 26-Nov · 4 slots |
| Load planning (Phase 3) | Card (disabled) | — | Truck fill / cube optimisation | Phase 3 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Confirm / move slot | Updates Partner App and Customer Portal |

### ERP-41 Compliance & Legal: e-way bill monitor and registers

| | |
|---|---|
| **Purpose** | E-way bills near expiry, statutory calendar, DPDP consent register and contract expiries. |
| **Used by** | Compliance Officer |
| **Opened from** | Compliance menu |
| **Basis** | Source §11 Dept 11 (contracts, e-way bill monitor, DPDP register, statutory calendar; clause extraction, expiry alerts); §14 |

**Panels**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| E-way bills | Table | — | EWB, LR, validity left, Part B status, action | 3410 2256 7781 · 2 days · Part B ✓ |
| Statutory calendar | Calendar | — | GST returns, licence renewals | — |
| DPDP register | Table | — | Consents, requests (access / erasure), breach log | — |
| Contract expiries | Table | — | Customer and partner contracts expiring in 60 days | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Extend EWB / update Part B | Simulated NIC call |

**Business rules**

- E-way bill rules are configurable because limits vary by state (source §14).

## 6.11 Technology and administration (Department 14)

### ERP-42 Users, roles and access control

| | |
|---|---|
| **Purpose** | Manage staff users, roles, department access and approval limits. |
| **Used by** | Super Admin |
| **Opened from** | Technology → Access |
| **Basis** | Source §14 (role-based access, SSO, two-factor); §11 Dept 14 (access control) |

**User**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Name / email / department | Text / select | Yes | | Sanjay Rao · Operations Control Tower |
| Role(s) | Multi-select | Yes | See Section 3 | Control Tower Operator |
| Region scope | Multi-select | No | Limit to regions / hubs (assumed) | North |
| Approval limits | ₹ fields | Cond. | Claims, payouts, discounts, credit (assumed) | — |
| Status | Chip | — | Active \| Disabled | Active |

**Role editor**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Role | Text | Yes | | Control Tower Operator |
| Permissions | Grid | Yes | Screen × View / Act / Approve | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | Logged in the audit log |

**Business rules**

- Two-factor is mandatory for all staff (source §14).

### ERP-43 Audit log and AI decision log

| | |
|---|---|
| **Purpose** | Every user action and every AI decision with its reason, for review and model monitoring. |
| **Used by** | Super Admin, Compliance, Technology |
| **Opened from** | Technology → Logs |
| **Basis** | Source §12 guardrails (every AI decision logged with its reason; models reviewed monthly); §14 (audit logs) |

**Views**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Audit log | Table | — | Time, user, app, action, record, before / after | Sanjay · reassign leg · JOB-000790-L1 |
| AI decision log | Table | — | Time, model, record, decision, reason, confidence, accepted by person Y/N | ETA model · LGS-DEL-000781 · +2.5 h · traffic · — |
| Model review | Table | — | Model, accuracy last month, fairness checks, next review | ETA · 91% within 2 h · 15-Dec |

**Actions**

| **Action** | **What happens** |
|---|---|
| Export | CSV |

### ERP-44 System settings (configurable parameters)

| | |
|---|---|
| **Purpose** | Central place for the values the source leaves configurable or unstated, so they can change without code. |
| **Used by** | Super Admin (edit); department heads (view) |
| **Opened from** | Technology → Settings |
| **Basis** | Source §14 (configurable for rule changes; tax rules configurable); values assumed |

**Groups**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Compliance | Fields | — | E-way bill threshold (₹50,000 inter-state; per-state values), validity km per day (200) | — |
| Pricing | Fields | — | Volumetric divisor (5,000), CFT factor (8), PTL minimums, target margin (15%), risk buffer (2%), quote validity (7 days) | — |
| Operations | Fields | — | Pickup cut-off, acceptance timer (30 min), geo-fence (200 m), weight tolerance (3% / 0.5 kg), NDR max attempts (3) | — |
| Finance | Fields | — | COD remittance (T+2; T+1 top tier), deposit window (24 h), dispute SLA (48 h), early-pay fee (1%), credit grace (15 days) | — |
| Claims | Fields | — | Settlement target (7 days), claim window (7 days), default liability cap | — |
| Partners | Fields | — | Tier bands, trial pass mark (80), Bronze cap (50%) | — |
| Language | Fields | — | Enabled languages (English, Hindi) | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | Effective immediately; logged |

**Prototype notes**

- Values are read by all four apps in the prototype, so changing one here changes behaviour everywhere.

### ERP-45 Placeholder department page

| | |
|---|---|
| **Purpose** | A standard page for departments not built in the prototype: shows the department’s planned modules and AI features. |
| **Used by** | Users of that department |
| **Opened from** | Menu: Marketing & Growth, Quality & Audit, HR & Admin, Procurement, Sustainability (ESG) |
| **Basis** | Source §11 (department table) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Department name and group | Header | — | | Sustainability (ESG) · Enablers |
| Planned modules | List | — | From source §11 | CO2 per shipment, green partner tagging, ESG reports |
| Planned AI features | List | — | From source §11 | Emission estimates; greener routes |
| Status | Chip | — | | Planned for a later phase |

**Prototype notes**

- One template rendered for 5 departments.

# 7. Engines and Business Rules

## 7.1 Leg planning and partner assignment

1.  Split the shipment into legs: first mile → origin hub → line-haul → destination hub → last mile, aligning cut-offs and hand-over windows so the legs connect.

2.  For each leg, keep only eligible partners: registered for that leg’s pincodes or lane, offering the selected service tier, and within declared daily capacity.

3.  Sort eligible partners by score (highest first), then cost (lowest), then transit time (fastest). Auto-assign the top partner. The Control Tower can override any leg.

Source §8. Example, first mile for LGS-DEL-000781 (pincode 110020): MetroDash (Platinum 92) is at capacity and skipped; SwiftCity (Gold 86, ₹250) is assigned ahead of QuickLink (Silver 74, ₹220).

## 7.2 Price, leg costs and margin (worked example)

| **Line** | **Amount** | **Note** |
|---|---|---|
| **Customer price before GST** | ₹3,074.80 | Freight 162 kg × ₹14 + fuel 10% + docket + appointment + insurance (Customer Portal spec, 7.3) |
| **Leg 1 SwiftCity (first mile)** | ₹250.00 | Per PTL pickup |
| **Leg 2 NCR CrossDock (origin hub)** | ₹162.00 | ₹1.00 / kg |
| **Leg 3 Deccan Roadlines (line-haul)** | ₹1,458.00 | ₹9.00 / kg × 162 kg |
| **Leg 4 Hubli Warehousing (destination hub)** | ₹162.00 | ₹1.00 / kg |
| **Leg 5 NK Express (last mile)** | ₹300.00 | PTL delivery with appointment |
| **Insurance premium passed to insurer** | ₹180.00 | 0.1% of ₹1,80,000 |
| **Gross margin** | ₹562.80 (18.3%) | ₹3,074.80 − ₹2,332.00 − ₹180.00 |
| **Risk buffer (re-attempts, damage)** | ₹61.50 | 2% of price (assumed; source §8 names a risk buffer) |
| **Margin after buffer** | ₹501.30 (16.3%) | Above 15% target (assumed) → no flag |

## 7.3 Partner scoring and tiers

Weekly score on six KPIs with Parcel / PTL weights: pickup adherence 15 / 15, on-time 25 / 30, first-attempt 15 / 10, damage-loss-shortage 20 / 25, scan & e-POD compliance 15 / 10, responsiveness 10 / 10 (source §5.2). Tiers: Platinum ≥ 90, Gold 80–89, Silver 70–79, Bronze 60–69 (all new partners), Probation \< 60, with the benefits and consequences in source §5.3. The Partner Portal Specification, Section 7, has the full worked example.

## 7.4 Exception action targets

| **Exception** | **Action** | **Target** | **Source** |
|---|---|---|---|
| Pickup missed | Reassign to backup first-mile partner | 2 hours | §10 |
| Line-haul delay | New ETA to customer; faster lane if possible | On detection | §10 |
| Seal mismatch / short pieces | Hold, photo evidence, investigate previous leg | 4 hours | §10 |
| NDR | WhatsApp with action buttons to consignee and shipper | Same day | §10 |
| E-way bill near expiry | Extension or Part B update | Before expiry | §10 |
| Damage / loss claim | Settle customer | 7 days | §10 |
| Partner invoice mismatch | Dispute desk decision | 48 hours | §9 |

## 7.5 Money cycle

| **Flow** | **Rule** | **Source** |
|---|---|---|
| Customer pays | Prepaid wallet, credit (TBB), To-Pay or COD; all collections into nodal / escrow account | §9 |
| Customer invoice | Per shipment or monthly; e-POD attached; e-invoice where applicable | §9 |
| Partner invoice | Self-billed from completed legs where agreed | §9 |
| Partner payout | Weekly by NEFT / IMPS; faster for higher tiers; early pay for a fee | §9, §5.3 |
| COD | Partner deposits in 24 h; shipper remitted T+2 (T+1 top tier); shortages deducted with evidence | §9 |
| Accounting | Revenue, leg costs and margin per shipment; daily GL; monthly GST ITC reconciliation; lane P&L | §9 |

# 8. AI Features and Guardrails

| **AI feature (source §12)** | **Phase** | **Where in the ERP** | **In the prototype** |
|---|---|---|---|
| AI assistant (Hindi + English) | 1 | Floating panel (ERP-02) | Scripted answers |
| Address intelligence | 1 | Shipment 360 (corrected address) | Pre-set |
| Document OCR & KYC fraud | 1 | ERP-12 | Pre-set flags |
| AI margin engine | 1 | ERP-13, ERP-22 to ERP-25 | Calculated from seed costs |
| Weight & dimension checks | 1 | Shipment 360, ERP-07 | Pre-set flags |
| Invoice 3-way match | 1 | ERP-32 | Calculated |
| Smart leg planning | 1 → 2 | Booking, ERP-08, ERP-20 | Rule-based ranking calculated |
| ETA & SLA breach prediction | 2 | ERP-05, ERP-06 | Seeded risk scores |
| Credit-risk scoring | 2 | ERP-30 | Seeded score with reasons |
| Network-gap fit score | 2 | ERP-11, ERP-21 | Seeded score with reasons |
| Demand forecasting | 2 | ERP-21 | Seeded chart |
| Dynamic pricing | 2 | ERP-24 (disabled card) | Shown as Phase 2 |
| Churn prediction | 2 | ERP-15, ERP-28, ERP-39 | Seeded chips |
| Claims liability & fraud | 2 | ERP-36, ERP-37 | Rule-based from scan records |
| Carbon estimation | 2 | Placeholder (Sustainability) | Not built |
| Load / cube & route optimisation | 3 | ERP-40 (disabled card) | Shown as Phase 3 |

## 8.1 Guardrails

- AI never changes a contract rate, pays money or closes a claim on its own; a person approves (source §12).

- Every AI decision is logged with its reason (ERP-43); models are reviewed monthly for accuracy and fairness (source §12).

- Wherever an AI suggestion is shown, the screen shows the reason and lets the person accept or dismiss it with a reason (assumed).

Note: several Phase 2 features (fit score, credit score, ETA prediction) are used in Phase 1 workflows in the source. See open question 2.

# 9. Status Models

| **Object** | **Statuses** |
|---|---|
| **Master shipment (customer view)** | Booked → Picked Up → At Origin Hub → In Transit → At Destination Hub → Out for Delivery → Delivered; exceptions: Undelivered (NDR), Delivered with Exception, Return to Origin; Cancelled (assumed) |
| **Leg** | Offered → Accepted / Flagged / Withdrawn → Assigned → In progress → Handed over / Delivered / Failed attempt / Exception → Closed |
| **Partner** | Applied → Invited / Waitlisted / Rejected → KYC → Agreement → Go-live setup → Trial → Live (tier) → Probation → Suspended → Offboarded |
| **Customer** | Lead → Qualified → KYC → Credit → Contract → Pilot → Live → (Credit hold) → Churned |
| **Exception ticket** | New → In progress → Waiting for customer → Resolved → Closed (only after customer confirmation) |
| **Claim** | New → Investigating → Approved / Partly approved / Rejected → Settled → Closed |
| **Payout batch** | Draft → Submitted → Approved → Released → Paid |

# 10. Staff Alerts

| **Alert** | **To** | **Channel** |
|---|---|---|
| Shipment enters top-20 risk list / SLA red | Control Tower | In-app, sound |
| SOS from the Partner App | Control Tower, Ops Lead | In-app (blocking banner), SMS |
| Exception past its action target | Ops Lead | In-app, email |
| New partner application / document flagged | Partner Management | In-app |
| Approval waiting | Approver | In-app, email |
| Lane margin below target | Pricing | In-app, weekly email |
| Customer overdue / over credit limit | Finance, KAM | In-app, email |
| COD not deposited after 24 h | Finance | In-app |
| Claim near 7-day deadline | Claims | In-app |
| E-way bill near expiry | Compliance, Control Tower | In-app |
| Daily review pack ready (9:00) | Ops Lead, Leadership | Email |

# 11. Prototype Implementation Notes

## 11.1 Demo toolbar (ERP only)

| **Control** | **Effect** |
|---|---|
| Advance time (+1 h, +1 day) | SLA timers move; shipments progress along seeded paths |
| Inject exception | Choose shipment and type (pickup missed, seal mismatch, delay, NDR, damage) |
| Run weekly scoring | Recalculates partner scores and proposes tier changes (ERP-16) |
| Switch role | Re-opens the ERP as another persona |
| Reset demo data | Restores the seed data in all four apps |

## 11.2 Seed data

- About 120 shipments across 8 lanes and all statuses; 10 active exceptions; 2 claims; LGS-DEL-000781 in transit.

- About 12 partners covering types A–F and every tier, 3 applications (one each invited, waitlisted, new), Deccan Roadlines in trial.

- About 8 customers across the 5 types, with leads at each pipeline stage.

- Rate cards, lanes, pincodes (about 10 cities), 12 weeks of scores, 3 months of invoices and payouts, seeded AI outputs.

## 11.3 End-to-end demo script

1.  Customer Portal: Priya books LGS-DEL-000781.

2.  ERP Control Tower: the shipment appears with 5 legs; open Shipment 360 to show partners, leg costs and the 18.3% margin.

3.  Partner Portal: SwiftCity accepts and assigns Ravi. Partner App: Ravi picks up and hands over at NCR CrossDock.

4.  ERP: advance time; the line-haul halt pushes the shipment into the at-risk list; the operator informs the customer.

5.  Inject “pickup missed” on another shipment; reassign the leg to QuickLink from ERP-08 and show it arrive in QuickLink’s inbox.

6.  Partner App: Manju delivers with OTP; Customer Portal shows Delivered and the e-POD.

7.  ERP Claims: open the seeded shortage claim, show the liability engine pointing to Leg 2, approve settlement.

8.  ERP Finance: resolve Deccan Roadlines’ ₹72 mismatch, approve the payout batch, show UTRs in the Partner Portal.

9.  ERP Partner Management: run weekly scoring; FastTrack Logistics drops from Bronze to Probation; open its suspension case.

10. Leadership dashboard: show the day’s numbers and the AI briefing.

# 12. Assumptions and Open Questions

| **\#** | **Topic** | **What the source says / gap** | **Assumption in this specification** |
|---|---|---|---|
| 1 | Trial pass vs starting tier | Trial pass 80 (§4) but new partners start at Bronze 60–69 (§5.3) | All new partners start at Bronze for at least 2 weeks |
| 2 | AI features by phase | Fit score, credit score and ETA prediction are Phase 2 (§12) but used in Phase 1 steps (§4, §6, §7) | Prototype shows them; production phase to confirm |
| 3 | Staff roles and permissions | RBAC required (§14), roles not listed | Roles in Section 3.1 |
| 4 | Approval limits | Only the AI guardrail is stated (§12) | Maker-checker table in Section 3.3 |
| 5 | Target margin and risk buffer | Named (§8, §8.1), values not given | 15% target; 2% buffer |
| 6 | Number of departments | Figure says 16 departments plus a Leadership office (numbered 0–16) | 17 menu entries; 5 as placeholders |
| 7 | Model A | Referred to (§2.2) but not defined in this document | Out of scope |
| 8 | Leg patterns | 2–5 legs (§2.2); which shipments use fewer legs is not defined | Intra-city 2, intra-region 3, long-haul 5 |
| 9 | Payout frequency | §9 weekly vs §5.3 tier-based | Tier-based |
| 10 | Leg cost visibility | Not defined | Only Leadership, Pricing, Finance and Super Admin see leg costs and margin |
| 11 | Partner hub rates | Type F paid per piece / kg + storage (§3); values not given | ₹1.00 / kg, minimum ₹150 in the demo |
| 12 | Customer and partner churn models | Named (§12) | Seeded chips only |

# Appendix A. Glossary

| **Term** | **Meaning** |
|---|---|
| **Control Tower** | Logisco’s virtual operations centre that watches every shipment, leg, partner and SLA |
| **Leg** | One part of a shipment handled by one partner |
| **Maker-checker** | One person prepares an action, a different person approves it |
| **Master shipment** | The customer’s single shipment record that holds 2–5 legs |
| **Nodal / escrow account** | Bank account holding customer money before partner payouts |
| **Risk buffer** | Amount set aside in pricing for re-attempts and damage |
| **Self-billing** | Logisco generates the partner’s invoice from completed legs |
| **SLA** | Service-level agreement: promised times for pickup, delivery and responses |
| **Tier** | Partner level (Platinum to Probation) from the weekly score |
| **3-way match** | Checking partner billing against rate card, verified weight and proof of delivery |
