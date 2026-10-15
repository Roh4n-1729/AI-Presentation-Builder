import { customAlphabet } from 'nanoid';

// Short, prefixed ids: cheap in LLM tokens, easy to read in traces, and unambiguous
// (no 0/o/1/l). 7 chars = 32^7 ≈ 34 billion: ids are minted on client and server without
// seeing each other, so collisions must be negligible (5 chars gave a ~6% chance of one
// repeat in 2,000 ids, which the test below caught).
const nano = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 7);

export const slideId = () => `s_${nano()}`;
export const elementId = () => `el_${nano()}`;
export const turnId = () => `t_${nano()}`;
