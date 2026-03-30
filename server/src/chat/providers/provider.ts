import type {
  GenerateAssistantInput,
  GenerateAssistantResult,
} from '../types.js'

export interface AssistantProvider {
  readonly id: string
  generate: (input: GenerateAssistantInput) => Promise<GenerateAssistantResult>
}
