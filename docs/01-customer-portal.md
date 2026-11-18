# Logisco — Customer Portal Specification (v0.1, 18-Nov-2026)

Source of truth for this app. Screen IDs are used in code and commits. "Source §x" = client workflow document (00-source-workflow.md); "Assumed" = our proposal, listed in Section 12.

# 1. Introduction

## 1.1 Purpose

This document specifies the Customer Portal of the Logisco platform at screen, field and action level. It is the build reference for the clickable prototype: a frontend-only application with static data in which a reviewer can sign up, book, track, handle exceptions and pay as if it were the production portal.

The Customer Portal is one of four applications in the prototype. The others are the Partner Portal, the Partner App and the Logisco ERP with its Control Tower. All four share one data store, so an action in this portal is visible in the others and the other way round.

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
<td><p>All screens used by B2B shippers: login, sign-up and onboarding, dashboard, quote, booking (single and bulk), tracking, exceptions, claims, billing, COD, documents, analytics, settings, AI assistant, support.</p>
<p>The public tracking and appointment page used by consignees (receivers).</p>
<p>Roles, permissions, business rules, statuses and notifications that affect these screens.</p></td>
<td><p>Partner Portal, Partner App and Logisco ERP screens (separate specifications).</p>
<p>Real backend, database and APIs; the prototype uses static data in the browser.</p>
<p>Real integrations (GST, bank, payment gateway, e-way bill, WhatsApp); these are simulated.</p>
<p>B2C or individual customers (excluded by the source, §1 Scope at a Glance).</p></td>
</tr>
</tbody>
</table>

## 1.3 Traceability to the source document

Every screen states its basis. “Source §x” means the requirement comes from that section of the Logisco workflow document. “Assumed” means the source is silent and this document proposes a standard behaviour so the prototype is complete. All assumptions that need client confirmation are listed in Section 12.

## 1.4 How to read the screen specifications

- Each screen has an ID (CP-01 to CP-37), a header table (purpose, users, where it opens from, basis) and one or more field tables.

- Field tables have five columns: Field, Type, Req. (mandatory), Rules / options, and Sample (the value used in the prototype’s demo data).

- Req. values: Yes = mandatory; No = optional; Cond. = mandatory only in the stated condition; — = read-only or display element.

- Actions tables list each button or link and what happens. Business rules and prototype notes follow as bullet lists.

- Amounts are in Indian Rupees with Indian digit grouping (₹1,80,000). Dates use DD-MMM-YYYY. All sample prices are illustrative.

# 2. Customer Portal Overview

## 2.1 What the portal does

The Customer Portal is where B2B shippers (SMEs, manufacturers, distributors, brands, enterprises and marketplace sellers) do business with Logisco. They onboard, get quotes, book Parcel and PTL shipments, track them, handle exceptions, pay, and download documents (source §1).

Behind each shipment, Logisco books up to five partners: first mile, origin hub, line-haul, destination hub and last mile. The customer never deals with them. The customer gets one tracking number and one invoice, however many partners touch the shipment (source §2).

| **Item** | **What the portal supports** | **Source** |
|---|---|---|
| Services | B2B Express Parcel (about 0.5–30 kg; Economy / Standard / Express), Express PTL (about 20 kg to a few tonnes, assured date), Standard PTL (bulk, cost first) | §2.1 |
| Value-added services | Appointment delivery, ODA delivery, multi-piece, reverse pickup, COD, To-Pay, transit insurance, special handling | §2.1 |
| Payment modes | Paid (at booking), To-Pay (consignee pays), TBB / To-Be-Billed (credit), COD (value of goods collected) | §2.1 |
| Booking channels | Portal, Excel bulk upload, API, ERP connectors (Tally / SAP / Zoho), ONDC | §7 Step 2 |
| Languages | English and Hindi on every screen, notification and AI reply | §14 |

## 2.2 Customer types and how the portal changes

The source defines five customer types (§6). They all use the same portal, but the onboarding track, billing and emphasis differ. Rows marked “assumed” are this document’s proposal.

| **Aspect** | **SME shipper** | **Manufacturer / distributor** | **Brand with retail / modern trade** | **Enterprise** | **Marketplace / ONDC seller** |
|---|---|---|---|---|---|
| Onboarding track (source) | Self-serve, same day | Assisted by inside sales | Key account manager (KAM) | KAM + solutions team; RFQ / tender | API / ONDC self-serve |
| Billing (source) | Prepaid wallet; small credit after 3 months of good history | Credit (TBB) with limit | Credit, monthly invoice | Contract with credit terms | Prepaid or credit |
| Rate card (assumed) | Standard, click-wrap | Standard or negotiated | Negotiated | Contract via RFQ | Standard |
| Screens most used (assumed) | Quote, single booking, wallet | Bulk upload, invoices, credit | Appointment deliveries, branded tracking | ERP integration, API, analytics | API keys, webhooks |
| Account manager card (assumed) | No | Inside-sales contact | Yes | Yes | No |
| 2-week pilot hyper-care (assumed) | Optional | Yes | Yes | Yes | Optional |

## 2.3 How the portal connects to the other three apps

| **Customer action in this portal** | **What happens elsewhere** |
|---|---|
| Signs up and completes KYC | Logisco ERP (Sales): a lead with its source and AI lead score appears. ERP (Finance): the credit application is reviewed. |
| Confirms a booking | ERP: the leg planner splits the shipment into legs and assigns a partner to each. Control Tower: the shipment appears with SLA clocks. Partner Portal: the first-mile partner sees a pickup job. |
| (Partner App: rider scans at pickup) | Portal: status changes to Picked Up. If the measured weight differs, a weight revision appears in the Exception Queue. |
| Accepts a weight revision or responds to an NDR | ERP Finance: the charge is updated. Partner App: the last-mile rider gets the reattempt or new slot. |
| Raises a claim | ERP Claims desk: a claim opens with the chain-of-custody evidence; the liability engine finds the responsible leg. |
| Recharges the wallet or pays an invoice | ERP Finance: the ledger and credit availability update. |

# 3. Users and Roles

## 3.1 Roles named in the source document

The source names three Customer Portal roles: dispatch, finance and admin (§7.2, Users & Integrations). It does not define their permissions. The descriptions and the matrix in 3.3 are this document’s proposal.

| **Role** | **Who it is for** | **Main jobs** | **Demo persona** |
|---|---|---|---|
| Admin | Business owner, logistics head; the first user who signs up | Onboarding, contract e-sign, users and roles, integrations, company profile; can also do everything Dispatch and Finance can | Priya Sharma, Logistics Head, Sharma Electricals |
| Dispatch | Warehouse or dispatch staff who send goods | Quote, book, print labels, track, handle NDR and weight revisions, raise claims, manage consignees and SKUs | Ramesh Kumar, Dispatch Supervisor |
| Finance | Accounts team | Invoices, payments, wallet, credit, COD remittance, credit notes, billing queries | Kavita Rao, Accounts Manager |

## 3.2 People who see portal screens without a portal role

| **Person** | **What they see** | **Login** |
|---|---|---|
| Sign-up applicant | Sign-up, qualification and the onboarding screens (CP-04 to CP-10) until the account is live. They become the Admin. | Yes (account in Onboarding state) |
| Consignee (receiver) | Public branded tracking page and appointment booking (CP-18), plus WhatsApp messages. The source says no app is needed (§2). | No |
| Anyone with an LR number | Public tracking page (CP-18) without prices | No |

## 3.3 Permission matrix (proposed)

Full = view and act; View = read-only; — = hidden from menu. The AI assistant can only do what the user’s role allows.

| **Module / capability** | **Admin** | **Dispatch** | **Finance** |
|---|---|---|---|
| Dashboard | All widgets | Operations widgets | Finance widgets |
| Onboarding: KYC, rate card, contract e-sign | Full | View | Credit step only |
| Get quote | Full | Full | View |
| Book shipment (single and bulk), print labels | Full | Full | — |
| Shipments list, search and tracking | Full | Full | View |
| Cancel, reschedule, update consignee | Full | Full | — |
| NDR actions | Full | Full | View |
| Weight revision: accept or dispute | Full | Full | Full |
| Raise claim | Full | Full | View |
| Claim settlement details | Full | View | Full |
| Wallet: balance | Full | View | Full |
| Wallet: recharge, auto-recharge | Full | — | Full |
| Invoices, credit notes, ledger, pay | Full | — | Full |
| Credit application | Full | — | Full |
| COD remittance | Full | View | Full |
| Document centre | All documents | Shipment documents | All documents |
| Analytics | Full | Full | Full |
| Users and roles | Full | — | — |
| Pickup locations | Full | View | View |
| Address book | Full | Full | View |
| SKU master | Full | Full | View |
| Integrations: API keys, webhooks, ERP connectors | Full | — | — |
| Company profile, branding, bank account | Full | View | View |
| Own notification preferences and language | Full | Full | Full |
| AI assistant, notifications, support tickets | Full | Full | Full |

## 3.4 Role rules

- The first user who signs up becomes the Admin. Every account must always have at least one active Admin.

- One user has one role. A user can be limited to selected pickup locations (assumed; useful for multi-warehouse customers).

- Role changes take effect on the user’s next action. Disabled users cannot log in.

- Menu items a role cannot use are hidden, not disabled. Opening a hidden screen by URL shows “You don’t have access to this page.”

# 4. Navigation and Sitemap

## 4.1 Header (all screens after login)

- Logisco logo (goes to Dashboard) and the customer’s company name.

- Universal search box: LR, AWB, invoice no., PO no., consignee.

- “Book shipment” button (Admin and Dispatch).

- Language toggle (English / हिन्दी), notification bell (CP-36), help (CP-37).

- Profile menu: name, role, preferences (CP-34), log out.

- Floating AI assistant button, bottom right (CP-35).

## 4.2 Left menu

| **Menu item** | **Opens** | **Visible to** |
|---|---|---|
| Dashboard | CP-11 | All |
| Get quote | CP-12 | All |
| Book → Single shipment \| Bulk upload | CP-13 \| CP-15 | Admin, Dispatch |
| Shipments (list, map, drafts) | CP-16 → CP-17 | All |
| Exceptions | CP-19 → CP-20 / CP-21 | All (Finance: weight disputes and claims) |
| Claims | CP-22 | All |
| Billing → Wallet \| Invoices \| COD remittance | CP-23 \| CP-24 \| CP-25 | Admin, Finance (Dispatch: wallet balance, COD view) |
| Documents | CP-26 | All |
| Analytics | CP-27 | All |
| Settings → Users \| Pickup locations \| Address book \| SKU master \| Integrations \| Company profile | CP-28 to CP-33 | Per matrix in 3.3 |
| Help | CP-37 | All |

## 4.3 Screens outside the menu

- Before login: CP-01 Login, CP-02 OTP, CP-03 Forgot password, CP-04 Sign up, CP-18 Public tracking.

- During onboarding the menu is replaced by the Onboarding Tracker (CP-10), which links to CP-05 to CP-09.

## 4.4 Main user journeys

| **Journey** | **Screens in order** |
|---|---|
| New customer onboarding | CP-04 Sign up → CP-02 OTP → CP-05 Qualification → CP-06 KYC → CP-07 Credit (credit track) → CP-08 Rate card and contract → CP-09 Integration → CP-10 Pilot → Live → CP-11 Dashboard |
| Quote and book one shipment | CP-11 → CP-12 Quote → CP-13 Book (6 steps) → CP-14 Confirmation → CP-17 Tracking |
| Book many shipments | CP-15 Bulk upload → validation → book valid rows → download labels |
| Track a shipment | Search or CP-16 → CP-17 (timeline, map, documents, POD) |
| Weight revision at pickup | Notification → CP-19 → CP-20 → Accept or Dispute |
| Failed delivery | WhatsApp / notification → CP-21 (or consignee on CP-18) → Reattempt / Change slot / RTO |
| Damage or shortage | CP-17 → CP-22 Raise claim → settlement → Confirm resolution |
| Month-end billing | CP-24 Invoice (e-PODs attached) → Pay now; CP-25 COD remittance |

# 5. Screen Inventory

The Customer Portal has 37 screens, grouped in 7 modules.

