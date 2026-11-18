# Logisco — Partner Portal Specification (v0.1, 18-Nov-2026)

Source of truth for this app. Screen IDs are used in code and commits. "Source §x" = client workflow document (00-source-workflow.md); "Assumed" = our proposal, listed in Section 12.

# 1. Introduction

## 1.1 Purpose

This document specifies the Partner Portal of the Logisco platform at screen, field and action level. It is the build reference for the clickable prototype: a frontend-only application with static data in which a reviewer can register as a partner, go through onboarding, accept and assign jobs, follow trips and hub work, handle escalations and claims, and see scores and payouts as if it were the production portal.

The Partner Portal is used by the office of a delivery partner company. The people who physically pick up, carry, sort and deliver (riders, drivers, hub staff) use the separate Partner App on their phones. Both write to the same shared data store as the Customer Portal and the Logisco ERP.

## 1.2 Scope

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
<td><p>Partner registration and onboarding (application, network fit, KYC, audit, agreement, go-live setup, trial).</p>
<p>Daily operations for the partner office: job inbox, assignment, live board, line-haul trips, hub operations, capacity, coverage.</p>
<p>Escalations, NDR, claims and deductions.</p>
<p>Scorecard, tiers, finance (reconciliation, invoices, 3-way match, payouts, COD).</p>
<p>Staff, vehicles, hubs, documents, users, API, suspension and offboarding.</p></td>
<td><p>Partner App screens used by riders, drivers and hub staff (separate specification).</p>
<p>Logisco ERP screens used by Logisco staff to approve, score and pay partners (separate specification).</p>
<p>Real backend and integrations (Vahan, Sarathi, GST, bank, GPS, e-sign); these are simulated.</p></td>
</tr>
</tbody>
</table>

## 1.3 Traceability to the source document

Every screen states its basis. “Source §x” means the requirement comes from that section of the Logisco workflow document. “Assumed” means the source is silent and this document proposes a behaviour so the prototype is complete. Assumptions needing confirmation are listed in Section 12.

## 1.4 How to read the screen specifications

- Each screen has an ID (PP-01 onwards), a header table (purpose, users, where it opens from, basis) and one or more field tables.

- Field tables: Field, Type, Req. (mandatory), Rules / options, Sample (the value used in the prototype’s demo data).

- Req. values: Yes = mandatory; No = optional; Cond. = mandatory only in the stated condition; — = read-only or display element.

- Partner types are written as A to F (Section 2.2). Where a screen or field applies only to some types, this is stated.

# 2. Partner Portal Overview

## 2.1 Who does what: Partner Portal vs Partner App

| **Work** | **Partner Portal (office, web)** | **Partner App (field, mobile)** |
|---|---|---|
| Onboarding | Application, KYC, agreement, staff and vehicle setup | Practice mode and training videos |
| Jobs | Accept or flag jobs; assign to staff; watch the live board | Receive assigned jobs; do the work |
| Pickup and delivery | Monitor; handle escalations and NDR | Scan, weigh, photograph, OTP / e-POD, COD collection |
| Line-haul | Plan trips, assign truck and driver, watch GPS, report breakdowns | Start trip, seal check, report halts, arrive |
| Hub | Hub summary, manifests, dwell time, short / excess | Bulk in-scan, sort, manifest, out-scan, seal |
| Money | Reconciliation, invoices, 3-way match, payouts, COD deposits | Rider’s own earnings and COD in hand |
| Performance | Scorecard, tier, improvement plans | — |

## 2.2 Partner types and how the portal changes

The source defines six partner types (§3) and which legs each serves in Model B (§2.2). The portal shows or hides screens and fields by type.

| **Aspect** | **A National courier** | **B Regional / city courier** | **C Hyperlocal** | **D Line-haul transporter** | **E PTL consolidator** | **F Hub / warehouse** |
|---|---|---|---|---|---|---|
| Legs served (source) | Any single leg (e.g. line-haul on busy lanes) | First and last mile | Last mile, same-city pickups | Line-haul, hub-to-hub | Consolidation, PTL line-haul; hub if they have one | Sorting, consolidation, de-consolidation, short storage |
| Connects by (source) | API | Partner App or API | Partner App | Partner App + GPS / FASTag via ULIP | Partner Portal + API | Hub scanning app |
| Paid (source) | Per leg | Per shipment handled | Per delivery / drop | Per trip or per kg on the lane | Per kg with minimum chargeable weight | Per piece / kg handled + storage per day |
| Extra screens (assumed) | API (PP-35), Trips | Delivery exceptions, COD | Delivery exceptions, COD | Trips (PP-16), Fleet | Trips, Hubs, API | Hub operations (PP-17), Hubs (PP-31) |
| Monitored trial (source) | 10 parcel jobs or 3 trips | 10 parcel jobs | 10 parcel jobs | 3 line-haul trips | 3 PTL / line-haul trips | 3 hub cycles (assumed) |
| Hub audit (source) | No | Only if runs a hub (assumed) | No | No | If they have a hub | Yes |

## 2.3 Document checklist by partner type

From source §4.1. The KYC screen (PP-06) shows only the rows required for the applicant’s type.

| **Document** | **A** | **B** | **C** | **D** | **E** | **F** |
|---|---|---|---|---|---|---|
| GST registration (GSTIN) | ✓ | ✓ | ✓¹ | ✓¹ | ✓ | ✓ |
| PAN (company or proprietor) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bank account (penny-drop verified) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Incorporation certificate / partnership deed | ✓ | ✓ | ✓² | ✓² | ✓ | ✓ |
| Udyam (MSME) certificate | Opt. | Opt. | Opt. | Opt. | Opt. | Opt. |
| Goods-in-transit / liability insurance | ✓ | ✓ | Opt. | ✓ | ✓ | ✓³ |
| Vehicle RC, fitness, permit, insurance | — | ✓⁴ | ✓ | ✓ | ✓ | — |
| Driver / rider licence and ID | — | ✓ | ✓ | ✓ | ✓ | — |
| Police verification of field staff | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hub lease, fire NOC, trade licence | — | ✓⁵ | — | — | ✓⁵ | ✓ |
| Signed agreement, SLA, rate card | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

¹ if GST-registered · ² if a company or firm · ³ premises insurance · ⁴ if own fleet · ⁵ if the partner runs a hub · Opt. = optional

## 2.4 How the portal connects to the other three apps

| **Event** | **What happens across apps** |
|---|---|
| Partner submits an application | Logisco ERP (Partner Management): application appears with an AI network-gap fit score. |
| Customer confirms a booking (Customer Portal) | ERP leg planner assigns each leg; the partner’s job appears in the Job Inbox (PP-12). |
| Partner assigns a job to a rider | Partner App: the rider sees the job. ERP Control Tower: the leg shows the assigned person. |
| Rider scans at pickup / hub hands over (Partner App) | Partner Portal: job status updates. Customer Portal: shipment status updates. |
| Escalation raised by Logisco desk | Partner Portal: ticket in Escalations Inbox with a timer (PP-20). |
| Claim attributed to the partner’s leg (ERP Claims) | Partner Portal: claim in PP-22; deduction in the next payout. |
| Weekly scoring run (ERP) | Partner Portal: scorecard and tier update (PP-23, PP-24). |
| Payout batch released (ERP Finance) | Partner Portal: payout with UTR (PP-27). |

# 3. Users and Roles

## 3.1 Portal roles

The source names the partner admin, who assigns jobs to field staff (§5.1), and a partner finance panel (§5.1). It does not define other roles. The Operations Manager and Finance roles below are proposed so that larger partners can split the work.

| **Role** | **Basis** | **Main jobs** | **Demo persona (SwiftCity Couriers)** |
|---|---|---|---|
| Partner Admin | Source §5.1 | Onboarding, agreement e-sign, users, bank, API; can do everything below | Vikram Singh, Director |
| Operations Manager | Assumed | Accept and assign jobs, live board, trips, hub ops, capacity, escalations, NDR, staff and vehicles | Neha Verma, Operations Head |
| Finance | Assumed (source mentions a partner finance panel) | Reconciliation, invoices, 3-way match disputes, payouts, early pay, COD deposits, claims and deductions | Anil Gupta, Accounts |

## 3.2 Field staff roles (managed here, used in the Partner App)

| **Role** | **Used by types** | **Does in the Partner App** |
|---|---|---|
| Rider | A, B, C | Pickup scan, weight and dimension photos, hand-over, delivery with OTP / e-POD, NDR, COD |
| Driver | A, D, E | Trip start with seal and vehicle number, GPS tracking, halts and breakdowns, arrival seal check |
| Hub staff | B (if hub), E, F | Bulk in-scan, sort to bags / cages, manifest, out-scan, seal, short / excess |

## 3.3 Permission matrix (proposed)

Full = view and act; View = read-only; — = hidden. Screens not relevant to the partner’s type are hidden for everyone.

| **Module / capability** | **Partner Admin** | **Operations** | **Finance** |
|---|---|---|---|
| Onboarding: application, KYC, audit booking | Full | View | View |
| Rate card and agreement e-sign | Full | View | View |
| Go-live setup (API, app, training) | Full | Full | — |
| Dashboard | All widgets | Operations widgets | Finance widgets |
| Job inbox: accept / flag | Full | Full | — |
| Assign to staff, live board | Full | Full | — |
| Line-haul trips, hub operations | Full | Full | View |
| Capacity calendar | Full | Full | — |
| Coverage change requests | Full | View | — |
| Escalations, delivery exceptions | Full | Full | View |
| Claims and deductions: respond | Full | View | Full |
| Scorecard and tier | Full | Full | Full |
| Finance panel, invoices, 3-way match disputes | Full | — | Full |
| Payouts and early pay | Full | — | Full |
| COD deposits | Full | View | Full |
| Field staff, vehicles | Full | Full | — |
| Hubs | Full | View | — |
| Documents and compliance | Full | View | View |
| Company profile and bank account | Full | View | View |
| Portal users | Full | — | — |
| API and integration | Full | — | — |
| Suspension / offboarding case | Full | View | Full |
| Own preferences, AI assistant, notifications, support | Full | Full | Full |

## 3.4 Role rules

- The applicant who registers becomes the Partner Admin. There must always be at least one active Partner Admin.

- Portal users can be limited to selected hubs or cities (assumed).

- Field staff never log in to the portal. Their mobile number is their Partner App login.

# 4. Navigation and Sitemap

## 4.1 Header

- Logisco logo, partner name and type badge (e.g. “Type B · Gold”).

- Search: job ID, LR, trip ID, staff name, vehicle number.

- Language toggle (English / हिन्दी), notification bell, help, profile menu, floating AI assistant button.

## 4.2 Left menu

| **Menu item** | **Opens** | **Shown for types** |
|---|---|---|
| Dashboard | PP-11 | All |
| Jobs (inbox) | PP-12 → PP-13, PP-14 | All |
| Live board | PP-15 | All |
| Trips | PP-16 | A, D, E |
| Hub operations | PP-17 | E (with hub), F; B if it runs a hub |
| Capacity | PP-18 | All |
| Coverage | PP-19 | All |
| Escalations | PP-20 | All |
| Delivery exceptions | PP-21 | A, B, C |
| Claims and deductions | PP-22 | All |
| Scorecard and tier | PP-23, PP-24 | All |
| Finance → Daily \| Invoices \| Payouts \| COD | PP-25 \| PP-26 \| PP-27 \| PP-28 | All (COD: A, B, C) |
| Staff \| Fleet \| Hubs \| Compliance | PP-29 \| PP-30 \| PP-31 \| PP-32 | Per type |
| Settings → Company \| Users \| Integration \| Preferences | PP-33 \| PP-34 \| PP-35 \| PP-36 | Integration: A, E (others optional) |
| Help | PP-38 | All |

## 4.3 Screens outside the menu

