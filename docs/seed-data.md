# Seed data and demo story

Every app reads from one shared store that is loaded from seed JSON in `src/data/`. Use **exactly** the names, IDs and numbers below so the four apps and the four specs agree. All companies, people, GSTINs and numbers are invented for the demo.

## 1. Demo clock

- The demo opens on **Monday 23-Nov-2026, 10:00 IST** (booking day for the hero shipment). Store this as `demoNow` in the store, not `Date.now()`.
- The demo toolbar can advance time (+1 h, +1 day). SLA timers, ETAs and statuses use `demoNow`.

## 2. Fixed simulated values

| Item | Value |
|---|---|
| Login / sign-up / e-sign OTP (all apps) | `123456` |
| Delivery OTP (Partner App) | `1234` |
| Any password for a seeded user | accepted |
| GSTIN that fails verification | any GSTIN ending in `Z9` |
| IFSC that fails penny-drop | `FAIL0000000` |
| LR format | `LGS-<origin code>-<6 digits>` e.g. `LGS-DEL-000781` |
| Job (leg) ID format | `JOB-<LR serial>-L<leg>` e.g. `JOB-000781-L1` |
| Seal format | `SL-#####` |

## 3. Hero shipment: LGS-DEL-000781

| Field | Value |
|---|---|
| Customer | Sharma Electricals Pvt Ltd (credit / TBB) |
| Booked by | Priya Sharma, Mon 23-Nov-2026 10:05 |
| From | Okhla Factory, Plot 42, Okhla Industrial Area Phase II, New Delhi 110020 |
| To | Hubli Electric Distributors, Shop 14, APMC Yard, Amargol, Hubballi 580030 (Mahesh Patil, 94480 12345, GSTIN 29AAFFH5678K1Z2) |
| Service | Express PTL, appointment delivery, transit insurance |
| Pieces | 6 cartons, 60 × 40 × 40 cm, 20 kg each (SKU SG-LT-400 “LT switchgear panel 400A”, HSN 8537) |
| Weights | Actual 120 kg · CFT 20.3 cu ft × 8 = 162 kg · **Chargeable 162 kg** |
| Invoice | SE/25-26/1187, 23-Nov-2026, ₹1,80,000, PO HED/PO/3321 |
| E-way bill | 3410 2256 7781, distance 1,880 km → valid 10 days (till 03-Dec) |
| Pickup slot | Mon 23-Nov 14:00–16:00 |
| ETA | Thu 26-Nov; appointment slot 11:00–13:00, Dock 2 |
| Seal | SL-44817 (bag BAG 07, manifest MAN-GGN-1123) |
| Trip | TRP-2026-0931, Gurugram hub → Hubballi hub, departs 23-Nov 23:00, truck KA25AB1234 |
| Delivery | Received by Mahesh Patil, OTP verified, GRN-HED-55120, 26-Nov 11:12 |

### Price (customer)

| Line | Amount |
|---|---|
| Freight 162 kg × ₹14.00 | ₹2,268.00 |
| Fuel 10% | ₹226.80 |
| Docket / LR | ₹100.00 |
| Appointment delivery | ₹300.00 |
| Insurance / FOV 0.1% of ₹1,80,000 | ₹180.00 |
| **Subtotal** | **₹3,074.80** |
| GST 18% (assumed rate) | ₹553.46 |
| **Total** | **₹3,628.26** |

### Legs and partner costs

| Leg | Partner (type, tier) | Person | Rate | Cost |
|---|---|---|---|---|
| L1 First mile | SwiftCity Couriers (B, Gold 86) | Ravi Kumar, rider | ₹250 per PTL pickup up to 200 kg | ₹250 |
| L2 Origin hub | NCR CrossDock, Gurugram (F, Silver 76) | Pooja S., hub staff | ₹1.00 / kg, min ₹150 | ₹162 |
| L3 Line-haul | Deccan Roadlines (E, in trial → Bronze) | Basavaraj H., driver | ₹9.00 / kg, min 50 kg | ₹1,458 |
| L4 Destination hub | Hubli Warehousing, Hubballi (F, Gold 82) | — | ₹1.00 / kg, min ₹150 | ₹162 |
| L5 Last mile | NK Express, Hubballi (B, Silver 78) | Manju R., rider | ₹300 per PTL delivery with appointment | ₹300 |
| | | | **Total leg cost** | **₹2,332** |