| **ID** | **Screen** | **Module** | **Used by** | **Basis** |
|---|---|---|---|---|
| CP-01 | Login | Access and login | All users (Admin, Dispatch, Finance) | Assumed |
| CP-02 | OTP verification | Access and login | All users | Assumed |
| CP-03 | Forgot / reset password | Access and login | All users | Assumed |
| CP-04 | Sign up (lead capture) | Customer onboarding | New business (becomes the account’s first Admin) | Source |
| CP-05 | Business qualification | Customer onboarding | Admin (during onboarding) | Source |
| CP-06 | KYC verification | Customer onboarding | Admin (during onboarding); later read-only in CP-33 | Source |
| CP-07 | Credit application and status | Customer onboarding | Admin, Finance | Source |
| CP-08 | Rate card, SLA and contract | Customer onboarding | Admin (signs); Finance and Dispatch view the rate card later | Source |
| CP-09 | Integration setup | Customer onboarding | Admin | Source |
| CP-10 | Onboarding tracker and pilot (hyper-care) | Customer onboarding | Admin (Dispatch and Finance see it read-only) | Source |
| CP-11 | Dashboard | Dashboard | All (widgets vary by role; see rules) | Source |
| CP-12 | Get quote | Quote, booking and tracking | Admin, Dispatch (Finance view only) | Source |
| CP-13 | Book shipment (single) | Quote, booking and tracking | Admin, Dispatch | Source |
| CP-14 | Booking confirmation | Quote, booking and tracking | Admin, Dispatch | Source |
| CP-15 | Bulk booking (Excel upload) | Quote, booking and tracking | Admin, Dispatch | Source |
| CP-16 | Shipments list and universal search | Quote, booking and tracking | All (Finance view only) | Source |
| CP-17 | Shipment detail and tracking | Quote, booking and tracking | All (actions per role) | Source |
| CP-18 | Public branded tracking page and consignee appointment | Quote, booking and tracking | Public (consignee); no login | Source |
| CP-19 | Exception queue | Exceptions and claims | Admin, Dispatch (Finance sees weight disputes and claims) | Source |
| CP-20 | Weight discrepancy | Exceptions and claims | Admin, Dispatch, Finance | Source |
| CP-21 | NDR action (failed delivery) | Exceptions and claims | Admin, Dispatch | Source |
| CP-22 | Claims (list and raise claim) | Exceptions and claims | Admin, Dispatch (raise); Finance (view settlement) | Source |
| CP-23 | Wallet (prepaid customers) | Billing and finance | Admin, Finance (Dispatch sees the balance only) | Source |
| CP-24 | Invoices, credit notes and ledger | Billing and finance | Admin, Finance | Source |
| CP-25 | COD remittance | Billing and finance | Admin, Finance (Dispatch view only) | Source |
| CP-26 | Document centre | Billing and finance | All (Dispatch: shipment documents; Finance: invoices and credit notes) | Source |
| CP-27 | Analytics | Billing and finance | Admin, Finance, Dispatch | Source |
| CP-28 | Users and roles | Settings and administration | Admin only | Source |
| CP-29 | Pickup locations | Settings and administration | Admin (edit); Dispatch (view) | Source |
| CP-30 | Address book (saved consignees) | Settings and administration | Admin, Dispatch | Source |
| CP-31 | SKU master | Settings and administration | Admin, Dispatch | Source |
| CP-32 | Integrations (API keys, webhooks, ERP connectors) | Settings and administration | Admin only | Source |
| CP-33 | Company profile, branding and rate card | Settings and administration | Admin (edit); Dispatch and Finance (view) | Source |
| CP-34 | Notification preferences and language | Settings and administration | All (own preferences); Admin also sets consignee notifications | Source |
| CP-35 | AI assistant | Settings and administration | All (it can only do what the user’s role allows) | Source |
| CP-36 | Notification centre | Settings and administration | All | Assumed |
| CP-37 | Help and support tickets | Settings and administration | All | Assumed |

# 6. Screen Specifications

## 6.1 Access and login

### CP-01 Login

| | |
|---|---|
| **Purpose** | Entry point for all Customer Portal users. Supports email and password, or mobile number with OTP. |
| **Used by** | All users (Admin, Dispatch, Finance) |
| **Opened from** | Portal URL; launcher card in the prototype |
| **Basis** | Assumed (standard). Language choice from source §14. |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Login method | Tabs | Yes | Email & password \| Mobile OTP | Email & password |
| Work email | Email | Cond. | Required for email login; valid email format | priya@sharmaelectricals.in |
| Password | Password | Cond. | Required for email login; min 8 characters; show/hide toggle | \*\*\*\*\*\*\*\* |
| Mobile number | Phone (+91) | Cond. | Required for OTP login; 10 digits starting 6–9 | 98100 23456 |
| Language | Dropdown | Yes | English \| हिन्दी (Hindi); remembered per user | English |
| Remember me | Checkbox | No | Keeps session on this device | Ticked |

**Actions**

| **Action** | **What happens** |
|---|---|
| Log in | Email login → Dashboard (CP-11), or Onboarding Tracker (CP-10) if the account is not yet live. Mobile login → OTP (CP-02). |
| Forgot password | Opens CP-03 |
| Sign up | Opens CP-04 (new business account) |
| Track a shipment | Opens public tracking page CP-18 without login |

**Business rules**

- Wrong credentials show an inline error; 5 failed attempts lock the account for 15 minutes (assumed).

- A disabled user sees “Your access has been disabled. Contact your company admin.”

**Prototype notes**

- Show persona chips (Admin / Dispatch / Finance for Sharma Electricals; Admin for Kaveri Handicrafts) that pre-fill credentials.

- Any password is accepted for a seeded user.

### CP-02 OTP verification

| | |
|---|---|
| **Purpose** | Verifies the mobile number during OTP login, sign-up and sensitive actions (adding a bank account, e-sign). |
| **Used by** | All users |
| **Opened from** | CP-01 (mobile login), CP-04 (sign-up), CP-06 (bank change) |
| **Basis** | Assumed (standard); SMS gateway from source §13 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| OTP | 6 single-digit boxes | Yes | Numeric; auto-advance; paste supported; expires in 5 minutes | 123456 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Verify | Correct OTP → continues to the next screen; wrong OTP → error, 3 attempts allowed |
| Resend OTP | Enabled after a 30-second countdown; maximum 3 resends |
| Change number | Returns to the previous screen |

**Business rules**

- The number is masked as 98XXX XX456.

**Prototype notes**

- The OTP is always 123456 and is shown as a hint under the boxes.

### CP-03 Forgot / reset password

| | |
|---|---|
| **Purpose** | Lets a user reset their password through an email link or mobile OTP. |
| **Used by** | All users |
| **Opened from** | CP-01 |
| **Basis** | Assumed (standard) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Email or mobile | Text | Yes | Must belong to an existing user | priya@sharmaelectricals.in |
| OTP | 6 digits | Yes | Sent to the registered mobile | 123456 |
| New password | Password | Yes | Min 8 characters, 1 number, 1 letter; strength meter | \*\*\*\*\*\*\*\* |
| Confirm password | Password | Yes | Must match the new password | \*\*\*\*\*\*\*\* |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reset password | Success message → back to CP-01 |

**Business rules**

- For security, the screen does not say whether an email exists; it always shows “If this account exists, we’ve sent an OTP”.

## 6.2 Customer onboarding

### CP-04 Sign up (lead capture)

| | |
|---|---|
| **Purpose** | A new B2B business creates its account. This is Phase 1, Step 1 of customer onboarding (Lead Captured). |
| **Used by** | New business (becomes the account’s first Admin) |
| **Opened from** | CP-01 → Sign up; website; referral link |
| **Basis** | Source §6 Phase 1 Step 1 |

**Business details**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Company legal name | Text | Yes | Max 120 characters | Sharma Electricals Pvt Ltd |
| GSTIN | Text (15) | Yes | Format: 2-digit state code + 10-char PAN + entity + Z + checksum; duplicate check against existing accounts | 07AABCS1234F1Z5 |
| Business type | Dropdown | Yes | SME shipper \| Manufacturer \| Distributor \| Brand with retail / modern trade \| Enterprise \| Marketplace / ONDC B2B seller | Manufacturer |
| Industry | Dropdown | Yes | Electricals & electronics \| Pharma \| FMCG \| Auto parts \| Textiles & apparel \| Industrial goods \| E-commerce \| Other | Electricals & electronics |
| City | Text with suggestions | Yes | | New Delhi |
| State | Dropdown | Yes | All Indian states and UTs; auto-filled from the GSTIN state code | Delhi |

**Contact person (becomes Admin)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Full name | Text | Yes | | Priya Sharma |
| Designation | Text | No | | Logistics Head |
| Work email | Email | Yes | Unique across users | priya@sharmaelectricals.in |
| Mobile number | Phone (+91) | Yes | 10 digits; verified by OTP (CP-02) | 98100 23456 |
| Password | Password | Yes | Min 8 characters | \*\*\*\*\*\*\*\* |

**Source and consent**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| How did you hear about us? | Dropdown | Yes | Website \| Sales visit \| Referral \| ONDC \| Tender \| Partner referral (the lead sources in source §6) | Sales visit |
| Referral code | Text | No | Shown when the source is Referral or Partner referral | — |
| Accept Terms and Privacy Notice | Checkbox | Yes | Links to Terms and the DPDP privacy notice (English / Hindi) | Ticked |
| Consent to fetch GST data | Checkbox | No | Allows GST filing data to be used for credit scoring (source §13: “with consent”) | Ticked |

**Actions**

| **Action** | **What happens** |
|---|---|
| Verify mobile | Sends OTP (CP-02) |
| Create account | Account created in “Onboarding” state; lead created in Logisco CRM with its source; goes to CP-05 |

**Business rules**

- Duplicate GSTIN → “An account already exists for this GSTIN. Ask your company admin to invite you.”

- An AI lead score (industry, lanes, declared volume) is calculated for Logisco Sales. It is not shown to the customer.

**Prototype notes**

- GSTIN 07AABCS1234F1Z5 is “already registered” (Sharma). Any other valid-format GSTIN creates a new demo account.

### CP-05 Business qualification

| | |
|---|---|
| **Purpose** | Captures the shipping profile so Logisco can check whether it can serve the lanes profitably, and decides the onboarding track. |
| **Used by** | Admin (during onboarding) |
| **Opened from** | After CP-04 |
| **Basis** | Source §6 Phase 1 Step 2 |

**Shipping profile**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Expected shipments per month | Number | Yes | Min 1 | 450 |
| Expected monthly freight spend | Dropdown | Yes | Below ₹50k \| ₹50k–2 lakh \| ₹2–10 lakh \| ₹10–50 lakh \| Above ₹50 lakh | ₹2–10 lakh |
| Parcel / PTL mix | Slider (%) | Yes | 0–100% Parcel; the rest is PTL | 30% Parcel / 70% PTL |
| Typical weight per shipment | Dropdown | Yes | Below 5 kg \| 5–30 kg \| 30–100 kg \| 100–500 kg \| Above 500 kg | 100–500 kg |

**Top lanes (repeatable, up to 5)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Origin pincode | Number (6) | Yes | Must be a valid Indian pincode | 110020 |
| Destination city / state | Text / dropdown | Yes | | Hubballi, Karnataka |
| Shipments per month on this lane | Number | Yes | | 60 |

**Needs and preferences**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Special handling | Multi-select | No | Fragile \| Heavy / oversize \| Appointment delivery to DCs / modern trade \| ODA locations \| Reverse pickups | Appointment delivery |
| Payment preference | Multi-select | Yes | Prepaid wallet \| Credit (TBB) \| To-Pay \| COD | Credit (TBB) |
| How will you book? | Multi-select | Yes | Portal \| Excel bulk upload \| API \| ERP (Tally / SAP / Zoho) \| Marketplace / ONDC | Portal, ERP (Tally) |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit | Shows a result card: (1) lane check per lane: Serviceable / Partly serviceable (ODA) / Not serviceable; (2) the onboarding track. |
| Continue to KYC | Opens CP-06 |

**Business rules**

- Track decision (source §6): volume above the threshold → Enterprise / assisted track with an account manager; otherwise → self-serve SME track. The source does not give the threshold; assumed ₹2 lakh monthly freight or 300 shipments.

- Business type also sets the track (source §6 customer-type table): Manufacturer / Distributor → inside sales; Brand → KAM; Enterprise → KAM + solutions team; Marketplace → API / ONDC self-serve. Assumed: an SME above the volume threshold moves to the assisted track.

- Assisted track shows the account manager card: “Your account manager will call within 1 business day. You can start KYC now.”

- An AI lane-cost preview runs in the background; the customer only sees serviceability, not Logisco’s costs.

**Prototype notes**

- Fixed lane results from seed data. For example, Delhi → Hubballi is serviceable and Delhi → Port Blair is not serviceable.

### CP-06 KYC verification

| | |
|---|---|
| **Purpose** | Digital KYC of the business, signatory, bank account and pickup addresses. Target is 1 hour or less for self-serve. |
| **Used by** | Admin (during onboarding); later read-only in CP-33 |
| **Opened from** | CP-05 → Continue; Onboarding Tracker |
| **Basis** | Source §6 Phase 2 Step 3 |

**Section 1: Business identity**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| GSTIN | Text (15) + Verify | Yes | Pre-filled from sign-up. Verify calls the GST API and returns legal name, trade name, registered address, status (Active / Cancelled) and registration date. | 07AABCS1234F1Z5 ✓ Active |
| PAN | Text (10) + Verify | Yes | Format AAAAA9999A; auto-filled from GSTIN characters 3–12; verified by API | AABCS1234F ✓ |
| Constitution of business | Read-only | — | From the GST API: Proprietorship \| Partnership \| LLP \| Private Ltd \| Public Ltd | Private Ltd |
| CIN | Text (21) | Cond. | Required if the constitution is Private / Public Ltd; LLPIN for an LLP | U31200DL2008PTC123456 |
| Udyam (MSME) number | Text | No | Format UDYAM-XX-00-0000000 | — |