- Before login: PP-01 to PP-05.

- Until go-live, the menu is replaced by the Onboarding Tracker (PP-10), which links to PP-06 to PP-09.

- When suspended, the portal opens on PP-39 and job screens are read-only.

## 4.4 Main user journeys

| **Journey** | **Screens in order** |
|---|---|
| Become a partner | PP-04 Register → PP-05 Network fit → PP-06 KYC → PP-07 Verification / audit → PP-08 Agreement → PP-09 Go-live setup → PP-10 Trial → Live at Bronze |
| Daily first-mile work | PP-11 Dashboard → PP-12 Accept job → PP-14 Assign rider → PP-15 Live board → (Partner App pickup and hand-over) → PP-25 Daily reconciliation |
| Line-haul trip | PP-12 Accept trip → PP-14 Assign truck and driver → PP-16 Follow trip → arrival seal check |
| Escalation | Notification → PP-20 Acknowledge → Resolve with root cause |
| Claim on my leg | Notification → PP-22 Review evidence → Accept / Contest → deduction in PP-27 |
| Getting paid | PP-26 Self-billed invoice and 3-way match → dispute mismatches → PP-27 Payout (or early pay) |
| Score falls | PP-23 Scorecard → PP-24 Tier change / improvement plan → (if Probation) PP-39 |

# 5. Screen Inventory

The Partner Portal has 39 screens, grouped in 8 modules.

| **ID** | **Screen** | **Module** | **Used by** | **Basis** |
|---|---|---|---|---|
| PP-01 | Login | Access and login | Partner Admin, Operations Manager, Finance | Assumed |
| PP-02 | OTP verification | Access and login | All portal users | Assumed |
| PP-03 | Forgot / reset password | Access and login | All portal users | Assumed |
| PP-04 | Partner registration (application) | Partner onboarding | Applicant (becomes Partner Admin) | Source |
| PP-05 | Application status and network fit | Partner onboarding | Applicant | Source |
| PP-06 | Documents and KYC | Partner onboarding | Partner Admin | Source |
| PP-07 | Verification outcome and hub audit | Partner onboarding | Partner Admin | Source |
| PP-08 | Rate card, SLA and agreement | Partner onboarding | Partner Admin (signs); Finance and Operations view later | Source |
| PP-09 | Go-live setup (integration, app and training) | Partner onboarding | Partner Admin, Operations Manager | Source |
| PP-10 | Onboarding tracker and monitored trial | Partner onboarding | Partner Admin (others view) | Source |
| PP-11 | Dashboard | Dashboard | All (widgets by role) | Source |
| PP-12 | Job inbox | Jobs and operations | Partner Admin, Operations Manager | Source |
| PP-13 | Job detail | Jobs and operations | Partner Admin, Operations Manager (Finance view only) | Source |
| PP-14 | Assign to field staff | Jobs and operations | Partner Admin, Operations Manager | Source |
| PP-15 | Live operations board | Jobs and operations | Partner Admin, Operations Manager | Source |
| PP-16 | Line-haul trips | Jobs and operations | Partner Admin, Operations Manager (Types A, D, E) | Source |
| PP-17 | Hub operations | Jobs and operations | Partner Admin, Operations Manager (Types E with hub, F) | Source |
| PP-18 | Capacity calendar | Jobs and operations | Partner Admin, Operations Manager | Source |
| PP-19 | Coverage: pincodes, lanes and hubs | Jobs and operations | Partner Admin (request changes); Operations (view) | Source |
| PP-20 | Escalations inbox | Exceptions, claims and escalations | Partner Admin, Operations Manager | Source |
| PP-21 | Delivery exceptions (NDR and RTO) | Exceptions, claims and escalations | Partner Admin, Operations Manager (Types A, B, C) | Source |
| PP-22 | Claims and deductions | Exceptions, claims and escalations | Partner Admin, Finance (Operations view) | Source |
| PP-23 | Performance scorecard | Performance | All portal users | Source |
| PP-24 | Tier and benefits | Performance | All portal users | Source |
| PP-25 | Finance panel (daily reconciliation) | Finance | Partner Admin, Finance | Source |
| PP-26 | Invoices and 3-way match | Finance | Partner Admin, Finance | Source |
| PP-27 | Payouts | Finance | Partner Admin, Finance | Source |
| PP-28 | COD deposits | Finance | Partner Admin, Finance (Types A, B, C) | Source |
| PP-29 | Field staff | Staff, fleet and settings | Partner Admin, Operations Manager | Source |
| PP-30 | Vehicles | Staff, fleet and settings | Partner Admin, Operations Manager (Types B with own fleet, C, D, E) | Source |
| PP-31 | Hubs | Staff, fleet and settings | Partner Admin (Types E with hub, F; B if it runs a hub) | Source |
| PP-32 | Documents and compliance | Staff, fleet and settings | Partner Admin | Source |
| PP-33 | Company profile, bank and agreement | Staff, fleet and settings | Partner Admin (edit); Finance (view bank, agreement) | Source |
| PP-34 | Portal users and roles | Staff, fleet and settings | Partner Admin | Assumed |
| PP-35 | API and integration | Staff, fleet and settings | Partner Admin | Source |
| PP-36 | Notification preferences and language | Staff, fleet and settings | All portal users | Source |
| PP-37 | AI assistant | Staff, fleet and settings | All portal users | Source |
| PP-38 | Notification centre and support | Staff, fleet and settings | All portal users | Assumed |
| PP-39 | Suspension and offboarding status | Staff, fleet and settings | Partner Admin, Finance | Source |

# 6. Screen Specifications

## 6.1 Access and login

### PP-01 Login

| | |
|---|---|
| **Purpose** | Entry point for partner company users (Admin, Operations, Finance). Field staff do not log in here; they use the Partner App. |
| **Used by** | Partner Admin, Operations Manager, Finance |
| **Opened from** | Partner Portal URL; launcher card in the prototype |
| **Basis** | Assumed (standard). Language from source §14. |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Login method | Tabs | Yes | Email & password \| Mobile OTP | Mobile OTP |
| Work email | Email | Cond. | For email login | vikram@swiftcity.in |
| Password | Password | Cond. | Min 8 characters | \*\*\*\*\*\*\*\* |
| Mobile number | Phone (+91) | Cond. | For OTP login; 10 digits starting 6–9 | 98111 22334 |
| Language | Dropdown | Yes | English \| हिन्दी | हिन्दी |

**Actions**

| **Action** | **What happens** |
|---|---|
| Log in | Live partner → Dashboard (PP-11). Applicant → Onboarding Tracker (PP-10). Suspended partner → Suspension status (PP-39). |
| Become a partner | Opens registration (PP-04) |
| Check application status | Enter application reference + mobile → PP-05 |
| Forgot password | PP-03 |

**Business rules**

- A field-staff mobile number used here shows: “Please use the Logisco Partner App.”

**Prototype notes**

- Persona chips: SwiftCity Couriers (Admin / Operations / Finance), Deccan Roadlines (Admin, in trial), NCR CrossDock (Admin, hub).

### PP-02 OTP verification

| | |
|---|---|
| **Purpose** | Verifies mobile numbers at login, registration and sensitive changes (bank account, early-pay request). |
| **Used by** | All portal users |
| **Opened from** | PP-01, PP-04, PP-33 |
| **Basis** | Assumed (standard) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| OTP | 6 boxes | Yes | Expires in 5 minutes; 3 attempts; resend after 30 seconds | 123456 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Verify | Continues to the next screen |
| Resend OTP | Max 3 resends |

**Prototype notes**

- OTP is always 123456.

### PP-03 Forgot / reset password

| | |
|---|---|
| **Purpose** | Resets a portal user’s password. |
| **Used by** | All portal users |
| **Opened from** | PP-01 |
| **Basis** | Assumed (standard) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Email or mobile | Text | Yes | | vikram@swiftcity.in |
| OTP | 6 digits | Yes | | 123456 |
| New password / confirm | Password | Yes | Min 8 characters, 1 letter, 1 number; must match | \*\*\*\*\*\*\*\* |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reset password | Back to PP-01 with a success message |

## 6.2 Partner onboarding

### PP-04 Partner registration (application)

| | |
|---|---|
| **Purpose** | A delivery partner applies to join the Logisco network: chooses its partner type and the legs it can serve, and declares coverage, fleet, capacity and indicative rates. Phase 1, Step 1. |
| **Used by** | Applicant (becomes Partner Admin) |
| **Opened from** | PP-01 → Become a partner; Logisco website; referral link; Logisco sales team |
| **Basis** | Source §4 Phase 1 Step 1; partner types §3 |

**Step 1: Partner type and legs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Partner type | Cards (single choice) | Yes | A National courier \| B Regional / city courier \| C Hyperlocal delivery \| D Mid-mile / line-haul transporter \| E PTL consolidator / transporter \| F Hub / warehouse operator (each card shows a one-line description from §3) | B Regional / city courier |
| Legs you can serve | Multi-select | Yes | First mile (pickup) \| Origin hub \| Line-haul \| Destination hub \| Last mile (delivery). Options are pre-ticked by type (see Section 2.2). | First mile, Last mile |
| Services | Multi-select | Yes | Parcel \| Express PTL \| Standard PTL | Parcel, Express PTL |
| Service tiers offered | Multi-select | Yes | Economy \| Standard \| Express \| Express PTL | Standard, Express |

**Step 2: Company details**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Company name | Text | Yes | | SwiftCity Couriers Pvt Ltd |
| GSTIN | Text (15) | Cond. | Required unless the partner is not GST-registered (allowed for Type C / D, source §4.1 note 1); duplicate check | 07AAKCS4321M1Z8 |
| PAN | Text (10) | Yes | Company or proprietor PAN; duplicate check | AAKCS4321M |
| Constitution | Dropdown | Yes | Proprietorship \| Partnership \| LLP \| Private Ltd \| Public Ltd | Private Ltd |
| Contact name / designation | Text | Yes | | Vikram Singh, Director |
| Mobile | Phone (+91) | Yes | Verified by OTP; duplicate check | 98111 22334 |
| Email | Email | Yes | | vikram@swiftcity.in |
| Registered address | Address | Yes | | B-14, Mayapuri Industrial Area, New Delhi 110064 |
| How did you hear about us? | Dropdown | Yes | Website \| App \| Referral \| Logisco sales team (source §4 Step 1) | Logisco sales team |

**Step 3: Coverage**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Operating states | Multi-select | Yes | | Delhi, Haryana, Uttar Pradesh |
| Operating cities | Multi-select | Yes | Filtered by states | New Delhi, Gurugram, Noida, Faridabad |
| Serviceable pincodes | Upload or pick | Cond. | For first / last mile (Types A, B, C). Upload Excel or pick on map; shows a pincode map preview | 142 pincodes |
| Lanes | Repeatable rows | Cond. | For line-haul (Types A, D, E): origin city → destination city, frequency (daily / alternate days / weekly), transit hours | Delhi → Hubballi, daily, 52 h |
| Hubs | Repeatable rows | Cond. | For Types E, F (and B if it runs a hub): hub name, address, pincode, area (sq ft), docks | — |

**Step 4: Fleet and capacity**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Fleet size by vehicle type | Number per type | Cond. | Two-wheeler \| Three-wheeler \| Tempo / small commercial \| 14–17 ft truck \| 19–24 ft truck \| 32 ft truck | Two-wheeler 40, Tempo 8 |
| Own fleet or attached | Radio | Yes | Own \| Attached / leased \| Both | Own |
| Field staff count | Number | Yes | Riders, drivers, hub staff | 52 |
| Daily capacity | Number + unit | Yes | Shipments / day (A, B, C); kg or tonnes / day (D, E); pieces / day (F) | 900 shipments / day |
| Indicative rates | Rows | Yes | Per leg type, in the unit used for that type: per shipment (B), per delivery (C), per trip or per kg (D), per kg with minimum (E), per piece / kg + storage per day (F), per leg (A) | First mile ₹28 / shipment; PTL pickup ₹1.50 / kg |

