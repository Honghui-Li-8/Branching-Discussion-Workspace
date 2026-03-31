import { buildPlaceholderAssistantReply } from '../../utils/placeholderModelReply.js'
import type { AssistantProvider } from './provider.js'
import { emitTokenDeltas } from './tokenDeltas.js'

export const createPlaceholderProvider = (): AssistantProvider => ({
  id: 'placeholder',
  generate: async (input) => {
    const content = buildPlaceholderAssistantReply(input.context.userInput)
    await emitTokenDeltas(content, input.onTokenDelta)

    return {
      content,
      finishReason: 'stop',
      providerResponseId: null,
    }
  },
})