**Section 2: Authorised signatory**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Signatory name | Text | Yes | | Rajesh Sharma |
| Designation | Text | Yes | | Director |
| Email | Email | Yes | Receives the contract for e-sign | rajesh@sharmaelectricals.in |
| Mobile | Phone (+91) | Yes | | 98110 45678 |
| Authorisation letter / board resolution | File upload | No | PDF, max 5 MB (assumed requirement for companies) | board_resolution.pdf |

**Section 3: Bank account (refunds, COD remittance, claim settlement)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Account holder name | Text | Yes | Should match the legal name | Sharma Electricals Pvt Ltd |
| Account number | Number (masked) | Yes | 9–18 digits | 50200012345678 |
| Confirm account number | Number | Yes | Must match | 50200012345678 |
| IFSC | Text (11) | Yes | Format AAAA0XXXXXX; bank and branch filled automatically | HDFC0001234 → HDFC Bank, Okhla |
| Account type | Radio | Yes | Current \| Savings | Current |
| Verify (penny-drop) | Button | Yes | ₹1 test credit; shows the name returned by the bank and a name-match % | ✓ Name match 100% |

**Section 4: Pickup addresses (repeatable, at least 1)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Location name | Text | Yes | Short label used in dropdowns | Okhla Factory |
| Address line 1 | Text | Yes | | Plot 42, Okhla Industrial Area Phase II |
| Address line 2 / landmark | Text | No | | Near Crown Plaza |
| Pincode | Number (6) | Yes | City and state filled automatically; shows a serviceability badge | 110020 ✓ Serviceable |
| Map pin | Map | Yes | AI address correction suggests the pin; the user drags to confirm | 28.5355, 77.2700 |
| Pickup contact name | Text | Yes | | Ramesh Kumar |
| Pickup contact mobile | Phone | Yes | | 98730 11223 |
| Pickup window | Time range | Yes | Earliest and latest pickup time | 10:00–17:00 |
| Working days | Multi-select | Yes | Mon–Sun | Mon–Sat |
| Default pickup location | Toggle | — | Exactly one default | On |

**Section 5: Documents**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| GST registration certificate | File upload | Yes | PDF / JPG / PNG, max 5 MB | gst_certificate.pdf |
| PAN card | File upload | Yes | Same formats | pan.jpg |
| Cancelled cheque | File upload | Yes | Same formats | cheque.jpg |
| Incorporation certificate | File upload | Cond. | If a company | coi.pdf |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save draft | Saves progress; the tracker shows KYC as “In progress” |
| Submit KYC | All checks pass → KYC Verified. Any check flagged → “Under review”; Logisco manually reviews it. |

**Business rules**

- Each section shows its own status chip: Not started / Verified / Flagged.

- Submit is disabled until GSTIN, PAN and the bank account are verified and at least one pickup address exists.

**Prototype notes**

- Verify buttons show a spinner (about 1.5 seconds), then a scripted result.

- GSTIN ending in “Z9” and IFSC “FAIL0000000” return a failure so the flagged path can be shown.

### CP-07 Credit application and status

| | |
|---|---|
| **Purpose** | Requests credit (TBB) terms and shows the decision. Only for customers on the credit track. Takes 1–2 days. |
| **Used by** | Admin, Finance |
| **Opened from** | Onboarding Tracker (credit customers); Billing → Apply for credit (SME after 3 months) |
| **Basis** | Source §6 Phase 2 Step 4; customer-type table in §6 |

**Application**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Requested credit limit | Currency (₹) | Yes | Min ₹25,000 | ₹5,00,000 |
| Requested payment terms | Dropdown | Yes | 15 \| 30 \| 45 days | 30 days |
| Years in business | Number | Yes | Pre-filled from GST registration date | 18 |
| Annual turnover | Dropdown | Yes | Below ₹1 Cr \| ₹1–10 Cr \| ₹10–50 Cr \| ₹50–250 Cr \| Above ₹250 Cr | ₹10–50 Cr |
| Financial statements (last 2 years) | File upload | No | PDF, max 10 MB each | fy25_financials.pdf |
| GST filing data consent | Checkbox | Yes | Needed for the AI credit-risk score | Ticked |
| Security deposit / bank guarantee | Radio | Yes | Willing \| Not willing | Willing |
| Trade references | Repeatable (2) | No | Company, contact name, phone | — |

**Decision view (read-only)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Status | Chip | — | Submitted \| Under review \| Approved \| Approved with lower limit \| Declined | Approved |
| Approved limit | Currency | — | | ₹5,00,000 |
| Payment terms | Text | — | | 30 days from invoice |
| Security deposit | Currency | — | | ₹50,000 |
| Remarks | Text | — | From Logisco Finance | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit application | Status becomes Under review; Logisco Finance is notified |
| Accept terms | Credit activated; billing switches to TBB |
| Continue on prepaid | Shown if declined; wallet stays the payment method |

**Business rules**

- The AI credit-risk score (GST filing regularity, business age, payment behaviour) is used by Logisco and not shown to the customer.

- SME shippers start prepaid; a “Small credit limit available” banner appears after 3 months of good payment history (source §6).

**Prototype notes**

- Submission auto-approves after a 5-second “Under review” state. Approved limit ₹5,00,000 on 30-day terms.

### CP-08 Rate card, SLA and contract

| | |
|---|---|
| **Purpose** | Customer reviews the standard or negotiated rate card, SLA and terms, then e-signs the contract. Takes 1–3 days. |
| **Used by** | Admin (signs); Finance and Dispatch view the rate card later |
| **Opened from** | Onboarding Tracker; Settings → Company profile → Rate card |
| **Basis** | Source §6 Phase 3 Step 5; price elements from §2.1 and §8.1 |

**Tab 1: Parcel rate card (read-only table)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Zone | Column | — | A Within city \| B Within state \| C Metro to metro \| D Rest of India \| E Special (North-East, J&K) (zones assumed) | D |
| Service tier | Column | — | Economy \| Standard \| Express | Standard |
| First 0.5 kg | ₹ | — | | ₹55 |
| Each additional 0.5 kg | ₹ | — | | ₹25 |
| Transit days | Range | — | | 4–5 days |

**Tab 2: PTL rate card (read-only table)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Lane | Column | — | Origin zone → destination zone or city | Delhi NCR → Karnataka |
| Service | Column | — | Express PTL \| Standard PTL | Express PTL |
| Rate per kg | ₹ | — | | ₹14.00 |
| Minimum chargeable weight | kg | — | | 50 kg |
| CFT factor | kg per cu ft | — | | 8 |
| Transit days | Number | — | Express PTL has an assured delivery date | 3–4 days |

**Tab 3: Surcharges and SLA**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Fuel surcharge | % of freight | — | Revised monthly | 10% |
| ODA charge | ₹ per kg, minimum ₹ | — | Applied to ODA pincodes | ₹3/kg, min ₹250 |
| Docket / LR charge | ₹ per shipment | — | | ₹100 (PTL), ₹30 (Parcel) |
| Appointment delivery | ₹ per shipment | — | | ₹300 |
| COD fee | % of COD value, minimum ₹ | — | | 1.5%, min ₹50 |
| To-Pay fee | ₹ per shipment | — | | ₹150 |
| Insurance / FOV | % of declared value | — | Owner’s risk if not taken | 0.1% |
| Special handling | ₹ per piece | — | Fragile / heavy / oversize | ₹100 |
| Pickup cut-off | Time | — | Bookings after this are picked up the next working day | 14:00 |
| Liability cap | ₹ per kg / per shipment | — | Without insurance | ₹100/kg, max ₹10,000 |
| Claim window | Days after delivery | — | Assumed | 7 days |
| ODA pincode list | Download | — | Excel | oda_list.xlsx |

**Tab 4: Contract**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Contract preview | PDF viewer | — | Generated from template with the customer’s rates | Logisco_MSA_Sharma.pdf |
| Effective date | Date | — | | 01-Dec-2026 |
| Term | Text | — | | 12 months, auto-renew |
| I have read and agree | Checkbox | Yes | Enables e-sign | Ticked |
| E-sign method | Radio | Yes | Aadhaar OTP e-sign \| DSC token | Aadhaar OTP |

**Actions**

| **Action** | **What happens** |
|---|---|
| Request changes | Comment box (rate line + remark) goes to the account manager; status “Changes requested”. Not shown for self-serve SME, who get the standard rate card. |
| Accept & e-sign | E-sign flow (OTP) → contract signed; rate card goes live in the rate engine |
| Download PDF | Downloads the rate card or contract |

**Business rules**

- Logisco’s AI margin engine checks every rate line before the contract is issued. The customer never sees margins.

- Self-serve SME: click-wrap acceptance of the standard rate card instead of a negotiated contract.

**Prototype notes**

- E-sign is a simulated dialog with OTP 123456; the signed PDF is a static sample.

### CP-09 Integration setup

| | |
|---|---|
| **Purpose** | Chooses and sets up how the customer will send bookings, and uploads the SKU master so weights are frozen. Takes 1–5 days. |
| **Used by** | Admin |
| **Opened from** | Onboarding Tracker |
| **Basis** | Source §6 Phase 4 Step 6 |

**Integration checklist**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Portal booking | Status | — | Always on | Ready |
| Excel bulk upload | Download template | No | Template link; see CP-15 | Template downloaded |
| API | Button | No | Generate sandbox key → CP-32 | Sandbox key created |
| ERP connector | Dropdown + Connect | No | Tally \| SAP \| Zoho | Tally — Connected |
| Marketplace / ONDC link | Button | No | Links the ONDC seller ID | Not used |
| SKU master upload | File upload | Recommended | Excel; see CP-31. AI flags dimension outliers. | sku_master.xlsx (120 SKUs) |

**Actions**

| **Action** | **What happens** |
|---|---|
| Mark integration complete | Tracker moves to Pilot |
| Skip for now | Allowed; portal booking only |

**Business rules**

- Weight freeze: once Logisco verifies an SKU’s dimensions, its weight is locked, which reduces weight disputes.

**Prototype notes**

- Connect buttons show “Connected” after a 2-second spinner.

### CP-10 Onboarding tracker and pilot (hyper-care)

| | |
|---|---|
| **Purpose** | Shows where the account is in onboarding and, during the 2-week pilot, the daily pilot report. |
| **Used by** | Admin (Dispatch and Finance see it read-only) |
| **Opened from** | Home screen until the account is live; afterwards Settings → Company profile |
| **Basis** | Source §6 Phase 4 Steps 7–8 |

**Tracker steps**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| 1\. Account created | Step | — | Done / In progress / Pending / Action needed | Done |
| 2\. Qualification | Step | — | | Done |
| 3\. KYC | Step | — | | Done |
| 4\. Credit (credit customers only) | Step | — | | Done |
| 5\. Contract | Step | — | | Done |
| 6\. Integration | Step | — | | Done |
| 7\. Pilot (2 weeks) | Step + progress | — | Day X of 14 | Day 6 of 14 |
| 8\. Live | Step | — | | Pending |

**Pilot report (daily table)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Date | Date | — | | 24-Nov-2026 |
| Shipments booked | Number | — | | 18 |
| Delivered on time | % | — | | 94% |
| Exceptions | Number + link | — | | 1 (NDR) |
| SLA risk warnings | List | — | Early warnings on shipments at risk | LGS-DEL-000790 |

**Account manager card**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Name, phone, email | Card | — | Shown for assisted, KAM and Enterprise tracks | Arjun Mehta, KAM |

**Actions**

| **Action** | **What happens** |
|---|---|
| Continue (on any pending step) | Opens that step’s screen |
| Book first shipment | Enabled once the contract is signed; opens CP-13 |

**Business rules**

- Hyper-care: every pilot shipment is monitored daily, with a daily report to the account manager and customer.

- After go-live: quarterly business reviews; Logisco runs churn-risk and upsell AI internally.

**Prototype notes**

- A fresh sign-up from CP-04 walks through every tracker step, with approvals happening automatically after a short delay. Sharma Electricals’ tracker shows the completed state.

## 6.3 Dashboard

### CP-11 Dashboard

| | |
|---|---|
| **Purpose** | Home screen after go-live. Shows shipment status, SLA performance, exceptions needing action, spend and COD due. |
| **Used by** | All (widgets vary by role; see rules) |
| **Opened from** | After login; Logisco logo in the header |
| **Basis** | Source §7.2 (Dashboard) |

**Filters**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Date range | Dropdown | — | Today \| Last 7 days \| Last 30 days \| This month \| Custom | Last 7 days |
| Pickup location | Dropdown | — | All \| each saved location | All |