Margin: ₹3,074.80 − ₹2,332.00 − ₹180.00 insurance = **₹562.80 (18.3%)**. Risk buffer 2% = ₹61.50 → **₹501.30 (16.3%)**, above the 15% target.

### Variants of the hero shipment (demo buttons)

- **Weight revision:** rider measures two boxes larger → chargeable 170 kg → new total ₹3,773.64 → **+ ₹145.38**.
- **Line-haul halt:** 3-hour traffic halt near Nagpur at 06:00 on 24-Nov → ETA revised, SLA amber.
- **Deccan overbilling:** Deccan bills 170 kg × ₹9 = ₹1,530 vs matched ₹1,458 → **₹72** dispute.

## 4. Other key shipments

| LR | Purpose in the demo |
|---|---|
| LGS-DEL-000784 | Open weight revision (Customer Portal CP-20) |
| LGS-DEL-000776 | Failed delivery: premises closed; customer chooses new slot 27-Nov 11:00–13:00 |
| LGS-DEL-000769 | Settled shortage claim CLM-2026-0142: piece 4 of 6 missing at origin hub (6 in, 5 sealed out); ₹30,000 to customer as credit note CN-2026-0088; recovery ₹10,000 from NCR CrossDock payout + ₹20,000 insurer (INS-88213) |
| LGS-DEL-000790 | At-risk pickup (78% risk, SwiftCity rider has 7 pending pickups) → reassign to QuickLink Express |
| LGS-MYS-000112 | Kaveri Handicrafts parcel, Mysuru 570001 → Pune 411001, 1 box 40×30×30 cm, 6 kg → 7.5 kg chargeable → ₹561.09 from wallet |

Plus about 120 more shipments over 8 lanes and all statuses (generate with a seeded script so the data is the same every reset).

## 5. Customers

### Sharma Electricals Pvt Ltd (Manufacturer, credit, live)
- GSTIN 07AABCS1234F1Z5 · PAN AABCS1234F · CIN U31200DL2008PTC123456 · Private Ltd
- Bank: HDFC Bank, Okhla, IFSC HDFC0001234, a/c 50200012345678
- Signatory: Rajesh Sharma, Director (rajesh@sharmaelectricals.in, 98110 45678)
- Users: **Priya Sharma** (Admin, Logistics Head, priya@sharmaelectricals.in, 98100 23456) · **Ramesh Kumar** (Dispatch, 98730 11223) · **Kavita Rao** (Finance, kavita@sharmaelectricals.in, 99100 77881)
- Pickup locations: Okhla Factory (default, 10:00–17:00, Mon–Sat) · Manesar Warehouse
- Credit: limit ₹5,00,000, 30 days, deposit ₹50,000 · used ₹3,44,200 · available ₹1,55,800
- Invoices: Oct invoice LGS/DL/25-26/04417 · 412 shipments · ₹2,04,915 + GST ₹36,885 = ₹2,41,800 · due 01-Dec · Unpaid. Plus one Paid and one Overdue earlier invoice. Nov unbilled to date ₹1,02,400.
- COD pending ₹38,400 (next remittance 20-Nov); remitted this month ₹2,12,600
- KAM: Arjun Mehta · Tally connected · 15 saved consignees · 20 SKUs (2 flagged)
- Rate card “Sharma Electricals 2026”: Delhi NCR → Karnataka Express PTL ₹14.00/kg, min 50 kg, CFT 8, 3 days

### Kaveri Handicrafts, Mysuru (SME, prepaid, live)
- Admin: **Suresh Gowda** · wallet ₹8,450 · mostly Parcel · standard rate card (Zone D Standard: first 0.5 kg ₹55, each extra 0.5 kg ₹25)

### New sign-up
- Created live by the reviewer; walks every onboarding step with automatic approvals after short delays.

## 6. Partners