**Actions**

| **Action** | **What happens** |
|---|---|
| Verify mobile | OTP (PP-02) |
| Back / Next | Moves between steps with validation |
| Submit application | Application reference created; acknowledgement sent on WhatsApp and email; goes to PP-05 |

**Business rules**

- Duplicate check on GSTIN, PAN and phone; a match shows “An application or account already exists. Contact partners@logisco.in.” (source §4 Step 1).

- A coverage map preview shows declared pincodes or lanes before submission.

**Prototype notes**

- Submitting any valid form creates application APP-2026-0413 and continues to PP-05.

### PP-05 Application status and network fit

| | |
|---|---|
| **Purpose** | Shows the outcome of the AI network-gap fit check: either the partner is invited to continue (with an onboarding coordinator) or placed on a waitlist. |
| **Used by** | Applicant |
| **Opened from** | After PP-04; PP-01 → Check application status; WhatsApp link |
| **Basis** | Source §4 Phase 1 Step 2 (target: same day) |

**Displayed**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Application reference | Text | — | | APP-2026-0412 |
| Status | Chip | — | Submitted \| Under review \| Invited to onboard \| Waitlisted \| Rejected | Invited to onboard |
| Why we need you | Text | — | Plain-language summary of the fit (no score shown, assumed) | Logisco needs line-haul capacity on Delhi → Hubballi |
| Onboarding coordinator | Card | — | Name, phone, email | Meera Iyer, Partner Management |
| Onboarding pack | Download | — | Process guide, document checklist for your type, sample agreement, rate card template | onboarding_pack_type_E.pdf |
| Waitlist note | Text | — | Shown if waitlisted: “We re-check every month and will contact you when there is a need on your lanes.” | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Start onboarding | Opens the Onboarding Tracker (PP-10) and document submission (PP-06) |

**Business rules**

- Fit → onboarding pack + coordinator assigned. No fit → waitlist, re-scored monthly (source §4 Step 2).

**Prototype notes**

- Deccan Roadlines shows “Invited” with a high fit on Delhi → Hubballi. A new applicant for Delhi pincodes already well covered is waitlisted.

### PP-06 Documents and KYC

| | |
|---|---|
| **Purpose** | Digital KYC: company, bank, insurance and licence documents, plus vehicle and driver checks where they apply. The list of required documents changes with partner type. Target 48 hours. |
| **Used by** | Partner Admin |
| **Opened from** | Onboarding Tracker; later PP-32 for renewals |
| **Basis** | Source §4 Phase 2 Step 3; document checklist §4.1 |

**Section 1: Company documents**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| GSTIN | Verify button | Cond. | Verified by API; required for A, B, E, F and for C / D if GST-registered | 07AAKCS4321M1Z8 ✓ Active |
| PAN | Verify button | Yes | Verified by API | AAKCS4321M ✓ |
| Incorporation certificate / partnership deed | File upload | Cond. | Required for A, B, E, F; for C / D if a company or firm | coi.pdf |
| Udyam (MSME) certificate | File / number | No | Optional for all types | UDYAM-DL-08-0012345 |
| Transport licence | File upload | Cond. | Where applicable (source §4 Step 3) | transport_licence.pdf |
| DigiLocker fetch | Button | No | Fetches verified documents with consent (source §13) | — |

**Section 2: Bank account (payouts)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Account holder name | Text | Yes | Should match the legal name | SwiftCity Couriers Pvt Ltd |
| Account number / confirm | Number | Yes | 9–18 digits; must match | 912020012345678 |
| IFSC | Text (11) | Yes | Bank and branch filled automatically | UTIB0000123 → Axis Bank, Rajouri Garden |
| Cancelled cheque | File upload | Yes | | cheque.jpg |
| Penny-drop | Auto | — | Runs automatically after the IFSC check; shows name match % | ✓ Name match 100% |

**Section 3: Insurance**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Goods-in-transit / liability insurance | File + policy no. + expiry | Cond. | Required for A, B, D, E; optional for C | GIT policy 2201/88, expires 31-Mar-2027 |
| Premises insurance | File + expiry | Cond. | Required for F (source §4.1 note 3) | — |

**Section 4: Vehicles (Types B if own fleet, C, D, E)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Vehicle registration number | Text + Verify | Yes | Verified on Vahan via ULIP: owner, class, fitness, permit, insurance validity | DL01LT4521 ✓ |
| RC, fitness, permit, insurance | File uploads | Yes | Auto-filled from Vahan where available; expiry dates captured | 4 documents |
| Add vehicles in bulk | Excel upload | No | Template with registration numbers | vehicles.xlsx |

**Section 5: Field staff (Types B, C, D, E; police verification also F)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Driver / rider licence | Licence no. + Verify | Cond. | Verified on Sarathi via ULIP (B, C, D, E) | DL-0420190012345 ✓ |
| Photo ID | File upload | Yes | | aadhaar_masked.jpg |
| Police verification | File upload | Cond. | Required for B, C, D, E, F | pv_ravi.pdf |

**Section 6: Hub documents (Type F; B and E if they run a hub)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hub lease / ownership | File upload | Cond. | | lease.pdf |
| Fire NOC | File + expiry | Cond. | | fire_noc.pdf |
| Trade licence | File + expiry | Cond. | | trade_licence.pdf |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save draft | Progress kept |
| Submit for verification | Automatic checks run; clean files → Verified; anything flagged → manual review by Partner Management (PP-07 outcome) |
| Re-upload | Available on any document marked Flagged, with the reason |

**Business rules**

- AI document OCR reads each upload and flags tampered, duplicate or mismatched documents (source §4 Step 3).

- Each document shows: Not uploaded \| Uploaded \| Verified \| Flagged (reason) \| Expiring soon.

- Only the documents ticked for the partner’s type in the checklist (Section 2.3) are shown.

**Prototype notes**

- Verify buttons return scripted results after a short spinner.

- For Deccan Roadlines, the insurance certificate is pre-set as Flagged (expired) so the re-upload path can be shown.

### PP-07 Verification outcome and hub audit

| | |
|---|---|
| **Purpose** | Shows the result of manual verification, and for hub operators, schedules and reports the site audit. |
| **Used by** | Partner Admin |
| **Opened from** | Onboarding Tracker; notification |
| **Basis** | Source §4 Phase 2 Step 4 |

**Verification outcome**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Outcome | Chip | — | Approved \| Conditionally approved \| Rejected | Conditionally approved |
| Reasons / conditions | List | — | Each condition with a due date | Upload renewed GIT insurance within 7 days |

**Hub audit (Type F, and Type E with a hub)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Preferred audit date | Date | Yes | Within 5 days (source §4 Step 4) | 26-Nov-2026 |
| Time window | Dropdown | Yes | Morning \| Afternoon | Morning |
| Site contact | Text + phone | Yes | | Rohit Malik, 98990 55667 |
| Audit checklist (read-only) | List | — | Security \| CCTV \| Fire safety \| Docks \| Scale calibration; each Pass / Fail / Observation with geo-tagged photos | 5 of 5 passed |
| Audit result | Chip | — | Approved \| Conditionally approved \| Rejected | Approved |
| Corrective actions | Table | Cond. | Action, due date, evidence upload, status | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Book audit slot | Confirms the slot with the auditor |
| Upload evidence | Closes a corrective action or condition |

**Business rules**

- A rejection lists reasons; the applicant can re-apply after 90 days (assumed).

**Prototype notes**

- NCR CrossDock shows a completed audit with photos.

### PP-08 Rate card, SLA and agreement

| | |
|---|---|
| **Purpose** | Partner reviews the proposed rate card per leg and lane, hand-over windows, SLA, penalties, liability and payment terms, and e-signs the agreement. Takes 1–3 days. |
| **Used by** | Partner Admin (signs); Finance and Operations view later |
| **Opened from** | Onboarding Tracker; Settings → Agreement |
| **Basis** | Source §4 Phase 3 Step 5 |

**Tab 1: Rate card per leg and lane**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Leg type | Column | — | First mile \| Origin hub \| Line-haul \| Destination hub \| Last mile | First mile |
| Lane / pincode cluster | Column | — | | Delhi South cluster |
| Service | Column | — | Parcel \| Express PTL \| Standard PTL | Express PTL |
| Rate and unit | Column | — | Unit follows the partner type (per shipment, per kg with minimum, per trip, per piece, storage per day) | ₹250 per PTL pickup up to 200 kg |
| Your proposed rate | Currency | No | Partner can counter-propose any line | — |

**Tab 2: Operations terms**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hand-over windows and cut-off times | Table | — | Per leg: e.g. pickups by 18:00 must reach origin hub by 21:00 | Hub drop by 21:00 |
| SLA | Table | — | Pickup within window; delivery / arrival by promised time; ticket acknowledgement time | Pickup within slot; tickets acknowledged in 2 h |
| Penalty matrix | Table | — | Breach type → penalty (values to be confirmed) | Missed pickup: ₹100 |
| Liability cap | Text | — | Per kg / per shipment for loss or damage on the partner’s leg | ₹100 / kg, max ₹10,000 |
| Payment cycle | Text | — | By tier (see PP-24) | Fortnightly at Bronze |
| Security deposit | Currency | No | Optional (source §4 Step 5) | ₹25,000 |

**Tab 3: Agreement**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Agreement preview | PDF viewer | — | Generated from template with the agreed rates | Logisco_Partner_Agreement_SwiftCity.pdf |
| Self-billing consent | Checkbox | No | Lets Logisco generate the partner’s invoice from completed legs (source §9; subject to GST rules) | Ticked |
| I agree | Checkbox | Yes | | Ticked |
| E-sign method | Radio | Yes | Aadhaar OTP \| DSC | Aadhaar OTP |

**Actions**

| **Action** | **What happens** |
|---|---|
| Propose changes | Sends counter-proposals to the coordinator; status “Under negotiation” |
| Accept & e-sign | Agreement signed; rate card loaded into Logisco’s rate engine |
| Download | Rate card Excel / agreement PDF |

**Business rules**

- Logisco’s AI margin check flags lanes where the partner rate leaves Logisco below its target margin. The partner sees only “Rate not accepted on this lane”, not Logisco’s margin (source §4 Step 5).

**Prototype notes**

- Deccan Roadlines’ Delhi → Belagavi line is pre-set as “Not accepted, please revise” to show negotiation.

### PP-09 Go-live setup (integration, app and training)

| | |
|---|---|
| **Purpose** | Connects the partner’s systems (Types A and E) or sets up the Partner App for its field staff (other types), and tracks training. Takes 1–2 days. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | Onboarding Tracker |
| **Basis** | Source §4 Phase 4 Step 6 |

**Path 1: API integration (Types A, E)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Sandbox API key | Generate | Yes | See PP-35 | lg_p_sbx\_••••7c2e |
| Webhook URL for job push | URL | Yes | HTTPS | https://api.deccanroadlines.in/logisco |
| Status code mapping | Table | Yes | Map each partner status to the Logisco status list | 12 of 12 mapped |
| Test shipments | Checklist | Yes | Receive job → accept → status updates → POD; each Pass / Fail | 5 of 5 passed |

**Path 2: Partner App setup (other types)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Download app | QR code + link | — | Android | — |
| Field staff added | Count + link | Yes | At least 1; managed in PP-29 | 12 riders, 2 hub staff |
| App activated | Count | — | Staff who logged in at least once | 10 of 14 |

**Training (all types)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Training videos | List | — | Scan, hand-over, seal, e-POD; English and Hindi | 4 videos |
| Practice mode completed | Per staff | — | Completed in the app’s practice mode | 9 of 14 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Run test | Sends a test job to the API sandbox and shows each step’s result |
| Mark ready for trial | Moves the tracker to Monitored Trial |

