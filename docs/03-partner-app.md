# Logisco — Partner App Specification (v0.1, 18-Nov-2026)

Source of truth for this app. Screen IDs are used in code and commits. "Source §x" = client workflow document (00-source-workflow.md); "Assumed" = our proposal, listed in Section 12.

# 1. Introduction

## 1.1 Purpose

This document specifies the Logisco Partner App: the Android app that riders, drivers and hub staff of delivery partners use to do the physical work. Every pickup, hand-over, line-haul trip, hub scan and delivery is recorded here with scans, photos, seal numbers and location. These records are the chain of custody that tracking, billing, claims and partner scoring all depend on (source §2.2).

The document is the build reference for the clickable prototype. In the prototype the app runs inside a phone frame in the browser and shares one data store with the Customer Portal, Partner Portal and Logisco ERP.

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
<td><p>Login, permissions, home, tasks, shared scanner, notifications, training, AI assistant, SOS, settings and offline sync.</p>
<p>Rider pickup (first mile) and delivery (last mile), including COD and failed delivery.</p>
<p>Hand-over give and receive between partners.</p>
<p>Driver line-haul trip: start, tracking, halts, breakdowns, arrival seal check.</p>
<p>Hub staff: in-scan, sort, bag, manifest, seal, out-scan, short / excess.</p></td>
<td><p>Partner company office work (job acceptance, assignment, finance) — see the Partner Portal Specification.</p>
<p>Customer and consignee screens — see the Customer Portal Specification.</p>
<p>Real device integrations (barcode SDK, Bluetooth scales, GPS, masked calling); these are simulated.</p>
<p>iOS (the source names low-cost Android phones, §5.1).</p></td>
</tr>
</tbody>
</table>

## 1.3 Traceability and how to read

- Every screen states its basis: “Source §x” or “Assumed”. Assumptions needing confirmation are listed in Section 12.

- Field tables: Field, Type, Req. (mandatory), Rules / options, Sample (demo data). Req.: Yes, No, Cond. (conditional), — (display only).

- On a phone, “fields” are often buttons, scans or photos rather than typed text; the Type column says which.

# 2. Partner App Overview

## 2.1 Design principles from the source

| **Principle** | **What it means for the app** | **Source** |
|---|---|---|
| Works offline | All scans, photos, OTP checks and forms save on the phone and sync when the network returns | §5.1 |
| Low-cost Android phones | Light app, small photos, simple screens | §5.1 |
| Hindi voice prompts | Spoken guidance and scan feedback; every label in Hindi and English | §5.1, §14 |
| SOS button | On every screen | §5.1 |
| Every hand-over is a digital scan with photo and seal number | No hand-over completes without both sides confirming | §2.2, §5.1 |
| Masked calling | Riders call shippers and consignees without seeing their numbers | §5.1, §13 |
| Training in the app | Videos and a practice mode in Hindi and English; AI assistant for “how do I…” | §4 Step 6 |

## 2.2 Which roles each partner type uses

| **Partner type** | **Rider** | **Driver** | **Hub staff** |
|---|---|---|---|
| A National courier (usually via API) | If using the app | If using the app | If using the app |
| B Regional / city courier | Yes | — | If it runs a hub |
| C Hyperlocal delivery | Yes | — | — |
| D Line-haul transporter | — | Yes | — |
| E PTL consolidator | PTL pickups (assumed) | Yes | If it has a hub |
| F Hub / warehouse operator | — | — | Yes (the source calls it the hub scanning app; here it is the hub mode of the same app) |

## 2.3 One shipment through the app (LGS-DEL-000781)

| **\#** | **Who (partner)** | **Screens** | **Result** |
|---|---|---|---|
| 1 | Ravi, rider (SwiftCity, B) | PA-14 → PA-15 → PA-16 → PA-17 | 6 pieces scanned, weighed, photographed; Picked Up |
| 2 | Ravi → Pooja, hub staff (NCR CrossDock, F) | PA-19 / PA-20 | Hand-over 1 confirmed by both |
| 3 | Pooja | PA-26 → PA-27 → PA-28 | In-scanned, sorted to BAG 07, sealed SL-44817, manifested; At Origin Hub |
| 4 | Pooja → Basavaraj, driver (Deccan Roadlines, E) | PA-29 → PA-19 / PA-20 | Bags loaded, door sealed, hand-over 2 |
| 5 | Basavaraj | PA-22 → PA-23 → PA-24 | Trip started, tracked, halt reported, seals intact on arrival; In Transit |
| 6 | Basavaraj → hub staff (Hubli Warehousing, F) | PA-19 / PA-20 → PA-26 | Hand-over 3, seal match, de-consolidated; At Destination Hub |
| 7 | Hub staff → Manju, rider (NK Express, B) | PA-20 → PA-31 | Pieces loaded for the run; Out for Delivery |
| 8 | Manju | PA-32 → PA-33 | OTP, photo, GRN, geo-tag; Delivered |

## 2.4 How the app connects to the other apps

| **App event** | **Seen in** |
|---|---|
| Partner admin assigns a job (Partner Portal) | Task appears on the staff member’s phone |
| Pickup confirmed, hand-overs, trip start, arrival, delivery | Customer Portal tracking, Partner Portal job status, ERP Control Tower |
| Weight differs at pickup | Customer Portal weight revision; ERP Finance |
| Failed delivery submitted | Customer Portal and WhatsApp NDR buttons; customer’s choice returns as a new task |
| Seal mismatch / short / damage | ERP exception ticket and claims evidence; Partner Portal escalation |
| SOS | ERP Control Tower and Partner Portal alert with live location |
| COD collected / deposited | Partner Portal COD screen; ERP Finance |

# 3. Users and Roles

## 3.1 Roles

The source names three kinds of partner field staff: riders, drivers and hub staff, who scan, load, move and deliver using the Logisco Partner App (§2). Each staff member is created by their partner company in the Partner Portal with one of these roles.

| **Role** | **Main work in the app** | **Demo persona** |
|---|---|---|
| Rider | First-mile pickups, last-mile deliveries, reattempts, reverse pickups, COD | Ravi Kumar (SwiftCity Couriers, pickup); Manju R. (NK Express, delivery) |
| Driver | Line-haul trips hub-to-hub: load check, seals, tracking, halts, arrival | Basavaraj H. (Deccan Roadlines) |
| Hub staff | Receive, in-scan, sort, bag, seal, manifest, dispatch, short / excess | Pooja S. (NCR CrossDock, Gurugram) |

## 3.2 Screen access by role

| **Screens** | **Rider** | **Driver** | **Hub staff** |
|---|---|---|---|
| PA-01 to PA-13 Getting started, home, tasks, scanner, training, SOS, sync | ✓ | ✓ | ✓ |
| PA-14 to PA-18 Pickup | ✓ | — | — |
| PA-19, PA-20 Hand-over give / receive | ✓ | ✓ | ✓ |
| PA-21 to PA-24 Line-haul trip | — | ✓ | — |
| PA-25 to PA-30 Hub operations | — | — | ✓ |
| PA-30 Short / excess / damage form | ✓ (from PA-20) | ✓ (from PA-20) | ✓ |
| PA-31 to PA-36 Delivery, COD, failed delivery | ✓ | — | — |

## 3.3 Role rules

- Staff log in only with the mobile number registered by their company; they cannot self-register.

- A staff member with an expired licence or pending police verification can log in but gets no tasks (source §4.1).

- One role per staff member (assumed). Small partners where one person both picks up and delivers use the Rider role, which covers both.

# 4. Navigation and Flows

## 4.1 Bottom tabs by role

