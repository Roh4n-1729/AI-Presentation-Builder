/**
 * Typed op failure. AI tools turn it into a tool result ({ ok: false, error }) so the model can
 * correct itself; the client store skips the op and shows a notice (D2, D11).
 *   NOT_FOUND  target slide/element doesn't exist (e.g. the user deleted it mid-stream)
 *   LOCKED     target element is locked
 *   INVALID    op or resulting element fails validation
 *   CONFLICT   an id the op wants to create already exists
 */
export class OpError extends Error {
  /** @param {'NOT_FOUND'|'LOCKED'|'INVALID'|'CONFLICT'} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'OpError';
    this.code = code;
  }
}
