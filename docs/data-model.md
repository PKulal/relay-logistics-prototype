# Data model (frontend store)

One store shared by all four apps (Zustand, persisted to `localStorage` under the key `logisco-demo-v1`, synced across tabs with `BroadcastChannel('logisco')`). Every entity has `id: string`, and records that change carry `updatedAt` (from `demoNow`). Types live in `src/shared/types.ts`. This is a guide, not a contract: add fields when a spec screen needs them, and keep names consistent.

## Master data

| Entity | Key fields |
|---|---|
| `Pincode` | code, area, city, state, zone (A–E), oda: boolean, serviceable: boolean |
| `Lane` | id, originRegion, destRegion, originHubId, destHubId, distanceKm, transitDays per service, departureTime, lineHaulPartnerIds[] |
| `Hub` | id, partnerId, name, address, pincode, docks, hours, auditStatus |
| `CustomerRateCard` | id, customerId?, type (standard / negotiated / contract), parcel grid (zone × tier: first, additional), ptl lines (lane, service, perKg, minKg, cftFactor), surcharges, validFrom, validTo, status |
| `PartnerRateLine` | id, partnerId, legType, laneOrCluster, service, rate, unit (perShipment / perKg / perTrip / perPiece / storagePerDay), minimum |
| `Settings` | all values in seed-data.md §9 |

## Customers

| Entity | Key fields |
|---|---|
| `Customer` | id, legalName, gstin, pan, cin?, type (SME / Manufacturer / Distributor / Brand / Enterprise / Marketplace), track, status (lead → … → live), billing (prepaid / credit), creditLimit, creditTermsDays, walletBalance, kamId?, rateCardId, branding |
| `CustomerUser` | id, customerId, name, email, mobile, role (admin / dispatch / finance), locationIds[], language |
| `PickupLocation` | id, customerId, name, address, pincode, lat, lng, contact, window, days, isDefault |
| `Consignee` | id, customerId, type, company, contact, mobile, address, pincode, gstin?, appointmentRequired |
| `Sku` | id, customerId, code, description, l, b, h, weight, hsn, unitValue, status (draft / flagged / frozen) |
| `Lead` | id, company, source, aiScore, stage, ownerId |

## Partners

| Entity | Key fields |
|---|---|
| `Partner` | id, name, type (A–F), legs[], services[], gstin, pan, status (applied … live / probation / suspended / offboarded), tier, score, capacityPerDay, coveragePincodes[], laneIds[], coordinatorId |
| `PartnerApplication` | id, partnerId, ref, fitScore, fitReason, status, documents[] |
| `PartnerUser` | id, partnerId, name, mobile, email, role (admin / operations / finance) |
| `FieldStaff` | id, partnerId, name, mobile, role (rider / driver / hub), vehicleId?, hubId?, licenceValidTill?, policeVerified, trained, onDuty |
| `Vehicle` | id, partnerId, regNo, type, payloadKg, fastagId?, gpsId?, docExpiry |
| `WeeklyScore` | id, partnerId, week, profile (parcel / ptl), kpis {pickup, onTime, firstAttempt, damagePer10k, scanCompliance, responsiveness}, total, tierBefore, tierAfter |

## Shipments (the core)

| Entity | Key fields |
|---|---|
| `Shipment` (master) | id = LR, customerId, bookedByUserId, pickupLocationId, consigneeId, service, tier?, paymentMode, codAmount?, addOns, invoice {no, date, value, po, fileUrl}, hsn, ewb {no, validTill, partBUpdated}, pieces[], weights {actual, volumetricOrCft, chargeable, verifiedChargeable?}, price {lines[], subtotal, gst, total}, status (customer status list), eta, appointment?, legIds[] |
| `Piece` | id (LR-01…), dims, weight, verifiedDims?, verifiedWeight?, condition |
| `Leg` | id = JOB-…-Ln, shipmentId, seq (1–5), type (firstMile / originHub / lineHaul / destHub / lastMile), partnerId, staffId?, vehicleId?, status (offered / accepted / flagged / withdrawn / assigned / inProgress / handedOver / delivered / failedAttempt / exception / closed), window, slaDueAt, cost, tripId? |
| `Trip` | id, legIds[], laneId, vehicleId, driverId, sealNos[], departAt, eta, positions[], halts[] |
| `Manifest` / `Bag` | id, hubId, destination, pieceIds[], sealNo, vehicleId?, status |
| `Event` (chain of custody) | id, shipmentId, legId?, type, at (phone time), by (staffId / userId), app (customer / partnerPortal / partnerApp / erp), lat?, lng?, pieceIds[], sealNos[], vehicleNo?, photos[], counterpartStaffId?, note |

**Rule:** apps never set `Shipment.status` directly. They add an `Event`; a single reducer in `src/shared/engines/status.ts` maps events → leg status → shipment status (see the Partner App spec, Section 8). This keeps all four apps consistent.

## Exceptions, claims, money

| Entity | Key fields |
|---|---|
| `Exception` | id, shipmentId, legId?, type, raisedAt, actionDueAt, ownerPartnerId?, rootCause, status, customerConfirmed |
| `WeightRevision` | id, shipmentId, booked, verified, amountDiff, photos[], status (pending / accepted / disputed / autoAccepted) |
| `Ndr` | id, shipmentId, attempt, reason, photo, at, customerChoice?, choiceBy? |
| `Claim` | id, shipmentId, customerId, type, pieceIds[], amountClaimed, amountApproved?, liableLegId?, liablePartnerId?, recovery {partner, insurer}, status, settleBy |
| `Invoice` / `CreditNote` | id, customerId, period, lines[], taxable, gst, total, dueDate, status, irn? |
| `WalletTxn` | id, customerId, type, ref, amount, balanceAfter, at |
| `CodRecord` | id, shipmentId, amount, collectedBy, collectedAt, depositedAt?, remittedAt?, status |
| `PartnerInvoice` | id, partnerId, cycle, mode (self-billed / uploaded), lines [{legId, rate, verifiedWeight, billed, matched, result}], status |
| `Payout` | id, batchId, partnerId, gross, deductions[], net, utr?, status |
| `Ticket` | id, raisedBy, app, category, shipmentId?, status, thread[] |

## Cross-cutting

| Entity | Key fields |
|---|---|
| `Notification` | id, audience (app + user / role), title, body, link, read |
| `AiDecision` | id, model, recordId, decision, reason, confidence, acceptedByUserId? |
| `AuditLog` | id, userId, app, action, recordId, before?, after? |

## Engines (pure functions in `src/shared/engines/`)

| File | Does |
|---|---|
| `chargeableWeight.ts` | Parcel: max(actual, L×B×H/5000) per piece, round up to 0.5 kg. PTL: max(actual, cuft × CFT factor, minimum) |
| `pricing.ts` | Price build-up lines from rate card + add-ons; GST; total |
| `assignment.ts` | Eligible partners per leg (pincode / lane, tier offered, capacity) → sort score ↓, cost ↑, transit ↑ |
| `margin.ts` | Leg costs, insurance pass-through, risk buffer, margin vs target |
| `status.ts` | Event → leg status → shipment status |
| `scoring.ts` | Weekly KPI points and tier rules |
| `threeWayMatch.ts` | Billed vs rate × verified weight × e-POD |
| `liability.ts` | First leg where piece count or seal breaks in the event chain |
| `ewayBill.ts` | Required? validity days = ceil(km / 200) |

Write unit tests for every engine using the numbers in seed-data.md §3 (e.g. pricing must return ₹3,628.26 for LGS-DEL-000781).