| **Role** | **Tabs** |
|---|---|
| Rider | Home · Tasks · Scan · My day · More |
| Driver | Home · Trip · Scan · My day · More |
| Hub staff | Home · Inbound · Scan · Outbound · More |
| All (top bar) | Duty status · sync indicator · language · SOS |

## 4.2 Main flows

| **Flow** | **Screens in order** |
|---|---|
| First use | PA-01 Language → PA-02 Login → PA-03 Permissions → PA-10 Training → PA-05 Home |
| Pickup | PA-06 Task → PA-14 Detail → I’ve arrived → PA-15 Scan & documents → PA-16 Weight → PA-17 Confirm → PA-19 Hand over at hub |
| Pickup failed | PA-14 → PA-18 |
| Hub inbound to outbound | PA-20 Receive → PA-26 In-scan → PA-27 Sort → PA-28 Bag & seal → PA-29 Out-scan → PA-19 Hand over to driver |
| Line-haul | PA-21 Trip → PA-20 Receive load → PA-22 Start → PA-23 In progress → PA-24 Arrival → PA-19 Hand over |
| Delivery | PA-20 Receive at hub → PA-31 Run → PA-32 Stop → PA-33 Deliver & e-POD (→ PA-34 COD) → next stop |
| Failed delivery | PA-32 → PA-35 → (customer chooses) → reattempt task or RTO |
| End of day | PA-36 Deposit COD → PA-13 Sync → off duty |

# 5. Screen Inventory

The Partner App has 36 screens, grouped in 6 modules.

| **ID** | **Screen** | **Module** | **Used by** | **Basis** |
|---|---|---|---|---|
| PA-01 | Language selection (first launch) | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-02 | Login (mobile + OTP) | Getting started (all roles) | Rider, Driver, Hub staff | Assumed |
| PA-03 | Permissions and profile check | Getting started (all roles) | Rider, Driver, Hub staff | Assumed |
| PA-04 | Bottom navigation (app shell) | Getting started (all roles) | Rider, Driver, Hub staff | Assumed |
| PA-05 | Home (today) | Getting started (all roles) | Rider, Driver, Hub staff (content by role) | Source |
| PA-06 | Task list | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-07 | Scanner (shared component) | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-08 | Notifications | Getting started (all roles) | Rider, Driver, Hub staff | Assumed |
| PA-09 | My day and performance | Getting started (all roles) | Rider, Driver, Hub staff | Assumed |
| PA-10 | Training and practice mode | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-11 | AI assistant | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-12 | SOS and report a problem | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-13 | Settings and sync queue | Getting started (all roles) | Rider, Driver, Hub staff | Source |
| PA-14 | Pickup task detail | Rider: pickup (first mile) | Rider (Types A, B, C) | Source |
| PA-15 | Pickup scan and documents | Rider: pickup (first mile) | Rider | Source |
| PA-16 | Weight and dimensions | Rider: pickup (first mile) | Rider | Source |
| PA-17 | Pickup confirmation | Rider: pickup (first mile) | Rider | Source |
| PA-18 | Pickup failed | Rider: pickup (first mile) | Rider | Assumed |
| PA-19 | Hand over (give) | Hand-over (all roles) | Rider (to origin hub), Hub staff (to driver or rider), Driver (to destination hub) | Source |
| PA-20 | Receive hand-over (take) | Hand-over (all roles) | Hub staff (from rider or driver), Driver (from hub), Rider (from destination hub) | Source |
| PA-21 | Trip detail | Driver: line-haul | Driver (Types A, D, E) | Source |
| PA-22 | Start trip | Driver: line-haul | Driver | Source |
| PA-23 | Trip in progress | Driver: line-haul | Driver | Source |
| PA-24 | Arrival and seal check | Driver: line-haul | Driver | Source |
| PA-25 | Hub home (shift view) | Hub staff: hub operations | Hub staff (Types B with hub, E, F) | Source |
| PA-26 | Bulk in-scan | Hub staff: hub operations | Hub staff | Source |
| PA-27 | Sort to bag / cage | Hub staff: hub operations | Hub staff | Source |
| PA-28 | Close bag, manifest and seal | Hub staff: hub operations | Hub staff | Source |
| PA-29 | Out-scan and dispatch | Hub staff: hub operations | Hub staff | Source |
| PA-30 | Short, excess and damage report | Hub staff: hub operations | Hub staff (riders and drivers use the same form from PA-20) | Source |
| PA-31 | Delivery run | Rider: delivery (last mile) | Rider (Types A, B, C) | Source |
| PA-32 | Delivery stop detail | Rider: delivery (last mile) | Rider | Source |
| PA-33 | Deliver and capture e-POD | Rider: delivery (last mile) | Rider | Source |
| PA-34 | COD collection | Rider: delivery (last mile) | Rider | Source |
| PA-35 | Failed delivery (NDR) | Rider: delivery (last mile) | Rider | Source |
| PA-36 | COD in hand and deposit | Rider: delivery (last mile) | Rider | Source |

# 6. Screen Specifications

## 6.1 Getting started (all roles)

### PA-01 Language selection (first launch)

| | |
|---|---|
| **Purpose** | First screen after install. The user picks the app language; voice prompts follow the same choice. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | First launch; Settings → Language |
| **Basis** | Source §14 (Hindi + English; Hindi voice prompts for riders) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Language | Two large cards | Yes | हिन्दी \| English (other languages can be added later without code changes) | हिन्दी |
| Voice prompts | Toggle | No | Spoken instructions and scan feedback | On |

**Actions**

| **Action** | **What happens** |
|---|---|
| Continue | Opens Login (PA-02) |

**Business rules**

- Every screen, button, error and voice prompt exists in both languages.

**Prototype notes**

- Voice prompts use the browser’s speech engine (Hindi voice where available).

### PA-02 Login (mobile + OTP)

| | |
|---|---|
| **Purpose** | Field staff log in with the mobile number their partner company registered in the Partner Portal. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | After PA-01; after logout |
| **Basis** | Assumed (standard); staff created in Partner Portal (source §4 Step 6) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Mobile number | Phone (+91), numeric keypad | Yes | Must belong to an active staff record | 98730 44556 |
| OTP | 4 or 6 boxes | Yes | Auto-read from SMS where the phone allows | 123456 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Get OTP | Sends SMS |
| Verify | First login → PA-03; later logins → PA-05 |

**Business rules**

- Unknown number: “This number is not registered. Ask your company to add you.”

- Blocked staff or expired licence / police verification: login allowed but no tasks; banner explains why.

- One active device per staff member; logging in on a new phone logs out the old one after sync (assumed).

**Prototype notes**

- Persona chips: Ravi (rider, SwiftCity), Basavaraj (driver, Deccan Roadlines), Pooja (hub staff, NCR CrossDock), Manju (rider, NK Express).

### PA-03 Permissions and profile check

| | |
|---|---|
| **Purpose** | Gets the phone permissions the work needs and shows the staff member their profile as registered by their company. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | First login; whenever a required permission is turned off |
| **Basis** | Assumed; needs camera (scan, photos), location (geo-tag, tracking) — source §5.1 |

**Permissions (one card each)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Camera | Allow button | Yes | For scanning and photos | Allowed |
| Location | Allow button | Yes | Precise; “while on duty” background for drivers | Allowed |
| Notifications | Allow button | Yes | New tasks, changes | Allowed |
| Phone calls | Allow button | No | For masked calling | Allowed |
| Battery optimisation off | Button | Recommended | Keeps tracking alive during trips | Done |

**Profile (read-only)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Photo, name, role, company, partner type | Card | — | | Ravi Kumar · Rider · SwiftCity Couriers (Type B) |
| Default vehicle | Text | — | | DL01LT4521 |
| Base location / hub | Text | — | | Okhla |
| Training status | Chip | — | Not started \| In progress \| Completed | In progress |

