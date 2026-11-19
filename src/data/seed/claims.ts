/**
 * Claim under investigation (CP-22 prototype note: "one settled claim and one
 * under investigation"). INVENTED: CLM-2026-0151 on the generated shipment
 * LGS-DEL-000667 (Sharma Electricals), whose piece 3 was scanned in at NCR
 * CrossDock but not sealed out. Not insured: capped at ₹100 / kg × 15 kg = ₹1,500.
 */
import type { DemoData } from '@shared/types'

export function addInvestigatingClaim(data: DemoData): DemoData {
  const lr = 'LGS-DEL-000667'
  const s = data.shipments[lr]
  if (!s || s.customerId !== 'C-SHARMA') return data
  const piece = 'LGS-DEL-000667-03'
  return {
    ...data,
    shipments: { ...data.shipments, [lr]: { ...s, pieces: s.pieces.map((p) => (p.id === piece ? { ...p, condition: 'missing' } : p)) } },
    claims: {
      ...data.claims,
      'CLM-2026-0151': {
        id: 'CLM-2026-0151',
        shipmentId: lr,
        customerId: 'C-SHARMA',
        type: 'shortage',
        pieceIds: [piece],
        amountClaimed: 1500,
        description: 'Box 3 of 3 missing at delivery; GRN signed "2 of 3 received"',
        files: ['grn_0667.jpg'],
        raisedBy: 'CU-PRIYA',
        liableLegId: 'JOB-000667-L2',
        liablePartnerId: 'P-NCRXD',
        recovery: { partner: 0, insurer: 0 },
        raisedAt: '2026-11-20T09:30:00+05:30',
        settleBy: '2026-11-27',
        status: 'investigating',
      },
    },
  }
}