**Widgets**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Shipments by status | Count tiles | — | Booked, Picked Up, In Transit, At Destination Hub, Out for Delivery, Delivered, Exceptions. Each tile opens a filtered CP-16. | In Transit: 14 |
| SLA performance | Gauge + trend | — | On-time delivery % this period vs previous | 93% (↑2%) |
| Exceptions needing action | List (top 5) + count | — | Type, LR, due-by timer, Action button. Opens CP-19. | 3 need action |
| Spend this month | Amount + bar | — | Spend vs credit limit (credit) or wallet balance (prepaid) | ₹1,02,400 this month · credit used ₹3,44,200 of ₹5,00,000 |
| COD due | Amount | — | Collected, not yet remitted; next remittance date | ₹38,400 on 20-Nov |
| Quick actions | Buttons | — | Get quote \| Book shipment \| Bulk upload \| Track | — |
| Search bar | Text | — | Universal search (LR, AWB, invoice no., PO no., consignee) → CP-16 | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Click a tile | Opens CP-16 filtered by that status |
| Act on an exception | Opens the matching exception screen (CP-20, CP-21 or CP-22) |

**Business rules**

- Dispatch sees status, SLA and exception widgets. Finance sees spend, COD, and invoices due or overdue. Admin sees all.

- Banners: wallet below threshold (prepaid); credit utilisation above 80%; overdue invoice; account in pilot.

**Prototype notes**

- Counts are computed live from the seed shipment store, so they change as shipments move in other apps.

## 6.4 Quote, booking and tracking

### CP-12 Get quote

| | |
|---|---|
| **Purpose** | Gives an all-in price and ETA before booking: serviceability, chargeable weight, full price build-up and tier comparison. |
| **Used by** | Admin, Dispatch (Finance view only) |
| **Opened from** | Dashboard quick action; menu → Get quote |
| **Basis** | Source §7 Step 1; §8.1 |

**Inputs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Service type | Segmented | Yes | Parcel \| Express PTL \| Standard PTL | Express PTL |
| Origin | Dropdown / pincode | Yes | Saved pickup location or any 6-digit pincode | Okhla Factory (110020) |
| Destination pincode | Number (6) | Yes | Serviceability and ODA checked on entry | 580030 |
| Package rows (repeatable) | Row group | Yes | Per row: SKU (optional lookup) \| Quantity \| L × B × H (cm) \| Weight per piece (kg) | 6 × 60×40×40 cm, 20 kg |
| Total actual weight | Read-only | — | Sum of rows | 120 kg |
| Declared goods value | Currency (₹) | Yes | Drives insurance and the e-way bill check | ₹1,80,000 |
| Service tier | Radio | Cond. | Parcel only: Economy \| Standard \| Express | — |
| Payment mode | Dropdown | Yes | Paid \| To-Pay \| TBB (credit customers) \| COD | TBB |
| COD amount | Currency | Cond. | If COD; cannot exceed goods value | — |
| Add-ons | Checkboxes | No | Appointment delivery \| Transit insurance (FOV) \| Special handling (fragile / heavy) | Appointment, Insurance |

**Result panel**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Serviceability | Badge | — | Serviceable \| ODA (extra charge) \| Not serviceable | Serviceable |
| Chargeable weight | Breakdown | — | Actual vs volumetric (Parcel) or CFT weight (PTL); the higher is used; PTL minimum applies | Actual 120 kg \| CFT 162 kg → 162 kg |
| Price build-up | Table | — | Base freight, Fuel, ODA, Docket / LR, Appointment, COD fee, To-Pay fee, Insurance / FOV, Special handling, Subtotal, GST, Total | Total ₹3,628.26 |
| ETA promise | Date | — | From lane transit days and the pickup cut-off | Thu, 26-Nov-2026 |
| Tier comparison (Parcel) | 3 cards | — | Economy / Standard / Express with price and ETA each | — |
| E-way bill note | Info | — | Shown when an e-way bill will be required | E-way bill will be auto-generated |

**Actions**

| **Action** | **What happens** |
|---|---|
| Book this | Opens CP-13 pre-filled with the quote |
| Download quote | PDF with the price build-up; quote ID and validity |
| Reset | Clears the form |

**Business rules**

- All-in price shown up front: no charge is added later except a weight revision verified at pickup (source §7).

- Quote validity: 7 days (assumed).

- Not serviceable → the Book button is disabled with the message “We don’t serve this pincode yet.”

**Prototype notes**

- Chargeable weight, price and ETA are calculated for real from seed rate cards (Section 7), so the quote responds to every input.

### CP-13 Book shipment (single)

| | |
|---|---|
| **Purpose** | Books one shipment in a 6-step form, from pickup to confirmation. |
| **Used by** | Admin, Dispatch |
| **Opened from** | Menu → Book; CP-12 → Book this; CP-16 → Book again |
| **Basis** | Source §7 Steps 1–2 |

**Step 1: Pickup**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pickup location | Dropdown | Yes | Saved pickup locations; default pre-selected | Okhla Factory |
| Pickup date | Date | Yes | Today (if before the 14:00 cut-off) or a future working day | Mon, 23-Nov-2026 |
| Pickup slot | Dropdown | Yes | Within the location’s pickup window, in 2-hour slots | 14:00–16:00 |
| Pickup contact | Read-only + edit | Yes | From the location; editable for this booking | Ramesh Kumar, 98730 11223 |
| Instructions for pickup | Text area | No | Max 250 characters | Use Gate 2 |

**Step 2: Consignee (receiver)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Search address book | Typeahead | No | Fills the fields below | Hubli Electric Distributors |
| Consignee type | Dropdown | Yes | Distributor \| Retailer \| Distribution centre (DC) \| Modern trade store \| Factory / plant \| Other business | Distributor |
| Company name | Text | Yes | | Hubli Electric Distributors |
| Contact person | Text | Yes | | Mahesh Patil |
| Mobile | Phone | Yes | Used for OTP at delivery and WhatsApp | 94480 12345 |
| Alternate mobile | Phone | No | | — |
| Email | Email | No | | stores@hublielectric.in |
| Address line 1 | Text | Yes | AI address check suggests corrections | Shop 14, APMC Yard, Amargol |
| Address line 2 / landmark | Text | No | | Near Gate 3 |
| Pincode | Number (6) | Yes | City and state filled automatically; serviceability and ODA badges | 580030 ✓ |
| Consignee GSTIN | Text (15) | No | Used on the e-way bill for B2B | 29AAFFH5678K1Z2 |
| Appointment required | Toggle | — | Automatically on for DC / modern trade | On |
| Save to address book | Checkbox | No | | Ticked |

**Step 3: Shipment details**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Service type | Segmented | Yes | Parcel \| Express PTL \| Standard PTL | Express PTL |
| Service tier | Radio | Cond. | Parcel: Economy \| Standard \| Express | — |
| Package rows | Row group | Yes | SKU lookup or manual: Description \| Qty \| L \| B \| H (cm) \| Weight per piece (kg) | Switchgear panels \| 6 \| 60 \| 40 \| 40 \| 20 |
| Packaging type | Dropdown | Yes | Carton box \| Bag \| Pallet \| Crate \| Drum \| Other | Carton box |
| Fragile | Checkbox | No | Adds the special-handling charge | — |
| Totals | Read-only | — | Pieces, actual weight, volumetric / CFT weight, chargeable weight | 6 pcs \| 120 kg \| 162 kg chargeable |

**Step 4: Invoice and e-way bill**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Invoice number | Text | Yes | | SE/25-26/1187 |
| Invoice date | Date | Yes | Not a future date | 23-Nov-2026 |
| Invoice value | Currency (₹) | Yes | Including GST | ₹1,80,000 |
| Invoice copy | File upload | Yes | PDF / image, max 5 MB; stored with the shipment | INV_1187.pdf |
| PO number | Text | No | Searchable later | HED/PO/3321 |
| Goods description | Text | Yes | | LT switchgear panels |
| HSN code | Text (4–8 digits) | Cond. | Required if an e-way bill is needed | 8537 |
| Customer reference | Text | No | Customer’s own reference, searchable | DISP-2311-07 |
| E-way bill option | Radio | Cond. | Shown when required: Auto-generate (default) \| I already have one | Auto-generate |
| Existing e-way bill number | Number (12) | Cond. | If “I already have one” | — |

**Step 5: Payment and add-ons**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Freight payment mode | Radio | Yes | Paid (wallet / online) \| To-Pay \| TBB (credit customers only) \| COD | TBB |
| COD amount | Currency | Cond. | If COD; ≤ invoice value | — |
| Insurance | Radio | Yes | Owner’s risk \| Logisco transit insurance (FOV %) | Transit insurance |
| Appointment delivery | Checkbox | — | Pre-set from Step 2 | Ticked |
| Special handling | Checkbox | No | | — |
| Available balance / credit | Read-only | — | Wallet balance or available credit | Available credit ₹1,55,800 |

**Step 6: Review and confirm**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Summary | Read-only cards | — | Pickup, consignee, packages, invoice, payment, with Edit links per step | — |
| Price build-up | Table | — | Same as CP-12 | ₹3,628.26 |
| ETA | Date | — | | Thu, 26-Nov-2026 |
| Accept booking terms | Checkbox | Yes | | Ticked |

**Actions**

| **Action** | **What happens** |
|---|---|
| Next / Back | Moves between steps; each step validates before moving on |
| Save as draft | Kept in Shipments → Drafts |
| Confirm booking | Creates the shipment (status Booked), generates LR / AWB and QR label, generates the e-way bill if needed, triggers leg planning → CP-14 |

**Business rules**

- E-way bill is required when the value is ₹50,000 or more for inter-state movement, or above the state threshold for intra-state (configurable).

- Prepaid: blocked if the wallet balance is below the total; the screen offers Recharge (CP-23).

- Credit: blocked if the booking would exceed available credit or an invoice is overdue beyond the grace period (assumed 15 days). The message tells the user to contact Finance.

- Not-serviceable pincodes cannot be booked. ODA pincodes show the ODA charge.

**Prototype notes**

- Confirming adds the shipment to the shared store, so it appears immediately in the ERP Control Tower and the Partner Portal job inbox.

### CP-14 Booking confirmation

| | |
|---|---|
| **Purpose** | Confirms the booking and gives the LR number, labels and e-way bill. |
| **Used by** | Admin, Dispatch |
| **Opened from** | After CP-13 or CP-15 |
| **Basis** | Source §7 Step 2 |

**Displayed**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR / AWB number | Text + copy | — | Format LGS-\<origin city code\>-\<6-digit serial\> | LGS-DEL-000781 |
| QR labels | Preview | — | One per piece (1/6 … 6/6) with LR, piece number, consignee, pincode, QR code | 6 labels |
| E-way bill | Text | — | 12-digit number and validity (1 day per 200 km) | EWB 3410 2256 7781, valid 10 days |
| Pickup | Text | — | | Mon 23-Nov, 14:00–16:00, Okhla Factory |
| ETA | Date | — | | Thu 26-Nov |
| Amount | Currency | — | And payment mode | ₹3,628.26 (TBB) |

**Actions**

| **Action** | **What happens** |
|---|---|
| Print labels | Label size: A4 (4 per page) \| 4×6 inch thermal |
| Download LR | PDF |
| Track shipment | Opens CP-17 |
| Book another / Repeat this booking | Opens CP-13 empty or pre-filled |

**Business rules**

- The invoice copy is stored with the shipment and appears in the Document Centre.

**Prototype notes**

- Labels and LR are generated client-side as a printable HTML/PDF preview.

### CP-15 Bulk booking (Excel upload)

| | |
|---|---|
| **Purpose** | Books many shipments in one go from an Excel file, with row-level validation. |
| **Used by** | Admin, Dispatch |
| **Opened from** | Menu → Book → Bulk upload; Dashboard quick action |
| **Basis** | Source §7.2 (Bulk Booking); §7 Step 2 |

**Upload**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Download template | Link | — | Columns: Customer ref, Consignee name, Contact, Mobile, Address, Pincode, Service type, Tier, Pieces, L, B, H, Weight per piece, SKU code, Invoice no., Invoice date, Invoice value, HSN, EWB no., Payment mode, COD amount, Appointment (Y/N), Insurance (Y/N) | logisco_bulk_template.xlsx |
| Pickup location | Dropdown | Yes | Applies to the whole batch | Okhla Factory |
| Pickup date | Date | Yes | | 24-Nov-2026 |
| Upload file | File (drag and drop) | Yes | .xlsx or .csv, max 5 MB, max 500 rows | dispatch_24nov.xlsx |

**Validation results (table)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Row | Number | — | | 12 |
| Consignee / pincode | Text | — | | Patel Traders / 380015 |
| Status | Chip | — | Valid \| Warning \| Error | Error |
| Message | Text | — | e.g. Pincode not serviceable; E-way bill required; Missing invoice value; Dimension outlier | Invoice value missing |
| Fix | Inline edit | — | Edit the cell in place and re-validate | — |

**Batch summary**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Valid rows / errors / warnings | Counts | — | | 46 / 2 / 3 |
| Total chargeable weight | kg | — | | 3,940 kg |
| Estimated total | Currency | — | | ₹61,250 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Validate | Runs checks and shows the results table |
| Download error file | Excel with an error column |
| Book valid rows | Creates shipments for valid rows; error rows stay in draft |
| Download all labels | Single merged PDF |
| Batch history | List of past uploads: date, file, rows, booked, errors, user |