**Actions**

| **Action** | **What happens** |
|---|---|
| Continue | Home (PA-05); if training is not complete, prompts to start PA-10 |

**Business rules**

- The app does not let a staff member go on duty without camera and location permission.

### PA-04 Bottom navigation (app shell)

| | |
|---|---|
| **Purpose** | The frame around every screen after login. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | Always visible after login |
| **Basis** | Assumed; offline, sync and SOS from source §5.1 |

**Elements**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Top bar | Bar | — | Duty status, sync indicator (synced / pending N / offline), language switch, SOS button | On duty · 2 pending |
| Offline banner | Banner | — | “You are offline. Work is saved and will sync.” | — |
| Bottom tabs (rider) | Tabs | — | Home \| Tasks \| Scan \| My day \| More | — |
| Bottom tabs (driver) | Tabs | — | Home \| Trip \| Scan \| My day \| More | — |
| Bottom tabs (hub staff) | Tabs | — | Home \| Inbound \| Scan \| Outbound \| More | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Tap SOS | Opens PA-12 |
| Tap sync indicator | Opens the sync queue (PA-13) |

**Business rules**

- Touch targets at least 48 dp; large text; works on low-cost Android phones (source §5.1).

**Prototype notes**

- Rendered inside a phone frame (360 × 760 px) next to the other apps.

### PA-05 Home (today)

| | |
|---|---|
| **Purpose** | Start-of-day screen: go on duty, see today’s work at a glance and start the next task. |
| **Used by** | Rider, Driver, Hub staff (content by role) |
| **Opened from** | After login; Home tab |
| **Basis** | Source §5.1 (Receive Jobs, Assign to Field Staff) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Duty toggle | Large switch | Yes | Off duty \| On duty. Going on duty records time and location. | On duty since 09:02 |
| Next task card | Card | — | The most urgent task with its time window and a Start button | Pickup · Sharma Electricals · 14:00–16:00 |
| Today counts (rider) | Tiles | — | Pickups to do / done; deliveries to do / done; failed | Pickups 3/5 · Deliveries 0/0 |
| Today (driver) | Card | — | Current trip, lane, departure time | TRP-2026-0931 · Gurugram → Hubballi · 23:00 |
| Today (hub staff) | Tiles | — | Expected inbound, scanned, to sort, bags to close, outbound | Inbound 212 · scanned 188 |
| COD in hand | Amount | — | Riders doing deliveries | ₹0 |
| Messages from office | List | — | Notes from the partner admin | Use Gate 2 at Okhla |

**Actions**

| **Action** | **What happens** |
|---|---|
| Go on duty / off duty | Off duty is blocked while a task is in progress or COD is in hand (assumed) |
| Start | Opens the task |

### PA-06 Task list

| | |
|---|---|
| **Purpose** | All tasks assigned to the user today, grouped by state, in the order to do them. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | Tasks / Trip / Inbound tab |
| **Basis** | Source §5.1 |

**Tabs**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| To do \| In progress \| Done \| Failed | Tabs | — | Count on each tab | To do (4) |

**Task card**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Task type | Icon + label | — | Pickup \| Hand-over \| Trip \| Inbound \| Sort \| Manifest \| Outbound \| Delivery \| Reattempt \| Reverse pickup \| RTO | Pickup |
| Place | Text | — | Company / consignee name and area | Sharma Electricals, Okhla Ph II |
| Time window | Text + colour | — | Green / amber / red by SLA | 14:00–16:00 (amber) |
| Pieces | Text | — | | 6 pcs |
| Tags | Chips | — | COD ₹ \| Appointment \| Fragile \| E-way bill \| ODA | E-way bill |
| Distance | Text | — | From current location | 2.4 km |

**Actions**

| **Action** | **What happens** |
|---|---|
| Tap card | Opens the task detail |
| Navigate | Opens the phone’s maps app |
| Call | Masked call |

**Business rules**

- New or changed tasks appear at the top with a “New” or “Changed” badge and a sound.

**Prototype notes**

- Tasks appear when the partner admin assigns them in the Partner Portal.

### PA-07 Scanner (shared component)

| | |
|---|---|
| **Purpose** | Camera scanning used by every task: piece labels, bag / cage labels, seals and hand-over codes. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | Scan tab; any “Scan” button inside a task |
| **Basis** | Source §5.1 (scan pieces, scan out, bulk in-scan) |

**Elements**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Camera view | Viewfinder | — | Reads QR and barcodes; torch button | — |
| Counter | Large text | — | Scanned / expected | 4 / 6 |
| Last scan result | Banner | — | Green: OK \| Amber: already scanned \| Red: not part of this task | Piece 4/6 ✓ |
| Manual entry | Text | No | If a label is damaged: type the piece ID; needs a photo of the label (assumed) | LGS-DEL-000781-04 |
| Continuous mode | Toggle | — | Hub bulk scanning: camera stays open between scans | On (hub) |
| Missing list | List | — | Pieces expected but not yet scanned | 05, 06 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Done | Returns to the task with the scan list |
| Report missing | Marks remaining pieces as short with a reason |

**Business rules**

- Each scan gives a beep, vibration and a short voice prompt (“चार में से छह”, “Wrong piece”).

**Prototype notes**

- “Tap to scan” simulates the next expected label; a second button simulates a wrong label.

### PA-08 Notifications

| | |
|---|---|
| **Purpose** | List of task and office messages. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | Bell icon; push notification |
| **Basis** | Assumed (standard) |

**List**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Item | Row | — | New task \| Task changed (slot, address) \| Task removed \| Customer chose reattempt \| Office message \| Sync failed | New slot for LGS-DEL-000776: 27-Nov 11:00 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Tap | Opens the related task |

### PA-09 My day and performance

| | |
|---|---|
| **Purpose** | The staff member’s own summary: tasks done, on-time rate, scan compliance and COD in hand. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | My day tab |
| **Basis** | Assumed; KPIs from source §5.2 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Today | Tiles | — | Tasks done, on time %, failed, distance | 12 done · 92% on time |
| Scan & photo compliance | % | — | Hand-overs with all scans and photos | 100% |
| COD in hand (riders) | Amount | — | Links to PA-36 | ₹4,200 |
| This week | Bar chart | — | Tasks per day | — |
| Earnings (if the partner enables it) | Amount | — | Per-task earnings set by the partner company (assumed optional) | Hidden |

### PA-10 Training and practice mode

| | |
|---|---|
| **Purpose** | Short videos and a practice mode with dummy shipments for scan, hand-over, seal and e-POD, in Hindi and English. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | More → Training; prompted at first login |
| **Basis** | Source §4 Step 6 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Videos | List | — | How to scan \| Hand-over and seal \| Delivery and e-POD \| Failed delivery \| COD (role-specific set) | 4 videos, 2 watched |
| Practice tasks | List | — | Same screens as real tasks with a “Practice” watermark; nothing is sent to customers | Practice pickup ✓ |
| Status | Chip | — | Shown to the partner admin in the Partner Portal | In progress |

**Actions**

| **Action** | **What happens** |
|---|---|
| Start practice | Opens a practice task |
| Mark complete | After all practice tasks pass |

**Prototype notes**

- Practice tasks reuse the real screens with dummy data.

### PA-11 AI assistant

| | |
|---|---|
| **Purpose** | Answers “how do I…” questions inside the app, by voice or text, in Hindi or English. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | More → Help; mic button on Home |
| **Basis** | Source §4 Step 6; §12 (AI assistant) |

**Panel**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Ask | Mic (push to talk) + text | — | | OTP नहीं आ रहा, क्या करूँ? |
| Quick questions | Chips | — | Customer not answering \| Label is torn \| Seal number wrong \| Scale not working | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Ask | Spoken and written answer with steps |