**Business rules**

- An AI assistant answers “how do I…” questions inside the app (source §4 Step 6).

**Prototype notes**

- Test results appear one by one with a short delay.

### PP-10 Onboarding tracker and monitored trial

| | |
|---|---|
| **Purpose** | Shows every onboarding step and, during the 1–2 week trial, the live trial score. |
| **Used by** | Partner Admin (others view) |
| **Opened from** | Home screen until go-live |
| **Basis** | Source §4 Phase 5 Steps 7–8; target 5 business days to go-live plus trial |

**Tracker steps**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| 1\. Application | Step | — | Done \| In progress \| Pending \| Action needed | Done |
| 2\. Network fit | Step | — | | Done |
| 3\. Documents and KYC | Step | — | | Done |
| 4\. Verification / hub audit | Step | — | | Done |
| 5\. Rate card and agreement | Step | — | | Done |
| 6\. Go-live setup | Step | — | | Done |
| 7\. Monitored trial | Step + progress | — | 10 live parcel jobs, or 3 PTL / line-haul trips | 2 of 3 trips |
| 8\. Live | Step | — | | Pending |

**Trial panel**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Trial jobs table | Table | — | Job, date, leg, on time (Y/N), scan compliance, AI anomaly flags, job score | TRP-2026-0931 · 86 |
| Running trial score | Gauge (0–100) | — | Pass mark 80 | 84 |
| Result | Chip | — | In progress \| Passed \| Extended \| Declined (with reasons) | In progress |

**Actions**

| **Action** | **What happens** |
|---|---|
| Open job | PP-13 job detail |

**Business rules**

- Trial score of 80 or more → go-live. Below 80 → trial extended, or partner declined with reasons (source §4 Step 7).

- At go-live the partner joins the assignment pool at Bronze tier (source §4 Step 8). See open question 1 in Section 12.

**Prototype notes**

- Deccan Roadlines is mid-trial. A demo toolbar button completes the third trip so the go-live moment can be shown.

## 6.3 Dashboard

### PP-11 Dashboard

| | |
|---|---|
| **Purpose** | Partner’s daily home: jobs to accept and assign, SLA clocks, capacity, score and tier, payouts and alerts. |
| **Used by** | All (widgets by role) |
| **Opened from** | After login |
| **Basis** | Source §5.1 (daily workflow); §5.2; §5.3 |

**Widgets**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Jobs to accept | Count + list | — | Offered jobs with acceptance countdown → PP-12 | 6 waiting |
| Jobs to assign | Count | — | Accepted but not yet assigned to staff → PP-14 | 4 |
| Today’s jobs by status | Tiles | — | Assigned \| In progress \| Handed over / delivered \| Failed \| SLA at risk | At risk: 2 |
| Capacity today | Bar | — | Accepted jobs vs declared capacity → PP-18 | 640 of 900 |
| Score and tier | Card | — | Current weekly score, tier, trend vs last week → PP-23 | 86 · Gold ↑1 |
| Open escalations | Count + timers | — | → PP-20 | 2 (1 due in 40 min) |
| Payout | Card | — | Next payout date and amount; pending deductions → PP-27 | ₹1,84,063 on 27-Nov |
| COD to deposit | Card | — | COD collected not yet deposited; 24-hour deadline → PP-28 | ₹21,600, due 19:00 |
| Alerts | List | — | Expiring documents, re-KYC, tier change, claims attributed | Fire NOC expires in 12 days |

**Actions**

| **Action** | **What happens** |
|---|---|
| Click any widget | Opens the related screen, filtered |

**Business rules**

- Operations Manager sees job, capacity and escalation widgets; Finance sees payout, COD and deductions; Admin sees all.

**Prototype notes**

- Counts are live from the shared store.

## 6.4 Jobs and operations

### PP-12 Job inbox

| | |
|---|---|
| **Purpose** | Jobs Logisco has assigned to this partner (pickups, line-haul trips, hub tasks, deliveries) appear here automatically with SLA clocks. The partner accepts each job or flags it as not serviceable. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | Menu → Jobs; dashboard |
| **Basis** | Source §5.1 (Receive Jobs) |

**Filters**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Job type | Multi-select | — | Pickup \| Line-haul trip \| Hub inbound \| Hub outbound \| Delivery \| Reverse pickup \| RTO | Pickup |
| Status | Tabs | — | Offered \| Accepted (unassigned) \| Assigned \| In progress \| Completed \| Flagged / rejected | Offered |
| Date / slot | Date | — | | Today |
| Pincode / lane / hub | Dropdown | — | | All |

**Table columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Job ID | Link | — | Leg-level ID: master LR + leg number | JOB-000781-L1 |
| Job type | Chip | — | | Pickup |
| From → to | Text | — | Pickup address → hand-over point (hub), or hub → hub | Okhla 110020 → NCR CrossDock, Gurugram |
| Pieces / weight | Text | — | Booked weight | 6 pcs / 120 kg |
| Window | Time range | — | Pickup slot or hand-over window | 14:00–16:00, hub by 21:00 |
| Payout for this job | Currency | — | From the partner’s rate card | ₹250 |
| Accept by | Countdown | — | Acceptance timer (assumed 30 minutes) | 22 min |
| Special | Icons | — | COD, appointment, fragile, ODA, e-way bill | E-way bill |

**Actions**

| **Action** | **What happens** |
|---|---|
| Accept | Job moves to Accepted (unassigned); SLA clock starts |
| Accept and assign | Accepts and opens PP-14 |
| Flag not serviceable | Reason: Pincode not served \| Capacity full \| Vehicle not available \| Holiday \| Other + remark. Job returns to Logisco for reassignment. |
| Bulk accept | For selected rows |

**Business rules**

- If not accepted before the timer ends, the job is withdrawn and offered to the next partner (assumed). Late acceptance and flags affect the Responsiveness score.

- Partners see the consignee’s name and address only for their own pickup or delivery leg, and never the customer’s price (assumed; DPDP masking).

**Prototype notes**

- When a booking is confirmed in the Customer Portal, its first-mile job appears here for SwiftCity within a second.

### PP-13 Job detail

| | |
|---|---|
| **Purpose** | Everything about one leg: what to move, from where to where, by when, the hand-over counterparts, scans, seals, photos and status. |
| **Used by** | Partner Admin, Operations Manager (Finance view only) |
| **Opened from** | PP-12, PP-15, search |
| **Basis** | Source §5.1; §2.2 (master shipment with legs, hand-over scans) |

**Header**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Job ID / master LR / leg | Text | — | | JOB-000781-L1 · LGS-DEL-000781 · Leg 1 of 5 |
| Status | Chip | — | See Section 8 | Assigned |
| SLA clock | Timer | — | Green / amber / red | 1 h 35 m to pickup window end |

**Details**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pick from / hand to | Address cards | — | Pickup or hub addresses; masked contact numbers with call button | Sharma Electricals, Okhla → NCR CrossDock, Gurugram |
| Previous / next partner | Text | — | Who hands over to you and who you hand over to (needed for the chain of custody) | Next: NCR CrossDock |
| Pieces | Table | — | Piece ID, booked dims and weight, verified dims and weight, scan status | 6 pieces |
| Documents | Links | — | LR, labels, invoice copy, e-way bill, manifest | 4 |
| Seal number | Text | — | Shown from origin hub onward | SL-44817 |
| COD amount | Currency | — | Last mile only | — |
| Assigned staff / vehicle | Text | — | | Ravi Kumar · DL01LT4521 |

**Timeline**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Events | List | — | Offered, accepted, assigned, started, each scan with photo and geo-tag, hand-over confirmed by both sides | Picked Up 14:32 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Assign / reassign staff | PP-14 |
| Report a problem | Breakdown \| Vehicle delay \| Consignee issue \| Damage found \| Other → creates a ticket |
| Call (masked) | Masked call to the pickup contact, consignee or next partner |

**Business rules**

- A hand-over is complete only when both sides confirm the scan with photo and seal number. Liability moves with it (source §2.2).

### PP-14 Assign to field staff

| | |
|---|---|
| **Purpose** | Partner admin assigns accepted jobs to riders, drivers or hub staff, who then get them in the Partner App. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | PP-12 → Accept and assign; PP-13 |
| **Basis** | Source §5.1 (Assign to Field Staff) |

**Assignment panel**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Jobs selected | List | — | Single or bulk | 3 pickups, Okhla |
| Staff | Dropdown with search | Yes | Shows each person’s role, jobs today, last location, on-duty status | Ravi Kumar · 5 jobs · Okhla |
| Vehicle | Dropdown | Cond. | Required for pickups over 30 kg and line-haul (assumed) | DL01LT4521 (Tempo) |
| Suggested staff | Chips | — | Nearest on-duty staff with spare load (assumed helper) | Ravi Kumar, Sunil Yadav |
| Note to staff | Text | No | Shown in the app | Use Gate 2 |

**Line-haul trip assignment (Types D, E)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Truck | Dropdown | Yes | Registration number; Vahan-verified | KA25AB1234 |
| Driver | Dropdown | Yes | Sarathi-verified licence | Basavaraj H. |
| Co-driver | Dropdown | No | | — |
| FASTag / GPS device | Read-only | — | From the vehicle record | FASTag linked, GPS ID 8812 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Assign | Job status → Assigned; the staff member gets a push notification in the Partner App |
| Unassign | Returns the job to Accepted |

**Business rules**

- Staff with expired licence or pending police verification cannot be assigned.

**Prototype notes**

- Assigning Ravi makes the job appear in the Partner App rider persona.

### PP-15 Live operations board

| | |
|---|---|
| **Purpose** | Real-time view of all the partner’s jobs and staff today, with SLA risk. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | Menu → Live board |
| **Basis** | Source §5.1; Control Tower features §11.1 (partner-side view, assumed) |

**Views**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Board columns | Kanban | — | Accepted \| Assigned \| In progress \| Handed over / delivered \| Failed | — |
| Map | Map | — | Staff and trucks with last location; jobs as pins | 14 riders on duty |
| At-risk list | Table | — | Jobs likely to miss SLA: job, staff, minutes left, reason | JOB-000790-L1 · 25 min |
| Staff list | Table | — | Staff, jobs done / total, last scan time, status (on duty / idle / offline) | Ravi 3/5 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reassign | Quick reassign from the board |
| Call staff | Masked call |

**Prototype notes**

- Rider markers move along preset paths.

### PP-16 Line-haul trips

| | |
|---|---|
| **Purpose** | For line-haul partners: plan and follow trips hub-to-hub with GPS / FASTag tracking, halts, breakdowns and arrival seal check. |
| **Used by** | Partner Admin, Operations Manager (Types A, D, E) |
| **Opened from** | Menu → Trips |
| **Basis** | Source §5.1 (Line-Haul Trip); §7 Step 6 |

**Trips list**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Trip ID | Link | — | | TRP-2026-0931 |
| Lane | Text | — | | Gurugram hub → Hubballi hub |
| Truck / driver | Text | — | | KA25AB1234 · Basavaraj H. |
| Load | Text | — | Shipments, pieces, kg | 38 shipments · 4,120 kg |
| Departure / ETA | Date-time | — | ETA updated from GPS | 23-Nov 23:00 / 25-Nov 03:00 |
| Status | Chip | — | Planned \| Loading \| In transit \| Halted \| Breakdown \| Arrived \| Closed | In transit |

**Trip detail**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Manifest | Table | — | LR, pieces, weight, bag / cage ID | 38 rows |
| Seal numbers | Text | — | Recorded at departure; checked on arrival | SL-44817 … SL-44822 |
| Live map | Map | — | GPS / FASTag positions along the route | Near Nagpur |
| Halts and incidents | Table | — | Time, place, type (rest / traffic / breakdown / police check), duration, remark | 06:00, 3 h, traffic |
| E-way bill Part B | Status | — | Vehicle number updated on vehicle change | Updated ✓ |
| Arrival check | Card | — | Arrival time, seal intact Y/N per seal, short / excess bags | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Report breakdown | Location, issue, photos, expected delay → Logisco Control Tower ticket; option to request a backup vehicle |
| Change vehicle | New truck and driver; prompts the e-way bill Part B update |