**Business rules**

- SKU codes in the file use frozen SKU dimensions from the SKU master (CP-31).

**Prototype notes**

- Use a pre-made sample file of 50 rows with 2 errors and 3 warnings; parse it in the browser (SheetJS).

### CP-16 Shipments list and universal search

| | |
|---|---|
| **Purpose** | Finds and manages all shipments. Search by LR, AWB, invoice number, PO number or consignee, with a list and a map view. |
| **Used by** | All (Finance view only) |
| **Opened from** | Menu → Shipments; dashboard tiles; header search |
| **Basis** | Source §7.2 (Universal Search) |

**Search and filters**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Search | Text | — | LR, AWB, invoice no., PO no., customer reference, consignee name or mobile | SE/25-26/1187 |
| Status | Multi-select | — | All statuses in Section 8, plus Draft and Cancelled | In Transit |
| Booked date | Date range | — | | Last 30 days |
| Service type | Multi-select | — | Parcel \| Express PTL \| Standard PTL | All |
| Pickup location | Dropdown | — | | All |
| Destination state | Dropdown | — | | Karnataka |
| Payment mode | Multi-select | — | Paid \| To-Pay \| TBB \| COD | All |
| SLA | Dropdown | — | On track \| At risk \| Breached | At risk |
| Exceptions only | Toggle | — | | Off |

**Table columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR no. | Link | — | Opens CP-17 | LGS-DEL-000781 |
| Booked on | Date | — | | 23-Nov-2026 |
| Consignee and city | Text | — | | Hubli Electric Distributors, Hubballi |
| Pieces / chargeable weight | Text | — | | 6 / 162 kg |
| Service | Text | — | | Express PTL |
| Status | Chip | — | Colour-coded | In Transit |
| ETA / delivered on | Date | — | | 26-Nov |
| SLA | Icon | — | Green / amber / red | Amber |
| Amount | Currency | — | Hidden for Dispatch if configured (assumed) | ₹3,628.26 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Row: Track | Opens CP-17 |
| Row: Print label / Download documents | PDF / ZIP |
| Row: Cancel | Only while status is Booked (before pickup); asks for a reason |
| Row: Book again | Opens CP-13 pre-filled |
| Row: Raise claim | Only after delivery, within the claim window → CP-22 |
| Bulk: Export / Print labels / Download documents | For selected rows |
| Map view | Toggle; pins at each shipment’s last scan location |

**Business rules**

- Pagination 25 / 50 / 100 rows; sort by any column; saved filters (assumed).

**Prototype notes**

- About 40 seed shipments for Sharma Electricals across every status, so every filter returns results.

### CP-17 Shipment detail and tracking

| | |
|---|---|
| **Purpose** | Everything about one shipment: status track, scan timeline, map, pieces, charges, documents and proof of delivery, plus the actions available at its current stage. |
| **Used by** | All (actions per role) |
| **Opened from** | CP-16 row; search; notification link |
| **Basis** | Source §7 Steps 3–11; §7.1; §7.2 (full scan timeline, map view) |

**Header**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR / AWB, status chip, ETA | Text | — | ETA updates when the AI predicts a delay; shows “Revised” if changed | LGS-DEL-000781 · In Transit · ETA 26-Nov |
| Status track | 7-step bar | — | Booked → Picked Up → At Origin Hub → In Transit → At Destination Hub → Out for Delivery → Delivered | Step 4 active |
| Exception banner | Alert | — | Shown if an exception is open, with its action button | — |

**Tab 1: Timeline and map**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Scan timeline | List | — | Date and time, event, location (city or hub city), remarks; newest first | 23-Nov 19:05 · At Origin Hub · Gurugram |
| Map | Map | — | Origin, destination, hubs, and the live truck position during line-haul | Truck near Nagpur |

**Tab 2: Shipment details**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Pickup and consignee | Cards | — | Addresses and contacts (consignee mobile masked) | — |
| Pieces table | Table | — | Piece ID, booked dimensions and weight, verified dimensions and weight (after pickup), photos | 6 rows |
| Invoice and e-way bill | Card | — | Invoice no., value, PO, EWB number, validity, Part B status | EWB valid till 03-Dec |

**Tab 3: Charges**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Booked charges | Table | — | Price build-up at booking | ₹3,628.26 |
| Revisions | Table | — | Weight revision, ODA added, RTO charges; reason and status | None |
| Final amount | Currency | — | | ₹3,628.26 |

**Tab 4: Documents**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Documents | List with download | — | LR, labels, e-way bill, invoice copy, e-POD, GRN, pickup photos, delivery photos | 6 documents |

**Tab 5: Proof of delivery (after delivery)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Received by | Text | — | | Mahesh Patil |
| Verification | Text | — | OTP verified \| e-signature image | OTP verified |
| GRN number | Text | — | | GRN-HED-55120 |
| Delivered at | Date and time + geo-tag | — | | 26-Nov 11:12, 15.36°N 75.12°E |
| Short / damaged pieces | Table | — | Piece, issue type, photo, remark | None |
| COD collected | Currency | — | If COD | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Reschedule delivery / change slot | Before Out for Delivery; opens a date and slot picker |
| Update consignee contact | Before Out for Delivery |
| Cancel shipment | Only while Booked |
| Raise claim | After Delivered / Delivered with Exception → CP-22 |
| Share tracking link | Copies the public link (CP-18) or sends it on WhatsApp |
| Download all documents | One ZIP for the shipment |
| Get help | Opens the AI assistant (CP-35) with this LR in context, or raises a ticket (CP-37) |

**Business rules**

- The customer sees one tracking number and one status list, however many partners handle the shipment. Partner names are not shown; the timeline shows “Logisco network” and the hub city (assumed; see Section 12).

- Every partner status code is mapped to the single status list in Section 8.

**Prototype notes**

- The timeline is read from the shared store, so a scan made in the Partner App appears here within a second (two tabs sync via BroadcastChannel).

- The truck moves along a preset route during line-haul.

### CP-18 Public branded tracking page and consignee appointment

| | |
|---|---|
| **Purpose** | No-login tracking page for the consignee and anyone with the LR, branded with both Logisco and the customer. Also where the consignee books a delivery slot (the same flow is offered on WhatsApp). |
| **Used by** | Public (consignee); no login |
| **Opened from** | Link in WhatsApp / SMS; CP-01 → Track a shipment; customer’s website |
| **Basis** | Source §7.2 (Branded Tracking); §7 Step 8; §2 (consignee needs no app) |

**Tracking view**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Logos | Header | — | Logisco logo + customer logo (from CP-33) | Sharma Electricals |
| Track by | Text | Yes | LR / AWB or customer reference | LGS-DEL-000781 |
| Status track, ETA, last update | Read-only | — | No prices or charges shown | In Transit · ETA 26-Nov |
| Contact | Button | — | Masked call to the delivery agent on the delivery day | — |

**Book delivery appointment (appointment shipments only)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Delivery date | Date picker | Yes | From the ETA date onward; excludes the consignee’s holidays | 26-Nov-2026 |
| Time slot | Dropdown | Yes | e.g. 09:00–11:00 \| 11:00–13:00 \| 14:00–16:00 \| 16:00–18:00 | 11:00–13:00 |
| Gate / dock number | Text | No | | Dock 2 |
| Receiving contact | Text + phone | Yes | | Mahesh Patil, 94480 12345 |
| Gate pass | File upload | Cond. | Required by DCs / modern trade | gatepass_7781.pdf |

**Failed delivery response (if NDR)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Choose action | Buttons | Yes | Reattempt \| Change slot / address \| Return to origin | Change slot |

**Actions**

| **Action** | **What happens** |
|---|---|
| Confirm slot | Slot saved; the last-mile partner gets a reminder; the shipper sees the slot in CP-17 |
| Respond to NDR | Same options as CP-21; the first response (consignee or shipper) is applied |

**Business rules**

- Available in English and Hindi. Consignee phone numbers are masked (DPDP).

**Prototype notes**

- Shown inside a phone frame next to a mock WhatsApp chat with the same buttons.

## 6.5 Exceptions and claims

### CP-19 Exception queue

| | |
|---|---|
| **Purpose** | One place for everything waiting on the customer: shipments on hold, NDR actions, weight disputes and claims. |
| **Used by** | Admin, Dispatch (Finance sees weight disputes and claims) |
| **Opened from** | Menu → Exceptions; dashboard widget; notifications |
| **Basis** | Source §7.2 (Exception Queue); §10 |

**Tabs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Needs my action | Tab | — | All open items with a response timer | 3 |
| NDR | Tab | — | Failed delivery attempts | 1 |
| Weight disputes | Tab | — | Weight revisions pending acceptance or under dispute | 1 |
| On hold | Tab | — | E-way bill expiring, missing invoice, address issue, seal mismatch under investigation | 1 |
| Claims | Tab | — | Open claims (links to CP-22) | 0 |

**Table columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR | Link | — | | LGS-DEL-000776 |
| Exception type | Chip | — | Weight revision \| NDR \| E-way bill expiry \| Missing document \| Delay \| Short / damaged delivery | NDR |
| Raised on | Date and time | — | | 24-Nov 15:40 |
| Details | Text | — | | Premises closed |
| Respond by | Timer | — | Amber when less than 2 hours remain | 5 h 20 m |
| Action | Button | — | Opens the matching screen | Take action |

**Actions**

| **Action** | **What happens** |
|---|---|
| Take action | Opens CP-20 (weight), CP-21 (NDR), CP-22 (claim) or CP-17 (hold) |

**Business rules**

- Exceptions are detected automatically (missed scan, ETA breach, seal mismatch, damage photo, NDR, short delivery) and a ticket is created (source §10).

- A ticket cannot close without customer confirmation (source §10 Step 2).

**Prototype notes**

- The demo toolbar can inject an exception into any shipment so the queue fills live.

### CP-20 Weight discrepancy

| | |
|---|---|
| **Purpose** | Shows booked vs verified weight and dimensions with photo evidence; the customer accepts the revised rate or raises a dispute. |
| **Used by** | Admin, Dispatch, Finance |
| **Opened from** | CP-19; notification |
| **Basis** | Source §7 Step 4 |

**Comparison**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Booked | Card | — | Pieces, dimensions, actual weight, chargeable weight, amount | 162 kg · ₹3,628.26 |
| Verified at pickup | Card | — | Same fields, measured by the pickup partner | 170 kg · ₹3,773.64 |
| Difference | Currency | — | Including taxes | \+ ₹145.38 |
| Evidence | Photo gallery | — | Scale photo and tape-measure photo per piece, with time and geo-tag | 6 photos |

**Dispute form (if disputing)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Reason | Dropdown | Yes | Dimensions measured incorrectly \| Weight incorrect \| Wrong piece measured \| SKU weight is frozen \| Other | Dimensions measured incorrectly |
| Remarks | Text area | Yes | Max 500 characters | Boxes 1–2 are 60×40×40, not 65×45×40 |
| Supporting files | File upload | No | Spec sheet, photos; max 5 files | spec_sheet.pdf |

**Actions**

| **Action** | **What happens** |
|---|---|
| Accept revised rate | Charge updated; wallet debited or added to the invoice |
| Raise dispute | Status “Under dispute”; Logisco reviews and responds |

**Business rules**

- If there is no response within 48 hours, the revised rate is accepted automatically (assumed).

- Shipments using frozen SKU weights should rarely get revisions.

**Prototype notes**

- Seed shipment LGS-DEL-000784 has an open weight revision.

### CP-21 NDR action (failed delivery)

| | |
|---|---|
| **Purpose** | Tells the shipper why delivery failed and lets them choose: reattempt, change slot or address, or return to origin. |
| **Used by** | Admin, Dispatch |
| **Opened from** | CP-19; WhatsApp / SMS link; notification |
| **Basis** | Source §5.1 (NDR); §7 Step 10; §10 Step 3 |

**Attempt details (read-only)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Attempt number and time | Text | — | | Attempt 1 · 26-Nov 11:05 |
| Reason code | Text | — | Consignee not available \| Premises closed \| Refused \| Address incomplete \| Appointment not available \| COD amount not ready \| Other | Premises closed |
| Agent remark and location photo | Text + photo | — | Geo-tagged photo of the location | Shutter down, photo |

**Your action**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Action | Radio | Yes | Reattempt \| Change slot / address \| Return to origin (RTO) | Change slot |
| Reattempt date | Date | Cond. | Next 3 working days | 27-Nov-2026 |
| Time slot | Dropdown | Cond. | | 11:00–13:00 |
| Updated contact number | Phone | No | | — |
| Updated address | Address fields | Cond. | Only within the same pincode (assumed) | — |
| Instructions | Text | No | | Call before arriving |
| RTO charges | Read-only | Cond. | Shown when RTO is selected | ₹2,268 (assumed: equal to forward freight) |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit | Instruction sent to the last-mile partner; the shipment timeline updates |

**Business rules**