**Business rules**

- The assistant guides only; it cannot complete a delivery or change COD.

**Prototype notes**

- Scripted answers for about 10 common questions.

### PA-12 SOS and report a problem

| | |
|---|---|
| **Purpose** | Emergency button and quick problem reporting. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | SOS button in the top bar |
| **Basis** | Source §5.1 (SOS button) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| SOS | Hold-to-activate button (3 seconds) | — | Shares live location with the partner admin and Logisco Control Tower and calls the emergency contact | — |
| Emergency type | Chips | No | Accident \| Theft / robbery \| Medical \| Threat \| Other | Accident |
| Report a problem (non-emergency) | Form | — | Vehicle breakdown \| Phone / app issue \| Road blocked \| Other; photo; note | Vehicle breakdown |

**Actions**

| **Action** | **What happens** |
|---|---|
| Hold SOS | Alert sent; screen shows “Help is being contacted” and keeps sharing location |
| Cancel SOS | Within 10 seconds (assumed) |

**Business rules**

- SOS works offline by falling back to SMS and a phone call (assumed).

**Prototype notes**

- SOS raises an alert card in the ERP Control Tower and Partner Portal.

### PA-13 Settings and sync queue

| | |
|---|---|
| **Purpose** | Language, voice, and the list of work saved on the phone that has not yet reached the server. |
| **Used by** | Rider, Driver, Hub staff |
| **Opened from** | More → Settings; sync indicator |
| **Basis** | Source §5.1 (works offline, syncs when connected) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Language / voice prompts | Dropdown / toggle | — | | हिन्दी · On |
| Sync queue | List | — | Each pending item: task, event, photos count, saved at, status (Waiting \| Sending \| Failed) | Pickup scan · 4 photos · Waiting |
| Sync now | Button | — | | — |
| Storage used by photos | Text | — | Synced photos are cleared after 7 days (assumed) | 84 MB |
| App version / log out | Text / button | — | Log out blocked while items are pending | v1.0.0 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Sync now | Retries all pending items |

**Business rules**

- Every event keeps the time and location of when it happened, not when it synced.

**Prototype notes**

- A demo-toolbar “Go offline” switch fills the queue; switching back online drains it.

## 6.2 Rider: pickup (first mile)

### PA-14 Pickup task detail

| | |
|---|---|
| **Purpose** | Everything the rider needs before reaching the shipper. |
| **Used by** | Rider (Types A, B, C) |
| **Opened from** | Task list |
| **Basis** | Source §5.1 (Pickup); §7 Step 4 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Shipper and address | Card + map | — | Pickup location, landmark, map pin | Sharma Electricals, Plot 42, Okhla Ph II |
| Contact | Masked call button | — | | Ramesh Kumar |
| Window | Text | — | | 14:00–16:00 |
| Shipments and pieces | List | — | One or more LRs at this address; pieces and booked weight per LR | LGS-DEL-000781 · 6 pcs · 120 kg |
| Instructions | Text | — | From the booking or office | Use Gate 2 |
| Requirements | Chips | — | Invoice copy \| E-way bill \| Fragile \| Labels to attach | E-way bill · Labels printed by shipper |
| Hand to | Text | — | Where the pickup goes next | NCR CrossDock, Gurugram by 21:00 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Navigate | Maps app |
| Call | Masked call |
| I’ve arrived | Checks location is within 200 m of the pin (assumed), then opens PA-15 |

**Business rules**

- “I’ve arrived” outside the radius asks for a reason and a photo (assumed).

### PA-15 Pickup scan and documents

| | |
|---|---|
| **Purpose** | Rider scans every piece, attaches labels if needed and collects the invoice copy. |
| **Used by** | Rider |
| **Opened from** | PA-14 → I’ve arrived |
| **Basis** | Source §5.1 (scan pieces, attach label, collect invoice copy) |

**Steps on screen**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| 1\. Labels | Radio | Yes | Shipper has labelled the pieces \| I will attach labels (scan each blank label as you stick it) | Shipper labelled |
| 2\. Scan pieces | Scanner (PA-07) | Yes | All expected pieces; counter must reach the total | 6 / 6 |
| 3\. Invoice copy | Photo | Yes | Photo of each invoice; auto-cropped | 1 photo |
| 4\. E-way bill | Check | Cond. | Shown if required: confirm the EWB number printed on the documents matches | ✓ Matches |
| 5\. Package condition | Radio + photo | Yes | All good \| Damaged packaging (photo required) | All good |

**Actions**

| **Action** | **What happens** |
|---|---|
| Next | Opens weight capture (PA-16) |
| Cannot pick up | Opens PA-18 |

**Business rules**

- The rider cannot continue with fewer pieces than booked unless the shipper confirms a short pickup (assumed: the booking is updated).

### PA-16 Weight and dimensions

| | |
|---|---|
| **Purpose** | Rider records actual weight and dimensions with photo evidence. Differences from the booking trigger a weight revision for the customer. |
| **Used by** | Rider |
| **Opened from** | After PA-15 |
| **Basis** | Source §5.1 (photo of weight and dimensions); §7 Step 4; §12 (Weight & Dimension Checks) |

**Per piece (or per group of identical pieces)**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Weight (kg) | Number (decimal) | Yes | From a scale; Bluetooth scale reading where available (source §13) | 20.5 |
| Scale photo | Photo | Yes | Must show the display and the piece label | photo |
| L × B × H (cm) | 3 numbers | Yes | Pre-filled from booking; rider edits if different | 60 × 40 × 40 |
| Tape photo | Photo | Cond. | Required if dimensions differ from the booking | — |
| Same for all remaining pieces | Checkbox | No | Copies values to identical pieces (photo still needed for one) | Ticked |

**Result**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Booked vs verified | Card | — | Actual, volumetric / CFT and chargeable weight, booked vs now | Booked 162 kg · Verified 162 kg ✓ |
| Difference flag | Banner | — | Shown when outside tolerance: “Customer will be asked to accept the new weight.” | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Next | Opens PA-17 |

**Business rules**

- Tolerance: differences up to 3% or 0.5 kg (whichever is higher) are ignored (assumed).

- AI checks the photos and numbers and flags likely errors or fraud (source §12).

- If the SKU weight is frozen in the customer’s SKU master, the frozen value is shown for reference.

**Prototype notes**

- A demo button “Measure larger” sets two boxes bigger so the chargeable weight becomes 170 kg and a weight revision appears in the Customer Portal.

### PA-17 Pickup confirmation

| | |
|---|---|
| **Purpose** | Rider and shipper confirm the pickup; the shipment becomes Picked Up. |
| **Used by** | Rider |
| **Opened from** | After PA-16 |
| **Basis** | Source §5.1; §7 Step 4 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Summary | Card | — | LRs, pieces, verified chargeable weight, photos taken | 1 LR · 6 pcs · 162 kg · 9 photos |
| Handed over by | Text | Yes | Shipper staff name | Ramesh Kumar |
| Shipper confirmation | Signature pad or OTP | Yes | Signature on screen, or OTP sent to the pickup contact (assumed) | Signature |

**Actions**

| **Action** | **What happens** |
|---|---|
| Confirm pickup | Status → Picked Up; geo-tag and time saved; the next task (hand-over at hub) appears |

**Business rules**

- Liability for the goods moves to the rider’s company at this moment (chain of custody, source §2.2).

**Prototype notes**

- Confirming updates the Customer Portal tracking and ERP Control Tower immediately.

### PA-18 Pickup failed

