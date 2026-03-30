import { buildPlaceholderAssistantReply } from '../../utils/placeholderModelReply.js'
import type { AssistantProvider } from './provider.js'

export const createPlaceholderProvider = (): AssistantProvider => ({
  id: 'placeholder',
  generate: async (input) => ({
    content: buildPlaceholderAssistantReply(input.context.userInput),
    finishReason: 'stop',
    providerResponseId: null,
  }),
})