- WhatsApp buttons go to both the consignee and the shipper; the first response is applied and the other party is informed.

- Respond the same day (source §10). If there is no response by the cut-off, a reattempt happens next working day; after 3 failed attempts the shipment moves to RTO (assumed).

**Prototype notes**

- Seed shipment LGS-DEL-000776 has an open NDR.

### CP-22 Claims (list and raise claim)

| | |
|---|---|
| **Purpose** | Raise and follow damage, shortage or loss claims, backed by the chain-of-custody evidence. |
| **Used by** | Admin, Dispatch (raise); Finance (view settlement) |
| **Opened from** | Menu → Claims; CP-17 → Raise claim; CP-19 → Claims tab |
| **Basis** | Source §10 Step 4 |

**Claims list columns**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Claim ID | Link | — | | CLM-2026-0142 |
| LR | Link | — | | LGS-DEL-000769 |
| Type | Chip | — | Damage \| Short delivery \| Loss \| Pilferage | Short delivery |
| Amount claimed / approved | Currency | — | | ₹30,000 / ₹30,000 |
| Status | Chip | — | Submitted \| Under investigation \| Approved \| Partly approved \| Rejected \| Settled \| Closed | Settled |
| Raised on / settled on | Dates | — | | 10-Nov / 15-Nov |

**Raise claim form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR number | Typeahead | Yes | Delivered shipments within the claim window | LGS-DEL-000769 |
| Claim type | Dropdown | Yes | Damage \| Short delivery \| Loss \| Pilferage | Short delivery |
| Affected pieces | Multi-select | Yes | From the shipment’s piece list | Piece 4 of 6 |
| Claim amount | Currency | Yes | Not more than the invoice value of the affected pieces; capped by liability terms unless insured | ₹30,000 |
| Description | Text area | Yes | Max 1,000 characters | Box 4 missing at delivery |
| Evidence | File upload | Yes | Photos, invoice, GRN with remarks; delivery photos and scans attached automatically | grn_remark.jpg |
| Settlement account | Read-only | — | Default bank account or credit note | HDFC ••5678 |

**Claim detail**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Evidence timeline | List | — | Handover scans, seal numbers and photos for each leg (no partner names) | Seal SL-44817 intact |
| Decision | Text | — | Approved amount and reason | Approved in full |
| Settlement | Text | — | Credit note number or bank UTR | CN-2026-0088 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit claim | Status Submitted; the ticket is assigned to the Logisco claims desk |
| Add information | Upload more files or reply to Logisco’s query |
| Confirm resolution | Closes the claim; required before the ticket can close |
| Reopen | Within 7 days of settlement (assumed) |

**Business rules**

- Logisco settles the customer within 7 days, then recovers from the liable partner or the insurer (source §10). Liability between partners is internal and not shown.

- Claim window: 7 days from delivery (assumed).

**Prototype notes**

- One settled claim and one under investigation in the seed data.

## 6.6 Billing and finance

### CP-23 Wallet (prepaid customers)

| | |
|---|---|
| **Purpose** | Prepaid balance, recharge and transaction history. Used by SME shippers and other prepaid accounts. |
| **Used by** | Admin, Finance (Dispatch sees the balance only) |
| **Opened from** | Menu → Billing → Wallet; low-balance banner |
| **Basis** | Source §6 customer types; §7.2 (Billing & COD); §9 |

**Summary and recharge**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Current balance | Currency | — | | ₹8,450 |
| Recharge amount | Currency | Yes | Quick picks ₹5,000 \| ₹10,000 \| ₹25,000; minimum ₹1,000 | ₹10,000 |
| Payment method | Radio | Yes | UPI \| Net banking \| Card (via payment gateway) | UPI |
| Auto-recharge | Toggle | No | When the balance falls below the threshold | Off |
| Auto-recharge threshold / amount | Currency | Cond. | | ₹2,000 / ₹10,000 |
| Low-balance alert | Currency | No | | ₹3,000 |

**Transactions table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Date and time | Date | — | | 22-Nov 16:10 |
| Type | Chip | — | Recharge \| Booking debit \| Weight revision \| Refund (cancellation) \| Claim credit \| RTO charge | Booking debit |
| Reference | Text | — | LR, payment ID or claim ID | LGS-MYS-000112 |
| Amount | Currency (±) | — | | − ₹561.09 |
| Balance after | Currency | — | | ₹8,450.00 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Recharge | Payment gateway dialog → success → balance updated; receipt available |
| Download statement | Excel / PDF for a date range |

**Business rules**

- All collections go into Logisco’s nodal / escrow account (source §9).

**Prototype notes**

- The payment gateway is a mock dialog with Success and Failure buttons.

### CP-24 Invoices, credit notes and ledger

| | |
|---|---|
| **Purpose** | GST invoices (per shipment or monthly), credit notes, account ledger and online payment for credit customers. |
| **Used by** | Admin, Finance |
| **Opened from** | Menu → Billing → Invoices |
| **Basis** | Source §7 Step 11; §9 (Customer Invoicing) |

**Credit summary (credit customers)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Credit limit / used / available | Currency | — | | ₹5,00,000 / ₹3,44,200 / ₹1,55,800 |
| Payment terms | Text | — | | 30 days |
| Overdue amount | Currency | — | Red if more than 0 | ₹0 |

**Invoices table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Invoice no. | Link | — | | LGS/DL/25-26/04417 |
| Invoice date / billing period | Date | — | Per shipment or monthly consolidated (account setting) | 01-Nov / Oct-2026 |
| Shipments | Number | — | | 412 |
| Taxable value / GST / total | Currency | — | | ₹2,04,915 / ₹36,885 / ₹2,41,800 |
| Due date | Date | — | | 01-Dec-2026 |
| Status | Chip | — | Unpaid \| Partly paid \| Paid \| Overdue | Unpaid |
| E-invoice | Icon | — | IRN and QR where applicable | IRN ✓ |

**Invoice detail**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Line items | Table | — | One line per shipment: LR, date, lane, chargeable weight, charges breakdown, e-POD link | 412 lines |
| Downloads | Buttons | — | Invoice PDF \| Line items Excel \| All e-PODs ZIP | — |

**Credit notes and ledger**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Credit notes | Table | — | CN no., date, against invoice, reason (claim / weight dispute / discount / cancellation), amount | CN-2026-0088 · Claim · ₹30,000 |
| Ledger | Table | — | Date, document type, number, debit, credit, running balance; date filter | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Pay now | Payment link (UPI / net banking / card) for one or more invoices |
| Raise billing query | Form: invoice, line, reason, remark → support ticket |
| Download | PDF / Excel |

**Business rules**

- Each invoice line has its e-POD attached, as the source requires.

**Prototype notes**

- Three months of seed invoices: one Paid, one Unpaid, one Overdue for the overdue banner demo.

### CP-25 COD remittance

| | |
|---|---|
| **Purpose** | Tracks cash collected on delivery and its remittance to the shipper. |
| **Used by** | Admin, Finance (Dispatch view only) |
| **Opened from** | Menu → Billing → COD; dashboard “COD due” widget |
| **Basis** | Source §9 (COD Handling); §7.2 (COD remittance report) |

**Summary**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| COD pending remittance | Currency | — | Collected, not yet remitted | ₹38,400 |
| Next remittance | Date | — | T+2 from delivery (T+1 for top-tier accounts) | 20-Nov-2026 |
| Remitted this month | Currency | — | | ₹2,12,600 |

**Remittance table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Remittance ID | Link | — | | REM-2026-1103 |
| Date | Date | — | | 18-Nov-2026 |
| Shipments | Number | — | | 14 |
| Gross COD / deductions / net | Currency | — | Deductions only if offset is enabled, or for shortages with evidence | ₹52,300 / ₹0 / ₹52,300 |
| UTR | Text | — | Bank reference | HDFCN52026111812345 |
| Status | Chip | — | Scheduled \| Remitted \| On hold | Remitted |

**Drill-down (per remittance)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| LR, delivered on, COD amount, collected status | Table | — | | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Download remittance report | Excel |

**Business rules**

- Partners deposit COD within 24 hours. A shortage is deducted from the partner, not the shipper (source §9).

### CP-26 Document centre

| | |
|---|---|
| **Purpose** | All shipment and billing documents in one place, downloadable as one ZIP per shipment or per month. |
| **Used by** | All (Dispatch: shipment documents; Finance: invoices and credit notes) |
| **Opened from** | Menu → Documents |
| **Basis** | Source §7.2 (Document Centre) |

**Filters and table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Document type | Multi-select | — | LR \| Label \| E-way bill \| Invoice \| Credit note \| E-POD \| GRN \| Photos | E-POD |
| Date range / LR search | Filters | — | | Oct-2026 |
| Columns | Table | — | Document name, type, LR, date, size, Download | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Download ZIP for a shipment | All documents for one LR |
| Download ZIP for a month | All documents of the selected types for a month |

**Prototype notes**

- ZIP downloads contain the same set of static sample PDFs and images.

### CP-27 Analytics

| | |
|---|---|
| **Purpose** | Lane-wise performance and cost: transit time, on-time %, damage rate, cost per kg and CO2 per shipment. |
| **Used by** | Admin, Finance, Dispatch |
| **Opened from** | Menu → Analytics |
| **Basis** | Source §7.2 (Analytics) |

**Filters**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Period | Dropdown | — | Last 30 days \| Last quarter \| Custom | Last quarter |
| Service type / lane / destination state | Dropdowns | — | | All |

**Charts and tables**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| On-time delivery % trend | Line chart | — | Weekly | — |
| Average transit days by lane | Bar chart | — | Actual vs promised | Delhi → Hubballi 3.2 vs 3.5 |
| Cost per kg by lane | Bar chart | — | | ₹19.0 / kg |
| Damage rate | Number + trend | — | Claims per 1,000 shipments | 0.8 |
| CO2 per shipment | Number + trend | — | kg CO2e, estimated | 11.4 kg |
| Top lanes table | Table | — | Lane, shipments, avg transit, on-time %, damage %, cost per kg, CO2 | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Export | Excel / PDF |

**Prototype notes**

- Pre-computed numbers in seed data.

## 6.7 Settings and administration

### CP-28 Users and roles

| | |
|---|---|
| **Purpose** | Company Admin manages who can use the portal and with which role. |
| **Used by** | Admin only |
| **Opened from** | Menu → Settings → Users |
| **Basis** | Source §7.2 (Users & Integrations: roles dispatch, finance, admin) |

**Users table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Name / email / mobile | Text | — | | Ramesh Kumar |
| Role | Chip | — | Admin \| Dispatch \| Finance | Dispatch |
| Location access | Text | — | All locations or selected pickup locations (assumed) | Okhla Factory |
| Status | Chip | — | Active \| Invited \| Disabled | Active |
| Last login | Date and time | — | | 23-Nov 09:12 |

**Add / edit user**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Full name | Text | Yes | | Kavita Rao |
| Work email | Email | Yes | Unique | kavita@sharmaelectricals.in |
| Mobile | Phone | Yes | | 99100 77881 |
| Role | Dropdown | Yes | Admin \| Dispatch \| Finance | Finance |
| Location access | Multi-select | Yes | All \| specific pickup locations | All |
| Preferred language | Dropdown | Yes | English \| Hindi | English |

**Actions**

| **Action** | **What happens** |
|---|---|
| Invite user | Email and SMS invite; status Invited until first login |
| Edit / change role | Takes effect on the user’s next action |
| Disable / enable | Disabled users cannot log in |
| Resend invite / reset password | — |

**Business rules**

- At least one active Admin must always exist; the last Admin cannot be disabled or downgraded.

**Prototype notes**

- Sharma Electricals has 3 users, one per role.

### CP-29 Pickup locations

| | |
|---|---|
| **Purpose** | Manage the addresses goods are collected from. |
| **Used by** | Admin (edit); Dispatch (view) |
| **Opened from** | Menu → Settings → Pickup locations |
| **Basis** | Source §6 Step 3 (pickup addresses); §7.2 |

**List and form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Location fields | Form | Yes | Same fields as CP-06 Section 4 | Okhla Factory |
| Active | Toggle | — | Inactive locations can’t be booked from | On |
| Recurring pickup | Toggle + days | No | Daily standing pickup on chosen days (assumed) | Mon–Sat |

**Actions**

| **Action** | **What happens** |
|---|---|
| Add / edit / deactivate / set default | — |

**Business rules**

- A new pincode is checked for serviceability before it can be saved.

**Prototype notes**

- Two locations: Okhla Factory (default) and Manesar Warehouse.

### CP-30 Address book (saved consignees)

| | |
|---|---|
| **Purpose** | Saved receivers for faster booking. |
| **Used by** | Admin, Dispatch |
| **Opened from** | Menu → Settings → Address book; CP-13 Step 2 |
| **Basis** | Source §7.2 (saved consignees) |

**List and form**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Consignee fields | Form | — | Same as CP-13 Step 2 | Hubli Electric Distributors |
| Default service type | Dropdown | No | Pre-selected when booking to this consignee | Express PTL |
| Holidays / receiving hours | Text | No | Used for appointment slots | Sunday closed |