| | |
|---|---|
| **Purpose** | Records why a pickup could not happen. |
| **Used by** | Rider |
| **Opened from** | PA-14 or PA-15 → Cannot pick up |
| **Basis** | Assumed (pickup missed is an exception in source §10) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Reason | Large buttons | Yes | Goods not ready \| Shipper closed \| Shipper refused \| Documents missing (invoice / e-way bill) \| Address wrong \| Vehicle too small \| Other | Goods not ready |
| Photo | Photo | Yes | Of the location or the problem | photo |
| Note | Text / voice note | No | | Ready at 17:00 |
| Called shipper | Auto | — | App checks a masked call was made in the last 15 minutes (assumed) | ✓ |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit | Task → Failed; Logisco desk and partner office alerted; Control Tower may reassign within 2 hours (source §10) |

## 6.3 Hand-over (all roles)

### PA-19 Hand over (give)

| | |
|---|---|
| **Purpose** | Scans goods out to the next partner. The hand-over is complete only when the receiver confirms on their phone. |
| **Used by** | Rider (to origin hub), Hub staff (to driver or rider), Driver (to destination hub) |
| **Opened from** | Hand-over task; end of PA-17, PA-24, PA-29 |
| **Basis** | Source §5.1 (Hand-Over: scan out with seal and vehicle number; both sides confirm) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hand over to | Read-only | — | Next partner and place | NCR CrossDock, Gurugram |
| Items | Scanner | Yes | Pieces (rider) or bags / cages (hub, driver) | 6 / 6 pieces |
| Seal number(s) | Scan or type | Cond. | Required for sealed bags and trucks | SL-44817 |
| Vehicle number | Pre-filled | Cond. | Required when goods go onto a vehicle | KA25AB1234 |
| Photo | Photo | Yes | Goods at hand-over / sealed door | photo |
| Hand-over code | QR + 6-digit code | — | Shown for the receiver to scan, or read out | QR · 418 552 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Show code | Receiver scans it on PA-20 |
| Waiting | Screen waits for the receiver’s confirmation; works offline by exchanging codes (assumed) |

**Business rules**

- Liability moves only when the receiver confirms (source §2.2).

**Prototype notes**

- The receiver persona can be opened in a second phone frame to complete the hand-over.

### PA-20 Receive hand-over (take)

| | |
|---|---|
| **Purpose** | The receiving partner checks count, seals and condition and accepts the goods, recording any exception. |
| **Used by** | Hub staff (from rider or driver), Driver (from hub), Rider (from destination hub) |
| **Opened from** | Receive task; Scan tab → scan hand-over QR |
| **Basis** | Source §5.1; §7 Steps 5–7 (seal check; short / excess flagged instantly) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Hand-over code | Scan QR or type | Yes | From the giver’s screen | 418 552 |
| Count | Scanner | Yes | Received / expected | 6 / 6 |
| Seal check | Per seal: match Y/N + photo | Cond. | Mismatch or broken seal is an exception | SL-44817 ✓ intact |
| Condition | Radio | Yes | All good \| Damaged (select pieces, photos) \| Short (auto from count) \| Excess (auto) | All good |

**Actions**

| **Action** | **What happens** |
|---|---|
| Accept | Both sides’ screens show “Handed over”; leg status updates |
| Accept with exception | Accepts and raises an exception ticket automatically with the photos |

**Business rules**

- A seal mismatch or short count puts the goods on hold and opens an investigation on the previous leg within 4 hours (source §10).

## 6.4 Driver: line-haul

### PA-21 Trip detail

| | |
|---|---|
| **Purpose** | The driver’s trip: lane, timings, load, seals and documents. |
| **Used by** | Driver (Types A, D, E) |
| **Opened from** | Trip tab |
| **Basis** | Source §5.1 (Line-Haul Trip); §7 Step 6 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Trip | Header | — | | TRP-2026-0931 · Gurugram hub → Hubballi hub |
| Departure / ETA | Text | — | | 23-Nov 23:00 / 25-Nov 03:00 |
| Truck | Text | — | Assigned in Partner Portal | KA25AB1234 · 19–24 ft |
| Load | Text + list | — | Shipments, bags, weight; manifest view | 38 shipments · 12 bags · 4,120 kg |
| Seals | List | — | Seal numbers expected on the truck door / bags | SL-44817 … SL-44822 |
| E-way bills | List | — | Count and validity; Part B status | 31 EWBs · Part B pending |
| Route | Map | — | Planned route and stops | Via NH44 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Receive load | Opens PA-20 at the origin hub |
| Start trip | Opens PA-22 |

### PA-22 Start trip

| | |
|---|---|
| **Purpose** | Driver confirms vehicle and seals and starts the trip; tracking begins. |
| **Used by** | Driver |
| **Opened from** | PA-21 → Start trip |
| **Basis** | Source §5.1 (Start trip, GPS / FASTag); §7 Step 6 (e-way bill Part B) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Vehicle number | Scan number plate or confirm | Yes | Must match the assigned truck | KA25AB1234 ✓ |
| Seal numbers on door | Scan / type each | Yes | Must match the manifest | SL-44817 ✓ |
| Sealed door photo | Photo | Yes | | photo |
| Odometer reading | Number | No | Assumed | 184,220 km |
| Co-driver | Read-only | — | | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Start trip | Status → In Transit for all shipments; GPS tracking on; e-way bill Part B updated with the vehicle number |

**Business rules**

- A different vehicle number than assigned blocks the start until the office updates it (prompts an e-way bill Part B change).

### PA-23 Trip in progress

| | |
|---|---|
| **Purpose** | Live trip view with ETA and quick reporting of halts and breakdowns. |
| **Used by** | Driver |
| **Opened from** | After PA-22; Trip tab |
| **Basis** | Source §5.1 (report halts or breakdowns) |

**Content and reports**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Map and progress | Map | — | Current position, distance covered / remaining, next checkpoint | 1,020 of 1,880 km |
| ETA | Text | — | Updated by Logisco’s delay prediction | 25-Nov 05:30 (revised) |
| Report halt | Big button → reason | — | Rest / meal \| Traffic \| Police / RTO check \| Loading at stop \| Other; expected duration | Traffic · 3 h |
| Report breakdown | Big button → form | — | Issue, photos, location auto, need backup vehicle Y/N | — |
| E-way bill alerts | Banner | — | Shown if any EWB is near expiry; Logisco extends it | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Report | Sent to Partner Portal (PP-16) and Logisco Control Tower |
| I’ve arrived | Opens PA-24 when within the destination hub geo-fence |

**Business rules**

- The app sends location every 2 minutes on the move and stores points offline (assumed); FASTag toll reads fill gaps (source §13).

**Prototype notes**

- The truck marker moves along a preset route; the demo toolbar can trigger a 3-hour halt.

### PA-24 Arrival and seal check

| | |
|---|---|
| **Purpose** | Driver arrives at the destination hub; seals are checked in front of hub staff before unloading. |
| **Used by** | Driver |
| **Opened from** | PA-23 → I’ve arrived |
| **Basis** | Source §5.1 (arrival with seal check); §7 Step 7 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Arrival time and location | Auto | — | | 25-Nov 05:10 · Hubballi hub |
| Seal intact? | Per seal: Yes / No + photo | Yes | | SL-44817 Yes |
| Odometer reading | Number | No | | 186,104 km |

**Actions**

| **Action** | **What happens** |
|---|---|
| Hand over to hub | Opens PA-19 (give); hub staff receive on PA-20 |

**Business rules**

- A broken seal is recorded before unloading so liability is clear (source §10).

## 6.5 Hub staff: hub operations

### PA-25 Hub home (shift view)

