let msgSeq = 0;
export const newMessageId = () => `m${Date.now().toString(36)}${(++msgSeq).toString(36)}`;

/**
 * Chat and AI-run state. Messages are plain data (persisted with the deck later, D20).
 *
 * @typedef {{ label: string, slideId: string|null, elementIds: string[] }} OpChip
 * @typedef {{
 *   id: string, role: 'user'|'assistant', text: string,
 *   status?: 'streaming'|'done'|'error'|'stopped', turnId?: string, kind?: 'edit'|'generate',
 *   phase?: string, activity?: string, chips?: OpChip[], skipped?: number, suggestions?: string[], planSuggestions?: string[],
 *   error?: { code: string, message: string, retryAfter?: number }, provider?: string,
 *   progress?: { done: number, total: number }, failedSlides?: string[], retry?: object,
 * }} ChatMessage
 */
export const createChatSlice = () => (set) => ({
  /** @type {ChatMessage[]} */
  messages: [],
  /** true while an AI request streams: undo/redo pause, input shows Stop (D10). */
  aiBusy: false,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg].slice(-200) })),
  /** Shallow-merge a patch (or the result of fn(message)) into one message. */
  patchMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m,
      ),
    })),
  setAiBusy: (aiBusy) => set({ aiBusy }),
  clearChat: () => set({ messages: [] }),
  /** Restore a saved conversation (on load). */
  replaceMessages: (messages) => set({ messages }),
});
