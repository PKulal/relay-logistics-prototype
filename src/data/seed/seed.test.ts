/**
 * Seed integrity: every reference resolves, and the values the demo depends on
 * match docs/seed-data.md exactly.
 */
import { buildSeed, DEMO_START } from './index'

const seed = buildSeed()

describe('seed matches seed-data.md', () => {
  it('opens on Monday 23-Nov-2026 10:00 IST', () => {
    expect(DEMO_START).toBe('2026-11-23T10:00:00+05:30')
  })

  it('has Sharma Electricals with the documented credit position', () => {
    const c = seed.customers['C-SHARMA']
    expect(c.legalName).toBe('Sharma Electricals Pvt Ltd')
    expect(c.gstin).toBe('07AABCS1234F1Z5')
    expect(c.creditLimit - c.creditUsed).toBe(155800)
    expect(c.creditTermsDays).toBe(30)
    expect(c.kamId).toBe('LS-ARJUN')
  })

  it('has Kaveri Handicrafts on prepaid with ₹8,450 in the wallet', () => {
    expect(seed.customers['C-KAVERI'].walletBalance).toBe(8450)
    expect(seed.customers['C-KAVERI'].billing).toBe('prepaid')
  })

  it('has the hero consignee', () => {
    const cn = seed.consignees['CN-HED']
    expect(cn.contact).toBe('Mahesh Patil')
    expect(cn.gstin).toBe('29AAFFH5678K1Z2')
    expect(cn.pincode).toBe('580030')
  })

  it('has the partner tiers and scores from §6', () => {
    const p = (id: string) => [seed.partners[id].tier, seed.partners[id].score]
    expect(p('P-SWIFTCITY')).toEqual(['gold', 86])
    expect(p('P-METRODASH')).toEqual(['platinum', 92])
    expect(p('P-QUICKLINK')).toEqual(['silver', 74])
    expect(p('P-NCRXD')).toEqual(['silver', 76])
    expect(p('P-HUBLIWH')).toEqual(['gold', 82])
    expect(p('P-NKEXP')).toEqual(['silver', 78])
    expect(p('P-FASTTRACK')).toEqual(['bronze', 61])
    expect(seed.partners['P-DECCAN']).toMatchObject({ status: 'trial', tier: null, trial: { tripsDone: 2, tripsRequired: 3 } })
  })

  it('has MetroDash at capacity', () => {
    const m = seed.partners['P-METRODASH']
    expect(m.baseLoadToday).toBeGreaterThanOrEqual(m.capacityPerDay)
  })

  it('has the hero partner rates', () => {
    const rate = (partnerId: string, legType: string) =>
      Object.values(seed.partnerRates).find(
        (r) => r.partnerId === partnerId && r.legType === legType && r.serviceKind !== 'parcel',
      )
    expect(rate('P-SWIFTCITY', 'firstMile')).toMatchObject({ rate: 250, unit: 'perShipment' })
    expect(rate('P-QUICKLINK', 'firstMile')).toMatchObject({ rate: 220 })
    expect(rate('P-NCRXD', 'originHub')).toMatchObject({ rate: 1, unit: 'perKg', minimum: 150 })
    expect(rate('P-DECCAN', 'lineHaul')).toMatchObject({ rate: 9, unit: 'perKg', minKg: 50, laneOrCluster: 'LN-DEL-HBL' })
    expect(rate('P-HUBLIWH', 'destHub')).toMatchObject({ rate: 1, minimum: 150 })
    expect(rate('P-NKEXP', 'lastMile')).toMatchObject({ rate: 300 })
  })

  it('has the Delhi → Hubballi lane and the Sharma contract rate', () => {
    expect(seed.lanes['LN-DEL-HBL']).toMatchObject({ distanceKm: 1880, departureTime: '23:00', originHubId: 'HUB-GGN', destHubId: 'HUB-HBL' })
    expect(seed.lanes['LN-DEL-HBL'].transitDays.expressPtl).toBe(3)
    const line = seed.rateCards['RC-SHARMA-2026'].ptl.find((l) => l.laneId === 'LN-DEL-HBL' && l.service === 'expressPtl')
    expect(line).toEqual({ laneId: 'LN-DEL-HBL', service: 'expressPtl', perKg: 14, minKg: 50, cftFactor: 8 })
  })

  it('has the standard parcel rate for Zone D Standard', () => {
    expect(seed.rateCards['RC-STANDARD'].parcel.D.standard).toEqual({ first: 55, additional: 25 })
  })

  it('has every ERP persona', () => {
    expect(Object.values(seed.staff).map((s) => s.name)).toEqual([
      'Rahul Khanna', 'Arjun Mehta', 'Divya Nair', 'Farah Khan', 'Meera Iyer', 'Karthik Rao', 'Sanjay Rao',
      'Pooja Menon', 'Lakshmi N.', 'Farhan Ali', 'Neeta Joshi', 'Kiran P.', 'Admin',
    ])
  })

  it('has the field personas with the right partners', () => {
    expect(seed.fieldStaff['FS-RAVI']).toMatchObject({ partnerId: 'P-SWIFTCITY', role: 'rider', mobile: '98730 44556', vehicleId: 'V-DL01LT4521' })
    expect(seed.fieldStaff['FS-POOJA']).toMatchObject({ partnerId: 'P-NCRXD', role: 'hub' })
    expect(seed.fieldStaff['FS-BASAVARAJ']).toMatchObject({ partnerId: 'P-DECCAN', role: 'driver', vehicleId: 'V-KA25AB1234' })
    expect(seed.fieldStaff['FS-MANJU']).toMatchObject({ partnerId: 'P-NKEXP', role: 'rider' })
  })

  it('has the §9 settings', () => {
    expect(seed.settings).toMatchObject({
      ewayBillThreshold: 50000,
      targetMarginPct: 15,
      riskBufferPct: 2,
      pickupCutoff: '14:00',
      trialPassMark: 80,
      tierBands: { platinum: 90, gold: 80, silver: 70, bronze: 60 },
    })
  })

  it('reserves LGS-DEL-000781 for the live hero booking', () => {
    expect(seed.lrSerials.DEL).toBe(781)
    expect(seed.shipments['LGS-DEL-000781']).toBeUndefined()
  })
})