| | |
|---|---|
| **Purpose** | What the hub is expecting and what is waiting at each stage, for the staff member’s shift. |
| **Used by** | Hub staff (Types B with hub, E, F) |
| **Opened from** | Home tab (hub staff) |
| **Basis** | Source §5.1 (Hub Operations) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Shift | Text | — | | Gurugram hub · 18:00–02:00 |
| Inbound expected | List | — | Riders and trucks due, with ETA and pieces | SwiftCity · Ravi · 6 pcs · 19:00 |
| Stage tiles | Tiles | — | To in-scan \| To sort \| Bags open \| Bags to seal \| To dispatch \| Exceptions | To sort: 28 |
| Outbound departures | List | — | Trucks leaving, destination, cut-off | Hubballi · 23:00 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Tap a tile | Opens that stage |

### PA-26 Bulk in-scan

| | |
|---|---|
| **Purpose** | Fast continuous scanning of everything arriving at the hub, with expected-vs-scanned tracking. |
| **Used by** | Hub staff |
| **Opened from** | Inbound tab; after PA-20 |
| **Basis** | Source §5.1 (bulk in-scan); §13 (weighing scales / dimensioners) |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Source | Dropdown | Yes | Arriving rider / truck / manifest | Ravi · SwiftCity |
| Scan | Continuous scanner | Yes | Pieces or bags | 188 / 212 |
| Hub weight check | Number + photo | No | Optional re-weigh on the hub scale; flags differences from pickup weight (assumed) | — |
| Unexpected item | Alert | — | Item not on any inbound list → excess | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Finish inbound | Remaining expected items marked short with reason; exception raised |

**Business rules**

- In-scan sets the shipment to At Origin Hub or At Destination Hub.

### PA-27 Sort to bag / cage

| | |
|---|---|
| **Purpose** | Scan a piece and the app shows which destination bag or cage it goes in. |
| **Used by** | Hub staff |
| **Opened from** | Sort tile |
| **Basis** | Source §5.1 (sort to destination bags / cages) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Scan piece | Scanner | Yes | | LGS-DEL-000781-01 |
| Destination | Very large text + colour | — | Bag / cage number and destination | BAG 07 · HUBBALLI (blue) |
| Confirm placement | Scan bag label | Yes | Wrong bag → red alert and voice “गलत बैग” | BAG 07 ✓ |

**Actions**

| **Action** | **What happens** |
|---|---|
| Next piece | Ready for the next scan |

### PA-28 Close bag, manifest and seal

| | |
|---|---|
| **Purpose** | Close a bag or cage, record its seal and add it to a manifest for a vehicle. |
| **Used by** | Hub staff |
| **Opened from** | Bags tile |
| **Basis** | Source §5.1 (manifest, out-scan, seal); §7 Step 5 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Bag / cage | Scan | Yes | | BAG 07 |
| Contents | List | — | Pieces in the bag; remove by scanning again | 38 pieces |
| Seal number | Scan or type | Yes | Format SL-##### | SL-44817 |
| Bag weight | Number | No | From the hub scale | 342 kg |
| Photo of sealed bag | Photo | Yes | | photo |
| Manifest | Dropdown / new | Yes | Add to an open manifest for a destination and vehicle | MAN-GGN-1123 · Hubballi |

**Actions**

| **Action** | **What happens** |
|---|---|
| Seal and add | Bag status Sealed; manifest updated |
| Print manifest | Sends to the hub printer (assumed) or shares PDF |

### PA-29 Out-scan and dispatch

| | |
|---|---|
| **Purpose** | Load sealed bags onto the vehicle and hand over to the driver. |
| **Used by** | Hub staff |
| **Opened from** | Outbound tab |
| **Basis** | Source §5.1 (out-scan, seal); §7 Step 6 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Manifest | Dropdown | Yes | | MAN-GGN-1123 |
| Vehicle | Scan plate / confirm | Yes | Must match the trip | KA25AB1234 |
| Scan bags onto vehicle | Scanner | Yes | | 12 / 12 |
| Door seal | Scan / type | Yes | | SL-44822 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Hand over to driver | Opens PA-19; driver accepts on PA-20 |

**Business rules**

- Departure after the cut-off raises an SLA-risk alert (assumed).

### PA-30 Short, excess and damage report

| | |
|---|---|
| **Purpose** | Report missing, extra or damaged pieces found in the hub, with photos. |
| **Used by** | Hub staff (riders and drivers use the same form from PA-20) |
| **Opened from** | Exceptions tile; PA-20; PA-26 |
| **Basis** | Source §7 Step 7; §10 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Type | Buttons | Yes | Short \| Excess \| Damaged \| Seal mismatch | Short |
| Piece / bag | Scan or pick | Yes | | LGS-DEL-000769-04 |
| Photos | Photos (up to 5) | Yes | | 3 photos |
| Note | Text / voice | No | | Bag seal intact, 5 of 6 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit | Exception ticket in Logisco ERP and the Partner Portal; shipment on hold if needed |

## 6.6 Rider: delivery (last mile)

### PA-31 Delivery run

| | |
|---|---|
| **Purpose** | The rider’s deliveries for the day in a suggested order, with appointment slots. |
| **Used by** | Rider (Types A, B, C) |
| **Opened from** | Tasks tab (delivery tasks) |
| **Basis** | Source §5.1 (Delivery); §7 Step 8 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Load check | Scanner | Yes | Scan all pieces at the destination hub before leaving (receive on PA-20) | 34 / 34 |
| Stops | Ordered list + map | — | Order by appointment slot then distance; drag to reorder (route optimisation is Phase 3, source §12) | 8 stops |
| Stop card | Card | — | Consignee, area, slot, pieces, COD, tags | Hubli Electric · 11:00–13:00 · 6 pcs |

**Actions**

| **Action** | **What happens** |
|---|---|
| Start run | All shipments → Out for Delivery; consignees get a delivery window message |
| Open stop | PA-32 |

### PA-32 Delivery stop detail

| | |
|---|---|
| **Purpose** | Details for one delivery: consignee, slot, gate pass, COD and contact. |
| **Used by** | Rider |
| **Opened from** | PA-31 |
| **Basis** | Source §5.1 (masked call, appointment check); §7 Step 8 |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Consignee | Card + map | — | Name, address, landmark | Hubli Electric Distributors, APMC Yard |
| Contact | Masked call | — | | Mahesh Patil |
| Appointment | Text | — | Slot, dock / gate, gate pass (view) | 11:00–13:00 · Dock 2 · gate pass ✓ |
| Pieces | List | — | | 6 pcs |
| COD | Amount | — | Large, highlighted if COD | — |
| Instructions | Text | — | | Call before arriving |

**Actions**

| **Action** | **What happens** |
|---|---|
| Navigate | Maps app |
| Call | Masked call |
| I’ve arrived | Geo-check, then PA-33 |
| Cannot deliver | PA-35 |

**Business rules**

- An appointment shipment cannot be marked delivered outside the slot without office approval (assumed).

### PA-33 Deliver and capture e-POD

| | |
|---|---|
| **Purpose** | Hands over the goods and captures proof of delivery: piece scan, OTP or signature, photo, geo-tag, GRN and any short or damaged pieces. |
| **Used by** | Rider |
| **Opened from** | PA-32 → I’ve arrived |
| **Basis** | Source §5.1 (Delivery); §7 Step 9 |

**Steps on screen**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| 1\. Scan pieces delivered | Scanner | Yes | Counter to total | 6 / 6 |
| 2\. Piece condition | Per piece: OK / Short / Damaged + photo | Yes | Damaged and short need photos and a remark | All OK |
| 3\. Received by | Text | Yes | Name of the person receiving | Mahesh Patil |
| 4\. Verification | OTP or e-signature | Yes | OTP sent to the consignee mobile; e-signature if OTP fails | OTP ✓ |
| 5\. GRN number | Text | Cond. | For B2B consignees that issue a GRN | GRN-HED-55120 |
| 6\. Delivery photo | Photo | Yes | Goods at the delivery point | photo |
| Geo-tag and time | Auto | — | | 15.36°N 75.12°E · 11:12 |