**Business rules**

- AI predicts delay from GPS progress; the partner sees “ETA risk” and the customer gets a revised ETA (source §7 Step 6).

**Prototype notes**

- Deccan Roadlines’ trial trip TRP-2026-0931 carries LGS-DEL-000781.

### PP-17 Hub operations

| | |
|---|---|
| **Purpose** | For hub operators: inbound, sorting, manifests, outbound, dwell time and short / excess at each hub. |
| **Used by** | Partner Admin, Operations Manager (Types E with hub, F) |
| **Opened from** | Menu → Hub operations |
| **Basis** | Source §5.1 (Hub Operations); §7 Steps 5 and 7 |

**Hub summary (per hub, today)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Expected inbound | Count | — | Shipments and pieces arriving from first-mile and line-haul | 212 shipments |
| In-scanned | Count | — | | 188 |
| Sorted / bagged | Count | — | By destination bag or cage | 160 |
| Manifested and sealed | Count | — | | 120 |
| Out-scanned | Count | — | | 96 |
| Average dwell time | Hours | — | Time from in-scan to out-scan | 5.2 h |
| Short / excess | Count + list | — | Pieces expected but not scanned, or scanned but not expected | 1 short |

**Manifests**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Manifest ID, destination, bags, pieces, seal, vehicle, status | Table | — | Open \| Sealed \| Dispatched \| Received | MAN-GGN-1123 · Hubballi · Sealed |

**Storage (if used)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Stored shipments, days in storage, storage charge accrued | Table | — | Storage per day is billable (source §3, Type F) | 4 shipments · 2 days |

**Actions**

| **Action** | **What happens** |
|---|---|
| Open manifest | Manifest detail and print |
| Raise short / excess | Creates an exception with photos; links to the previous leg |

**Business rules**

- Scanning itself is done by hub staff in the Partner App (hub mode). This screen is the supervisor’s view.

**Prototype notes**

- NCR CrossDock shows the Gurugram hub with seeded counts.

### PP-18 Capacity calendar

| | |
|---|---|
| **Purpose** | Partner declares daily capacity and holidays; Logisco’s assignment engine respects it. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | Menu → Capacity |
| **Basis** | Source §5.1 (Declare Capacity); §8 (Capacity Check) |

**Calendar**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Default daily capacity | Number + unit | Yes | Per service and leg type, in the type’s unit | Pickups 450 / day; deliveries 450 / day |
| Day override | Number | No | Click a date to raise or lower capacity | Diwali week: 200 / day |
| Holiday / closed | Toggle per date | No | No jobs offered on that date | 1-Nov |
| Pause new jobs | Toggle + until | No | Emergency pause (e.g. strike, flood); reason required | Off |
| Utilisation | Heat map | — | Jobs accepted vs capacity per day | 71% average |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | Engine uses new capacity for future offers |

**Business rules**

- Frequent pauses are visible to Logisco Partner Management (assumed).

### PP-19 Coverage: pincodes, lanes and hubs

| | |
|---|---|
| **Purpose** | The pincodes, lanes and hubs the partner is registered for. Changes need Logisco approval. |
| **Used by** | Partner Admin (request changes); Operations (view) |
| **Opened from** | Menu → Coverage |
| **Basis** | Source §4 Step 1; §8 (Pincode Serviceability) |

**Views**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pincode map and list | Map + table | — | Pincode, area, leg types served, active Y/N | 142 pincodes |
| Lanes | Table | — | Lane, frequency, transit hours, active | — |
| Hubs | Table | — | Links to PP-31 | — |
| Change request | Form | — | Add / remove pincodes or lanes, effective date, reason | Add 6 Noida pincodes |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit change request | Status Pending → Approved / Rejected by Logisco Network Planning |

**Business rules**

- Only partners registered for a leg’s pincodes or lane are eligible for that leg (source §8).

## 6.5 Exceptions, claims and escalations

### PP-20 Escalations inbox

| | |
|---|---|
| **Purpose** | Tickets raised against the partner land here with a response timer. A missed timer reduces the score. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | Menu → Escalations; dashboard |
| **Basis** | Source §5.1 (Escalations); §5.2 (Responsiveness) |

**Table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Ticket ID | Link | — | | TKT-P-5521 |
| Job / LR | Link | — | | JOB-000790-L1 |
| Type | Chip | — | Missed pickup \| Delay \| Missed scan \| Seal mismatch \| Short / damaged \| NDR dispute \| Customer complaint \| COD shortage | Missed pickup |
| Raised by / on | Text | — | Logisco desk or system | System · 23-Nov 16:05 |
| Acknowledge by / resolve by | Timers | — | Amber under 30 minutes | Ack in 40 min |
| Status | Chip | — | New \| Acknowledged \| In progress \| Resolved \| Closed | New |

**Ticket detail**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Timeline | List | — | Full shipment timeline for the leg | — |
| Response | Text area | Yes | | Rider vehicle broke down; reassigned to Sunil, ETA 17:15 |
| Evidence | File upload | No | Photos, documents | — |
| Root cause | Dropdown | Yes (to resolve) | Staff shortage \| Vehicle issue \| Address issue \| Customer not ready \| Weather / traffic \| Other | Vehicle issue |

**Actions**

| **Action** | **What happens** |
|---|---|
| Acknowledge | Stops the acknowledgement timer |
| Resolve | Sends the resolution to Logisco |
| Request more time | With reason |

**Business rules**

- Acknowledgement and resolution within SLA feed the Responsiveness KPI (10% weight).

**Prototype notes**

- The demo toolbar can raise an escalation on any SwiftCity job.

### PP-21 Delivery exceptions (NDR and RTO)

| | |
|---|---|
| **Purpose** | For last-mile partners: failed attempts, the action chosen by the shipper or consignee, reattempt scheduling and returns. |
| **Used by** | Partner Admin, Operations Manager (Types A, B, C) |
| **Opened from** | Menu → Exceptions |
| **Basis** | Source §5.1 (NDR); §7 Step 10 |

**Table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR / job | Link | — | | JOB-000776-L5 |
| Attempt and reason | Text | — | Reason code and photo submitted by the rider | 1 · Premises closed |
| Customer instruction | Chip | — | Awaiting \| Reattempt \| New slot / address \| RTO | New slot 27-Nov 11:00–13:00 |
| Reattempt assigned to | Dropdown | Cond. | | Manju R. |
| RTO jobs | Tab | — | Returns to the origin hub | 0 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Assign reattempt | Job back to the rider with the new slot |
| Dispute NDR | If the partner disagrees with a customer complaint about a fake attempt |

**Business rules**

- The action follows the customer’s choice (source §5.1). Attempts without location photo and geo-tag count against Scan & e-POD Compliance.

### PP-22 Claims and deductions

| | |
|---|---|
| **Purpose** | Claims for damage, loss or shortage that the liability engine has attributed to the partner’s leg, with chain-of-custody evidence, and the resulting deductions. |
| **Used by** | Partner Admin, Finance (Operations view) |
| **Opened from** | Menu → Claims; notification |
| **Basis** | Source §10 Step 4; §5.1 (deductions with evidence); §9 |

**Table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Claim ID | Link | — | | CLM-2026-0142 |
| LR / your leg | Text | — | | LGS-DEL-000769 · Leg 2 (origin hub) |
| Type | Chip | — | Damage \| Loss \| Shortage \| Pilferage | Shortage |
| Amount attributed | Currency | — | Capped by the agreement’s liability cap | ₹10,000 |
| Status | Chip | — | Notified \| Under review \| Accepted \| Contested \| Decided \| Deducted \| Recovered from insurer | Deducted |

**Claim detail**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Evidence | Timeline | — | Hand-over scans, photos, seal numbers before and after your leg | Seal intact at arrival; 6 in, 5 out at origin hub |
| Your response | Radio + text | Yes | Accept liability \| Contest (reason + evidence) \| Claim on my insurance | Contest |
| Evidence upload | Files | Cond. | CCTV clip, photos, manifest | cctv_2311.mp4 |
| Decision | Text | — | Final amount and reason | Liability confirmed: ₹10,000 |
| Deduction | Text | — | Payout cycle in which it will be deducted | Payout 27-Nov |

**Actions**

| **Action** | **What happens** |
|---|---|
| Accept | Deduction scheduled |
| Contest | Goes to the Logisco claims desk |
| Claim on insurance | Insurer details captured; deduction held (assumed) |

**Business rules**

- Logisco settles the customer within 7 days, then recovers from the partner’s payout or the insurer (source §10).

- Every deduction is shown with its evidence (source §5.1, §9). The outcome feeds the damage, on-time and responsiveness KPIs (source §10 Step 5).

**Prototype notes**

- NCR CrossDock has the settled shortage claim from the Customer Portal demo.

## 6.6 Performance

### PP-23 Performance scorecard

| | |
|---|---|
| **Purpose** | The partner’s weekly score on six KPIs, visible to the partner, with drill-down to the jobs behind each number. |
| **Used by** | All portal users |
| **Opened from** | Menu → Scorecard; dashboard |
| **Basis** | Source §5.2 |

**Scorecard**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Period | Dropdown | — | This week \| Last week \| Last 4 weeks \| Custom | Last week |
| Score profile | Read-only | — | Parcel, or PTL & line-haul (weights differ) | Parcel |
| Pickup adherence | KPI tile | — | 15% / 15% — picked up within the promised window | 96% → 14.4 |
| On-time delivery / arrival | KPI tile | — | 25% / 30% — delivered or arrived at hub by promised time | 91% → 22.8 |
| First-attempt / appointment success | KPI tile | — | 15% / 10% | 88% → 13.2 |
| Damage, loss & shortage | KPI tile | — | 20% / 25% — claims per 10,000 pieces on your leg | 4 per 10k → 17.0 |
| Scan & e-POD compliance | KPI tile | — | 15% / 10% — every hand-over scanned with photo and seal; e-POD complete | 95% → 14.3 |
| Responsiveness | KPI tile | — | 10% / 10% — tickets acknowledged and resolved in SLA | 45% → 4.5 |
| Total score | Gauge | — | Sum of weighted KPIs (0–100) | 86.2 |

**Drill-down**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Per KPI | Table | — | Jobs counted, jobs failed, list of failed jobs with reason | Pickup: 12 late of 300 |
| Trend | Line chart | — | Weekly score, last 12 weeks | — |
| Tips | List | — | AI suggestions to improve the weakest KPI (assumed) | Acknowledge tickets within 2 hours |

**Actions**

| **Action** | **What happens** |
|---|---|
| Download scorecard | PDF / Excel |
| Query a KPI | Raises a support ticket on a specific job’s scoring |

**Business rules**

- Weights from source §5.2. KPI-to-points conversion is assumed in Section 7.2.

**Prototype notes**

- SwiftCity’s numbers are seeded to total 86 (Gold).

### PP-24 Tier and benefits

| | |
|---|---|
| **Purpose** | Shows the partner’s tier, what it earns them, what happens if the score falls, and progress to the next tier. |
| **Used by** | All portal users |
| **Opened from** | Menu → Scorecard → Tier; dashboard |
| **Basis** | Source §5.3 |