**Actions**

| **Action** | **What happens** |
|---|---|
| Add / edit / delete | — |
| Import from Excel | Template download and upload |

**Prototype notes**

- About 15 saved consignees across Karnataka, Maharashtra, Gujarat and Tamil Nadu.

### CP-31 SKU master

| | |
|---|---|
| **Purpose** | Standard product dimensions and weights so bookings are fast and weights are frozen. |
| **Used by** | Admin, Dispatch |
| **Opened from** | Menu → Settings → SKU master; CP-09 |
| **Basis** | Source §6 Step 6 (SKU master, weight freeze, AI outliers) |

**Table**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| SKU code | Text | Yes | Unique | SG-LT-400 |
| Description | Text | Yes | | LT switchgear panel 400A |
| L × B × H (cm) | Numbers | Yes | | 60 × 40 × 40 |
| Weight (kg) | Number | Yes | | 20 |
| Volumetric / CFT weight | Read-only | — | Calculated | 27 kg |
| HSN code | Text | No | | 8537 |
| Unit value (₹) | Currency | No | | ₹30,000 |
| Weight status | Chip | — | Draft \| Flagged \| Frozen (verified by Logisco) | Frozen |

**Actions**

| **Action** | **What happens** |
|---|---|
| Upload Excel / add SKU / edit | Edits to Frozen SKUs need Logisco re-verification |
| Review AI flags | For flagged rows (e.g. weight too low for the size): Accept as is \| Correct |

**Prototype notes**

- About 20 SKUs; 2 flagged as outliers.

### CP-32 Integrations (API keys, webhooks, ERP connectors)

| | |
|---|---|
| **Purpose** | Technical setup for customers who book from their own systems. |
| **Used by** | Admin only |
| **Opened from** | Menu → Settings → Integrations; CP-09 |
| **Basis** | Source §7.2 (API keys, webhooks, ERP connectors); §6 Step 6; §13 |

**API keys**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Environment | Tabs | — | Sandbox \| Production (Production after go-live) | Sandbox |
| Key name | Text | Yes | | Tally connector |
| Key | Masked text + copy | — | Shown in full only once at creation | lg_sbx\_••••91af |
| Created / last used | Dates | — | | 20-Nov / 23-Nov |

**Webhooks**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Endpoint URL | URL | Yes | HTTPS only | https://erp.sharmaelectricals.in/logisco |
| Events | Multi-select | Yes | Booked \| Picked up \| In transit \| Out for delivery \| Delivered \| NDR \| Exception \| Invoice generated | All |
| Signing secret | Masked | — | Regenerate | whsec\_•••• |

**Connectors**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| ERP | Cards | — | Tally \| SAP \| Zoho: status, last sync, sync frequency | Tally — Connected, every 15 min |
| Marketplace / ONDC | Card | — | Seller ID link status | Not connected |
| Excel templates | Links | — | Bulk booking, address book, SKU master | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Generate / revoke key | — |
| Add webhook / send test event | Shows a mock response 200 OK |
| Connect / disconnect ERP | — |
| View API documentation | Opens docs (static page in the prototype) |

### CP-33 Company profile, branding and rate card

| | |
|---|---|
| **Purpose** | The account’s legal details, KYC documents, billing settings, tracking-page branding, account manager and current rate card. |
| **Used by** | Admin (edit); Dispatch and Finance (view) |
| **Opened from** | Menu → Settings → Company profile |
| **Basis** | Source §6; §7.2 (Branded Tracking) |

**Sections**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Legal details | Read-only | — | Legal name, GSTIN, PAN, CIN, constitution, KYC status, re-KYC due date | KYC Verified |
| KYC documents | List | — | With upload date and expiry; Replace button | — |
| Billing settings | Form | — | Billing address, invoice frequency (per shipment / monthly), invoice email(s), PO mandatory (Y/N) | Monthly |
| Bank account | Card | — | Change needs OTP and a new penny-drop | HDFC ••5678 |
| Tracking-page branding | Form | No | Logo (PNG/SVG, max 1 MB), brand colour, support phone and email | logo.png, \#1B4F9C |
| Account manager | Card | — | | Arjun Mehta |
| Rate card and contract | Links | — | Opens CP-08 in read-only mode; contract PDF | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save changes | Changes to legal details need a ticket to Logisco |

### CP-34 Notification preferences and language

| | |
|---|---|
| **Purpose** | Each user chooses which alerts they get and on which channel, and their language. |
| **Used by** | All (own preferences); Admin also sets consignee notifications |
| **Opened from** | Profile menu → Preferences |
| **Basis** | Source §13 (WhatsApp, SMS); §14 (Hindi + English) |

**Matrix (event × channel)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Events | Rows | — | Booking confirmed \| Picked up \| Weight revision \| Delay / new ETA \| Out for delivery \| Delivered \| NDR \| Claim update \| Invoice generated \| Payment due \| COD remitted \| Wallet low | — |
| Channels | Checkbox columns | — | WhatsApp \| SMS \| Email \| In-app | WhatsApp + In-app |
| Consignee notifications (Admin) | Toggles | — | Send tracking, appointment and delivery messages to receivers | On |
| Language | Dropdown | Yes | English \| Hindi; applies to the portal and messages | English |

**Actions**

| **Action** | **What happens** |
|---|---|
| Save | — |

### CP-35 AI assistant

| | |
|---|---|
| **Purpose** | Chat panel that can answer and act in English or Hindi, by text or voice: track, reschedule, raise claims, download documents. |
| **Used by** | All (it can only do what the user’s role allows) |
| **Opened from** | Floating button on every screen; CP-17 → Get help |
| **Basis** | Source §7.2 (AI Assistant); §12 |

**Panel**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Message box | Text | — | Max 500 characters | Where is LR 781? |
| Voice input | Mic button | — | English or Hindi speech | — |
| Suggestion chips | Buttons | — | Track a shipment \| Reschedule delivery \| Raise a damage claim \| Download invoice | — |
| Response cards | Rich cards | — | Status card, slot picker, claim form summary, document link | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Ask | Answer shown as text plus a card |
| Act | The assistant prepares the action and the user taps Confirm (e.g. new delivery slot) |

**Business rules**

- Guardrail (source §12): the AI never pays money or closes a claim on its own; a person confirms every action.

**Prototype notes**

- Scripted intents matched by keyword in English and Hindi (e.g. “LR 781 kahan hai?”); answers read the shared store.

### CP-36 Notification centre

| | |
|---|---|
| **Purpose** | In-app list of alerts. |
| **Used by** | All |
| **Opened from** | Bell icon in the header |
| **Basis** | Assumed (standard) |

**List**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Item | Row | — | Icon, title, LR, time, read / unread; tap opens the related screen | Weight revision on LGS-DEL-000784 |
| Filter | Tabs | — | All \| Unread \| Action needed | Unread |

**Actions**

| **Action** | **What happens** |
|---|---|
| Mark all as read | — |

### CP-37 Help and support tickets

| | |
|---|---|
| **Purpose** | Raise and follow service or billing queries that are not exceptions or claims. |
| **Used by** | All |
| **Opened from** | Menu → Help; CP-17 → Get help; CP-24 → Raise billing query |
| **Basis** | Assumed; Logisco Customer Success tickets are in source §11 |

**Raise ticket**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Category | Dropdown | Yes | Shipment \| Billing \| Pickup \| Account \| Integration \| Other | Pickup |
| LR / invoice (optional) | Typeahead | No | | LGS-DEL-000790 |
| Subject / description | Text | Yes | | Pickup not done yesterday |
| Attachment | File | No | Max 5 MB | — |

**Tickets list**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Ticket ID, category, status, last update | Table | — | Open \| In progress \| Waiting for you \| Resolved \| Closed | TKT-2026-3381 · Resolved |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit | Ticket created |
| Reply | Conversation thread |
| Confirm resolved | Closes the ticket |

# 7. Business Rules and Calculations

## 7.1 Parameters used in this specification

The source names these rules but not their values. The values below are placeholders for the prototype and must be confirmed (Section 12).

| **Parameter** | **Value used** | **Basis** |
|---|---|---|
| Parcel volumetric divisor | L × B × H (cm) ÷ 5,000 | Assumed (common industry value) |
| Parcel weight slab | 0.5 kg | Assumed |
| PTL CFT factor | 8 kg per cubic foot | Assumed; configurable per contract |
| PTL minimum chargeable weight | 50 kg (Express PTL), 100 kg (Standard PTL) | Source says minimum applies (§2.1); values assumed |
| Pickup cut-off | 14:00 local time | Assumed |
| Quote validity | 7 days | Assumed |
| Weight revision auto-accept | 48 hours without response | Assumed |
| Maximum delivery attempts before RTO | 3 | Assumed |
| Claim window | 7 days from delivery | Assumed |
| Claim settlement to customer | Within 7 days | Source §10 |
| COD remittance | T+2 from delivery; T+1 for top-tier accounts | Source §9 |
| E-way bill threshold | ₹50,000 inter-state; state limits vary (configurable) | Source §7, §14 |
| E-way bill validity | 1 day per 200 km | Source §14 |
| Credit hold | Booking blocked if over limit or any invoice overdue by more than 15 days | Assumed |
| Enterprise / assisted track threshold | ₹2 lakh monthly freight or 300 shipments per month | Source says a threshold exists (§6); value assumed |
| Low wallet balance alert | ₹3,000 (user can change) | Assumed |

## 7.2 Chargeable weight

- Parcel: for each piece, chargeable weight = higher of actual weight and volumetric weight (L × B × H ÷ 5,000), rounded up to the next 0.5 kg slab (source §8.1).

- PTL: chargeable weight = higher of total actual weight and CFT weight (total cubic feet × CFT factor), and never below the minimum chargeable weight (source §8.1).

- Cubic feet = L × B × H in cm ÷ 28,317. Example: a 60 × 40 × 40 cm box is 96,000 cm³ = 3.39 cu ft.

## 7.3 Price build-up

The order of elements follows source §8.1. Every element is shown at quote time, so there are no surprises later; the only later change is a weight revision verified at pickup (source §7 Step 1).

1.  Base freight: Parcel = weight slab × zone rate; PTL = chargeable kg × lane rate per kg.

2.  Surcharges: fuel (% of freight), ODA, docket / LR, appointment, COD fee, To-Pay fee, insurance / FOV, special handling.

3.  Subtotal, then GST at the configured rate (18% is assumed in the examples), then total.

**Worked example 1: Express PTL, Sharma Electricals (LGS-DEL-000781)**

Okhla, Delhi (110020) → Hubballi, Karnataka (580030). 6 cartons of 60 × 40 × 40 cm, 20 kg each. Goods value ₹1,80,000. Appointment delivery and transit insurance. Payment TBB.

| **Line** | **Calculation** | **Amount** |
|---|---|---|
| **Actual weight** | 6 × 20 kg | 120 kg |
| **CFT weight** | 6 × 3.39 cu ft = 20.3 cu ft × 8 kg | 162 kg |
| **Chargeable weight** | Higher of 120 and 162; above 50 kg minimum | 162 kg |
| **Base freight** | 162 kg × ₹14.00 | ₹2,268.00 |
| **Fuel surcharge** | 10% of freight | ₹226.80 |
| **Docket / LR** | Per shipment | ₹100.00 |
| **Appointment delivery** | Per shipment | ₹300.00 |
| **Insurance / FOV** | 0.1% of ₹1,80,000 | ₹180.00 |
| **Subtotal** | | ₹3,074.80 |
| **GST** | 18% (assumed) | ₹553.46 |
| **Total** | | ₹3,628.26 |

E-way bill: goods value ₹1,80,000 is above ₹50,000 and the movement is inter-state, so it is generated automatically. Distance about 1,900 km → validity 10 days. ETA: booked Monday before the cut-off, 3-day Express PTL transit → Thursday.

**Worked example 2: Parcel, Kaveri Handicrafts (SME, prepaid wallet)**

Mysuru (570001) → Pune (411001), Zone D, Standard tier. 1 box of 40 × 30 × 30 cm, actual weight 6 kg. Payment from wallet.

| **Line** | **Calculation** | **Amount** |
|---|---|---|
| **Volumetric weight** | 40 × 30 × 30 ÷ 5,000 | 7.2 kg |
| **Chargeable weight** | Higher of 6 and 7.2, rounded up to 0.5 kg slab | 7.5 kg |
| **Base freight** | First 0.5 kg ₹55 + 14 additional slabs × ₹25 | ₹405.00 |
| **Fuel surcharge** | 10% | ₹40.50 |
| **Docket** | Parcel | ₹30.00 |
| **Subtotal** | | ₹475.50 |
| **GST** | 18% (assumed) | ₹85.59 |
| **Total (debited from wallet)** | | ₹561.09 |

## 7.4 Booking checks

- Origin and destination pincodes must be serviceable; ODA pincodes add the ODA charge (source §7 Step 1).

- Service tier must be offered on the lane (source §8).

- E-way bill check runs on invoice value and route. If one is required, the HSN code is mandatory.

