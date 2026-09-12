/**
 * Workbench card vocabulary.
 *
 * A card is a Workspace, so the only card-local state is which of its two faces
 * the user is looking at. Everything else on a card comes from the Host
 * Workspace row.
 */

/** The two faces one Workspace card can show. */
export type CardFace = 'conversation' | 'files'