| Partner | Type | Tier / score | Role in the demo | People |
|---|---|---|---|---|
| SwiftCity Couriers Pvt Ltd, Delhi NCR | B | Gold 86 | First-mile pickups; daily ops; payouts; COD | Vikram Singh (Admin, 98111 22334), Neha Verma (Operations), Anil Gupta (Finance); riders incl. Ravi Kumar (98730 44556, vehicle DL01LT4521) |
| MetroDash | B | Platinum 92 | Top-ranked but at capacity → skipped for 000781 | — |
| QuickLink Express | B | Silver 74 | Cheaper backup (₹220); receives the reassigned pickup for 000790 | — |
| NCR CrossDock, Gurugram | F | Silver 76 | Origin hub; hub ops; completed audit; liable for claim 0142 | Pooja S. (hub staff), Rohit Malik (site contact) |
| Deccan Roadlines | E | Trial 84 (2 of 3 trips) → Bronze | Onboarding, flagged insurance, Belagavi rate negotiation, trip, ₹72 mismatch | Basavaraj H. (driver), application APP-2026-0412, coordinator Meera Iyer |
| Hubli Warehousing, Hubballi | F | Gold 82 | Destination hub | — |
| NK Express, Hubballi | B | Silver 78 | Last mile; NDR flow | Manju R. (rider) |
| FastTrack Logistics | B | Bronze 61 → Probation 57 after the scoring run | Tier consequences and suspension case | — |

SwiftCity scorecard (last week, Parcel profile): pickup 96% → 14.4 · on-time 91% → 22.8 · first attempt 88% → 13.2 · damage 4 per 10k → 17.0 · scan compliance 95% → 14.3 · responsiveness 45% → 4.5 · **total 86.2**.
SwiftCity next payout: **₹1,84,063 on 27-Nov** (self-billed SB/SWC/25-26/047: ₹1,56,240 + GST ₹28,123 = ₹1,84,363, less ₹300 deduction).

## 7. Logisco staff (ERP personas)

| Role | Person |
|---|---|
| Leadership | Rahul Khanna, CEO |
| Sales / KAM | Arjun Mehta |
| Pricing Head | Divya Nair |
| Customer Success | Farah Khan |
| Partner Management | Meera Iyer |
| Network Planning | Karthik Rao |
| Control Tower Operator | Sanjay Rao |
| Hub Ops Coordinator | Pooja Menon |
| Finance | Lakshmi N. |
| Claims | Farhan Ali |
| Compliance | Neeta Joshi |
| Hub auditor | Kiran P. |
| Super Admin | Admin |

## 8. Rate cards and surcharges

| Surcharge | Value |
|---|---|
| Fuel | 10% of freight |
| ODA | ₹3/kg, min ₹250 |
| Docket / LR | ₹100 (PTL), ₹30 (Parcel) |
| Appointment delivery | ₹300 |
| COD fee | 1.5%, min ₹50 |
| To-Pay fee | ₹150 |
| Insurance / FOV | 0.1% of declared value |
| Special handling | ₹100 per piece |

Parcel zones (assumed): A within city · B within state · C metro to metro · D rest of India · E special (North-East, J&K). Volumetric divisor 5,000. PTL minimum chargeable 50 kg (Express) / 100 kg (Standard). CFT factor 8.

## 9. Settings (ERP-44) — all assumed unless marked

| Setting | Value |
|---|---|
| E-way bill threshold | ₹50,000 inter-state (source) |
| E-way bill validity | 1 day per 200 km (source) |
| Target margin / risk buffer | 15% / 2% |
| Quote validity | 7 days |
| Pickup cut-off | 14:00 |
| Partner acceptance timer | 30 minutes |
| Arrival geo-fence | 200 m |
| Weight tolerance | 3% or 0.5 kg, whichever is higher |
| NDR max attempts | 3 |
| COD deposit by partner | 24 h (source) |
| COD remittance to shipper | T+2; T+1 top tier (source) |
| Partner invoice dispute SLA | 48 h (source) |
| Claim settlement | 7 days (source) |
| Claim window | 7 days after delivery |
| Early-pay fee | 1% |
| Credit grace before hold | 15 days |
| Trial pass mark | 80 (source) |
| Volume cut when a Bronze partner falls to Probation | 50% of declared capacity (source §5.3; Bronze itself is capped at declared capacity) |
| Tier bands | Platinum ≥ 90, Gold 80–89, Silver 70–79, Bronze 60–69, Probation < 60 (source) |