- Prepaid: wallet balance must cover the total. Credit: the total must fit within available credit and no invoice may be overdue beyond the grace period.

- COD amount cannot exceed the invoice value.

## 7.5 After booking

- Cancellation: allowed only while the status is Booked. Prepaid amounts are refunded to the wallet; no invoice line is raised (assumed).

- Weight revision: if pickup weight or dimensions differ, the customer accepts the revised rate or raises a dispute with evidence on screen (source §7 Step 4).

- Delay: the AI predicts delays; the ETA is revised and the customer is informed (source §7 Step 6, §10).

- NDR: the shipper and consignee get WhatsApp buttons: Reattempt, Change slot / address, RTO. The first response applies (source §7 Step 10).

- Claims: opened with chain-of-custody evidence; Logisco settles the customer within 7 days and recovers from the liable partner or insurer (source §10).

- Billing: GST invoice per shipment or monthly, with e-POD attached; e-invoice with IRN and QR where applicable (source §7 Step 11, §9).

# 8. Shipment Status Model

Every partner status code maps to this one list, which is the only list the customer sees (source §7.1).

| **Status** | **Meaning** | **Set by** | **What the customer can do** |
|---|---|---|---|
| **Booked** | Shipment created, LR issued, waiting for pickup | Customer Portal (booking) | Cancel, edit pickup slot, print labels |
| **Picked Up** | First-mile partner scanned all pieces and verified weight | Partner App (rider) | Respond to a weight revision; reschedule delivery |
| **At Origin Hub** | Sorted, manifested and sealed at the origin hub | Partner App (hub mode) | Track |
| **In Transit** | On the line-haul truck; tracked by GPS / FASTag | Partner App (driver) | Track live; change delivery slot |
| **At Destination Hub** | Seal checked, de-consolidated, pieces counted | Partner App (hub mode) | Book or change the appointment slot |
| **Out for Delivery** | With the last-mile rider; delivery window or slot set | Partner App (rider) | Share tracking link; masked call |
| **Delivered** | OTP or e-signature, photo, geo-tag, GRN captured | Partner App (rider) | Download e-POD; raise claim within the window |
| **Undelivered (NDR)** | Delivery attempt failed, with a reason code | Partner App (rider) | Reattempt, change slot or address, RTO |
| **Delivered with Exception** | Delivered with short or damaged pieces recorded | Partner App (rider) | Raise claim |
| **Return to Origin** | Coming back to the shipper | Shipper or consignee choice; or after max attempts | Track the return; see RTO charges |
| **Cancelled (assumed)** | Cancelled before pickup | Customer Portal | Refund to wallet (prepaid) |

# 9. Notifications

Channels: WhatsApp (with action buttons), SMS, email and in-app. Every template exists in English and Hindi (source §13, §14). Users choose channels in CP-34.

| **Event** | **Sent to** | **Default channels** | **Content and buttons** |
|---|---|---|---|
| Booking confirmed | Booking user | In-app, email | LR number, pickup slot, ETA, label link |
| Picked up | Booking user | In-app, WhatsApp | Pieces, verified weight |
| Weight revision | Booking user, Finance | In-app, WhatsApp | Old vs new charge; buttons: Accept \| Dispute |
| Delay / revised ETA | Shipper and consignee | WhatsApp, SMS | New ETA and reason |
| Appointment request | Consignee | WhatsApp | Buttons: Book slot \| Upload gate pass |
| Out for delivery | Consignee | WhatsApp, SMS | Delivery window, OTP, masked agent contact |
| Delivered | Shipper | In-app, email | Receiver name, time, e-POD link |
| NDR | Shipper and consignee | WhatsApp, in-app | Reason, photo; buttons: Reattempt \| Change slot / address \| RTO |
| E-way bill near expiry | Booking user | In-app, email | Extension handled by Logisco; customer informed |
| Claim update | Raised-by user, Finance | In-app, email | Status, approved amount, settlement reference |
| Invoice generated | Finance users | Email, in-app | Invoice PDF, due date, Pay now link |
| Payment due / overdue | Finance users, Admin | Email, WhatsApp | Amount, due date, Pay now link |
| COD remitted | Finance users | Email, in-app | Amount, UTR, report link |
| Wallet low | Admin, Finance | In-app, WhatsApp | Balance and Recharge link |
| OTP | User | SMS | 6-digit code |

# 10. Common Validations and Formats

| **Field** | **Rule** | **Example** |
|---|---|---|
| **GSTIN** | 15 characters: 2-digit state code, 10-character PAN, entity number, “Z”, checksum. Pattern ^\[0-9\]{2}\[A-Z\]{5}\[0-9\]{4}\[A-Z\]\[1-9A-Z\]Z\[0-9A-Z\]\$ | 07AABCS1234F1Z5 |
| **PAN** | Pattern ^\[A-Z\]{5}\[0-9\]{4}\[A-Z\]\$ | AABCS1234F |
| **CIN** | 21 characters. Pattern ^\[LU\]\[0-9\]{5}\[A-Z\]{2}\[0-9\]{4}\[A-Z\]{3}\[0-9\]{6}\$ | U31200DL2008PTC123456 |
| **IFSC** | Pattern ^\[A-Z\]{4}0\[A-Z0-9\]{6}\$ | HDFC0001234 |
| **Pincode** | 6 digits, first digit not 0 | 110020 |
| **Mobile** | 10 digits starting 6–9; shown with +91 | 98100 23456 |
| **E-way bill number** | 12 digits | 341022567781 |
| **HSN code** | 4, 6 or 8 digits | 8537 |
| **Dimensions** | Positive, up to 1 decimal, maximum 300 cm per side (assumed) | 60 × 40 × 40 |
| **Weight** | Greater than 0, up to 2 decimals | 20.00 kg |
| **Amounts** | ₹ with Indian grouping, 2 decimals in invoices | ₹1,80,000.00 |
| **Dates / times** | DD-MMM-YYYY; 24-hour time | 23-Nov-2026 14:30 |
| **File uploads** | PDF, JPG, PNG; maximum 5 MB unless stated | invoice.pdf |

Error messages appear inline under the field, in the user’s language, and say how to fix the problem (for example, “Enter a 6-digit pincode”).

# 11. Prototype Implementation Notes

## 11.1 Demo accounts

| **Account** | **Profile** | **Users (role)** |
|---|---|---|
| Sharma Electricals Pvt Ltd, Okhla, Delhi | Manufacturer; credit (TBB) ₹5 lakh, 30 days; live; Tally connected; 2 pickup locations | Priya Sharma (Admin), Ramesh Kumar (Dispatch), Kavita Rao (Finance) |
| Kaveri Handicrafts, Mysuru | SME shipper; prepaid wallet ₹8,450; live; mostly Parcel | Suresh Gowda (Admin) |
| New sign-up | Created live by the reviewer from CP-04; walks through every onboarding step with automatic approvals | The reviewer (Admin) |

## 11.2 Seed data for the portal

- About 40 shipments for Sharma Electricals spread over every status, including LGS-DEL-000781 (in transit), LGS-DEL-000784 (open weight revision), LGS-DEL-000776 (open NDR) and LGS-DEL-000769 (settled shortage claim). About 8 Parcel shipments for Kaveri Handicrafts.

- Rate cards: one PTL card (8 lanes) and one Parcel card (5 zones × 3 tiers), surcharges as in CP-08.

- Pincode master for about 10 cities with ODA flags; 15 saved consignees; 20 SKUs (2 flagged as outliers).

- 3 monthly invoices (Paid, Unpaid, Overdue), 2 credit notes, 4 COD remittances, 2 claims, 3 support tickets, wallet transactions for Kaveri.

## 11.3 What is calculated and what is simulated

| **Item** | **In the prototype** |
|---|---|
| Chargeable weight, price build-up, ETA, e-way bill requirement | Calculated for real from seed rate cards and lane data |
| Status counts, dashboards, lists, filters, search | Calculated live from the shared data store |
| GSTIN, PAN, CIN, bank penny-drop verification | Spinner, then scripted success; special values return failure (see CP-06) |
| OTP and e-sign | Fixed OTP 123456; e-sign is a mock dialog |
| Payment gateway (wallet recharge, Pay now) | Mock dialog with Success and Failure buttons |
| LR, label, e-way bill number, invoice PDFs | Generated in the browser from templates and sequences |
| WhatsApp, SMS and email | Shown in a phone-preview panel and the notification centre; buttons work |
| Live truck location | Marker moved along a preset route |
| AI assistant, lead score, credit score, delay prediction | Scripted responses and pre-computed values |
| ERP connector, API keys, webhooks | Static states; test webhook returns a mock 200 OK |

## 11.4 Cross-app moments to show in a demo

| **Do this in the Customer Portal** | **Then show it in** |
|---|---|
| Confirm booking for LGS-DEL-000781 | ERP Control Tower (new shipment with 5 legs) and Partner Portal (SwiftCity Couriers’ job inbox) |
| Watch tracking while the rider scans in the Partner App | Status moves to Picked Up on CP-17 without a refresh |
| Accept a weight revision | ERP Finance: revised charge on the shipment |
| Choose “Change slot” on an NDR | Partner App: last-mile rider sees the new slot |
| Raise a shortage claim | ERP Claims: claim with seal and scan evidence; liable leg identified |

## 11.5 UI conventions

- Desktop-first web layout (1280 px and wider) with a responsive tablet view; the public tracking page (CP-18) is mobile-first.

- Every data load shows a short skeleton state (300–800 ms) so the experience feels like a real network call.

- Empty states with a next action (for example, “No exceptions. Nice work.”), success toasts after every action, and confirm dialogs for cancel, RTO and disabling users.

- English / Hindi toggle in the header; all labels come from a translation file so Hindi can be completed later.

- A “Reset demo data” control (in the prototype’s demo toolbar) restores the seed data.

# 12. Assumptions and Open Questions

These items are not defined in the source document. The prototype uses the stated assumption until the client confirms.

| **\#** | **Topic** | **Assumption in this specification** | **Confirm with** |
|---|---|---|---|
| 1 | Role permissions | Source names Admin, Dispatch and Finance only; the matrix in 3.3 is proposed | Logisco product owner |
| 2 | Partner names on tracking | Hidden from the customer; the timeline shows “Logisco network” and the hub city | Logisco product owner |
| 3 | Onboarding track rules | Business type sets the track; an SME above ₹2 lakh / 300 shipments a month moves to assisted | Logisco Sales |
| 4 | Weight and price parameters | Volumetric divisor 5,000; CFT factor 8; PTL minimums 50 / 100 kg; parcel zones A–E | Logisco Pricing |
| 5 | Cancellation and dispute timelines | Cancel only before pickup; weight revision auto-accepted after 48 hours | Logisco Operations |
| 6 | NDR limits and RTO charges | 3 attempts, then RTO; RTO charge equals forward freight | Logisco Operations |
| 7 | Claims | 7-day claim window; liability cap ₹100/kg up to ₹10,000 without insurance | Logisco Claims / Legal |
| 8 | Reverse pickup and To-Pay | Listed as services in the source, but no flow is described; the prototype shows them only as booking options | Logisco product owner |
| 9 | Multiple GSTINs | One GSTIN per account; multi-state companies with several GSTINs are not covered | Logisco Finance |
| 10 | Credit hold | Booking blocked when over limit or an invoice is overdue by more than 15 days | Logisco Finance |
| 11 | Hindi coverage in the prototype | Toggle present; Hindi text completed for key screens first | Pace Wisdom / Logisco |
| 12 | Consignee appointment channel | Both WhatsApp and the public web page (CP-18) | Logisco product owner |
| 13 | E-invoice applicability | Shown where applicable; the source says this is to be confirmed by tax advisers (§14) | Logisco Finance / tax advisers |

# Appendix A. Glossary

| **Term** | **Meaning** |
|---|---|
| **AWB / LR** | Air waybill / lorry receipt: the shipment’s consignment number |
| **CFT** | Cubic feet; used to work out volumetric weight for PTL |
| **COD** | Cash on delivery: the value of the goods is collected from the consignee |
| **e-POD** | Electronic proof of delivery: OTP or signature, photo, geo-tag |
| **E-way bill (EWB)** | Government document required to move goods above a value threshold |
| **FOV** | Freight on value: insurance charge as a % of goods value |
| **GRN** | Goods receipt note issued by the consignee on receipt |
| **IRN** | Invoice reference number from the GST e-invoice system |
| **KAM** | Key account manager |
| **NDR** | Non-delivery report: a failed delivery attempt |
| **ODA** | Out-of-delivery-area pincode, charged extra |
| **ONDC** | Open Network for Digital Commerce |
| **Penny-drop** | ₹1 test credit used to verify a bank account |
| **PTL** | Part-truckload: multi-box consignments too large for parcel, smaller than a full truck |
| **RTO** | Return to origin |
| **SLA** | Service-level agreement (promised pickup and delivery times) |
| **TBB** | To-be-billed: credit terms, invoiced later |
| **To-Pay** | The consignee pays the freight |
