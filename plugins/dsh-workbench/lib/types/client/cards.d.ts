/**
 * Workspace card types shared between the inject face and the panel.
 *
 * The workbench panel does not get a runtime "is this Workspace running?"
 * signal from the Host, so the card runs a small local state machine on top
 * of the injected `openWorkspace` Promise. The status moves through three
 * states — `idle` before the operator has opened it, `running` while the open
 * is in flight, and `completed` once the Host has answered — and the panel
 * draws the running/completed/idle states from that local fact alone.
 *
 * When the composition eventually ships a real "session is active" signal,
 * the same three strings stay the right vocabulary; only the writes into this
 * state machine change.
 */
/** One card's local state. */
export type CardStatus = 'idle' | 'running' | 'completed';
//# sourceMappingURL=cards.d.ts.map