describe('seed integrity', () => {
  it('uses each record id as its key', () => {
    for (const [name, collection] of Object.entries(seed)) {
      if (name === 'settings' || name === 'lrSerials') continue
      for (const [key, record] of Object.entries(collection as Record<string, { id: string }>)) {
        expect(record.id, `${name}.${key}`).toBe(key)
      }
    }
  })

  it('resolves every cross-reference', () => {
    const missing: string[] = []
    const check = (label: string, collection: Record<string, unknown>, id: string | undefined) => {
      if (id && !collection[id]) missing.push(`${label} → ${id}`)
    }
    for (const p of Object.values(seed.pincodes)) check(`pincode ${p.code} hub`, seed.hubs, p.hubId)
    for (const h of Object.values(seed.hubs)) {
      check(`hub ${h.id} partner`, seed.partners, h.partnerId)
      check(`hub ${h.id} pincode`, seed.pincodes, h.pincode)
    }
    for (const l of Object.values(seed.lanes)) {
      check(`lane ${l.id}`, seed.hubs, l.originHubId)
      check(`lane ${l.id}`, seed.hubs, l.destHubId)
      l.lineHaulPartnerIds.forEach((p) => check(`lane ${l.id}`, seed.partners, p))
    }
    for (const rc of Object.values(seed.rateCards)) rc.ptl.forEach((line) => check(`rate card ${rc.id}`, seed.lanes, line.laneId))
    for (const r of Object.values(seed.partnerRates)) check(`rate ${r.id}`, seed.partners, r.partnerId)
    for (const c of Object.values(seed.customers)) {
      check(`customer ${c.id} rate card`, seed.rateCards, c.rateCardId)
      check(`customer ${c.id} KAM`, seed.staff, c.kamId)
    }
    for (const u of Object.values(seed.customerUsers)) {
      check(`user ${u.id}`, seed.customers, u.customerId)
      u.locationIds.forEach((l) => check(`user ${u.id} location`, seed.pickupLocations, l))
    }
    for (const l of Object.values(seed.pickupLocations)) check(`location ${l.id} pincode`, seed.pincodes, l.pincode)
    for (const c of Object.values(seed.consignees)) check(`consignee ${c.id} pincode`, seed.pincodes, c.pincode)
    for (const p of Object.values(seed.partners)) {
      p.coveragePincodes.forEach((pc) => check(`partner ${p.id} coverage`, seed.pincodes, pc))
      p.laneIds.forEach((l) => check(`partner ${p.id} lane`, seed.lanes, l))
      p.hubIds.forEach((h) => check(`partner ${p.id} hub`, seed.hubs, h))
      check(`partner ${p.id} coordinator`, seed.staff, p.coordinatorId)
    }
    for (const u of Object.values(seed.partnerUsers)) check(`partner user ${u.id}`, seed.partners, u.partnerId)
    for (const f of Object.values(seed.fieldStaff)) {
      check(`staff ${f.id}`, seed.partners, f.partnerId)
      check(`staff ${f.id} vehicle`, seed.vehicles, f.vehicleId)
      check(`staff ${f.id} hub`, seed.hubs, f.hubId)
    }
    expect(missing).toEqual([])
  })

  it('gives every partner a Partner Portal admin', () => {
    const withAdmin = new Set(Object.values(seed.partnerUsers).filter((u) => u.role === 'admin').map((u) => u.partnerId))
    expect(Object.keys(seed.partners).filter((id) => !withAdmin.has(id))).toEqual([])
  })

  it('covers partner types A–F', () => {
    expect(new Set(Object.values(seed.partners).map((p) => p.type))).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']))
  })

  it('never uses a GSTIN that is meant to fail verification (ends in Z9)', () => {
    const gstins = [...Object.values(seed.customers), ...Object.values(seed.partners), ...Object.values(seed.consignees)]
      .map((r) => r.gstin)
      .filter(Boolean)
    expect(gstins.filter((g) => g!.endsWith('Z9'))).toEqual([])
  })

  it('returns a fresh copy on every call', () => {
    const a = buildSeed()
    a.customers['C-KAVERI'].walletBalance = 0
    expect(buildSeed().customers['C-KAVERI'].walletBalance).toBe(8450)
  })
})
