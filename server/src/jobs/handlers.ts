import type { ConversationPostprocessJobRecord } from '../db/models/conversationPostprocessJob.js'

export type JobHandler = (job: ConversationPostprocessJobRecord) => Promise<void>

export const summarizeTurn: JobHandler = async (_job) => {}

export const indexTurn: JobHandler = async (_job) => {}
