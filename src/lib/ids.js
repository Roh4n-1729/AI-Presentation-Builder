import { customAlphabet } from 'nanoid';

// Short, prefixed ids: cheap in LLM tokens, easy to read in traces, and unambiguous
// (no 0/o/1/l). 32^5 ≈ 33M combinations is plenty for one deck.
const nano = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 5);

export const slideId = () => `s_${nano()}`;
export const elementId = () => `el_${nano()}`;
export const turnId = () => `t_${nano()}`;
