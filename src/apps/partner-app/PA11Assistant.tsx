/**
 * PA-11 AI assistant — docs/03-partner-app.md. Source §4 Step 6 ("AI assistant
 * answers 'how do I…' questions inside the app"), §12. Voice or text, Hindi or
 * English; the answer is spoken when voice prompts are on (PA-13). It guides
 * only: it can't complete a delivery or change COD.
 */
import { useTranslation } from 'react-i18next'
import { AssistantChat } from '@shared/ui/Assistant'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useFieldSession } from './useFieldSession'

export default function PA11Assistant() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <h1 className="flex items-center gap-2 font-heading text-[22px] font-bold">
        {t('ai.title')} <SimulatedTag />
      </h1>
      <AssistantChat ctx={{ app: 'partnerApp', userId: staff.id, role: staff.role, partnerId: staff.partnerId }} voice={staff.voicePrompts !== false} className="min-h-0 flex-1" />
    </div>
  )
}
