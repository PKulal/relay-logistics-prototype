/** Logisco staff — ERP personas (docs/seed-data.md §7, ERP spec §3.1). Emails INVENTED. */
import type { StaffUser } from '@shared/types'

export const staff: StaffUser[] = [
  { id: 'LS-RAHUL', name: 'Rahul Khanna', title: 'CEO', role: 'leadership', email: 'rahul.khanna@logisco.in' },
  { id: 'LS-ARJUN', name: 'Arjun Mehta', title: 'Key Account Manager', role: 'sales', email: 'arjun.mehta@logisco.in' },
  { id: 'LS-DIVYA', name: 'Divya Nair', title: 'Pricing Head', role: 'pricing', email: 'divya.nair@logisco.in' },
  { id: 'LS-FARAH', name: 'Farah Khan', title: 'Customer Success Agent', role: 'customerSuccess', email: 'farah.khan@logisco.in' },
  { id: 'LS-MEERA', name: 'Meera Iyer', title: 'Partner Onboarding Coordinator', role: 'partnerManagement', email: 'meera.iyer@logisco.in' },
  { id: 'LS-KARTHIK', name: 'Karthik Rao', title: 'Network Planner', role: 'networkPlanning', email: 'karthik.rao@logisco.in' },
  { id: 'LS-SANJAY', name: 'Sanjay Rao', title: 'Control Tower Operator', role: 'controlTower', email: 'sanjay.rao@logisco.in' },
  { id: 'LS-POOJA', name: 'Pooja Menon', title: 'Hub Ops Coordinator', role: 'hubOps', email: 'pooja.menon@logisco.in' },
  { id: 'LS-LAKSHMI', name: 'Lakshmi N.', title: 'Finance Executive', role: 'finance', email: 'lakshmi.n@logisco.in' },
  { id: 'LS-FARHAN', name: 'Farhan Ali', title: 'Claims Officer', role: 'claims', email: 'farhan.ali@logisco.in' },
  { id: 'LS-NEETA', name: 'Neeta Joshi', title: 'Compliance Officer', role: 'compliance', email: 'neeta.joshi@logisco.in' },
  { id: 'LS-KIRAN', name: 'Kiran P.', title: 'Hub Auditor', role: 'hubAuditor', email: 'kiran.p@logisco.in' },
  { id: 'LS-ADMIN', name: 'Admin', title: 'Super Admin', role: 'superAdmin', email: 'admin@logisco.in' },
]