**Actions**

| **Action** | **What happens** |
|---|---|
| Collect COD | Shown if COD → PA-34 |
| Complete delivery | Status → Delivered (or Delivered with Exception); e-POD sent to the shipper |

**Business rules**

- OTP is 4 digits and expires at end of day (assumed). Offline: OTP checked against a code stored on the phone when the run started (assumed).

**Prototype notes**

- Completing shows Delivered in the Customer Portal and Control Tower immediately.

### PA-34 COD collection

| | |
|---|---|
| **Purpose** | Collects the cash-on-delivery amount before completing delivery. |
| **Used by** | Rider |
| **Opened from** | PA-33 → Collect COD |
| **Basis** | Source §5.1 (COD collection); §9 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Amount due | Read-only, large | — | | ₹4,200 |
| Mode | Buttons | Yes | Cash \| UPI (QR shown on phone) (UPI assumed) | Cash |
| Amount received | Number | Yes | Must equal the amount due | ₹4,200 |
| UPI reference | Auto | Cond. | For UPI | — |

**Actions**

| **Action** | **What happens** |
|---|---|
| Confirm collected | COD marked collected; receipt sent to the consignee by SMS |

**Business rules**

- Partial COD is not allowed; the rider marks a failed delivery with reason “COD amount not ready” (assumed).

### PA-35 Failed delivery (NDR)

| | |
|---|---|
| **Purpose** | Records why a delivery failed, with a location photo; the customer then chooses what happens next. |
| **Used by** | Rider |
| **Opened from** | PA-32 or PA-33 → Cannot deliver |
| **Basis** | Source §5.1 (NDR: reason code + photo of location); §7 Step 10 |

**Fields**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Reason | Large buttons | Yes | Consignee not available \| Premises closed \| Refused \| Address incomplete \| Appointment not available \| COD amount not ready \| Other | Premises closed |
| Location photo | Photo | Yes | | photo |
| Called consignee | Auto check | Yes | Masked call log in the last 15 minutes (assumed) | ✓ 11:03 |
| Note | Text / voice | No | | Shutter down |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit | Shipment → Undelivered (NDR); shipper and consignee get WhatsApp buttons; the customer’s choice comes back as a reattempt task or RTO |

**Business rules**

- An NDR without a call log or location photo cannot be submitted, to prevent fake attempts (assumed).

**Prototype notes**

- Seed shipment LGS-DEL-000776 uses this flow.

### PA-36 COD in hand and deposit

| | |
|---|---|
| **Purpose** | Shows cash collected and records hand-over of the cash to the partner office or bank within 24 hours. |
| **Used by** | Rider |
| **Opened from** | My day → COD; Home banner |
| **Basis** | Source §9 (COD deposited within 24 hours) |

**Content**

| **Field** | **Type** | **Req.** | **Rules / options** | **Sample (demo)** |
|---|---|---|---|---|
| Cash in hand | Amount | — | Per LR | ₹4,200 (1 LR) |
| Deposit to | Radio | Yes | Partner office cashier \| Bank (slip photo) | Partner office |
| Amount | Number | Yes | | ₹4,200 |
| Cashier confirmation / slip | OTP from cashier or photo | Yes | | OTP ✓ |

**Actions**

| **Action** | **What happens** |
|---|---|
| Submit deposit | COD moves from rider to partner; visible in Partner Portal PP-28 |

**Business rules**

- Going off duty is blocked while COD is in hand, unless the office allows overnight holding (assumed).

# 7. Business Rules

## 7.1 What every chain-of-custody event records

Each scan, hand-over, trip event, delivery and failure is saved as one event record. Liability moves with the shipment at each confirmed hand-over (source §2.2), and claims use these records to find the leg at fault (source §10).

| **Data** | **Captured how** |
|---|---|
| Event type | Pickup, hand-over give / receive, in-scan, sort, bag seal, out-scan, trip start / halt / arrival, delivery, failed attempt |
| Who | Staff ID, role, partner company |
| When | Phone time at the moment of the event (not sync time); checked against server time on sync |
| Where | GPS latitude / longitude and accuracy |
| What | Shipment LR, piece IDs, bag IDs, counts |
| Seal and vehicle | Seal numbers and vehicle number where relevant |
| Evidence | Photos (compressed), signature, OTP result, GRN |
| Counterpart | For hand-overs: the receiving staff member and partner |

## 7.2 Parameters used in this specification

| **Parameter** | **Value used** | **Basis** |
|---|---|---|
| Arrival geo-fence | 200 m from the pin | Assumed |
| Weight tolerance before a revision | 3% or 0.5 kg, whichever is higher | Assumed |
| Delivery OTP | 4 digits; valid until end of day | Assumed |
| Call before NDR / failed pickup | Masked call within the last 15 minutes | Assumed |
| Location ping while driving | Every 2 minutes; stored offline | Assumed |
| SOS cancel window | 10 seconds | Assumed |
| Photo size after compression | About 200 KB | Assumed |
| Synced photo retention on phone | 7 days | Assumed |
| COD deposit deadline | 24 hours from collection | Source §9 |
| Pickup reassignment after a missed pickup | Within 2 hours (Logisco action) | Source §10 |
| Seal / short investigation | Within 4 hours (Logisco action) | Source §10 |

## 7.3 Offline behaviour

| **Works fully offline** | **Needs the network (queued until online)** |
|---|---|
| Task list already downloaded; scanning; photos; weight entry; hand-over by code exchange; delivery with OTP checked against the code stored on the phone; e-signature; failed delivery; COD record; SOS by SMS / call | New task downloads; masked calls; sending OTP to a consignee who has not received it; weight revision reaching the customer; live map on the office side; AI assistant (scripted help still works offline) |

- The top bar always shows the sync state; the sync queue (PA-13) lists every pending item.

- If two phones record conflicting hand-overs offline, the server keeps both and opens an exception for the Logisco desk (assumed).

## 7.4 Weight verification

At pickup the rider records actual weight and dimensions with photos (source §5.1). The app works out the verified chargeable weight in the same way as the quote: Parcel uses the higher of actual and volumetric weight; PTL uses the higher of actual and CFT weight, with the minimum chargeable weight (source §8.1). If the difference is outside the tolerance, the customer is asked to accept the revised rate or dispute it, with the rider’s photos as evidence (source §7 Step 4).

Example: LGS-DEL-000781 was booked at 162 kg chargeable. If the rider measures two of the six boxes larger and the verified chargeable weight becomes 170 kg (8 kg or about 4.9% higher, which is above the 3% tolerance), the Customer Portal shows a weight revision of + ₹145.38.

## 7.5 Reverse pickups and returns

- Reverse pickup: uses the pickup screens (PA-14 to PA-17) with a “Reverse” label; the consignee is the person handing over (source §2.1 lists reverse pickup as a service; flow assumed).

- RTO: uses the delivery screens with the shipper as the receiver and “RTO” on every card (assumed).

# 8. App Events and Status Mapping

Each app event updates the leg status (Partner Portal) and the shipment status the customer sees (Customer Portal). Partner status codes always map to the one customer status list (source §7.1).

