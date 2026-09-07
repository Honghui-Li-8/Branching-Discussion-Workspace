// Composer sizing and model constants. Kept out of ConversationComposer.tsx so that
// module exports only a component and Fast Refresh can hot-swap it cleanly.
export const CHAT_INPUT_MIN_HEIGHT = 24
export const CHAT_INPUT_MAX_LINES = 10
export const CHAT_INPUT_MAX_HEIGHT = CHAT_INPUT_MIN_HEIGHT * CHAT_INPUT_MAX_LINES
export const CHAT_MODELS = ['gpt-5', 'gpt-4o', 'gpt-4.1', 'gpt-4']