**Displayed**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Current tier | Badge | — | Platinum (≥ 90) \| Gold (80–89) \| Silver (70–79) \| Bronze (60–69; all new partners) \| Probation (\< 60) | Gold |
| Benefits | List | — | From source §5.3, e.g. Gold: priority assignment, weekly payout, early-pay option | Priority assignment · weekly payout · early pay |
| If score falls | Text | — | Consequence for this tier, e.g. Gold: improvement plan | Improvement plan |
| Progress to next tier | Bar | — | Points needed and weeks required | 4 points to Platinum |
| Tier history | Table | — | Week, score, tier, change | — |
| Improvement plan | Card | Cond. | Shown when on a plan: target KPIs, deadline, coordinator | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Acknowledge improvement plan | Records acknowledgement |

**Business rules**

- Platinum drops one tier after 2 weeks below band. Bronze below band: volume cut by 50%. Probation: essential allocations only; suspension review after 2 weeks; offboarding if no recovery (source §5.3).

## 6.7 Finance

### PP-25 Finance panel (daily reconciliation)

| | |
|---|---|
| **Purpose** | Daily view of legs completed, money earned, COD collected, deductions with evidence and payout status. |
| **Used by** | Partner Admin, Finance |
| **Opened from** | Menu → Finance |
| **Basis** | Source §5.1 (Daily Reconciliation) |

**Daily table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Date | Date | — | | 23-Nov-2026 |
| Legs completed | Count | — | Verified with e-POD / hand-over scan | 312 |
| Earnings | Currency | — | Rate card × verified weight per leg | ₹38,420 |
| Deductions | Currency + link | — | Penalties, claims; each opens its evidence | − ₹300 |
| COD collected / deposited | Currency | — | | ₹21,600 / ₹0 |
| Net for the day | Currency | — | | ₹38,120 |
| Payout status | Chip | — | Pending match \| Matched \| In payout batch \| Paid | Matched |

**Actions**

| **Action** | **What happens** |
|---|---|
| Open day | Line-level list of legs |
| Raise query | On any line |
| Export | Excel |

### PP-26 Invoices and 3-way match

| | |
|---|---|
| **Purpose** | Partner invoices per payout cycle, either self-billed by Logisco from completed legs or uploaded by the partner, matched line by line against rate card, verified weight and e-POD. |
| **Used by** | Partner Admin, Finance |
| **Opened from** | Menu → Finance → Invoices |
| **Basis** | Source §9 (Partner Invoicing; 3-Way Match) |

**Invoices table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Invoice no. | Link | — | Self-billed numbering or partner’s own | SB/SWC/25-26/047 |
| Cycle | Date range | — | | 16–22 Nov 2026 |
| Legs | Count | — | | 1,982 |
| Taxable / GST / total | Currency | — | | ₹1,56,240 / ₹28,123 / ₹1,84,363 |
| Match status | Chip | — | Matched \| Partly matched \| Mismatch under dispute | Partly matched |
| Mode | Chip | — | Self-billed \| Uploaded | Self-billed |

**Upload invoice (if not self-billing)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Invoice PDF | File | Yes | | INV-DR-0099.pdf |
| Invoice no. / date / amount | Text / date / currency | Yes | | DR/0099 · 22-Nov · ₹1,530 |
| Line file | Excel | Yes | Job ID, weight billed, rate, amount | lines.xlsx |

**3-way match lines**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Job ID | Link | — | | JOB-000781-L3 |
| Rate card | Currency | — | Agreed rate | ₹9.00 / kg |
| Verified weight | kg | — | From pickup verification | 162 kg |
| e-POD / hand-over | Icon | — | Present Y/N | ✓ |
| Billed vs matched amount | Currency | — | | ₹1,530 vs ₹1,458 |
| Result | Chip | — | Match \| Mismatch (reason) | Mismatch: weight 170 vs 162 kg |

**Actions**

| **Action** | **What happens** |
|---|---|
| Accept matched amount | Line closed at the matched value |
| Dispute line | Reason + evidence → Logisco dispute desk (48-hour SLA) |
| Download self-billed invoice | PDF |

**Business rules**

- Self-billing is subject to the agreement and GST rules (source §9).

**Prototype notes**

- Deccan Roadlines has the ₹72 mismatch on JOB-000781-L3 (170 kg billed vs 162 kg verified at ₹9 / kg).

### PP-27 Payouts

| | |
|---|---|
| **Purpose** | Payout schedule by tier, payout history and early-pay requests. |
| **Used by** | Partner Admin, Finance |
| **Opened from** | Menu → Finance → Payouts; dashboard |
| **Basis** | Source §9 (Platform Pays Partner); §5.3 (payout speed by tier) |

**Next payout**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Date | Date | — | Platinum within 3 days; Gold and Silver weekly; Bronze fortnightly (source §5.3) | 27-Nov-2026 |
| Amount | Currency | — | Matched earnings − deductions − COD not deposited (assumed) | ₹1,84,063 |
| Breakdown | Table | — | Earnings, deductions, adjustments, TDS (assumed), net | — |

**Payout history**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Payout ID, period, gross, deductions, net, mode, UTR, date, status | Table | — | Mode: NEFT \| IMPS | PO-2026-0412 · ₹1,71,880 · IMPS · Paid |

**Early pay (Gold and Silver)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Amount available | Currency | — | Matched, unpaid earnings | ₹62,400 |
| Fee | Read-only | — | Small fee (value assumed 1%) | ₹624 |
| Request amount | Currency | Yes | Up to the available amount | ₹50,000 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Request early pay | OTP confirm → paid by IMPS within 1 day (assumed) |
| Download payout advice | PDF per payout |

**Business rules**

- Higher tiers are paid faster (source §9).

**Prototype notes**

- Payment is simulated; a UTR is generated.

### PP-28 COD deposits

| | |
|---|---|
| **Purpose** | Cash collected by riders on delivery and its deposit to Logisco within 24 hours. |
| **Used by** | Partner Admin, Finance (Types A, B, C) |
| **Opened from** | Menu → Finance → COD; dashboard |
| **Basis** | Source §9 (COD Handling) |

**Summary**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Collected, not deposited | Currency | — | With the oldest collection time | ₹21,600 (oldest 09:40) |
| Due by | Time | — | 24 hours from collection | Tomorrow 09:40 |

**Collections table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR, rider, amount, collected at, deposit status | Table | — | Pending \| Deposited \| Short | LGS-DEL-000702 · Manju · ₹4,200 · Pending |

**Record deposit**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Deposit method | Radio | Yes | Bank transfer (UTR) \| Cash deposit at bank (slip) \| UPI to Logisco collection account | Bank transfer |
| Amount | Currency | Yes | | ₹21,600 |
| Reference / slip | Text + file | Yes | | UTR AXISN2026112309911 |
| Shipments covered | Multi-select | Yes | | 6 LRs |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit deposit | Status Deposited after Logisco reconciliation |

**Business rules**

- Shortages are deducted from the partner payout with evidence (source §9). Late deposits are flagged to Logisco (assumed).

## 6.8 Staff, fleet and settings

### PP-29 Field staff

| | |
|---|---|
| **Purpose** | Add and manage riders, drivers and hub staff who use the Partner App, with photo, ID, licence, police verification and training status. |
| **Used by** | Partner Admin, Operations Manager |
| **Opened from** | Menu → Staff; PP-09 |
| **Basis** | Source §4 Step 6 (add riders, drivers, hub staff with photo and ID); §4.1 |

**Staff list**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Name, photo, role, mobile, vehicle, status, app activated, training, documents | Table | — | Role: Rider \| Driver \| Hub staff. Status: Active \| Inactive \| Blocked | Ravi Kumar · Rider · Active · Trained |

**Add / edit staff**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Full name | Text | Yes | | Ravi Kumar |
| Role | Dropdown | Yes | Rider \| Driver \| Hub staff | Rider |
| Mobile | Phone | Yes | Used for app login by OTP; unique across Logisco | 98730 44556 |
| Photo | Image upload | Yes | Clear face photo | ravi.jpg |
| Photo ID | File | Yes | Masked Aadhaar / voter ID / PAN | id_ravi.jpg |
| Driving licence no. | Text + Verify | Cond. | Rider and Driver; verified via Sarathi | DL-0420190012345 ✓ valid till 2034 |
| Police verification | File + date | Cond. | Required for all types except A (source §4.1) | pv_ravi.pdf |
| Default vehicle | Dropdown | No | | DL01LT4521 |
| Base location / hub | Dropdown | Yes | | Okhla |
| App language | Dropdown | Yes | English \| Hindi | Hindi |

**Actions**

| **Action** | **What happens** |
|---|---|
| Add staff | SMS with app download link |
| Deactivate / block | Removes app access |
| Resend app link | — |

**Business rules**

- Staff cannot be assigned jobs until licence (if needed) and police verification are valid.

**Prototype notes**

- SwiftCity has 14 staff, including rider Ravi Kumar, who does the first-mile pickup for LGS-DEL-000781.

### PP-30 Vehicles

| | |
|---|---|
| **Purpose** | Vehicles with registration, fitness, permit, insurance, FASTag and GPS details, verified through Vahan. |
| **Used by** | Partner Admin, Operations Manager (Types B with own fleet, C, D, E) |
| **Opened from** | Menu → Fleet |
| **Basis** | Source §4 Step 3; §4.1; §13 (ULIP Vahan, FASTag, GPS) |

**Vehicle form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Registration number | Text + Verify | Yes | Verified on Vahan | KA25AB1234 ✓ |
| Vehicle type | Dropdown | Yes | Two-wheeler \| Three-wheeler \| Tempo \| 14–17 ft \| 19–24 ft \| 32 ft | 19–24 ft truck |
| Payload capacity | kg | Yes | | 9,000 kg |
| RC / fitness / permit / insurance | Files + expiry dates | Yes | Auto-filled from Vahan where possible | Insurance till 14-Feb-2027 |
| FASTag ID | Text | Cond. | Line-haul vehicles | 34161FA82033 |
| GPS device ID | Text | No | | 8812 |
| Ownership | Radio | Yes | Own \| Attached | Own |

**Actions**

| **Action** | **What happens** |
|---|---|
| Add / edit / deactivate | — |
| Bulk upload | Excel |

**Business rules**

- Vehicles with an expired document cannot be assigned.

### PP-31 Hubs

| | |
|---|---|
| **Purpose** | Hub profiles for hub operators and PTL consolidators: address, docks, hours, storage and audit status. |
| **Used by** | Partner Admin (Types E with hub, F; B if it runs a hub) |
| **Opened from** | Menu → Hubs |
| **Basis** | Source §3 (Type F); §4 Step 4 (audit) |

**Hub form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hub name / address / pincode / map pin | Text / address / map | Yes | | NCR CrossDock, Sector 37, Gurugram 122001 |
| Area | sq ft | Yes | | 24,000 |
| Docks | Number | Yes | | 8 |
| Operating hours | Time range + days | Yes | | 24 × 7 |
| Storage capacity | Pallets / sq ft | No | | 300 pallets |
| Scale calibration certificate | File + expiry | Yes | | Valid till 30-Jun-2027 |
| CCTV / fire safety | Checkboxes + files | Yes | | ✓ / ✓ |
| Audit status | Chip | — | From PP-07 | Approved |

**Actions**

| **Action** | **What happens** |
|---|---|
| Add hub | Triggers a new audit |

### PP-32 Documents and compliance

| | |
|---|---|
| **Purpose** | All company, vehicle, staff and hub documents with expiry dates, renewal uploads and re-KYC alerts. |
| **Used by** | Partner Admin |
| **Opened from** | Menu → Compliance; alerts |
| **Basis** | Source §4 Step 8 (document-expiry and re-KYC alerts); §5.4 (repeated document expiry is a suspension trigger) |

**Table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Document, belongs to (company / vehicle / staff / hub), number, expiry, status | Table | — | Valid \| Expiring in 30 days \| Expired \| Under review | Fire NOC · Hub · expires 30-Nov · Expiring |
| Upload renewal | File + new expiry | — | | fire_noc_2027.pdf |

**Actions**

