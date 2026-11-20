/**
 * The AI decision log (ERP-43). Source §12 guardrails: every AI decision is
 * logged with its reason; a person confirms anything that acts.
 */
import type { AiDecision, DemoData, Id } from '@shared/types'

export const MODEL_OF: Record<AiDecision['kind'], string> = {
  legAssignment: 'assignment-v1',
  marginCheck: 'margin-check-v1',
  etaPrediction: 'eta-v1',
  assistant: 'assistant-v1',
  creditRisk: 'credit-risk-v1',
  leadScore: 'lead-score-v1',
  skuOutlier: 'sku-outlier-v1',
  documentOcr: 'doc-ocr-v1',
  weightCheck: 'weight-check-v1',
}

/** Add one decision; returns the data and its id. */
export function logAi(data: DemoData, d: Omit<AiDecision, 'id' | 'model'> & { model?: string }): { data: DemoData; id: Id } {
  const id = `AI-X-${String(Object.keys(data.aiDecisions).filter((k) => k.startsWith('AI-X-')).length + 1).padStart(5, '0')}`
  return { data: { ...data, aiDecisions: { ...data.aiDecisions, [id]: { ...d, id, model: d.model ?? MODEL_OF[d.kind] } } }, id }
}

export const logAiData = (data: DemoData, d: Omit<AiDecision, 'id' | 'model'>) => logAi(data, d).data

/** The person confirmed what the AI prepared. */
export function acceptAi(data: DemoData, id: Id, userId: Id): DemoData {
  const d = data.aiDecisions[id]
  if (!d || d.acceptedByUserId) return data
  return { ...data, aiDecisions: { ...data.aiDecisions, [id]: { ...d, acceptedByUserId: userId } } }
}