| **App event (screen)** | **Leg status** | **Shipment status shown to customer** |
|---|---|---|
| Pickup confirmed (PA-17) | In progress | Picked Up |
| Pickup failed (PA-18) | Exception | Booked (pickup rescheduled) |
| Hand-over received at origin hub (PA-20) / in-scan (PA-26) | Handed over (leg 1); In progress (leg 2) | At Origin Hub |
| Bag sealed, manifested (PA-28) | In progress | At Origin Hub |
| Trip started (PA-22) | In progress (leg 3) | In Transit |
| Halt / breakdown reported (PA-23) | Exception if ETA at risk | In Transit (ETA may be revised) |
| Arrival and hand-over at destination hub (PA-24, PA-20) | Handed over (leg 3); In progress (leg 4) | At Destination Hub |
| Run started (PA-31) | In progress (leg 5) | Out for Delivery |
| Delivered (PA-33) | Delivered | Delivered or Delivered with Exception |
| Failed delivery (PA-35) | Failed attempt | Undelivered (NDR) |
| Seal mismatch / short / damage (PA-20, PA-30) | Exception | Status unchanged; exception shown; may become Delivered with Exception |

# 9. Notifications and Voice Prompts

## 9.1 Push notifications

| **Event** | **Sent to** | **Message** |
|---|---|---|
| New task assigned | Staff member | New pickup at Sharma Electricals, 14:00–16:00 |
| Task changed | Staff member | Slot / address / instructions changed, with what changed |
| Task removed or reassigned | Staff member | Task removed by office |
| Customer chose reattempt / new slot / RTO | Last-mile rider | Reattempt LGS-DEL-000776 on 27-Nov, 11:00–13:00 |
| SLA at risk | Staff member | Pickup window ends in 30 minutes |
| Office message | Staff member | Free text from partner admin |
| Sync failed for over 30 minutes | Staff member | Some work is not uploaded; connect to the internet |
| COD deposit due | Rider | Deposit ₹4,200 by 09:40 tomorrow |

## 9.2 Voice prompts (examples)

| **Moment** | **Hindi prompt** | **English prompt** |
|---|---|---|
| Scan OK | छह में से चार | Four of six |
| Wrong item | यह इस काम का पैकेट नहीं है | This piece is not part of this task |
| Already scanned | पहले ही स्कैन हो चुका है | Already scanned |
| Wrong bag | गलत बैग | Wrong bag |
| Photo needed | वज़न की फ़ोटो लें | Take a photo of the weight |
| Hand-over done | हैंडओवर पूरा हुआ | Hand-over complete |
| Delivered | डिलीवरी पूरी हुई | Delivery complete |

# 10. Device and Technical Requirements

The source asks for an app that runs on low-cost Android phones and works offline (§5.1). The figures below are proposed targets.

| **Item** | **Target (assumed)** |
|---|---|
| Android version | Android 9 or later |
| Phone | 2 GB RAM, 16 GB storage, 8 MP autofocus camera, GPS |
| App size | Under 30 MB install |
| Data use | Photos compressed to about 200 KB; sync in the background |
| Scanning | QR and 1D barcodes through the camera; external Bluetooth scanners supported |
| Scales and dimensioners | Bluetooth scale readings where available (source §13); manual entry with photo otherwise |
| Location | Foreground location for riders and hub staff; background location for drivers while on a trip |
| Calling | Masked calls through the telephony provider (source §13) |
| Security | OTP login, device binding, encrypted local storage, auto-logout after 12 hours off duty |

# 11. Prototype Implementation Notes

## 11.1 Personas

| **Persona** | **Partner** | **Opens on** |
|---|---|---|
| Ravi Kumar, rider | SwiftCity Couriers (B) | Pickup task for LGS-DEL-000781 |
| Pooja S., hub staff | NCR CrossDock (F), Gurugram | Hub home with Ravi’s inbound expected |
| Basavaraj H., driver | Deccan Roadlines (E) | Trip TRP-2026-0931 |
| Manju R., rider | NK Express (B), Hubballi | Delivery run including LGS-DEL-000781 and the NDR shipment LGS-DEL-000776 |

## 11.2 What is simulated

| **Real feature** | **In the prototype** |
|---|---|
| Camera scanning | “Tap to scan” returns the next expected label; a second button returns a wrong one |
| Photos | Sample images inserted with a shutter animation |
| GPS and geo-fence | Fixed coordinates per stop; “I’ve arrived” always passes unless the demo toolbar forces a failure |
| OTP and masked calls | OTP 123456 (delivery OTP 1234); calls show a mock call screen |
| Offline | Demo toolbar “Go offline” fills the sync queue; “Go online” drains it with a short delay per item |
| Voice prompts | Browser speech synthesis in Hindi or English |
| Two phones at a hand-over | Two phone frames side by side, or switch persona to receive |

## 11.3 Cross-app moments to show in a demo

| **Do this in the Partner App** | **Then show it in** |
|---|---|
| Ravi confirms pickup | Customer Portal tracking (Picked Up); Partner Portal live board |
| Ravi uses “Measure larger” | Customer Portal weight revision + ₹145.38 |
| Basavaraj reports a 3-hour halt | ERP Control Tower amber SLA timer; customer ETA revised |
| Manju submits a failed delivery | Customer Portal NDR buttons; after the customer picks a new slot, the reattempt task returns to Manju |
| Pooja reports a short piece | ERP exception and claim evidence; Partner Portal escalation for the previous leg |
| Any persona holds SOS | Alert in ERP Control Tower and Partner Portal |

# 12. Assumptions and Open Questions

| **\#** | **Topic** | **What the source says / gap** | **Assumption in this specification** |
|---|---|---|---|
| 1 | Hub app | Type F uses a “hub scanning app” (§3) | Hub mode of the same Partner App, not a separate app |
| 2 | Shipper confirmation at pickup | Not defined | Shipper staff signs on screen or gives an OTP |
| 3 | Labels | Rider can “attach label” (§5.1) | Shipper normally prints labels; rider carries blank QR labels and links them by scanning |
| 4 | Delivery OTP offline | OTP or signature (§5.1) | OTP code stored on the phone at run start; e-signature fallback |
| 5 | Weight tolerance | Not defined | 3% or 0.5 kg |
| 6 | Geo-fence and call-before-NDR rules | Not defined | 200 m; masked call within 15 minutes; photo mandatory |
| 7 | COD by UPI | Only “COD collection” (§5.1) | Cash or UPI QR |
| 8 | Rider earnings in the app | Not defined | Optional, switched on by the partner company |
| 9 | Hand-over between two phones offline | Both sides confirm (§5.1) | Exchange of a QR / 6-digit code works without network |
| 10 | Reverse pickup and RTO screens | Services named (§2.1), flows not described | Reuse pickup and delivery screens with labels |
| 11 | Devices | Low-cost Android (§5.1) | Android 9+, 2 GB RAM; no iOS |
| 12 | Staff with two roles | Not defined | One role per staff member; Rider covers both pickup and delivery |
| 13 | Odometer, face check at duty start | Not mentioned | Odometer optional for drivers; no face check |

# Appendix A. Glossary

| **Term** | **Meaning** |
|---|---|
| **Bag / cage** | Container used at a hub to group pieces going to the same destination |
| **Chain of custody** | Record of who held each piece at every moment, built from hand-over scans with photo and seal |
| **CFT** | Cubic feet; used to work out the chargeable weight of PTL shipments |
| **e-POD** | Electronic proof of delivery: OTP or signature, photo, geo-tag, GRN |
| **Geo-fence** | Circle around an address; the app checks the staff member is inside it |
| **GRN** | Goods receipt note issued by the receiver |
| **Hand-over** | Transfer of goods from one partner to the next, confirmed on both phones |
| **Manifest** | List of bags and shipments loaded onto one vehicle |
| **Masked call** | Phone call through a proxy number so neither side sees the other’s number |
| **NDR** | Non-delivery report: a failed delivery attempt |
| **RTO** | Return to origin |
| **Seal** | Numbered tamper-evident seal on a bag or truck door |