| **Action** | **What happens** |
|---|---|
| Upload renewal | Status Under review → Valid |

**Business rules**

- Alerts at 30, 15 and 7 days before expiry (assumed). Repeated expiry can trigger suspension (source §5.4).

### PP-33 Company profile, bank and agreement

| | |
|---|---|
| **Purpose** | Company details, payout bank account, signed agreement, current rate card and security deposit. |
| **Used by** | Partner Admin (edit); Finance (view bank, agreement) |
| **Opened from** | Menu → Settings → Company |
| **Basis** | Source §4 Step 5 |

**Sections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Company details | Read-only | — | Type, GSTIN, PAN, address, onboarding date, coordinator | Type B · since 12-Mar-2026 |
| Bank account | Card | — | Change needs OTP and a new penny-drop | Axis ••5678 |
| Agreement | PDF | — | Signed agreement and annexures | — |
| Rate card | Table | — | Read-only; request revision | — |
| Security deposit | Currency | — | | ₹25,000 held |

**Actions**

| **Action** | **What happens** |
|---|---|
| Request rate revision | Ticket to Partner Management |
| Request exit | Starts partner-initiated offboarding (PP-39) |

### PP-34 Portal users and roles

| | |
|---|---|
| **Purpose** | Partner Admin manages office users of the Partner Portal. |
| **Used by** | Partner Admin |
| **Opened from** | Menu → Settings → Users |
| **Basis** | Assumed; source names only the partner admin (§5.1) |

**User form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Name / email / mobile | Text | Yes | | Neha Verma |
| Role | Dropdown | Yes | Partner Admin \| Operations Manager \| Finance | Operations Manager |
| Hub / region access | Multi-select | No | Limit to selected hubs or cities (assumed) | All |
| Status | Chip | — | Active \| Invited \| Disabled | Active |

**Actions**

| **Action** | **What happens** |
|---|---|
| Invite | — |
| Disable | — |

**Business rules**

- At least one active Partner Admin.

**Prototype notes**

- SwiftCity: Vikram (Admin), Neha (Operations), Anil (Finance).

### PP-35 API and integration

| | |
|---|---|
| **Purpose** | For partners with their own systems (Types A and E): API keys, webhooks for job push and status updates, and status mapping. |
| **Used by** | Partner Admin |
| **Opened from** | Menu → Settings → Integration; PP-09 |
| **Basis** | Source §13 (Partner API, webhook); §4 Step 6 |

**Sections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| API keys | Table | — | Sandbox \| Production; generate, revoke, last used | lg_p_live\_••••19ab |
| Job push webhook | URL + events | Yes | Job offered \| Job withdrawn \| Job updated | https://api.deccanroadlines.in/logisco |
| Status update endpoint | Read-only | — | Logisco endpoint the partner calls | POST /v1/legs/{id}/status |
| Status mapping | Table | Yes | Partner code → Logisco status | DEP → In Transit |
| Error log | Table | — | Failed calls with reason | 0 today |

**Actions**

| **Action** | **What happens** |
|---|---|
| Generate key | — |
| Send test event | Mock 200 OK |

### PP-36 Notification preferences and language

| | |
|---|---|
| **Purpose** | Each user chooses alerts, channels and language. |
| **Used by** | All portal users |
| **Opened from** | Profile menu |
| **Basis** | Source §13, §14 |

**Matrix**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Events × channels | Checkbox grid | — | See Section 9; channels WhatsApp \| SMS \| Email \| In-app | — |
| Language | Dropdown | Yes | English \| Hindi | Hindi |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | — |

### PP-37 AI assistant

| | |
|---|---|
| **Purpose** | Answers “how do I…” questions and helps with jobs, payouts and score, in English or Hindi, by text or voice. |
| **Used by** | All portal users |
| **Opened from** | Floating button |
| **Basis** | Source §4 Step 6; §12 (AI assistant, segment A) |

**Panel**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Message / voice | Text + mic | — | | Mera payout kab aayega? |
| Suggestion chips | Buttons | — | Why did my score drop? \| When is my next payout? \| How do I add a rider? \| Show at-risk jobs | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Ask | Answer with a card and a link to the screen |

**Business rules**

- The AI never pays money or closes a claim on its own (source §12 guardrails).

**Prototype notes**

- Scripted intents in English and Hindi.

### PP-38 Notification centre and support

| | |
|---|---|
| **Purpose** | In-app alerts list and support tickets to Logisco Partner Management. |
| **Used by** | All portal users |
| **Opened from** | Bell icon; Menu → Help |
| **Basis** | Assumed (standard) |

**Sections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Notifications | List | — | Unread / all; tap opens the related screen | New job offered: JOB-000781-L1 |
| Raise ticket | Form | — | Category (Jobs \| Payout \| Score \| Documents \| App \| Other), subject, description, attachment | Payout |
| My tickets | Table | — | ID, category, status, last update | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit ticket | — |
| Mark all read | — |

### PP-39 Suspension and offboarding status

| | |
|---|---|
| **Purpose** | Shows a suspension or offboarding case: the trigger, each step with its reason, in-flight transfers, settlement and final payout. Also used when the partner asks to exit. |
| **Used by** | Partner Admin, Finance |
| **Opened from** | Shown automatically when suspended; PP-33 → Request exit |
| **Basis** | Source §5.4 |

**Case view**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Trigger | Text | — | Score below 60 for 2 weeks \| Fraud / theft / tampering \| Repeated document expiry \| Partner request | Score below 60 for 2 weeks |
| Step 1: Freeze | Status | — | New allocations frozen; date | Done 10-Nov |
| Step 2: In-flight shipments | Table | — | Each shipment: finish yourself \| transferred to backup partner | 3 finished, 2 transferred |
| Step 3: Settlement | Table | — | Claims and deductions with evidence; final payout amount | ₹42,300 final payout |
| Access | Status | — | App and API access revoked on date | Pending |
| Log | List | — | Every step with reason, visible to the partner | — |
| Exit request (partner-initiated) | Form | Cond. | Reason, last working date | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Respond / appeal | Adds a response to the case log (assumed) |
| Download settlement statement | PDF |

**Business rules**

- Records are archived per retention policy after closure (source §5.4).

**Prototype notes**

- A separate demo partner, “FastTrack Logistics” (Type B), is on Probation with a suspension review open.

# 7. Business Rules and Calculations

## 7.1 Onboarding targets

| **Step** | **Target** | **Source** |
|---|---|---|
| Application acknowledgement | Instant (WhatsApp and email) | §4 Step 1 |
| AI network-gap fit score | Same day | §4 Step 2 |
| Digital KYC | Within 48 hours | §4 Step 3 |
| Hub site audit | Within 5 days | §4 Step 4 |
| Rate card, SLA and agreement | 1–3 days | §4 Step 5 |
| Technical integration and app onboarding | 1–2 days | §4 Step 6 |
| Monitored trial | 1–2 weeks; pass mark 80 | §4 Step 7 |
| Overall | Application to go-live in about 5 business days, plus trial | §4 |

## 7.2 Parameters used in this specification

The source names these rules but not their values. Placeholders below must be confirmed (Section 12).

| **Parameter** | **Value used** | **Basis** |
|---|---|---|
| Job acceptance timer | 30 minutes, then the job is offered to the next partner | Assumed |
| Escalation acknowledgement / resolution | 2 hours / 24 hours | Assumed |
| Damage KPI conversion | KPI % = 100 − 3.75 × claims per 10,000 pieces (minimum 0) | Assumed |
| Other KPI conversion | KPI % × weight = points | Assumed |
| Bronze volume cap | Not more than 50% of declared capacity | Source says “capped volume” (§5.3); value assumed |
| Early-pay fee | 1% of the amount | Source says “small fee” (§9); value assumed |
| COD deposit deadline | 24 hours from collection | Source §9 |
| Invoice mismatch dispute SLA | 48 hours | Source §9 |
| Document expiry alerts | 30, 15 and 7 days before expiry | Assumed |
| Hub storage charge | Per shipment per day after 24 hours (rate in the agreement) | Source names storage per day (§3); terms assumed |
| Re-apply after rejection | 90 days | Assumed |

## 7.3 Weekly score calculation

Weights come from source §5.2. A partner is scored on the Parcel profile or the PTL & line-haul profile, depending on its main work (assumed).

| **KPI** | **Weight (Parcel / PTL)** | **SwiftCity result** | **Points (Parcel)** |
|---|---|---|---|
| **Pickup adherence** | 15% / 15% | 96% picked up in window | 14.4 |
| **On-time delivery / arrival** | 25% / 30% | 91% on time | 22.8 |
| **First-attempt / appointment success** | 15% / 10% | 88% first attempt | 13.2 |
| **Damage, loss & shortage** | 20% / 25% | 4 claims per 10,000 pieces → 85% | 17.0 |
| **Scan & e-POD compliance** | 15% / 10% | 95% fully scanned | 14.3 |
| **Responsiveness** | 10% / 10% | 45% of tickets within SLA | 4.5 |
| **Total** | 100% | | 86.2 → Gold |

## 7.4 Tiers and consequences

| **Tier (score)** | **Partner gets** | **If score falls** |
|---|---|---|
| **Platinum (≥ 90)** | First choice in assignment · payout in 3 days · volume commitments · co-branding | Down one tier after 2 weeks below band |
| **Gold (80–89)** | Priority assignment · weekly payout · early-pay option | Improvement plan |
| **Silver (70–79)** | Normal assignment · weekly payout · early-pay option | Warning and coaching |
| **Bronze (60–69; all new partners)** | Capped volume · fortnightly payout | Volume cut by 50% |
| **Probation (\< 60)** | Essential allocations only | Suspension review after 2 weeks; offboarding if no recovery |

Source §5.3. Tiers are reviewed weekly with the scorecard (source §4 Step 8).

## 7.5 How jobs reach a partner

Partners should understand why they get jobs. Logisco’s assignment engine (source §8) works per leg:

1.  Eligibility: the partner is registered for that leg’s pincodes or lane (PP-19), offers the selected service tier, and is within its declared daily capacity (PP-18).

2.  Ranking: eligible partners are sorted by score (highest first), then cost (lowest first), then transit time (fastest first).

3.  The highest-ranked partner is auto-assigned. Logisco’s Control Tower can override any leg.

Example (LGS-DEL-000781, first mile, pincode 110020): MetroDash (Platinum, 92) is at capacity and skipped; SwiftCity (Gold, 86) is assigned ahead of QuickLink (Silver, 74) even though QuickLink is cheaper, because score is sorted first.

## 7.6 Earnings, 3-way match and payout

**Worked example: partner earnings on LGS-DEL-000781 (Express PTL, 162 kg verified)**

| **Leg** | **Partner (type)** | **Rate** | **Earning** |
|---|---|---|---|
| **1 First mile** | SwiftCity Couriers (B) | ₹250 per PTL pickup up to 200 kg | ₹250 |
| **2 Origin hub** | NCR CrossDock (F) | ₹1.00 per kg handled, minimum ₹150 | ₹162 |
| **3 Line-haul** | Deccan Roadlines (E) | ₹9.00 per kg, minimum 50 kg | ₹1,458 |
| **4 Destination hub** | Hubli Warehousing (F) | ₹1.00 per kg handled, minimum ₹150 | ₹162 |
| **5 Last mile** | NK Express (B) | ₹300 per PTL delivery with appointment | ₹300 |
| **Total paid to partners** | | | ₹2,332 |

- 3-way match (source §9): each leg’s billed amount is checked against rate card × verified weight × e-POD / hand-over scan. Deccan Roadlines billed 170 kg × ₹9 = ₹1,530; verified weight is 162 kg, so the matched amount is ₹1,458 and the ₹72 difference goes to the dispute desk (48-hour SLA).

- Payout: matched earnings minus deductions (penalties, claims with evidence, COD shortages), paid by NEFT / IMPS. Platinum within 3 days; Gold and Silver weekly; Bronze fortnightly (source §5.3, §9).

- Early pay: Gold and Silver can draw matched, unpaid earnings early for a small fee (source §5.3, §9).

- COD: riders’ COD must be deposited within 24 hours; shortages are deducted with evidence (source §9).

- Claims: Logisco settles the customer within 7 days, then recovers from the liable partner’s payout or insurer, capped by the agreement’s liability cap (source §10).

## 7.7 Suspension and offboarding

1.  Trigger: score below 60 for 2 weeks, fraud / theft / tampering, repeated document expiry, or partner request.

2.  Freeze new allocations; finish or transfer in-flight shipments to backup partners.

3.  Settle claims and deductions with evidence → final payout → revoke app and API access → archive records. Every step is logged with reasons and visible to the partner.

Source §5.4.

# 8. Job (Leg) Status Model

Partners see the status of their own leg. Shipment-level statuses (what the customer sees) are in the Customer Portal specification, Section 8. The leg statuses below are proposed.

| **Leg status** | **Meaning** | **Set by** | **Shipment status it drives** |
|---|---|---|---|
| **Offered** | Logisco has assigned the leg to this partner; waiting for acceptance | ERP assignment engine | Booked |
| **Accepted** | Partner accepted; not yet given to a person | Partner Portal | — |
| **Flagged** | Partner flagged it not serviceable; returned to Logisco | Partner Portal | — |
| **Withdrawn** | Acceptance timer ran out or Logisco reassigned it | ERP | — |
| **Assigned** | Given to a rider, driver or hub staff | Partner Portal | — |
| **In progress** | Work started: rider at pickup, trip started, or in-scanned at hub | Partner App | Picked Up / In Transit / At Hub |
| **Handed over** | Next partner confirmed the hand-over scan with photo and seal | Partner App (both sides) | At Origin Hub / In Transit / At Destination Hub |
| **Delivered** | Last-mile leg completed with OTP / e-POD | Partner App | Delivered |
| **Failed attempt** | Delivery attempt failed with reason code (NDR) | Partner App | Undelivered (NDR) |
| **Exception** | Delay, seal mismatch, short / damaged, breakdown | Partner App / ERP | Delivered with Exception or ETA revised |
| **Closed** | Leg matched and ready for payout | ERP Finance | — |

# 9. Notifications

Channels: WhatsApp, SMS, email and in-app, in English and Hindi (source §13, §14).

| **Event** | **Sent to** | **Default channels** | **Content** |
|---|---|---|---|
| Application received | Applicant | WhatsApp, email | Application reference number |
| Network fit result | Applicant | WhatsApp, email | Invited (coordinator, onboarding pack) or waitlisted |
| Document flagged / verified | Partner Admin | In-app, email | Document and reason |
| Agreement ready to sign | Partner Admin | Email, WhatsApp | Link to PP-08 |
| Trial result / go-live | Partner Admin | WhatsApp, email | Score; go-live at Bronze or extension |
| New job offered | Admin, Operations | In-app, WhatsApp | Job type, window, accept-by time |
| Acceptance timer ending | Admin, Operations | In-app | Jobs about to be withdrawn |
| SLA at risk | Operations | In-app, WhatsApp | Job, staff, minutes left |
| Escalation raised | Admin, Operations | In-app, WhatsApp | Ticket, acknowledge-by time |
| Claim attributed / deduction | Admin, Finance | In-app, email | Claim, amount, evidence link |
| Invoice mismatch | Finance | In-app, email | Lines in dispute |
| Payout processed | Admin, Finance | WhatsApp, email | Amount, UTR, advice link |
| COD deposit due | Finance, Operations | In-app, WhatsApp | Amount and deadline |
| Weekly scorecard / tier change | All portal users | In-app, email | Score, tier, change |
| Document expiring | Partner Admin | In-app, email | Document, expiry date |
| Suspension notice | Admin, Finance | Email, WhatsApp, in-app | Trigger and next steps |

# 10. Common Validations and Formats

| **Field** | **Rule** | **Example** |
|---|---|---|
| **GSTIN** | 15 characters; pattern ^\[0-9\]{2}\[A-Z\]{5}\[0-9\]{4}\[A-Z\]\[1-9A-Z\]Z\[0-9A-Z\]\$ | 07AAKCS4321M1Z8 |
| **PAN** | ^\[A-Z\]{5}\[0-9\]{4}\[A-Z\]\$ | AAKCS4321M |
| **IFSC** | ^\[A-Z\]{4}0\[A-Z0-9\]{6}\$ | UTIB0000123 |
| **Pincode** | 6 digits, first digit not 0 | 110020 |
| **Mobile** | 10 digits starting 6–9 | 98111 22334 |
| **Vehicle registration** | ^\[A-Z\]{2}\[0-9\]{1,2}\[A-Z\]{0,3}\[0-9\]{4}\$ (BH-series also allowed) | KA25AB1234 |
| **Driving licence** | State code + RTO code + year + serial (15–16 characters) | DL-0420190012345 |
| **FASTag ID** | Alphanumeric, as issued | 34161FA82033 |
| **Seal number** | Format SL-##### (assumed) | SL-44817 |
| **Udyam number** | UDYAM-XX-00-0000000 | UDYAM-DL-08-0012345 |
| **Capacity** | Whole number greater than 0 | 900 |
| **Rates** | ₹, up to 2 decimals | ₹9.00 / kg |
| **File uploads** | PDF, JPG, PNG up to 5 MB; video up to 50 MB (claim evidence) | fire_noc.pdf |

# 11. Prototype Implementation Notes

## 11.1 Demo partners

| **Partner** | **Type and state** | **What it demonstrates** |
|---|---|---|
| SwiftCity Couriers Pvt Ltd, Delhi NCR | B · Gold 86 · live | Daily first-mile work, assignment, live board, scorecard, payouts, COD. Users: Vikram (Admin), Neha (Operations), Anil (Finance). |
| Deccan Roadlines | E · in monitored trial (2 of 3 trips) | Onboarding tracker, flagged insurance, rate negotiation, trips, 3-way match mismatch, go-live at Bronze. |
| NCR CrossDock, Gurugram | F · Silver 76 · live | Hub operations, manifests, completed hub audit, claim attributed to its leg. |
| FastTrack Logistics | B · Probation 57 | Tier consequences and suspension case (PP-39). |
| New applicant | Created by the reviewer | Registration and network fit (invited or waitlisted). |

## 11.2 Seed data

- About 60 jobs for SwiftCity across all leg statuses for today and the past week, including JOB-000781-L1.

- 14 field staff and 10 vehicles for SwiftCity; 6 trucks and 8 drivers for Deccan Roadlines; one hub for NCR CrossDock.

- 12 weeks of scores for each partner; 4 payouts and 1 self-billed invoice in progress per live partner; 3 escalations; 2 claims; COD collections for 3 days.

## 11.3 What is calculated and what is simulated

| **Item** | **In the prototype** |
|---|---|
| Job lists, counts, capacity use, live board | Calculated live from the shared data store |
| Weekly score and tier | Calculated from seeded KPI percentages using Section 7.3 |
| Earnings, 3-way match, payout totals | Calculated from seeded rate cards and verified weights |
| GST, PAN, Vahan, Sarathi, bank checks, DigiLocker | Spinner, then scripted result (one flagged case per demo) |
| AI network fit, document OCR flags, delay prediction | Pre-set outcomes |
| GPS / FASTag positions | Markers moved along preset routes |
| E-sign, OTP, payouts, UTRs | Mock dialogs; fixed OTP 123456; generated references |

## 11.4 Cross-app moments to show in a demo

| **Do this** | **Then show it in** |
|---|---|
| Book LGS-DEL-000781 in the Customer Portal | Partner Portal: JOB-000781-L1 appears in SwiftCity’s inbox |
| Accept and assign the job to Ravi | Partner App: Ravi’s job list; ERP Control Tower: leg 1 assigned |
| Ravi scans at pickup in the Partner App | Partner Portal live board and Customer Portal tracking: Picked Up |
| Complete Deccan Roadlines’ third trial trip (demo toolbar) | Partner Portal: tracker moves to Live at Bronze; ERP: partner enters the assignment pool |
| ERP Claims attributes a shortage to NCR CrossDock | Partner Portal: claim in PP-22 and deduction in the next payout |

## 11.5 UI conventions

- Desktop-first web layout; tablet-friendly for hub supervisors.

- Countdown timers (acceptance, SLA, escalation) use green / amber / red and update every second.

- Short skeleton loading states, success toasts, confirm dialogs for flagging jobs, contesting claims and requesting early pay.

- English / Hindi toggle; all labels from a translation file.

# 12. Assumptions and Open Questions

| **\#** | **Topic** | **What the source says / gap** | **Assumption in this specification** |
|---|---|---|---|
| 1 | Trial pass mark vs starting tier | Trial pass is a score of 80 or more (§4 Step 7), but new partners start at Bronze, which is the 60–69 band (§5.3) | All new partners start at Bronze for at least 2 weeks whatever the trial score, then move by weekly score |
| 2 | Payout frequency | §9 says weekly payouts; §5.3 gives Platinum 3 days and Bronze fortnightly | Tier-based payout as in §5.3 |
| 3 | Portal roles | Only the partner admin is named (§5.1) | Partner Admin, Operations Manager, Finance |
| 4 | Acceptance timer and missed acceptances | Not defined | 30 minutes; job withdrawn and offered to the next partner; counts against Responsiveness |
| 5 | Penalty matrix | Named in the agreement (§4 Step 5) without values | Sample values only in the prototype |
| 6 | KPI-to-points conversion | Weights given (§5.2), conversion not | As in Section 7.3 |
| 7 | Bronze volume cap | “Capped volume” (§5.3) | 50% of declared capacity |
| 8 | Early-pay fee | “Small fee” (§9) | 1% |
| 9 | What partners see | Not defined | Consignee details only on their own pickup / delivery leg; never the customer’s price; names of the previous / next partner for hand-overs |
| 10 | COD deposit method and late deposit | Deposit within 24 hours (§9) | Bank transfer, cash deposit or UPI; late deposits flagged to Logisco |
| 11 | TDS on payouts | Not mentioned | Shown as a line in the payout breakdown |
| 12 | Self-billing | Subject to agreement and GST rules (§9) | Consent checkbox in the agreement; confirm with tax advisers |
| 13 | Appeal and re-application | Not defined (§5.4) | Partner can respond in the case log; re-apply after 90 days |
| 14 | Type F trial | Trial defined only for parcel jobs and PTL / line-haul trips (§4 Step 7) | 3 hub cycles (inbound to outbound) for hub operators |

# Appendix A. Glossary

| **Term** | **Meaning** |
|---|---|
| **3-way match** | Checking each billed leg against rate card × verified weight × e-POD / hand-over scan |
| **Chain of custody** | The record of who held a shipment at each moment, built from hand-over scans with photo and seal number |
| **Dwell time** | Time a shipment spends inside a hub between in-scan and out-scan |
| **e-POD** | Electronic proof of delivery |
| **FASTag** | Toll tag; its toll reads are used to track line-haul trucks through ULIP |
| **Hand-over** | Transfer of a shipment from one partner to the next, confirmed by both sides |
| **Leg** | One part of a shipment’s journey handled by one partner (first mile, origin hub, line-haul, destination hub, last mile) |
| **Manifest** | List of shipments and bags loaded together, tied to a seal and vehicle |
| **NDR** | Non-delivery report: a failed delivery attempt |
| **PTL** | Part-truckload |
| **RTO** | Return to origin |
| **Sarathi / Vahan** | Government databases for driving licences and vehicle registrations, reached through ULIP |
| **Self-billing** | Logisco generates the partner’s invoice from completed legs |
| **ULIP** | Unified Logistics Interface Platform |
